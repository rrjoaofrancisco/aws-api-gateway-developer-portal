module.exports = {
    // required; bucket must be pre-made
    buildAssetsBucket: `apidevportal-sam.nexxera.com`,
    s3Bucket: 'apidevportal-lambdaf.nexxera.com',
  
    // required; created by stack
    stackName: `barramento-dev-portal`,
    siteAssetsBucket: `apidevportal-static-assets.nexxera.com`,
    apiAssetsBucket: `apidevportal-artifacts.nexxera.com`,
    
    // optional values (uncomment and change values if you want to use them)
  
    // Change the name of the customer's table. Useful for multiple stacks. Defaults to `DevPortalCustomers`
    // customersTableName: `DevPortalCustomers`,
    
    // Turns on cognito hosted sign in / sign up UI; Defaults to `` (blank string)
    cognitoDomainName: `dev-portal-domain-user-pool3`,
    cognitoIdentityPoolName: 'DevPortalUserPool3',
  
    // Set this to overwrite-content if you want to reset your custom content back to the defaults. Defaults to ``
    staticAssetRebuildMode: `overwrite-content`, // ONLY SET

    samTemplate: '../cloudformation/template.yaml',

    packageConfig: '../cloudformation/packaged.yaml'
  }