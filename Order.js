const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'us-west-2'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const db1 = 'NuOrder';
const db2 = 'Restaurant';
const db3 = 'Review';
const healthPath = '/health';
const orderPath = '/order';
const ordersPath = '/orders';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200);
      break;
    case event.httpMethod === 'GET' && event.path === orderPath:
      response = await getOrder(event.queryStringParameters.customerName);
      break;
    case event.httpMethod === 'GET' && event.path === ordersPath:
      response = await getOrders();
      break;
    case event.httpMethod === 'POST' && event.path === orderPath:
      response = await saveOrder(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === orderPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyOrder(requestBody.orderId, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE' && event.path === orderPath:
      response = await deleteOrder(JSON.parse(event.body).orderId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getOrder(customerName) {  //searches for customerName, scans for those that match
  var params = {
      TableName: 'NuOrder',
      FilterExpression : "#key = :value ",
      ExpressionAttributeNames: {"#key": "customerName"},
      ExpressionAttributeValues: {
          ':value': customerName
      }
  };
  
  return await dynamodb.scan(params).promise().then((response) => {
    return buildResponse(200, response.Items);
  }, (error) => {
    console.error('custom log: ', error);
  });
}

async function getOrders() {
  const params = {
    TableName: db1
  }
  const orders = await scanDb(params, []);
  const body = {
    orders: orders
  }
  return buildResponse(200, body);
}

async function scanDb(params, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(params).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      params.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDb(params, itemArray);
    }
    return itemArray;
  } catch(error) {
    console.error('custom log: ', error);
  }
}

async function saveOrder(requestBody) {
  const params = {
    TableName: db1,
    Item: requestBody
  }
  return await dynamodb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('custom log: ', error);
  })
}

async function modifyOrder(orderId, updateKey, updateValue) {
  const params = {
    TableName: db1,
    Key: {
      'orderId': orderId
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue
    },
    ReturnValues: 'UPDATED_NEW'
  }
  return await dynamodb.update(params).promise().then((response) => {
    const body = {
      Operation: 'UPDATE',
      Message: 'SUCCESS',
      UpdatedAttributes: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('custom log: ', error);
  })
}

async function deleteOrder(orderId) {
  const params = {
    TableName: db1,
    Key: {
      'orderId': orderId
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamodb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('custom log: ', error);
  })
}

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

  /*
  var params = {
  TableName: 'Table',
  IndexName: 'Index',
  KeyConditionExpression: 'HashKey = :hkey and RangeKey > :rkey',
  ExpressionAttributeValues: {
    ':hkey': 'key',
    ':rkey': 2015
  }
};

var documentClient = new AWS.DynamoDB.DocumentClient();

documentClient.query(params, function(err, data) {
   if (err) console.log(err);
   else console.log(data);
});
  */