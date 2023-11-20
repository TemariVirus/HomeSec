"use strict";
const { iot, mqtt } = require("aws-iot-device-sdk-v2");
const { randomBytes } = require("crypto");
const { existsSync, readFileSync, writeFile } = require("fs");
const readline = require("readline");
const yargs = require("yargs");

const CERT_PATH = "certificate.pem.crt";
const KEY_PATH = "private.pem.key";
const CA_PATH = "AmazonRootCA1.pem";
const ENDPOINT = "a1ujiwut160nuw-ats.iot.us-east-1.amazonaws.com";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});
const decoder = new TextDecoder();

yargs
    .command(
        "*",
        false,
        (yargs) =>
            yargs
                .usage("Simulate a HomeSec device")
                .option("username", {
                    alias: "u",
                    type: "string",
                    describe: "Your username",
                    demandOption: true,
                })
                .option("device-id", {
                    alias: "d",
                    type: "string",
                    describe: "The ID of the IoT device",
                    demandOption: true,
                })
                .option("type", {
                    alias: "t",
                    type: "choices",
                    choices: ["camera", "contact", "shock"],
                    describe: "The type of IoT device",
                    demandOption: true,
                }),
        main
    )
    .parse();

function buildConnection(argv) {
    let config_builder =
        iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
            CERT_PATH,
            KEY_PATH
        );

    config_builder.with_certificate_authority_from_path(undefined, CA_PATH);
    config_builder.with_clean_session(false);
    config_builder.with_client_id(`${argv.username}/${argv.deviceId}}`);
    config_builder.with_endpoint(ENDPOINT);
    const config = config_builder.build();

    const client = new mqtt.MqttClient();
    return client.new_connection(config);
}

async function init(connection, initTopic, username, deviceId, deviceInfo) {
    const userTopicPath = `devices/${username}/${deviceId}`;

    if (existsSync(userTopicPath)) {
        const topicName = readFileSync(userTopicPath);
        // const topicName = decoder.decode(readFileSync(userTopicPath));
        console.log(`Using topic name: ${topicName}`);
        return {
            dataTopic: `homesec/data/${topicName}/${deviceId}`,
            commandTopic: `homesec/command/${topicName}/${deviceId}`,
        };
    }

    const topics = new Promise((resolve) => {
        // Subscribe to get user's topic name
        connection.subscribe(
            initTopic,
            mqtt.QoS.AtLeastOnce,
            (topic, payload) => {
                const msg = decoder.decode(payload);
                const json = JSON.parse(msg);
                console.log(
                    `Received message from ${topic}: ${JSON.stringify(json)}`
                );

                if (json.action !== "user-topic") {
                    return;
                }
                connection.unsubscribe(initTopic);

                const topicName = json.data;
                // TODO: make this work
                // Save topic name to file
                writeFile(userTopicPath, topicName, null, () => {});

                resolve({
                    dataTopic: `homesec/data/${topicName}/${deviceId}`,
                    commandTopic: `homesec/command/${topicName}/${deviceId}`,
                    deviceInfo: deviceInfo,
                });
            }
        );
    });

    // Send data from device
    send(connection, initTopic, "init", deviceInfo);

    return await topics;
}

// Randomly generates device info
function generateDeviceInfo(type) {
    let info;
    switch (type) {
        case "camera":
            info = {
                type: "camera",
                streamUrl: `https://${randomBytes(10).toString("hex")}`,
            };
            break;
        case "contact":
            info = {
                type: "contact",
                isOpen: Math.round(Math.random()) === 1,
            };
            break;
        case "shock":
            info = {
                type: "shock",
                isOpen: Math.round(Math.random()) === 1,
            };
            break;
        default:
            throw new Error(`Invalid device type: ${type}`);
    }

    // Common info
    info.battery = Math.random() * 100;
    return info;
}

function send(connection, topic, action, data) {
    const msg = JSON.stringify({
        action: action,
        data: data,
    });
    connection.publish(topic, msg, mqtt.QoS.AtLeastOnce).then(() => {
        console.log(`Published to ${topic}: ${msg}`);
    });
}

async function main(argv) {
    argv.deviceId = argv["device-id"];
    argv["device-id"] = undefined;

    const initTopic = `homesec/init/${argv.username}/${argv.deviceId}`;
    const connection = buildConnection(argv);

    await connection.connect();
    console.log("Connected.");

    // Disconnect on close
    rl.on("close", async () => {
        await connection.disconnect();
        console.log("Disconnected.");
        process.exit(0);
    });

    // Get topics
    let deviceInfo = generateDeviceInfo(argv.type);
    const { dataTopic, commandTopic } = await init(
        connection,
        initTopic,
        argv.username,
        argv.deviceId,
        deviceInfo
    );

    // Use user input to simulate device updates
    rl.on("line", (line) => {
        const json = JSON.parse(line);
        // TODO: update device info with json
        send(connection, dataTopic, "update", json);
    });

    // Subscribe to get commands from cloud
    connection.subscribe(
        commandTopic,
        mqtt.QoS.AtLeastOnce,
        (topic, payload) => {
            const msg = decoder.decode(payload);
            const json = JSON.parse(msg);
            console.log(
                `Received message from ${topic}: ${JSON.stringify(json)}`
            );

            switch (json.action) {
                case "get-info":
                    send(connection, dataTopic, "get-info", deviceInfo);
                    break;
                case "remove":
                    rl.close();
                    break;
            }
        }
    );
}
