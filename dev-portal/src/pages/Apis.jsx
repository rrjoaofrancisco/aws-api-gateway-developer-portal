// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'

// swagger-ui
import SwaggerUI from 'swagger-ui'
import 'swagger-ui/dist/swagger-ui.css'

// semantic-ui
import { Container, Header, Icon, Loader } from 'semantic-ui-react'

// services
import { isAuthenticated } from 'services/self'
import { updateUsagePlansAndApisList, getApi } from 'services/api-catalog';

// components
import ApisMenu from 'components/ApisMenu'
import ApiSearch from 'components/ApiSearch'
import SwaggerLayoutPlugin from 'components/SwaggerUiLayout'

import '../components/styles/Apis.css';

// state
import { store } from 'services/state.js'
import { observer } from 'mobx-react'

export default observer(class ApisPage extends React.Component {
  componentDidMount() { this.updateApi().then(() => updateUsagePlansAndApisList(true)) }
  componentDidUpdate() { this.updateApi() }

  updateApi = () => {
    return getApi(this.props.match.params.apiId || 'ANY', true, this.props.match.params.stage)
      .then(api => {
        if (api) {
          let swaggerUiConfig = {
            dom_id: '#swagger-ui-container',
            plugins: [SwaggerLayoutPlugin],
            supportedSubmitMethods: [],
            spec: api.swagger,
            onComplete: () => {
              if (store.apiKey)
                uiHandler.preauthorizeApiKey("api_key", store.apiKey)
            }
          }
          if (isAuthenticated()) {
            delete swaggerUiConfig.supportedSubmitMethods
          }
          let uiHandler = SwaggerUI(swaggerUiConfig)
        }
      })
  }

  render() {
    let errorHeader
    let errorBody

    console.log(store)
    if (store.apiList.loaded) {
      if (!store.apiList.apiGateway.length && !store.apiList.generic.length) {
        setTimeout(() => {
          errorHeader = `Nenhuma API publicada`
          errorBody = `Seu administrador não adicionou nenhuma API à sua conta. Por favor, contate-o para publicar uma API.`
        });
      } else if (!store.api) {
        errorHeader = `API não encontrada.`
        errorBody = `A API selecionada não existe.`
      }
    }

    return (
      <div style={{ display: "flex", flex: "1 1 auto", overflow: "hidden" }}>
        <ApisMenu path={this.props.match} />
        <div className="swagger-section" style={{ flex: "1 1 auto", overflow: 'auto' }}>
          <ApiSearch style={{ display: (!errorHeader && !errorBody && store.api) ? 'block' : 'none' }}></ApiSearch>
          <div className="swagger-ui-wrap" id="swagger-ui-container" style={{ padding: "0 20px", position: "relative", zIndex: "16", height: "100%" }}>
            {errorHeader && errorBody && (
              <React.Fragment>
                <Header as='h2' icon textAlign="center" style={{ padding: "40px 0px" }}>
                  <Icon name='warning sign' circular />
                  <Header.Content className={"error-content"}>{errorHeader}</Header.Content>
                </Header>
                <Container text textAlign='center'>
                  <p>{errorBody}</p>
                </Container>
              </React.Fragment>
            )}
            <Loader active={ !errorHeader && !errorBody } size='big'>Carregando APIs</Loader>
          </div>
        </div>
      </div>
    )
  }
})
