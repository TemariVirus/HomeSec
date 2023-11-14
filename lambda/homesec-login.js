"use strict";
var crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "homesec";

const client = new DynamoDBClient({});
const dynamo = DynamoDBDocumentClient.from(client);

/**
 * @param {string} password
 * @param {string} salt
 * @returns {string}
 */
function hash(password, salt) {
    let hash = crypto.createHmac("sha512", salt);
    hash.update(password);
    return hash.digest("hex");
}

async function handler(event) {
    const body = event.body;

    return {
        statusCode: 200,
        body: "[jwt token here]",
    };
}

module.exports = { handler };
