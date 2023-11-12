const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand } = require("@aws-sdk/lib-dynamodb");

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);
const tableName = "homesec";

function validateUser(user) {
    // TODO: Implement
    return true;
}

async function putOne(user) {
    await dynamo.send(
        new PutCommand({
            TableName: tableName,
            ConditionExpression: "attribute_not_exists(username)",
            ReturnItemCollectionMetrics: "SIZE",
            Item: {
                username: user.username,
            },
        })
    );
}

async function handler(event) {
    const user = event.body;
    if (!validateUser(user)) {
        return {
            statusCode: 400,
            body: "Invalid user payload",
        };
    }

    try {
        await putOne(user);
    } catch (err) {
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return {
                statusCode: 409,
                body: `User ${user.username} already exists`,
            };
        }

        return {
            statusCode: 500,
            body: "Internal server error",
        };
    }

    return {
        statusCode: 200,
        body: `Successfully created user ${user.username}`,
    };
}

module.exports = { handler };
