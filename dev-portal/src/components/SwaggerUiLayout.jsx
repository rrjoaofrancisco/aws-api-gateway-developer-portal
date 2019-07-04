// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'

// semantic-ui
import { Button, Header, Image, Container, Loader } from 'semantic-ui-react'

// services
import { subscribe, unsubscribe } from 'services/api-catalog'
import { isAuthenticated } from 'services/self'

import { GetSdkButton } from 'components/GetSdk'

// state
import { observer } from 'mobx-react'
import { store } from 'services/state.js'

// Create the plugin that provides our layout component
export const SwaggerLayoutPlugin = () => ({ components: { InfoContainer: InfoReplacement } })

// replaces the InfoContainer component
// https://github.com/swagger-api/swagger-ui/blob/dd3afdc45656bda2a64ae6a7f9bdad006ea98149/src/core/components/layouts/base.jsx

const InfoReplacement = observer(({ specSelectors }) => {
  const basePath = specSelectors.basePath()
  const host = specSelectors.host()
  const externalDocs = specSelectors.externalDocs()

  return (
    <Container fluid textAlign='left' className="fixfloat" style={{ padding: "40px 0px", marginTop: "70px" }}>
      <div style={{ display: "flex" }}>
        <div style={{ flex: "0 0 auto", marginRight: "20px" }}>
          <Image size='small' src={store.api.logo} />
        </div>
        <div>
          <Header as='h1'>{store.api.swagger.info.title}</Header>
          <div style={{ display: "flex" }}>
            <div style={{ marginRight: "20px" }}>
              {store.api.generic && (
                <p style={{ fontWeight: "bold" }}>Versão</p>
              )}
              <p style={{ fontWeight: "bold" }}>Endpoint</p>
              <p style={{ fontWeight: "bold" }}>Plano de uso</p>
            </div>
            <div>
              {store.api.generic && (
                <p>{store.api.swagger.info.version}</p>
              )}
              <p>https://{host}{basePath}</p>
              <p>{store.api.usagePlan.name}</p>
            </div>
          </div>
          <p>{externalDocs}</p>
          <SubscriptionButtons />
          {store.api.sdkGeneration && <GetSdkButton />}
        </div>
      </div>
    </Container>
  )
})

const SubscriptionButtons = observer(class SubscriptionButtons extends React.Component {
  state = {
    loading: false
  }

  onUnsubscribe() {
    const { api } = store

    this.setState({ loading: true });

    unsubscribe(api.usagePlan)
      .then(() => {
        this.setState({ loading: false });
      }).catch((error) => {
        this.setState({ loading: false });
        console.warn(error);
      });
  }

  onSubscribe() {
    const { api } = store

    this.setState({ loading: true });

    subscribe(api.usagePlan)
      .then(() => {
        this.setState({ loading: false });
      }).catch((error) => {
        this.setState({ loading: false });
        console.warn(error);
      });
  }

  render() {
    const { api } = store

    return (
      (api && isAuthenticated()) ? !api.generic ? (
        api.subscribed ? (
          <div>
            <Button disabled={this.state.loading} onClick={() => this.onUnsubscribe()}>Cancelar inscrição</Button>
            <Loader active={this.state.loading} inline style={{ marginLeft: '10px' }} />
          </div>
        ) : (
          <div>
            <Button disabled={this.state.loading} onClick={() => this.onSubscribe()}>Inscrever-se</Button>
            <Loader active={this.state.loading} inline style={{ marginLeft: '10px' }} />
          </div>
        )
      ) : <Header as='h4' color='grey'>Essa API não está configurada para inscrição.</Header> : null
    )
  }
})

export default SwaggerLayoutPlugin