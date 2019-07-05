// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Link } from 'react-router-dom'
import { Redirect } from 'react-router'
import { Menu, Image } from 'semantic-ui-react'

import { isAdmin, isAuthenticated, logout, getLoginRedirectUrl } from 'services/self'

import { cognitoDomain, cognitoClientId } from '../services/api'

// mobx
import { observer } from 'mobx-react'

// fragments
import { fragments } from 'services/get-fragments'

// components
import Register from './Register'
import './styles/NavBar.css'

export const NavBar = observer(
  class NavBar extends React.Component {
    constructor(props) {
      super(props)

      this.state = {
        activatedMenu: 0
      }
    }

    getCognitoUrl = (type) => {
      let redirectUri = getLoginRedirectUrl()
      return `${cognitoDomain}/${type}?response_type=token&client_id=${cognitoClientId}&redirect_uri=${redirectUri}`
    }

    insertAuthMenu() {
      const menu = window.location.href.split('/')[window.location.href.split('/').length - 1];

      return isAuthenticated() ?
        (
          <Menu.Menu position="right">
            {isAdmin() && <Menu.Item active={this.state.activatedMenu===3 || menu === 'admin'} onClick={() => this.getActiveMenu('admin')} as={Link} to="/admin">Painel de administração</Menu.Item>}
            <Menu.Item key="dashboard" active={this.state.activatedMenu===4 || menu === 'dashboard'} onClick={() => this.getActiveMenu('dashboard')} as={Link} to="/dashboard">Painel de controle</Menu.Item>
            <Menu.Item key="signout" as="a" onClick={logout}>Sair</Menu.Item>
          </Menu.Menu>
        ) : (
          <Menu.Menu position="right">
            <Redirect to="/"/>
            <Menu.Item key="register" as="a"
                       href={this.getCognitoUrl('login')}>
                Login
            </Menu.Item>
            <Register />
          </Menu.Menu>
        )
    }

    getActiveMenu(link) {
      switch (link) {
        // case 'getting-started':
        //   this.setState({ activatedMenu: 1 })
        //   break
        case 'apis':
          this.setState({ activatedMenu: 2 })
          break
        case 'admin':
          this.setState({ activatedMenu: 3 })
          break
        case 'dashboard':
          this.setState({ activatedMenu: 4 })
          break

        default:
          this.setState({ activatedMenu: 0 })
      }
    }

    render() {
      const menu = window.location.href.split('/')[window.location.href.split('/').length - 1];

      return <Menu className="navbar-menu" inverted borderless attached>
        <Menu.Item onClick={() => this.getActiveMenu('')} as={Link} to="/">
          <Image size='mini' src="/custom-content/code_white.svg" style={{ paddingRight: "10px" }} />
          {fragments.Home.title}
        </Menu.Item>

        {/* <Menu.Item active={this.state.activatedMenu===1 || menu === 'getting-started'} onClick={() => this.getActiveMenu('getting-started')} as={Link} to="/getting-started">{fragments.GettingStarted.title}</Menu.Item> */}
        { isAuthenticated() && <Menu.Item active={this.state.activatedMenu===2|| menu === 'apis'} onClick={() => this.getActiveMenu('apis')} as={Link} to="/apis">{fragments.APIs.title}</Menu.Item> }

        {this.insertAuthMenu()}
      </Menu >
    }
  }
)

export default NavBar
