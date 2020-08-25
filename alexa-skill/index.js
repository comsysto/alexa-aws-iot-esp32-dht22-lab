const { SkillBuilders, getRequestType, getIntentName, getSlotValue } = require('ask-sdk-core');
const AWS = require('aws-sdk');
const Speech = require('ssml-builder');

const config = {
    IOT_BROKER_ENDPOINT: "XXXXXX.iot.eu-west-1.amazonaws.com", // get via 'mos config-get mqtt.server --port /dev/.....'
    IOT_BROKER_REGION: "eu-west-1",
    IOT_ACCESS_ROLE_ARN: "arn:aws:iam::XXXXXX:role/YYYYYY", // ARN of the role you created to use with STS
    ROOMS: { // mapping from Room to ESP, key must match the Slot values (lowercase)
        "vorratskeller": "esp32_AAAAAA", // get via 'mos config-get device.id --port /dev/....' or 'aws --region=eu-west-1 iot list-things'
        "werkstatt": "esp32_BBBBBB",
        "heizungskeller": "esp32_CCCCCC"
    }
};

AWS.config.region = config.IOT_BROKER_REGION;

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        var speech = new Speech();
        speech.say("Hallo!")
            .say('Du kannst mich fragen, wie die Temperatur oder Luftfeuchtigkeit im Keller ist.');
        return handlerInput.responseBuilder
            .speak(speech.ssml(true))
            .reprompt(speech.ssml(true))
            .getResponse();
    }
}

const GetRoomSpecificValuesHandler = {
    canHandle(handlerInput) {
        return getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && getIntentName(handlerInput.requestEnvelope) === 'GetMeasurementForRoom';
    },
    async handle(handlerInput) {
        const room = getSlotValue(handlerInput.requestEnvelope, 'room');
        const roomSensor = config.ROOMS[room];
        const sensorData = await getSensorData(roomSensor);

        const measurement = getSlotValue(handlerInput.requestEnvelope, 'measurement');
        var speech = new Speech();
        if (measurement === 'temperatur') {
            speech.say('Es ist im')
            speech.say(room)
            speech.sayAs({ interpret: 'number', word: formatTemp(sensorData.state.reported.temp) })
            speech.say('Grad warm');
        } else if (measurement === 'luftfeuchtigkeit') {
            speech.say("Die Luftfeuchtigkeit im")
            speech.say(room)
            speech.say("beträgt")
            speech.sayAs({ interpret: 'number', word: formatTemp(sensorData.state.reported.humidity) })
        }
        return handlerInput.responseBuilder.speak(speech.ssml(true)).getResponse();
    }
}

async function getSensorData(sensorName) {
    const credentials = await getCredentials();
    const iotData = new AWS.IotData({
        endpoint: config.IOT_BROKER_ENDPOINT,
        accessKeyId: credentials.Credentials.AccessKeyId,
        secretAccessKey: credentials.Credentials.SecretAccessKey,
        sessionToken: credentials.Credentials.SessionToken
    });
    const data = await iotData.getThingShadow({ thingName: sensorName }).promise();
    return JSON.parse(data.payload);
}

async function getCredentials() {
    const STS = new AWS.STS({ apiVersion: '2011-06-15' });
    return STS.assumeRole({
        RoleArn: config.IOT_ACCESS_ROLE_ARN,
        RoleSessionName: 'Session'
    }).promise();
}

function formatTemp(temp) {
    return temp.toFixed(1).replace('.', ',');
}

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(error);
        return handlerInput.responseBuilder
            .speak('Sorry, dass kann ich leider nicht')
            .getResponse();
    },
};

const skillBuilder = SkillBuilders.custom();
exports.handler = skillBuilder
    .addRequestHandlers(
        LaunchRequestHandler,
        GetRoomSpecificValuesHandler
    )
    .addErrorHandlers(ErrorHandler)
    .lambda();