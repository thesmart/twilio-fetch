const sendSMS = require('./dist/twilio.js').sendSMS;

const args = Array.from(process.argv);
args.shift();
args.shift();
const phoneNumber = args.shift();
const message = args.shift();
sendSMS(phoneNumber, message);
