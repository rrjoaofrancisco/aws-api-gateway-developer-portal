// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react'

// mobx
import { observer } from 'mobx-react'

// fragments
import { fragments } from 'services/get-fragments'

// react-router
import { Link } from 'react-router-dom'

// semantic-ui
import { Segment, Container, Image, Button } from 'semantic-ui-react'
import '../components/styles/Home.css';

export const HomePage = observer(() => (
  <React.Fragment>
    <Segment className="content" vertical textAlign='center'>
      <div>
        <Image style={{ marginBottom: "40px" }} centered size='big' src='/custom-content/pd.svg' />
        {/* <Header as='h1' style={{ color: "whitesmoke" }}>{fragments.Home.header}</Header> */}
        {/* <p>{fragments.Home.tagline}</p> */}
        <Link to="/getting-started"><Button positive>{fragments.Home.gettingStartedButton}</Button></Link>
        {/* <Link to="/apis" style={{ padding: "0.78571429em 1.5em 0.78571429em", color: "white" }}>{fragments.Home.apiListButton}</Link> */}
      </div>
      <Image className="company-logo" centered size='small' src='/custom-content/grupo-nexxera-mono-branco.svg' />
    </Segment>
    <Segment className="footer" vertical>
      <Container fluid text textAlign='justified'>
        <fragments.Home.jsx />
      </Container>
    </Segment>
  </React.Fragment>
))

export default HomePage
