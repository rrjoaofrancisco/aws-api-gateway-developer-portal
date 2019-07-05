import React from 'react'

import { Button, Table, Loader, Popup, Icon, Modal, Form, Message, Menu, Checkbox } from 'semantic-ui-react'

import { apiGatewayClient } from 'services/api'
import { getApi } from 'services/api-catalog'
import { store } from 'services/state'

import * as YAML from 'yamljs'

import hash from 'object-hash'
import { toJS } from 'mobx'
import { observer } from 'mobx-react'

export const ApiManagement = observer(class ApiManagement extends React.Component {
  constructor(props) {
    super(props)

    let adminPanel = localStorage.getItem('admin-panel')
    if (!adminPanel) {
      localStorage.setItem('admin-panel', JSON.stringify([true, true, false]))
    } else {
      adminPanel = JSON.parse(adminPanel)
    }

    this.state = {
      modalOpen: false,
      errors: [],
      loadingComponent: true,
      loadingBy: '',
      api: undefined,
      usagePlan: undefined,
      displaySubscribable: adminPanel ? adminPanel[0] : true,
      displayUnsubscribable: adminPanel ? adminPanel[1] : true,
      displayGeneric: adminPanel ? adminPanel[2] : false
    }
  }

  fileInput = React.createRef()

  componentDidUpdate() {
    if (this.state.loadingComponent) {
      this.setState(prev => ({ ...prev, loadingComponent: false }))
    }
  }

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
          if (f.name.includes('yaml') || f.name.includes('yml')) {
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
            .then((result) => {
              if (result.status === 200) {
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
        .then((result) => {
          setTimeout(() => this.getApiVisibility(), 2000)
        })
    })

  }

  getApiVisibility = () => {
    apiGatewayClient()
      .then(app => app.get('/admin/catalog/visibility', {}, {}, {}))
      .then(result => {
        if (result.status === 200) {
          // console.log(`visibility: ${JSON.stringify(result.data, null, 2)}`)

          let apiGateway = result.data.apiGateway
          let generic = result.data.generic && Object.keys(result.data.generic)

          // console.log(`generic: ${JSON.stringify(generic, null, 2)}`)
          // console.log(`api gateway: ${JSON.stringify(apiGateway, null, 2)}`)

          apiGateway.forEach((api, i) => {
            result.data.apiGateway[i].loading = false

            if (generic) {
              generic.forEach(genApi => {
                if (result.data.generic[`${genApi}`]) {
                  if (
                    result.data.generic[`${genApi}`].apiId === api.id &&
                    result.data.generic[`${genApi}`].stage === api.stage
                  ) {
                    api.visibility = true
                    delete result.data.generic[`${genApi}`]
                  }
                }
              })
            }
          })

          store.visibility = result.data
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
    this.setState(prev => ({ ...prev, api, loadingBy }))

    apiGatewayClient()
      .then(app => app.post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {}))
      .then((result) => {
        if (result.status === 200) {
          api.loading = false
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
        }

        console.log(result.status)
      }).catch(() => {
        api.loading = false
      })
  }

  hideApiGatewayApi = (api, loadingBy) => {
    api.loading = true
    this.setState(prev => ({ ...prev, api, loadingBy }))

    if (!api.subscribable && !api.id && !api.stage) {
      this.deleteAPISpec(api.genericId)
    } else {
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then((result) => {
          if (result.status === 200) {
            api.loading = false
            this.updateLocalApiGatewayApis(store.visibility.apiGateway, api)
          }

          console.log(result.status)
        }).catch(() => {
          api.loading = false
        })
    }
  }

  showAllApiGatewayApis = (usagePlan, loadingBy) => {
    usagePlan.loading = true
    this.setState(prev => ({ ...prev, usagePlan, loadingBy }))

    Promise.all(usagePlan.apis.map((api) =>
        apiGatewayClient()
          .then(app => app.post('/admin/catalog/visibility', {}, {
            apiKey: `${api.id}_${api.stage}`,
            subscribable: `${api.subscribable}`
          }, {}))
          .then(result => { result.api = api; return result })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          usagePlan.loading = false
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, true)
        }

        console.log(result.status)
      })
    }).catch(() => {
      usagePlan.loading = false
    })
  }

  hideAllApiGatewayApis = (usagePlan, loadingBy) => {
    usagePlan.loading = true
    this.setState(prev => ({ ...prev, usagePlan, loadingBy }))

    Promise.all(usagePlan.apis.map((api) =>
      apiGatewayClient()
        .then(app => app.delete(`/admin/catalog/visibility/${api.id}_${api.stage}`, {}, {}, {}))
        .then(result => { result.api = api; return result })
    )).then((promises) => {
      promises.forEach((result) => {
        if (result.status === 200) {
          usagePlan.loading = false
          this.updateLocalApiGatewayApis(store.visibility.apiGateway, result.api, false)
        }

        console.log(result.status)
      })
    }).catch(() => {
      usagePlan.loading = false
    })
  }

  updateApiGatewayApi = (api, loadingBy) => {
    api.loading = true
    this.setState(prev => ({ ...prev, api, loadingBy }))

    apiGatewayClient()
      .then(app => {
        app
          .post('/admin/catalog/visibility', {}, { apiKey: `${api.id}_${api.stage}`, subscribable: `${api.subscribable}` }, {})
          .then(() => {
            api.loading = false
          }).catch((error) => {
            api.loading = false
            console.warn(error)
          })
      }).catch(() => {
        api.loading = false
      })
  }

  isSdkGenerationConfigurable = (api) => {
    return api.visibility
  }

  toggleSdkGeneration = (apisList, updatedApi, loadingBy) => {
    updatedApi.loading = true
    this.setState(prev => ({ ...prev, api: updatedApi, loadingBy }))

    apiGatewayClient()
      .then(app => {
        if (updatedApi.sdkGeneration) {
          return app.delete(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        } else {
          return app.put(`/admin/catalog/${updatedApi.id}_${updatedApi.stage}/sdkGeneration`, {}, {}, {})
        }
      })
      .then(result => {
        if (result.status === 200) {
          const updatedApis = apisList.map(stateApi => {
            if (stateApi.id === updatedApi.id && stateApi.stage === updatedApi.stage) {
              stateApi.sdkGeneration = !stateApi.sdkGeneration
            }
            return stateApi
          })

          updatedApi.loading = false
          store.visibility.apiGateway = updatedApis
        }
      }).catch(() => {
        updatedApi.loading = false
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
        this.state.usagePlan &&
        this.state.usagePlan.id === usagePlan.id &&
        this.state.usagePlan.loading &&
        this.state.loadingBy === 'renderHeaderVisibilityButton-yes' ? (
        <Button
          loading
          style={{ width: '94px', marginRight: '0px !important' }}
          color='teal'>
            Loading
        </Button>) : (
        <Button key={i}
          color='teal'
          style={{ width: '94px', marginRight: '0px !important' }}
          disabled={(this.state.api && this.state.api.loading) || (this.state.usagePlan && this.state.usagePlan.loading)}
          onClick={() => this.hideAllApiGatewayApis(usagePlan, 'renderHeaderVisibilityButton-yes')}>
            Sim
        </Button>)
      )
    }
    // every API is not visible, show the current state (False) and enable on click
    else if (numberofVisibleApis === 0) {
      return (
        this.state.usagePlan &&
        this.state.usagePlan.id === usagePlan.id &&
        this.state.usagePlan.loading &&
        this.state.loadingBy === 'renderHeaderVisibilityButton-no' ? (
        <Button
          loading
          style={{ width: '94px', marginRight: '0px !important' }}
          color='red'>
            Loading
        </Button>) : (
        <Button color='red'
          key={i}
          style={{ width: '94px', marginRight: '0px !important' }}
          disabled={(this.state.api && this.state.api.loading) || (this.state.usagePlan && this.state.usagePlan.loading)}
          onClick={() => this.showAllApiGatewayApis(usagePlan, 'renderHeaderVisibilityButton-no')}>
            Não
        </Button>)
      )
    // some APIs are visible, some are hidden; show the current state (Partial, with a warning) and enable on click
    } else {
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

    let usagePlans =
      store.visibility.apiGateway
        .filter((api) => api.usagePlanId)
        .reduce((accumulator, api) => {
          if(!accumulator.find((usagePlan) => api.usagePlanId === usagePlan.id)) {
            accumulator.push({ id: api.usagePlanId, name: api.usagePlanName, loading: api.loading })
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
          {
            this.state.api &&
            this.state.api.id === api.id &&
            this.state.api.stage === api.stage &&
            this.state.api.loading &&
            this.state.loadingBy === 'renderRow-displaying' ? (
            <Button basic
              loading
              style={{ width: '94px', marginRight: '0px !important' }}
              color={api.visibility ? 'teal' : 'red'}>
                Loading
            </Button>) : (
            <Button basic
              color={api.visibility ? 'teal' : 'red'}
              style={{ width: '94px', marginRight: '0px' }}
              disabled={(this.state.api && this.state.api.loading) || (this.state.usagePlan && this.state.usagePlan.loading)}
              onClick={() => api.visibility ? this.hideApiGatewayApi(api, 'renderRow-displaying') : this.showApiGatewayApi(api, 'renderRow-displaying')}>
                {api.visibility ? 'Sim' : 'Não'}
            </Button>)
          }
        </Table.Cell>
        <Table.Cell>
          {
            this.state.api &&
            this.state.api.id === api.id &&
            this.state.api.stage === api.stage &&
            this.state.api.loading &&
            this.state.loadingBy === 'renderRow-updating' ? (
            <Button basic
              loading
              style={{ width: '100%', marginRight: '0px' }}
              color='blue'>
                Loading
            </Button>) : (
            <Button basic
              color='blue'
              disabled={!api.visibility || ((this.state.api && this.state.api.loading) || (this.state.usagePlan && this.state.usagePlan.loading))}
              style={{ width: '100%' }}
              onClick={() => this.updateApiGatewayApi(api, 'renderRow-updating')}>
                Atualizar
            </Button>)
          }
        </Table.Cell>
        <Table.Cell>
          {
            this.state.api &&
            this.state.api.id === api.id &&
            this.state.api.stage === api.stage &&
            this.state.api.loading &&
            this.state.loadingBy === 'renderRow-sdk' ? (
            <Button basic
              loading
              style={{ width: '100%', marginRight: '0px' }}
              color={'blue'}>
                Loading
            </Button>) : (
            <Button basic // color={api.sdkGeneration ? 'green' : 'red'}
              color='blue'
              style={{ width: '100%', marginRight: '0px' }}
              disabled={!api.visibility || !this.isSdkGenerationConfigurable(api) || ((this.state.api && this.state.api.loading) || (this.state.usagePlan && this.state.usagePlan.loading))}
              onClick={() => this.toggleSdkGeneration(store.visibility.apiGateway, api, 'renderRow-sdk')}>
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
      <div style={{ display: "flex", flex: "1 1 auto" }}>
        {!this.state.loadingComponent && <Menu inverted vertical borderless attached style={{ flex: "0 0 auto" }}>
          <Menu.Header style={{ padding: "13px 5px 13px 16px", color: 'lightsteelblue' }}>Exibir tabelas</Menu.Header>
          <Menu.Item className={'display-flex'}>
            <Checkbox toggle
              checked={this.state.displaySubscribable}
              onChange={() => {
                this.setState(prev => ({...prev, displaySubscribable: !this.state.displaySubscribable}))
                localStorage.setItem('admin-panel', JSON.stringify([!this.state.displaySubscribable, this.state.displayUnsubscribable, this.state.displayGeneric]))
              }}
              className={'developer-toggle'} />
            <div className={'item-label'}>Registráveis</div>
          </Menu.Item>
          <Menu.Item className={'display-flex'}>
            <Checkbox toggle
              checked={this.state.displayUnsubscribable}
              onChange={() => {
                this.setState(prev => ({...prev, displayUnsubscribable: !this.state.displayUnsubscribable}))
                localStorage.setItem('admin-panel', JSON.stringify([this.state.displaySubscribable, !this.state.displayUnsubscribable, this.state.displayGeneric]))
              }}
              className={'developer-toggle'} />
            <div className={'item-label'}>Não registráveis</div>
          </Menu.Item>
          <Menu.Item className={'display-flex'}>
            <Checkbox toggle
              checked={this.state.displayGeneric}
              onChange={() => {
                this.setState(prev => ({...prev, displayGeneric: !this.state.displayGeneric}))
                localStorage.setItem('admin-panel', JSON.stringify([this.state.displaySubscribable, this.state.displayUnsubscribable, !this.state.displayGeneric]))
              }}
              className={'developer-toggle'} />
            <div className={'item-label'}>APIs genéricas</div>
          </Menu.Item>
        </Menu>}
        <div style={{ display: 'flex', width: '100%' }}>
          {!this.state.loadingComponent ? (
            <div style={{ display: 'flex', width: '100%' }}>
              {this.state.displaySubscribable && <div style={{ padding: '2em' }}>
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
              </div>}
              {this.state.displayUnsubscribable && <div style={{ padding: '2em' }}>
                <Table color={'red'} celled collapsing>
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
              </div>}
              {this.state.displayGeneric && <div style={{ padding: '2em' }}>
                <Table color={'red'} celled collapsing>
                  <Table.Header fullWidth>
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
                          <Modal.Header>Selecione arquivos tipo .JSON, .YAML, ou .YML</Modal.Header>
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
                  </Table.Body>
                </Table>
              </div>}
            </div>
          ) : (
            <Loader active size='big'>Carregando APIs</Loader>
          )}
        </div>
      </div>
    )
  }
})
