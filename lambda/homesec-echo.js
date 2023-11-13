const {
    ApiGatewayManagementApiClient,
    PostToConnectionCommand,
} = require("@aws-sdk/client-apigatewaymanagementapi");

async function handler(event) {
    const connectId = event.requestContext.connectionId;
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;

    const body = JSON.parse(event.body);
    const data = body.data;

    const client = new ApiGatewayManagementApiClient({
        endpoint: `https://${domain}/${stage}/`,
    });

    const requestParams = {
        ConnectionId: connectId,
        Data: data,
    };

    const command = new PostToConnectionCommand(requestParams);

    try {
        await client.send(command);
    } catch (error) {
        console.log(error);
    }

    return {
        statusCode: 200,
    };
}

module.exports = { handler };
