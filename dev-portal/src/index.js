// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter, Route, Switch, Redirect } from 'react-router-dom'
import PropTypes from 'prop-types';

import * as queryString from 'query-string'

// content-fragments (import here to start this ASAP)
import 'services/get-fragments'

// semantic-ui
import 'semantic-ui-css/semantic.css'

// pages
import Home from 'pages/Home'
import GettingStarted from 'pages/GettingStarted'
import Dashboard from 'pages/Dashboard'
import Apis from 'pages/Apis'
import { Admin } from 'pages/Admin'

// components
import AlertPopup from 'components/AlertPopup'
import GlobalModal from 'components/Modal'
import NavBar from 'components/NavBar'
import Feedback from './components/Feedback'
import ApiSearch from './components/ApiSearch'

import { isAdmin, init, login, logout } from 'services/self'
import './index.css';

// TODO: Feedback should be enabled if
// the following is true && the current
// user is not an administrator
const feedbackEnabled = window.config.feedbackEnabled
let locationListener = '/'

export const AdminRoute = ({component: Component, ...rest}) => (
  <Route {...rest} render={(props) => (
    isAdmin()
      ? <Component {...props} />
      : <Redirect to="/" />
  )} />
)

class LocationListener extends React.Component {
  static contextTypes = {
    router: PropTypes.object
  };

  componentDidMount() {
    this.handleLocationChange(this.context.router.history.location)
    this.unlisten = this.context.router.history.listen(this.handleLocationChange)
  }

  componentWillUnmount() {
    this.unlisten()
  }

  handleLocationChange(location) {
    locationListener = location
  }

  render() {
    return this.props.children;
  }
}

class App extends React.Component {
  constructor() {
    super()
    init()

    // We are using an S3 redirect rule to prefix the url path with #!
    // This then converts it back to a URL path for React routing
    if (window.location.hash && window.location.hash[1] === '!') {
      const hashRoute = window.location.hash.substring(2)
      window.history.pushState({}, 'home page', hashRoute)
    }
  }

  render() {
    return (
      <BrowserRouter>
        <LocationListener>
          <React.Fragment>
            <NavBar />
            <GlobalModal />
            <Switch>
              <Route exact path="/" component={Home} />
              <Route exact path="/index.html" component={() => {
                const { action } = queryString.parse(window.location.search)
                if (action === 'login') {
                  login()
                } else if (action === 'logout') {
                  logout()
                }
                return <Redirect to="/" />
              }} />
              <Route path="/getting-started" component={GettingStarted} />
              <Route path="/dashboard" component={Dashboard} />
              <AdminRoute path="/admin" component={Admin} />
              <Route exact path="/apis" render={(props) => <Apis locationListener={locationListener} {...props} /> }  />
              <Route exact path="/apis/search" component={ApiSearch} />
              <Route exact path="/apis/:apiId" component={Apis}/>
              <Route path="/apis/:apiId/:stage" component={Apis} />
              <Route path="/login" render={() => { login(); return <Redirect to="/" /> }} />
              <Route path="/logout" render={() => { logout(); return <Redirect to="/" /> }} />
              <Route component={() => <h2>Page not found</h2>} />
            </Switch>
            {feedbackEnabled && <Feedback />}
            <AlertPopup />
          </React.Fragment>
        </LocationListener>
      </BrowserRouter>
    )
  }
}

ReactDOM.render(
  <App />,
  document.getElementById('root')
);
