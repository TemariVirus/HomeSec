"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
    DynamoDBDocumentClient,
    DeleteCommand,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * @param {string} connectionId
 */
async function deleteConnection(connectionId) {
    const res = await dynamo.send(
        new DeleteCommand({
            TableName: process.env.CONNECTION_TABLE,
            Key: {
                id: connectionId,
            },
            ReturnValues: "ALL_OLD",
        })
    );

    console.log("Deleted", res);
    const username = res.Attributes?.username;
    if (!username) {
        return;
    }

    await dynamo.send(
        new UpdateCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            UpdateExpression: "REMOVE connectionId",
            ConditionExpression: "connectionId = :connectionId",
            ExpressionAttributeValues: {
                ":connectionId": connectionId,
            },
        })
    );
}

export async function handler(event) {
    const connectionId = event.requestContext.connectionId;

    try {
        await deleteConnection(connectionId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Failed to delete connection ID from database",
        };
    }

    return {
        statusCode: 200,
    };
}
