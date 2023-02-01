const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'us-west-2'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const db1 = 'Restaurant';
const restaurantPath = '/restaurant';
const restaurantsPath = '/restaurants';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === restaurantPath:
      response = await getRestaurant(event.queryStringParameters.fullName, event.queryStringParameters.cuisine);
      break;
    case event.httpMethod === 'GET' && event.path === restaurantsPath:
      response = await getRestaurant();
      break;
    case event.httpMethod === 'POST' && event.path === restaurantPath:
      response = await saveRestaurant(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === restaurantPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyRestaurant(requestBody.restaurantId, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE' && event.path === restaurantPath:
      response = await deleteRestaurant(JSON.parse(event.body).restaurantId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getRestaurant(fullName, cuisine) {  //searches for customerName, scans for those that match
    var params = {
        TableName: db1,
        FilterExpression : "contains(#key, :value) AND contains(#key2, :value2)",
        ExpressionAttributeNames: {"#key": "fullName", "#key2": "cuisine"},
        ExpressionAttributeValues: {
            ':value': fullName,
            ':value2': cuisine
        }
    };
    if(!fullName){
        params.FilterExpression = "contains(#key2, :value2)";
        params.ExpressionAttributeNames = {"#key2": "cuisine"};
        params.ExpressionAttributeValues = {":value2": cuisine};
    }else if(!cuisine){
        params.FilterExpression = "contains(#key, :value)";
        params.ExpressionAttributeNames = {"#key": "fullName"};
        params.ExpressionAttributeValues = {":value": fullName};
    }
  
    return await dynamodb.scan(params).promise().then((response) => {
        return buildResponse(200, response.Items);
    }, (error) => {
        console.error('custom log: ', error);
    });
}

async function getRestaurants() {
  const params = {
    TableName: db1
  }
  const restaurants = await scanDb(params, []);
  const body = {
    restaurants: restaurants
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

async function saveRestaurant(requestBody) {
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

async function modifyRestaurant(restaurantId, updateKey, updateValue) {
  const params = {
    TableName: db1,
    Key: {
      'restaurantId': restaurantId
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

async function deleteRestaurant(restaurantId) {
  const params = {
    TableName: db1,
    Key: {
      'restaurantId': restaurantId
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
