// TODO: send message to mqtt to get devices to send current state
// another lambda will stream responses to client and client will handle timeout to determine if no battery
/* Expected event body: {
 *     "action": "get-info",
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

/**
 * @param {string} connectionId
 * @returns {Promise<string | null>}
 */
async function getUsername(connectionId) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.CONNECTION_TABLE,
            Key: {
                id: connectionId,
            },
            ProjectionExpression: "username",
        })
    );
    return data.Item?.username ?? null;
}

/**
 * @param {string} username
 * @returns {Promise<{isArmed: boolean, devices: object[]}>}
 */
async function getUserInfo(username) {
    const data = await dynamo.send(
        new GetCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ProjectionExpression: "username, isArmed, devices",
        })
    );
    return data.Item ?? null;
}

export async function handler(event) {
    let username;
    try {
        username = await getUsername(event.requestContext.connectionId);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to retrive user",
        };
    }
    if (!username) {
        return {
            statusCode: 401,
            body: "User not found",
        };
    }

    let userInfo;
    try {
        userInfo = await getUserInfo(username);
    } catch (err) {
        console.error(err);
        return {
            statusCode: 500,
            body: "Unable to retrive user info",
        };
    }

    const action = JSON.parse(event.body).action;
    return {
        statusCode: 200,
        body: JSON.stringify({ action: action, data: userInfo }),
    };
}
