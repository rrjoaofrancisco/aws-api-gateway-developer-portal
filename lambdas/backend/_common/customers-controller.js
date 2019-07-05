// Copyright 2018 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

'use strict'
const AWS = require('aws-sdk')
const { getAllUsagePlans } = require('../shared/get-all-usage-plans')

const dynamoDb = new AWS.DynamoDB.DocumentClient()

const customersTable = process.env.CustomersTableName || 'DevPortalCustomers'
const regions = ['us-east-1', 'sa-east-1']
var regionApi = 'us-east-1';

function ensureCustomerItem(cognitoIdentityId, cognitoUserId, keyId, error) {
    // ensure user is tracked in customer table
    const getParams = {
        TableName: customersTable,
        Key: {
            Id: cognitoIdentityId
        }
    }

    return dynamoDb.get(getParams).promise()
        .then((data) => {
            // upsert old entries with user pool IDs as well as new entries
            if (data.Item === undefined || data.Item.UserPoolId === undefined) {
                const putParams = {
                    TableName: customersTable,
                    Item: {
                        Id: cognitoIdentityId,
                        UserPoolId: cognitoUserId,
                        ApiKeyId: keyId
                    }
                }

                return dynamoDb.put(putParams).promise()
                    .catch((customerErr) => error(customerErr))
                    .then((customerData) => {
                        console.log(`Created new customer in ddb with id ${cognitoIdentityId}`)
                        return putParams.Item
                    })
            } else {
                console.log(`Customer exists with id ${cognitoIdentityId}`)
                return data.Item
            }
        })
        .catch((err) => {
            console.error(err)
            error(err)
        })
}

function getCognitoIdentityId(marketplaceCustomerId, error, callback) {
    const params = {
        TableName: customersTable,
        IndexName: "MarketplaceCustomerIdIndex",
        KeyConditionExpression: "MarketplaceCustomerId = :customerId",
        ExpressionAttributeValues: {
            ":customerId": marketplaceCustomerId
        },
        ProjectionExpression: "MarketplaceCustomerId, Id"
    }
    dynamoDb.query(params, (err, data) => {
        if (err) {
            error(err)
        } else if (data.Items === undefined || data.Items.length === 0) {
            // no customer matching marketplaceCustomerId - this should be created during marketplace subscription redirect
            error(`No customer is registered in the developer portal for marketplace customer ID ${marketplaceCustomerId}`)
        } else {
            callback(data.Items[0].Id)
        }
    })
}

function subscribe(cognitoIdentityId, usagePlanId, region, cognitoUserId, errFunc, callback) {
    console.log("-------- COGNITOID: " + cognitoIdentityId)
    console.log("-------- USAGEPLANID: " + usagePlanId)
    regionApi = region
    getApiKeyForCustomer(cognitoIdentityId, regionApi, errFunc).then((data) => {
        console.log(`Get Api Key data ${JSON.stringify(data)}`)

        if (data.items.length === 0) {
            console.log(`No API Key found for customer ${cognitoIdentityId}`)

            createApiKey(cognitoIdentityId, cognitoUserId, errFunc, (createData) => {
                console.log(`Create API Key data: ${createData}`)
                const keyId = createData.id

                console.log(`Got key ID ${keyId}`)

                createUsagePlanKey(keyId, usagePlanId, errFunc, (createKeyData) => {
                    callback(createKeyData)
                })
            })
        } else {
            const keyId = data.items[0].id

            console.log(`Got key ID ${keyId}`)

            createUsagePlanKey(keyId, usagePlanId, errFunc, (createKeyData) => {
                callback(createKeyData)
            })
        }

    }).catch((error) => {
        console.warn('Subscribe error: ', error)
    })
}

function unsubscribe(cognitoIdentityId, usagePlanId, region, error, success) {
    regionApi = region
    console.log('>>> UNSUBSCRIBE REGION API::: ', region)
    getApiKeyForCustomer(cognitoIdentityId, regionApi, error).then((data) => {
        console.log(`Get Api Key data ${JSON.stringify(data)}`)

        if (data.items.length === 0) {
            console.log(`No API Key found for customer ${cognitoIdentityId}`)
            return;
            // error('Customer does not have an API Key')
        } else {
            const keyId = data.items[0].id

            console.log(`Found API Key for customer with ID ${keyId}`)

            deleteUsagePlanKey(keyId, usagePlanId, error, (deleteData) => {
                success(deleteData)
            })
        }
    }).catch((error) => {
        console.warn('Unsubscribe error: ', error)
    })
}

