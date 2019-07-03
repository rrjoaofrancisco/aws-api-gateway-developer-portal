// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'
import { Link } from 'react-router-dom'
import { Menu, Image } from 'semantic-ui-react'

import { isAdmin, isAuthenticated, logout } from 'services/self'

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
    getCognitoUrl = (type) => {
      let redirectUri = `${window.location.protocol}//${window.location.host}/login`
      return `${cognitoDomain}/${type}?response_type=token&client_id=${cognitoClientId}&redirect_uri=${redirectUri}`
    }

    insertAuthMenu() {
      return isAuthenticated() ?
        (
          <Menu.Menu position="right">
            {isAdmin() && <Menu.Item as={Link} to="/admin">Painel de administração</Menu.Item>}
            <Menu.Item key="dashboard" as={Link} to="/dashboard">Painel de controle</Menu.Item>
            <Menu.Item key="signout" as="a" onClick={logout}>Sair</Menu.Item>
          </Menu.Menu>
        ) : (
          <Menu.Menu position="right">
            <Menu.Item key="register" as="a"
                       href={this.getCognitoUrl('login')}>
                Login
            </Menu.Item>
            <Register />
          </Menu.Menu>
        )
    }

    render() {
      return <Menu className="navbar-menu" inverted borderless attached>
        <Menu.Item as={Link} to="/">
          <Image size='mini' src="/custom-content/nav-logo.png" style={{ paddingRight: "10px" }} />
          {fragments.Home.title}
        </Menu.Item>

        <Menu.Item as={Link} to="/getting-started">{fragments.GettingStarted.title}</Menu.Item>
        <Menu.Item as={Link} to="/apis">{fragments.APIs.title}</Menu.Item>

        {this.insertAuthMenu()}
      </Menu >
    }
  }
)

export default NavBar
