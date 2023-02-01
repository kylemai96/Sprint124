const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'us-west-2'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const db1 = 'Review';
const reviewPath = '/review';
const reviewsPath = '/reviews';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === reviewPath:
      response = await getRestaurant(event.queryStringParameters.restaurantName);
      break;
    case event.httpMethod === 'GET' && event.path === reviewsPath:
      response = await getRestaurant();
      break;
    case event.httpMethod === 'POST' && event.path === reviewPath:
      response = await saveRestaurant(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === reviewPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyRestaurant(requestBody.reviewId, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE' && event.path === reviewPath:
      response = await deleteRestaurant(JSON.parse(event.body).reviewId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

async function getRestaurant(restaurantName) {  //searches for customerName, scans for those that match
    var params = {
        TableName: db1,
        FilterExpression : "contains(#key, :value)",
        ExpressionAttributeNames: {"#key": "restaurantName"},
        ExpressionAttributeValues: {
            ':value': restaurantName,
        }
    };
  
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
  const reviews = await scanDb(params, []);
  const body = {
    reviews: reviews
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

async function modifyRestaurant(reviewId, updateKey, updateValue) {
  const params = {
    TableName: db1,
    Key: {
      'reviewId': reviewId
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

async function deleteRestaurant(reviewId) {
  const params = {
    TableName: db1,
    Key: {
      'reviewId': reviewId
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

