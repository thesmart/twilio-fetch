import fetch from 'node-fetch';
import type { RequestInit } from 'node-fetch';
import { toBase64 } from './base64';

export interface TwilioEnvironment {
  sid: string;
  authToken: string;
  phoneNumber: string;
}

// phone number format supported by Twilio
export const PHONE_NUMBER_E164_REGEXP = /^\+[1-9]\d{10,14}$/;

/**
 * Extract required configuration from `process.env`.
 */
export function getTwilioEnvironment(): TwilioEnvironment {
  for (const name of ['TWILIO_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER']) {
    if (!process.env[name]) {
      throw new Error(`Missing environment variable ${name}.`);
    }
  }
  return {
    sid: process.env.TWILIO_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    phoneNumber: process.env.TWILIO_PHONE_NUMBER!,
  };
}

const ENV = getTwilioEnvironment();

/**
 * A `JSON.parse` reviver function that deserializes all Dates
 * with a key that ends with `at`, such as `createdAt` or
 * `created_at`.
 */
export function reviveKeyedDateString(k: string, v: unknown): unknown {
  if (typeof v != 'string') {
    return v;
  }
  if (/(^date_)|(_at$)|([a-z]At$)/.test(k)) {
    return new Date(Date.parse(v));
  }
  return v;
}

/**
 * Takes plain-text credentials and turns it into
 * a value acceptable for the HTTP Basic Authorization
 * standard header.
 */
export function encodeBasicAuthorizationHeader(user: string, pass: string) {
  // @see https://tools.ietf.org/html/rfc2617#section-2
  if (/:/.test(user)) {
    throw new Error("Colons (e.g. ':') are not allowed in HTTP Authentication usernames.");
  }
  const userPass = `${user}:${pass}`;
  const encodedUserPass = toBase64(userPass);
  return `Basic ${encodedUserPass}`;
}

export interface TwilioMessageResponse {
  /**
   * The status of the message.
   * NOTE: `read` is for WhatsApp only.
   * See [detailed descriptions](https://www.twilio.com/docs/sms/api/message-resource#message-status-values).
   */
  status:
    | 'accepted'
    | 'queued'
    | 'sending'
    | 'sent'
    | 'failed'
    | 'delivered'
    | 'undelivered'
    | 'receiving'
    | 'received'
    | 'read';
  /**
   * The unique string that that we created to
   * identify the Message resource.
   */
  sid: string;
  /**
   * The SID of the [Messaging Service](https://www.twilio.com/docs/sms/services/api)
   * used with the message. The value is null if a
   * Messaging Service was not used.
   */
  messaging_service_sid: string | null;
  /**
   * The date and time in GMT that the resource was created
   * specified in RFC 2822 format.
   */
  date_created: string;
  /**
   * The date and time in GMT that the resource was sent specified
   * in RFC 2822 format. For outgoing messages, this is when we
   * sent the message. For incoming messages, this is when we
   * made the HTTP request to your application.
   */
  date_sent: string;
  /**
   * The error code returned if your message status is failed
   * or undelivered. The error_code provides more information
   * about the failure. If the message was successful, this
   * value is `null`.
   */
  error_code: number | null;
  /**
   * The description of the `error_code` if your message status
   * is failed or undelivered. If the message was successful,
   * this value is `null`.
   */
  error_message: string | null;

  /**
   * The phone number (in E.164 format), alphanumeric sender ID,
   * or Wireless SIM that initiated the message. For
   * incoming messages, this will be the number of the
   * sending phone. For outgoing messages, this value will be
   * one of your Twilio phone numbers or the alphanumeric
   * sender ID used.
   */
  from: string;

  /**
   * The phone number in E.164 format that received the message.
   * For incoming messages, this will be one of your Twilio phone
   * numbers. For outgoing messages, this will be the sending phone.
   */
  to: string;

  /**
   * The message text. Can be up to 1,600 characters long.
   */
  body: string;
}

export interface TwilioErrorResponse {
  status: number;
  message: string;
  code: number;
  moreInfo: string;
  details: string;
}

/**
 * @see: https://www.twilio.com/docs/api/errors
 */
class TwilioError extends Error {
  status: number;
  code: number;
  moreInfo: string | null = null;
  details: string | null = null;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.code = 410; // unknown
  }

  static fromResponse(errRes: TwilioErrorResponse) {
    const e = new TwilioError(errRes.message, errRes.status);
    e.code = errRes.code;
    e.moreInfo = errRes.moreInfo;
    e.details = errRes.details;
    return e;
  }
}

/**
 * Call Twilio API
 * @throws {TwilioError}
 */
export async function fetchTwilio(
  path: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
  reqData?: Record<string, string | number | Date>,
): Promise<unknown> {
  method = method || 'GET';

  const init: RequestInit = {
    method: method,
    headers: {
      Authorization: encodeBasicAuthorizationHeader(ENV.sid, ENV.authToken),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };

  if (reqData) {
    let queryStrTokens = [];
    for (const k of Object.getOwnPropertyNames(reqData)) {
      const v = reqData[k] instanceof Date ? (reqData[k] as Date).toISOString() : reqData[k].toString();
      queryStrTokens.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
    }
    init.body = queryStrTokens.join('&');
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(ENV.sid)}/${encodeURIComponent(path)}`;
  const response = await fetch(url, init);
  const responseText = await response.text();
  const respData = (() => {
    try {
      return JSON.parse(responseText, reviveKeyedDateString);
    } catch (e) {
      console.error(`TwilioError (status=${response.status}): ${e.message}`, responseText.substr(0, 5 * 1024));
      throw new TwilioError('Failed JSON.parse', response.status);
    }
  })();

  if (response.status < 200 || response.status >= 300) {
    throw TwilioError.fromResponse(respData as TwilioErrorResponse);
  }

  return respData;
}

/**
 * Send a text message.
 */
export async function sendSMS(to: string, message: string): Promise<TwilioMessageResponse> {
  if (!PHONE_NUMBER_E164_REGEXP.test(to)) {
    throw new Error('Invalid phone number, not E.164 format.');
  }
  if (message.length > 1600) throw new Error('Message is too big.');

  return (await fetchTwilio('Messages.json', 'POST', {
    From: ENV.phoneNumber,
    To: to,
    Body: message,
  })) as TwilioMessageResponse;
}
