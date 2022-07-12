# twilio-fetch
A modern and simplified Twilio SMS client for Node.js that uses native Promises.

This library requires a Twilio account.

### Using in TypeScript
To use in your own Typescript project, copy `./src/*.ts` and link to it in source:
```typescript
import sendSMS from "./src/twilio.ts"
(async () => {
  await sendSMS(phoneNumber, message);
  console.info("Message sent!");
})();
```

Try it out from the CLI:
```sh
TWILIO_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=xxx npx ts-node example.ts "$TO_PHONE_NUMBER" "Hello World"
```

### Using in JavaScript
To use in your own JavaScript project, do this:

```sh
npm install
npm run build
```

Try it out from the CLI:
```sh
TWILIO_SID=xxx TWILIO_AUTH_TOKEN=xxx TWILIO_PHONE_NUMBER=xxx node example.js "$TO_PHONE_NUMBER" "Hello World!"
```

Now copy `./dist/*` to your own project and use it as used in `./example.js`:
```js
const sendSMS = require('./dist/twilio.js').sendSMS;
sendSMS(phoneNumber, message);
```