function createApiKey(cognitoIdentityId, cognitoUserId, error, callback) {
    console.log(`Creating API Key for customer ${cognitoIdentityId} and User Pool user ${cognitoUserId}`)

    // set the name to the cognito identity ID so we can query API Key by the cognito identity
    const params = {
        description: `Dev Portal API Key for Identity Pool user ${cognitoIdentityId} / User Pool user ${cognitoUserId} / Region of api ${regionApi}`,
        enabled: true,
        generateDistinctId: true,
        name: `${cognitoIdentityId}/${cognitoUserId}`
    }


    new AWS.APIGateway({ region: regionApi }).createApiKey(params, (err, data) => {
        if (err) {
            error(err)
        } else {
            updateCustomerApiKeyId(cognitoIdentityId, data.id, error, () => {
                console.log(`<<<<<< CALLBACK:::::: `, data)
                callback(data)
            })
        }
    })
}

function createUsagePlanKey(keyId, usagePlanId, error, callback) {
    console.log(`Creating usage plan key for key id ${keyId}, usagePlanId ${usagePlanId} and region ${regionApi}`)

    const params = {
        keyId,
        keyType: 'API_KEY',
        usagePlanId
    }

    new AWS.APIGateway({ region: regionApi }).createUsagePlanKey(params, (err, data) => {
        if (err) {
            error(err)
        } else {
            callback(data)
        }

    })
}

function deleteUsagePlanKey(keyId, usagePlanId, error, callback) {
    console.log(`Deleting usage plan key for key id ${keyId} and usagePlanId ${usagePlanId}`)

    const params = {
        keyId,
        usagePlanId
    }
    new AWS.APIGateway({ region: regionApi }).deleteUsagePlanKey(params, (err, data) => {
        if (err) {
            error(err)
        }
        else callback(data)
    })
}

function getApiKeyForCustomer(cognitoIdentityId, region, error, callback) {
    let regionGateway = region != null && region != 'undefined' ? region : regionApi
    console.log(`Getting API Key for customer  ${cognitoIdentityId} and region ${regionGateway}`)
    return new Promise((resolve, reject) => {
        const params = {
            limit: 1,
            includeValues: true,
            nameQuery: cognitoIdentityId
        }

        new AWS.APIGateway({ region: regionGateway }).getApiKeys(params, function (err, data) {
            if (err) {
                console.log(err);
                reject(err)
            } else {
                // dataCallback.items.push(data.items)
                console.log('>>>>> GETAPIKEYFORCUSTOMER::: ', JSON.stringify(data))
                resolve(data)
                // callback(dataCallback)
            }
        })
    })
}

function getUsagePlansForCustomer(cognitoIdentityId, region, error, callback) {
    let regionGateway = region != null && region != 'undefined' ? region : regionApi
    console.log(`Getting Usage Plan for customer ${cognitoIdentityId} and region ${regionGateway}`)
    return new Promise((resolve, reject) => {
        getApiKeyForCustomer(cognitoIdentityId, regionGateway, error)
            .then((data) => {
                if (data.items.length === 0) {
                    resolve({ data: {} })
                } else {
                    const keyId = data.items[0].id
                    const params = {
                        keyId,
                        limit: 1000
                    }
                    //TODO GETALLUSAGEPLANS(apigateway)
                    new AWS.APIGateway({ region: regionGateway }).getUsagePlans(params, (err, usagePlansData) => {
                        if (err) {
                            // error(err)
                            console.log(err)
                            return;
                        } else {
                            resolve(usagePlansData)
                            // callback(usagePlansData)
                        }
                    })
                }
            }).catch((error) => {
                reject(error)
            })
    })
}

