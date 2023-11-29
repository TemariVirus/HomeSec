"use strict";
import jwt from "jsonwebtoken";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import {
    S3Client,
    ListObjectsV2Command,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

/**
 * @param {string} token
 * @returns {{username: string, sessionId: string}}
 */
function decodeToken(token) {
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ["HS512"],
        ignoreExpiration: false,
    });
    return {
        username: payload.username,
        sessionId: payload.sessionId,
    };
}

/**
 * @param {string} username
 * @param {string} sessionId
 */
async function deleteUser(username, sessionId) {
    await dynamo.send(
        new DeleteCommand({
            TableName: process.env.USER_TABLE,
            Key: {
                username: username,
            },
            ConditionExpression: "sessionId = :sessionId",
            ExpressionAttributeValues: {
                ":sessionId": sessionId,
            },
        })
    );
    await deleteUserClips(username);
}

async function deleteUserClips(username) {
    const keys = await s3
        .send(
            new ListObjectsV2Command({
                Bucket: process.env.CLIP_BUCKET,
                Prefix: `${username}/`,
            })
        )
        .then((data) => data.Contents?.map((c) => c.Key));
    await Promise.all(
        keys.map((key) =>
            s3.send(
                new DeleteObjectCommand({
                    Bucket: process.env.CLIP_BUCKET,
                    Key: key,
                })
            )
        )
    );
}

/**
 * @param {number} status
 * @param {string | undefined} body
 * @returns {{
 *     statusCode: number,
 *     headers: {
 *         Content-Type: string,
 *         Access-Control-Allow-Origin: string,
 *         Access-Control-Allow-Methods: string
 *     },
 *     body: string
 * }}
 */
function formatResponse(status, body) {
    return {
        statusCode: status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "DELETE",
        },
        body: body,
    };
}

export async function handler(event) {
    const auth = event.headers.Authorization;
    if (!auth) {
        return formatResponse(401, "No authorization header");
    }

    const token = auth.split(" ")[1];
    if (auth.split(" ")[0] != "Bearer" || !token) {
        return formatResponse(401, "No bearer token");
    }

    let payload;
    try {
        payload = decodeToken(token);
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            return formatResponse(401, "Token expired");
        }
        if (err instanceof jwt.JsonWebTokenError) {
            return formatResponse(401, "Invalid token");
        }

        console.error(err);
        return formatResponse(500, "Unable to verify token");
    }

    try {
        await deleteUser(payload.username, payload.sessionId);
    } catch (err) {
        if (err.__type?.endsWith("#ConditionalCheckFailedException")) {
            return formatResponse(401, "Invalid login session");
        }

        console.error(err);
        return formatResponse(500, "Unable to delete user");
    }
    return formatResponse(200);
}
