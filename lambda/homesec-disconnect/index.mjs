"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

async function deleteOne(connectionId) {
    await dynamo.send(
        new DeleteCommand({
            TableName: process.env.CONNECTION_TABLE,
            Key: {
                id: connectionId,
            },
        })
    );
}

export async function handler(event) {
    const connectionId = event.requestContext.connectionId;

    try {
        await deleteOne(connectionId);
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
