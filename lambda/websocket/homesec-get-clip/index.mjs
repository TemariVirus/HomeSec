/* Expected event body: {
 *     "action": "get-clip",
 *     "data": string,
 * }
 */

"use strict";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

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
 * @param {string} objectUrl
 * @returns {Promise<string>}
 */
async function getClip(objectUrl) {
    return await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: process.env.CLIP_BUCKET,
            Key: objectUrl,
        }),
        { expiresIn: 30 * 60 }
    );
}

export async function handler(event) {
    let body;
    try {
        body = JSON.parse(event.body);
        if (!body?.data) {
            return {
                statusCode: 400,
                body: "Invalid request body",
            };
        }
    } catch (err) {
        return {
            statusCode: 400,
            body: "Invalid request body",
        };
    }

    const connectionId = event.requestContext.connectionId;
    const username = await getUsername(connectionId);
    if (!username) {
        return {
            statusCode: 401,
            body: "No user found for connection",
        };
    }

    const partialUrl = body.data;
    let clipSignedUrl;
    try {
        clipSignedUrl = await getClip(`${username}/${partialUrl}`);
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: "Error fetching clip url",
        };
    }

    return {
        statusCode: 200,
        body: JSON.stringify({ action: body.action, data: clipSignedUrl }),
    };
}
