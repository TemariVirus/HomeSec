// TODO: Device responsibilities:
// - send all info when connected
// - send all info when requested
// - send state info when changed
// - disconnect when removed
"use strict";
const { iot, mqtt } = require("aws-iot-device-sdk-v2");
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
        (yargs) => {
            yargs.usage("Mock a HomeSec device");
            yargs.option("username", {
                alias: "u",
                type: "string",
                describe: "Your username",
                demandOption: true,
            });
            yargs.option("device-id", {
                alias: "d",
                type: "string",
                describe: "The ID of the IoT device",
                demandOption: true,
            });
        },
        main
    )
    .parse();

function build_connection(argv) {
    let config_builder =
        iot.AwsIotMqttConnectionConfigBuilder.new_mtls_builder_from_path(
            CERT_PATH,
            KEY_PATH
        );

    config_builder.with_certificate_authority_from_path(undefined, CA_PATH);
    config_builder.with_clean_session(false);
    config_builder.with_client_id(`${argv.username}/${argv["device-id"]}}`);
    config_builder.with_endpoint(ENDPOINT);
    const config = config_builder.build();

    const client = new mqtt.MqttClient();
    return client.new_connection(config);
}

async function main(argv) {
    const connection = build_connection(argv);

    await connection.connect();
    console.log("Connected.");
    rl.on("close", async () => {
        await connection.disconnect();
        console.log("Disconnected.");
        process.exit(0);
    });

    connection.subscribe(
        argv.username,
        mqtt.QoS.AtLeastOnce,
        (topic, payload) => {
            const str = decoder.decode(payload);
            const data = JSON.parse(str);
            console.log(
                `Received message from topic [${topic}]: ${JSON.stringify(
                    data
                )}`
            );
        }
    );

    connection
        .publish(
            `${argv.username}/${argv["device-id"]}`,
            JSON.stringify({ hello: "world" }),
            mqtt.QoS.AtLeastOnce
        )
        .then(() => {
            console.log(
                "Published message:",
                JSON.stringify({ hello: "world" })
            );
        });
}
