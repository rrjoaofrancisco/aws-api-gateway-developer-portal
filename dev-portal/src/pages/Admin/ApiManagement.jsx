import React from 'react'

import { Button, Table, Loader, Popup, Icon } from 'semantic-ui-react'

import { apiGatewayClient } from 'services/api'
import { getApi } from 'services/api-catalog'
import { store } from 'services/state'

import * as YAML from 'yamljs'

import hash from 'object-hash'
import { toJS } from 'mobx'
import { observer } from 'mobx-react'

export const ApiManagement = observer(class ApiManagement extends React.Component {
  state = {
    modalOpen: false,
    errors: [],
    loadingBy: ''
  }

  fileInput = React.createRef()

  componentDidMount() {
    this.getApiVisibility()
  }

  uploadAPISpec = (event) => {
    event.preventDefault();

    const files = this.fileInput.current.files
    let swagger, swaggerObject, anyFailures

    if (files.length > 0) {
      this.setState(prev => ({ ...prev, errors: [] }))

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const reader = new FileReader()

        reader.onload = ((f) => (e) => {
          if (f.name.includes('yaml')) {
            swaggerObject = YAML.parse(e.target.result)
            swagger = JSON.stringify(swaggerObject)
          } else {
            swaggerObject = JSON.parse(e.target.result)
            swagger = JSON.stringify(swaggerObject)
          }

          if (!(swaggerObject.info && swaggerObject.info.title)) {
            anyFailures = true
            this.setState(prev => ({ ...prev, errors: [...prev.errors, file.name] }))
            return
          }

          if (anyFailures) {
            return
          }

          apiGatewayClient()
            .then((app) => app.post('/admin/catalog/visibility', {}, { swagger }, {}))
            .then((res) => {
              if (res.status === 200) {
                this.setState(prev => ({ ...prev, modalOpen: anyFailures, errors: anyFailures ? prev.errors : [] }))
              }
              setTimeout(() => this.getApiVisibility(), 2000)
            })
        })(file);
        reader.readAsText(file);
      }
    }
  }

  deleteAPISpec = (apiId) => {
    getApi(apiId, false, undefined, true).then(api => {
      let _api = toJS(api),
        myHash = hash(_api.swagger)

      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/generic/${myHash}`, {}, {}, {}))
        .then((res) => {
          setTimeout(() => this.getApiVisibility(), 2000)
        })
    })

  }

  getApiVisibility = () => {
    apiGatewayClient()
      .then(app => app.get('/admin/catalog/visibility', {}, {}, {}))
      .then(res => {
        if (res.status === 200) {
          // console.log(`visibility: ${JSON.stringify(res.data, null, 2)}`)

          let apiGateway = res.data.apiGateway
          let generic = res.data.generic && Object.keys(res.data.generic)

          // console.log(`generic: ${JSON.stringify(generic, null, 2)}`)
          // console.log(`api gateway: ${JSON.stringify(apiGateway, null, 2)}`)

          apiGateway.forEach((api, i) => {
            res.data.apiGateway[i].loading = false

            if (generic) {
              generic.forEach(genApi => {
                if (res.data.generic[`${genApi}`]) {
                  if (
                    res.data.generic[`${genApi}`].apiId === api.id &&
                    res.data.generic[`${genApi}`].stage === api.stage
                  ) {
                    api.visibility = true
                    delete res.data.generic[`${genApi}`]
                  }
                }
              })
            }
          })

          store.visibility = res.data
        }
      })
  }

  updateLocalApiGatewayApis = (apisList, updatedApi, parity) => {
    const updatedApis = apisList.map(stateApi => {
      if (stateApi.id === updatedApi.id && stateApi.stage === updatedApi.stage) {
        if(parity !== undefined && (parity === true || parity === false)) {
          stateApi.visibility = parity
        } else {
          stateApi.visibility = !stateApi.visibility
        }
      }
      return stateApi
    })

    store.visibility = { generic: store.visibility.generic, apiGateway: updatedApis }
  }

  showApiGatewayApi = (api, loadingBy) => {
    api.loading = true
    this.setState(prev => ({ ...prev, loadingBy }))

    apiGatewayClient()
      .then(app => app.post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {}))
      .then((res) => {
        if (res.status === 200) {
          api.loading = false
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
        }
      })
  }

  hideApiGatewayApi = (api, loadingBy) => {
    api.loading = true
    this.setState(prev => ({ ...prev, loadingBy }))

    if (!api.subscribable && !api.id && !api.stage) {
      this.deleteAPISpec(api.genericId)
    } else {
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then((res) => {
          if (res.status === 200) {
            api.loading = false
            this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
          }
        })
    }
  }

  showAllApiGatewayApis = (usagePlan) => {
    Promise.all(usagePlan.apis.map((api) =>
        apiGatewayClient()
          .then(app => app.post('/admin/catalog/visibility', {}, {
            apiKey: `${api.id}_${api.stage}`,
            subscribable: `${api.subscribable}`
          }, {}))
          .then(res => { res.api = api; return res })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, true)
        }
      })
    })
  }

  hideAllApiGatewayApis = (usagePlan) => {
    Promise.all(usagePlan.apis.map((api) =>
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then(res => { res.api = api; return res })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, false)
        }
      })
    })
  }

  updateApiGatewayApi = (api, loadingBy) => {
    api.loading = true
    this.setState(prev => ({ ...prev, loadingBy }))

    apiGatewayClient()
      .then(app => {
        app.post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {})
        api.loading = false
      }).catch(() => {
        api.loading = false
      })
  }

  isSdkGenerationConfigurable = (api) => {
    return api.visibility
  }

  toggleSdkGeneration = (apisList, updatedApi) => {
    apiGatewayClient()
      .then(app => {
        if (updatedApi.sdkGeneration) {
          return app.delete(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        } else {
          return app.put(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        }
      })
      .then(res => {
        if (res.status === 200) {
          const updatedApis = apisList.map(stateApi => {
            if (stateApi.id === updatedApi.id && stateApi.stage === updatedApi.stage) {
              stateApi.sdkGeneration = !stateApi.sdkGeneration
            }
            return stateApi
          })

          store.visibility.apiGateway = updatedApis
        }
      })
  }

  tableSort = (first, second) => {
    if (first.name !== second.name) {
      return first.name.localeCompare(second.name)
    } else {
      return first.stage.localeCompare(second.stage)
    }
  }

  genericTableSort = (firstIndex, secondIndex) => {
    const list = store.visibility.generic

    if (list[firstIndex].name !== list[secondIndex].name) {
      list[firstIndex].name.localeCompare(list[secondIndex].name)
    } else {
      // compare by their index, which happens to be their id
      return firstIndex.localeCompare(secondIndex)
    }
  }

  usagePlanSort = (first, second) => {
    if (first.name !== second.name) {
      return first.name.localeCompare(second.name)
    } else {
      return first.id.localeCompare(second.id)
    }
  }

  renderHeaderVisibilityButton(usagePlan, i) {
    let numberOfApis = usagePlan.apis.length,
        numberofVisibleApis = usagePlan.apis.filter((api) => api.visibility === true).length

    // every API is visible, show the "disable" button
    if(numberOfApis === numberofVisibleApis) {
      return (
        <Button key={i}
                color='teal'
                style={{ width: '100%'}}
                onClick={() => this.hideAllApiGatewayApis(usagePlan)}>
            Sim
        </Button>
      )
    }
    // every API is not visible, show the current state (False) and enable on click
    else if(numberofVisibleApis === 0) {
      return (
        <Button color='red'
                key={i}
                style={{ width: '100%'}}
                onClick={() => this.showAllApiGatewayApis(usagePlan)}>
            Não
        </Button>
      )
    }
    // some APIs are visible, some are hidden; show the current state (Partial, with a warning) and enable on click
    else {
      return (
      <Popup content='Os usuários inscritos em qualquer uma das APIs nesse plano de uso terão uma chave de API válida para todas as APIs neste plano de uso, mesmo aquelas que não estiverem visíveis!' trigger={<Button
                              color='yellow'
                              style={{ backgroundColor: 'white', width: '100%', paddingLeft: '1em', paddingRight: '1em', minWidth: '88px' }}
                              onClick={() => this.showAllApiGatewayApis(usagePlan)}>
        Partial <Icon name='warning sign' style={{ paddingLeft: '5px' }} />
      </Button>} />
      )
    }
  }

  sortByUsagePlan() {
    if(!store.visibility.apiGateway)
      return this.renderNoApis()
      console.log(store)

    let usagePlans =
      store.visibility.apiGateway
        .filter((api) => api.usagePlanId)
        .reduce((accumulator, api) => {
          if(!accumulator.find((usagePlan) => api.usagePlanId === usagePlan.id)) {
            accumulator.push({ id: api.usagePlanId, name: api.usagePlanName })
          }
          return accumulator
        }, [])
        .sort(this.usagePlanSort)
        .map((usagePlan) => {
          return { ...usagePlan, apis: store.visibility.apiGateway.filter((api) => {
            return api.usagePlanId === usagePlan.id
          }).sort(this.tableSort) }
        })

    return (
      <React.Fragment>
        {usagePlans.map((usagePlan, i) => {
          return (
            <React.Fragment key={usagePlan.name + '-' + i}>
              {this.renderHeader(usagePlan, i)}
              {usagePlan.apis.map((api, i) => api.id !== window.config.restApiId && this.renderRow(api, 'usagePlan-' + usagePlan.name + '-' + i))}
            </React.Fragment>
          )
        })}
      </React.Fragment>
    )
  }

  renderNoApis = () => {
    return (
      <Table.Row>
        <Table.Cell colSpan='4'>
          Nenhuma API encontrada
        </Table.Cell>
      </Table.Row>
    )
  }

  renderHeader(usagePlan, i) {
    return (
      <Table.Row key={i} style={{'backgroundColor': '#3e6ca5', 'color': 'white'}}>
        <Table.Cell colSpan='3'>
        <i>Plano de Uso</i> - <b>{usagePlan && usagePlan.name}</b>
        </Table.Cell>
        <Table.Cell>
            {this.renderHeaderVisibilityButton(usagePlan, i)}
        </Table.Cell>
        <Table.Cell colSpan='2'>

        </Table.Cell>
      </Table.Row>
    )
  }

  renderRow(api, i) {
    return (
      <Table.Row key={i}>
        <Table.Cell collapsing>{api.name}</Table.Cell>
        <Table.Cell>{api.stage}</Table.Cell>
        <Table.Cell>{api.subscribable ? 'Registrável' : 'Não registrável'}</Table.Cell>
        <Table.Cell>
          {api.loading && this.state.loadingBy === 'displaying' ? (
            <Button basic
              loading
              style={{ marginRight: '0px !important' }}
              color={api.visibility ? 'teal' : 'red'}>
                Loading
            </Button>) : (
            <Button basic
              color={api.visibility ? 'teal' : 'red'}
              disabled={api.loading}
              style={{ width: '94px', marginRight: '0px' }}
              onClick={() => api.visibility ? this.hideApiGatewayApi(api, 'displaying') : this.showApiGatewayApi(api, 'displaying')}>
                {api.visibility && !api.loading ? 'Sim' : 'Não'}
            </Button>)
          }
        </Table.Cell>
        <Table.Cell>
          {api.loading && this.state.loadingBy === 'updating' ? (
            <Button basic
              loading
              color='blue'>
                Loading
            </Button>) : (
            <Button basic
              color='blue'
              disabled={!api.visibility}
              style={{ width: '100%' }}
              onClick={() => this.updateApiGatewayApi(api, 'updating')}>
                Atualizar
            </Button>)
          }
        </Table.Cell>
        <Table.Cell>
          {api.loading && this.state.loadingBy === 'sdk' ? (
            <Button basic loading color={'blue'}>
              Loading
            </Button>) : (
            <Button basic // color={api.sdkGeneration ? 'green' : 'red'}
              color='blue'
              style={{ width: '100%' }}
              disabled={!api.visibility || !this.isSdkGenerationConfigurable(api, 'sdk')}
              onClick={() => this.toggleSdkGeneration(store.visibility.apiGateway, api)}>
                {api.sdkGeneration ? 'Ativado' : 'Desativado'}
            </Button>)
          }
        </Table.Cell>
      </Table.Row>
    )
  }

  render() {
    let unsubscribable =
      store.visibility.apiGateway
        .filter((api) => !api.usagePlanId)
          .sort(this.tableSort)

    return (
      <div style={{ display: 'flex', width: '100%' }}>
        <div style={{ padding: '2em' }}>
          <Table color={'teal'} celled collapsing>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='6'>API Gateway APIs - <b>Registráveis</b></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell collapsing sorted="ascending">Nome da API</Table.HeaderCell>
                <Table.HeaderCell>Estágio</Table.HeaderCell>
                <Table.HeaderCell>Disponibilidade</Table.HeaderCell>
                <Table.HeaderCell>Exibindo</Table.HeaderCell>
                <Table.HeaderCell>Atualizar</Table.HeaderCell>
                <Table.HeaderCell>Permitir geração de SDK</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              { this.sortByUsagePlan() }
            </Table.Body>
          </Table>
        </div>

        <div style={{ padding: '2em' }}>
          <Table color={'red'} celled collapsing>
            {/* <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='4'>APIs genéricas</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='2'>
                  <Modal
                    closeIcon
                    closeOnEscape={true}
                    closeOnDimmerClick={true}
                    onClose={() => this.setState((prev) => ({ ...prev, modalOpen: false }))}
                    trigger={
                      <Button floated='right' onClick={() => this.setState((prev) => ({ ...prev, modalOpen: true }))}>
                        Adicionar API
                    </Button>}
                    open={this.state.modalOpen}
                  >
                    <Modal.Header>Selecione .JSON, .YAML, or .YML files</Modal.Header>
                    <Modal.Content>
                      <React.Fragment>
                        <Form onSubmit={this.uploadAPISpec}>
                          <Form.Field>
                            <label htmlFor="files">Selecione os arquivos:</label>
                            <input type="file" id="files" name="files" accept=".json,.yaml,.yml" multiple={true} ref={this.fileInput} />
                          </Form.Field>
                          {!!this.state.errors.length &&
                            <Message size='tiny' color='red' list={this.state.errors} header="Esses arquivos não são analisáveis ou não contêm um título de API:" />
                          }
                          <br />
                          <Button type='submit'>Upload</Button>
                        </Form>
                      </React.Fragment>
                    </Modal.Content>
                  </Modal>
                </Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell collapsing sorted="ascending">Nome da API</Table.HeaderCell>
                <Table.HeaderCell>Deletar</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {store.visibility.generic ? Object.keys(store.visibility.generic).sort(this.genericTableSort).map((apiId, i) =>
                (
                  <Table.Row key={i}>
                    <Table.Cell collapsing>{store.visibility.generic[apiId].name}</Table.Cell>
                    <Table.Cell>
                      <Button basic
                        color='red'
                        onClick={() => this.deleteAPISpec(apiId)}>
                        Deletar
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                )) : (
                  <Table.Row >
                    <Table.Cell colSpan='4'>
                      Nenhuma API encontrada
                    </Table.Cell>
                  </Table.Row>
                )}
            </Table.Body> */}
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell colSpan='6'>API Gateway APIs - <b>Não registráveis</b> - <i>Nenhum plano de uso</i></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Header fullWidth>
              <Table.Row>
                <Table.HeaderCell collapsing sorted="ascending">Nome da API</Table.HeaderCell>
                <Table.HeaderCell>Estágio</Table.HeaderCell>
                <Table.HeaderCell>Disponibilidade</Table.HeaderCell>
                <Table.HeaderCell>Exibindo</Table.HeaderCell>
                <Table.HeaderCell>Atualizar</Table.HeaderCell>
                <Table.HeaderCell>Permitir geração de SDK</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {unsubscribable.map((api, i) => api.id !== window.config.restApiId && this.renderRow(api, 'unsubscribable-' + i))}
            </Table.Body>
          </Table>
        </div>
      </div>
    );
  }
})