function getUsagePlanForProductCode(productCode, error, callback) {
    console.log(`Getting Usage Plan for product ${productCode}`)

    // do a linear scan of usage plans for name matching productCode
    var params = {
        limit: 1000
    };
    new AWS.APIGateway({ region: regionApi }).getUsagePlans(params, function (err, data) {
        if (err) {
            // error(err)
            console.log(err)
            return;
        } else {
            console.log(`Got usage plans ${JSON.stringify(data.items)}`)

            // note: ensure that only one usage plan maps to a given marketplace product code
            const usageplan = usagePlans.find(function (item) {
                return item.productCode !== undefined && item.productCode === productCode
            })
            if (usageplan !== undefined) {
                console.log(`Found usage plan matching ${productCode}`)
                callback(usageplan)
            } else {
                console.log(`Couldn't find usageplan matching product code ${productCode}`)
                error(`Couldn't find usageplan matching product code ${productCode}`)
            }
        }
    }).catch(err => error(err))
}

function updateCustomerMarketplaceId(cognitoIdentityId, marketplaceCustomerId, error, success) {
    const dynamoDbParams = {
        TableName: customersTable,
        Key: {
            Id: cognitoIdentityId
        },
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: { '#a': 'MarketplaceCustomerId' },
        ExpressionAttributeValues: {
            ':x': marketplaceCustomerId
        }
    }

    // update DDB customer record with marketplace customer id
    // and update API Gateway API Key with marketplace customer id
    dynamoDb.update(dynamoDbParams, (dynamoDbErr) => {
        if (dynamoDbErr) {
            error(dynamoDbErr)
        } else {
            getApiKeyForCustomer(cognitoIdentityId, regionApi, error).then((data) => {
                console.log(`Get Api Key data ${JSON.stringify(data)}`)

                if (data.items.length === 0) {
                    console.log(`No API Key found for customer ${cognitoIdentityId}`)

                    createApiKey(cognitoIdentityId, cognitoUserId, errFunc, (createData) => {
                        console.log(`Create API Key data: ${createData}`)
                        const keyId = createData.id

                        console.log(`Got key ID ${keyId}`)

                        updateApiKey(keyId, marketplaceCustomerId, error, (createKeyData) => {
                            success(createKeyData)
                        })
                    })
                } else {
                    const keyId = data.items[0].id

                    console.log(`Got key ID ${keyId}`)

                    updateApiKey(keyId, marketplaceCustomerId, error, (createKeyData) => {
                        success(createKeyData)
                    })
                }
            }).catch((error) => {
                console.warn('updateCustomerMarketplaceId error: ', error)
            })
        }
    })
}

function updateApiKey(apiKeyId, marketplaceCustomerId, error, success) {
    console.log(`Updating API Key ${apiKeyId} in API Gateway with marketplace customer ID`)

    // update API Gateway API Key with marketplace customer id to support metering
    var params = {
        apiKey: apiKeyId,
        patchOperations: [
            {
                op: 'replace',
                path: '/customerId',
                value: marketplaceCustomerId
            }
        ]
    };
    new AWS.APIGateway({ region: regionApi }).updateApiKey(params, function (err, data) {
        if (err) {
            error(err)
        } else {
            success(data)
        }
    });
}

function updateCustomerApiKeyId(cognitoIdentityId, apiKeyId, error, success) {
    // update customer record with marketplace customer code
    const dynamoDbParams = {
        TableName: customersTable,
        Key: {
            Id: cognitoIdentityId
        },
        UpdateExpression: 'set #a = :x',
        ExpressionAttributeNames: { '#a': 'ApiKeyId' },
        ExpressionAttributeValues: {
            ':x': apiKeyId
        }
    }

    dynamoDb.update(dynamoDbParams, (dynamoDbErr) => {
        if (dynamoDbErr) {
            error(dynamoDbErr)
        } else {
            success()
        }
    })
}

module.exports = {
    ensureCustomerItem,
    subscribe,
    unsubscribe,
    createApiKey,
    createUsagePlanKey,
    deleteUsagePlanKey,
    getApiKeyForCustomer,
    getUsagePlansForCustomer,
    getUsagePlanForProductCode,
    updateCustomerMarketplaceId,
    getCognitoIdentityId,
    dynamoDb
}
