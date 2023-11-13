const {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

async function handler(event, context) {
    console.log("Event: ", event);
    console.log("Context: ", context);
    const connectId = event["requestContext"]["connectionId"];
    const domainName = event["requestContext"]["domainName"];
    const stageName = event["requestContext"]["stage"];
    const qs = event["queryStringParameters"];
    console.log(
        "Connection ID: ",
        connectId,
        "Domain Name: ",
        domainName,
        "Stage Name: ",
        stageName,
        "Query Strings: ",
        qs
    );

    // const client = new ApiGatewayManagementApiClient({
    //     endpoint:
    //         "https://yjrwbj2w60.execute-api.us-east-1.amazonaws.com/production/",
    // });

    // const requestParams = {
    //     ConnectionId: connectionId,
    //     Data: event.data,
    // };

    // const command = new PostToConnectionCommand(requestParams);

    // try {
    //     await client.send(command);
    // } catch (error) {
    //     console.log(error);
    // }

    return {
        statusCode: 200,
    };
}

module.exports = { handler };

// event from websocket api with lambda proxy integration on
// Event:  {
//   requestContext: {
//     routeKey: 'echo',
//     messageId: 'OUyNbfL0IAMCLUA=',
//     eventType: 'MESSAGE',
//     extendedRequestId: 'OUyNbHeGoAMFzOg=',
//     requestTime: '13/Nov/2023:07:03:49 +0000',
//     messageDirection: 'IN',
//     stage: 'production',
//     connectedAt: 1699858145900,
//     requestTimeEpoch: 1699859029627,
//     identity: { sourceIp: '116.88.68.25' },
//     requestId: 'OUyNbHeGoAMFzOg=',
//     domainName: 'yjrwbj2w60.execute-api.us-east-1.amazonaws.com',
//     connectionId: 'OUwDWcDXoAMCLUA=',
//     apiId: 'yjrwbj2w60'
//   },
//   body: '{"action": "echo", "data": "asdlkj"}',
//   isBase64Encoded: false
// }
