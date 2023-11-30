"use strict";
const { iot, mqtt } = require("aws-iot-device-sdk-v2");
const { randomBytes } = require("crypto");
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

/**
 * @param {yargs.Arguments} argv
 * @returns {mqtt.MqttClientConnection}
 */
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

/**
 * @param {mqtt.MqttClientConnection} connection
 * @param {string} topic
 * @param {any} payload
 */
function send(connection, topic, payload) {
    const msg = JSON.stringify(payload);
    connection.publish(topic, msg, mqtt.QoS.AtLeastOnce).then(() => {
        console.log(`Published to ${topic}: ${msg}`);
    });
}

/**
 * @param {string} type
 * @returns {any}
 */
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

/**
 * @param {yargs.Arguments} argv
 */
async function main(argv) {
    argv.deviceId = argv["device-id"];
    argv["device-id"] = undefined;

    const initTopic = `homesec/init/${argv.username}/${argv.deviceId}`;
    const dataTopic = `homesec/data/${argv.username}/${argv.deviceId}`;
    const commandTopic = `homesec/command/${argv.username}/${argv.deviceId}`;
    const connection = buildConnection(argv);

    await connection.connect();
    console.log("Connected.");

    // Disconnect on close
    rl.on("close", async () => {
        await connection.disconnect();
        console.log("Disconnected.");
        process.exit(0);
    });

    // Send initial device info
    let deviceInfo = generateDeviceInfo(argv.type);
    send(connection, initTopic, deviceInfo);
    send(connection, dataTopic, deviceInfo);

    // Use user input to simulate device updates
    rl.on("line", (line) => {
        if (line.trim() === "random") {
            deviceInfo = generateDeviceInfo(argv.type);
            send(connection, dataTopic, deviceInfo);
            return;
        }

        try {
            const payload = JSON.parse(line);
            deviceInfo = { ...deviceInfo, ...payload };
            send(connection, dataTopic, payload);
        } catch {
            console.error("Invalid JSON");
        }
    });

    // Subscribe to get commands from cloud
    await connection.subscribe(
        commandTopic,
        mqtt.QoS.AtLeastOnce,
        (topic, payload) => {
            const msg = decoder.decode(payload);
            const json = JSON.parse(msg);
            console.log(`Received from ${topic}: ${JSON.stringify(json)}`);

            switch (json.action) {
                case "get-info":
                    send(connection, dataTopic, deviceInfo);
                    break;
                case "remove-device":
                    rl.close();
                    break;
            }
        }
    );
}
