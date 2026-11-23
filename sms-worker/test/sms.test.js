import assert from "node:assert/strict";
import test from "node:test";
import worker, { createMessage, getSmsProvider, normalizeNumbers, sendSms, SmsRateLimiter } from "../src/index.js";

test("normalizes Philippine mobile numbers and removes duplicates", () => {
  assert.deepEqual(
    normalizeNumbers(["09 123-456-789", "+639876543210", "639123456789"]),
    ["639123456789", "639876543210"]
  );
});

test("rejects invalid recipient lists", () => {
  assert.throws(() => normalizeNumbers([]), /one and five/);
  assert.throws(() => normalizeNumbers(["12345"]), /Philippine mobile/);
});

const smsToCredentials = {
  SMSTO_API_KEY: "sms-to-test-key"
};
const smsToAcceptedResponse = () => new Response(JSON.stringify({
  success: true,
  campaign_id: "campaign-test"
}), { status: 200 });

test("reports SMS.to rate limits and respects the five-minute retry minimum", async () => {
  const result = await sendSms(
    smsToCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("temporarily unavailable", {
      status: 429,
      headers: { "Retry-After": "42" }
    })
  );
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "SMS.to is temporarily rate-limiting requests; the alert can be retried.",
    providerStatus: 429,
    retryAfterSeconds: 300
  });
});

test("sends one campaign through SMS.to using Bearer auth and E.164 recipients", async () => {
  let captured;
  const result = await sendSms(
    smsToCredentials,
    ["639123456789", "639987654321"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return smsToAcceptedResponse();
    }
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sent: 2, failed: 0, queued: true });
  assert.equal(captured.url, "https://api.sms.to/sms/send");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.equal(captured.options.headers.Authorization, "Bearer sms-to-test-key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    message: "test message",
    to: ["+639123456789", "+639987654321"]
  });
  assert.equal(captured.options.headers["X-Idempotency-Key"], undefined);
});

test("trims SMS.to credentials and includes an approved sender ID when configured", async () => {
  let captured;
  await sendSms(
    {
      SMSTO_API_KEY: "  sms-to-test-key  ",
      SMSTO_SENDER_ID: " SchoolHeat "
    },
    ["639123456789"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return smsToAcceptedResponse();
    }
  );
  assert.equal(captured.options.headers.Authorization, "Bearer sms-to-test-key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    message: "test message",
    to: ["+639123456789"],
    sender_id: "SchoolHeat"
  });
});

test("requires a configured SMS provider", async () => {
  await assert.rejects(
    sendSms(
      { SMSTO_API_KEY: "   " },
      ["639123456789"],
      "test message"
    ),
    /No SMS provider is configured/
  );
});

const philSmsCredentials = {
  PHILSMS_API_TOKEN: "philsms-test-token"
};
const philSmsAcceptedResponse = () => new Response(JSON.stringify({
  status: "success",
  data: { messages: [{ id: "msg_test", status: "queued" }] }
}), { status: 200 });

test("sends one PhilSMS campaign with Bearer auth and comma-separated recipients", async () => {
  let captured;
  const result = await sendSms(
    philSmsCredentials,
    ["639123456789", "639987654321"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return philSmsAcceptedResponse();
    }
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sent: 2, failed: 0, queued: true });
  assert.equal(captured.url, "https://dashboard.philsms.com/api/v3/sms/send");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers.Authorization, "Bearer philsms-test-token");
  assert.equal(captured.options.headers.Accept, "application/json");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(captured.options.body), {
    recipient: "639123456789,639987654321",
    sender_id: "SchoolHeat",
    type: "plain",
    message: "test message"
  });
});

test("trims PhilSMS credentials and uses a configured sender ID", async () => {
  let captured;
  await sendSms(
    {
      PHILSMS_API_TOKEN: "  philsms-test-token  ",
      PHILSMS_SENDER_ID: " SchoolHeat "
    },
    ["639123456789"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return philSmsAcceptedResponse();
    }
  );
  assert.equal(captured.options.headers.Authorization, "Bearer philsms-test-token");
  assert.deepEqual(JSON.parse(captured.options.body), {
    recipient: "639123456789",
    sender_id: "SchoolHeat",
    type: "plain",
    message: "test message"
  });
});

test("reports PhilSMS rate limits and respects the five-minute retry minimum", async () => {
  const result = await sendSms(
    philSmsCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("too many", {
      status: 429,
      headers: { "Retry-After": "42" }
    })
  );
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "PhilSMS is temporarily rate-limiting requests; the alert can be retried.",
    providerStatus: 429,
    retryAfterSeconds: 300
  });
});

test("does not automatically retry unclear or rejected PhilSMS responses", async () => {
  const unclear = await sendSms(
    philSmsCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("server error", { status: 500 })
  );
  assert.equal(unclear.status, 409);
  assert.match(unclear.body.error, /Check PhilSMS message logs/);

  const rejected = await sendSms(
    philSmsCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({ status: "error", message: "invalid_token" }), { status: 200 })
  );
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error, /PhilSMS rejected the request/);
});

test("does not automatically retry when the PhilSMS connection fails", async () => {
  const result = await sendSms(
    philSmsCredentials,
    ["639123456789"],
    "test message",
    async () => { throw new Error("network failed"); }
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check PhilSMS message logs/);
});

const exSenderCredentials = {
  EXSENDER_API_KEY: "psk_live_test_key"
};
const exSenderAcceptedResponse = () => new Response(JSON.stringify({
  ok: true,
  campaignId: "camp_test",
  totals: { accepted: 1, failed: 0, invalid: 0 },
  recipients: [{ id: "msg_test", to: "+639123456789", status: "pending" }]
}), { status: 201 });

test("prefers SMS API PH, then PhilSMS, then ExSender, then SMS.to", () => {
  assert.equal(getSmsProvider({ SMSAPIPH_API_KEY: " key " }), "smsapiph");
  assert.equal(getSmsProvider({ SMSAPIPH_API_KEY: "  ", PHILSMS_API_TOKEN: " token " }), "philsms");
  assert.equal(getSmsProvider({ SMSAPIPH_API_KEY: "  ", PHILSMS_API_TOKEN: "  ", EXSENDER_API_KEY: " key " }), "exsender");
  assert.equal(getSmsProvider({ SMSAPIPH_API_KEY: "  ", PHILSMS_API_TOKEN: "  ", EXSENDER_API_KEY: "  ", SMSTO_API_KEY: " key " }), "smsto");
  assert.equal(getSmsProvider({ SMSAPIPH_API_KEY: " key ", PHILSMS_API_TOKEN: " token ", EXSENDER_API_KEY: " key ", SMSTO_API_KEY: " key " }), "smsapiph");
  assert.equal(getSmsProvider({}), null);
});

test("sends through ExSender with Bearer auth and E.164 recipients", async () => {
  let captured;
  const result = await sendSms(
    exSenderCredentials,
    ["639123456789", "639987654321"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return new Response(JSON.stringify({
        ok: true,
        campaignId: "camp_test",
        totals: { accepted: 2, failed: 0, invalid: 0 },
        recipients: [
          { id: "msg_one", to: "+639123456789", status: "pending" },
          { id: "msg_two", to: "+639987654321", status: "pending" }
        ]
      }), { status: 201 });
    }
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sent: 2, failed: 0, queued: true });
  assert.equal(captured.url, "https://exsender.com/api/v1/sms/send");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.equal(captured.options.headers.Authorization, "Bearer psk_live_test_key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    to: ["+639123456789", "+639987654321"],
    message: "test message",
    type: "transactional"
  });
});

test("trims ExSender credentials and includes a configured sender ID", async () => {
  let captured;
  await sendSms(
    {
      EXSENDER_API_KEY: "  psk_live_test_key  ",
      EXSENDER_SENDER_ID: " SchoolHeat "
    },
    ["639123456789"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return exSenderAcceptedResponse();
    }
  );
  assert.equal(captured.options.headers.Authorization, "Bearer psk_live_test_key");
  assert.deepEqual(JSON.parse(captured.options.body), {
    to: ["+639123456789"],
    message: "test message",
    type: "transactional",
    senderId: "SchoolHeat"
  });
});

test("reports ExSender rate limits and respects the five-minute retry minimum", async () => {
  const result = await sendSms(
    exSenderCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("too many", {
      status: 429,
      headers: { "Retry-After": "42" }
    })
  );
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "ExSender is temporarily rate-limiting requests; the alert can be retried.",
    providerStatus: 429,
    retryAfterSeconds: 300
  });
});

test("does not automatically retry unclear or rejected ExSender responses", async () => {
  const unclear = await sendSms(
    exSenderCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("server error", { status: 500 })
  );
  assert.equal(unclear.status, 409);
  assert.match(unclear.body.error, /Check ExSender message logs/);

  const rejected = await sendSms(
    exSenderCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({ error: "insufficient_balance" }), { status: 402 })
  );
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error, /ExSender rejected the request/);
});

test("does not report acceptance when ExSender omits message IDs", async () => {
  const result = await sendSms(
    exSenderCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({
      ok: true,
      totals: { accepted: 1, failed: 0, invalid: 0 },
      recipients: [{ to: "+639123456789", status: "pending" }]
    }), { status: 201 })
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check ExSender message logs/);
});

const smsApiPhCredentials = {
  SMSAPIPH_API_KEY: "sms-api-ph-test-key"
};
const smsApiPhAcceptedResponse = () => new Response(JSON.stringify({
  success: true,
  message: "Message sent",
  data: { id: "msg_test" }
}), { status: 200 });

test("sends each recipient through SMS API PH with x-api-key auth and E.164 numbers", async () => {
  const captured = [];
  const waits = [];
  const result = await sendSms(
    smsApiPhCredentials,
    ["639123456789", "639987654321"],
    "test message",
    async (url, options) => {
      captured.push({ url, options });
      return smsApiPhAcceptedResponse();
    },
    async ms => waits.push(ms)
  );
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { sent: 2, failed: 0, queued: true });
  assert.equal(captured.length, 2);
  assert.ok(captured.every(call => call.url === "https://smsapiph.onrender.com/api/v1/send/sms"));
  assert.deepEqual(JSON.parse(captured[0].options.body), {
    recipient: "+639123456789",
    message: "test message"
  });
  assert.deepEqual(JSON.parse(captured[1].options.body), {
    recipient: "+639987654321",
    message: "test message"
  });
  assert.ok(captured.every(call => call.options.method === "POST"));
  assert.ok(captured.every(call => call.options.headers["x-api-key"] === "sms-api-ph-test-key"));
  assert.ok(captured.every(call => call.options.headers["Content-Type"] === "application/json"));
  assert.deepEqual(waits, [10000]);
});

test("trims SMS API PH credentials before sending", async () => {
  let captured;
  const waits = [];
  await sendSms(
    { SMSAPIPH_API_KEY: "  sms-api-ph-test-key  " },
    ["639123456789"],
    "test message",
    async (url, options) => {
      captured = { url, options };
      return smsApiPhAcceptedResponse();
    },
    async ms => waits.push(ms)
  );
  assert.equal(captured.options.headers["x-api-key"], "sms-api-ph-test-key");
  assert.deepEqual(waits, []);
});

test("reports SMS API PH rate limits and respects the five-minute retry minimum", async () => {
  const result = await sendSms(
    smsApiPhCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("too many", {
      status: 429,
      headers: { "Retry-After": "42" }
    })
  );
  assert.equal(result.status, 503);
  assert.deepEqual(result.body, {
    error: "SMS API PH is temporarily rate-limiting requests; the alert can be retried.",
    providerStatus: 429,
    retryAfterSeconds: 300
  });
});

test("does not automatically retry unclear or rejected SMS API PH responses", async () => {
  const unclear = await sendSms(
    smsApiPhCredentials,
    ["639123456789"],
    "test message",
    async () => new Response("server error", { status: 500 })
  );
  assert.equal(unclear.status, 409);
  assert.match(unclear.body.error, /Check SMS API PH message logs/);

  const rejected = await sendSms(
    smsApiPhCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({ success: false, error: "invalid_key" }), { status: 200 })
  );
  assert.equal(rejected.status, 422);
  assert.match(rejected.body.error, /SMS API PH rejected the request/);
});

test("does not automatically retry when the SMS API PH connection fails", async () => {
  const result = await sendSms(
    smsApiPhCredentials,
    ["639123456789"],
    "test message",
    async () => { throw new Error("network failed"); }
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check SMS API PH message logs/);
});

test("does not automatically retry when SMS.to response status is uncertain", async () => {
  const result = await sendSms(
    smsToCredentials,
    ["639123456789", "639987654321"],
    "test message",
    async () => new Response("temporary provider error", { status: 500 })
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check SMS\.to message activity before sending this alert again/);
});

test("does not automatically retry when the SMS.to connection fails", async () => {
  const result = await sendSms(
    smsToCredentials,
    ["639123456789"],
    "test message",
    async () => { throw new Error("network failed"); }
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check SMS\.to message activity before sending this alert again/);
});

test("does not report acceptance when SMS.to returns no campaign or message ID", async () => {
  const result = await sendSms(
    smsToCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({
      success: true,
      message: "Message queued"
    }), { status: 200 })
  );
  assert.equal(result.status, 409);
  assert.match(result.body.error, /Check SMS\.to message activity/);
});

test("does not accept an explicit SMS.to rejection", async () => {
  const result = await sendSms(
    smsToCredentials,
    ["639123456789"],
    "test message",
    async () => new Response(JSON.stringify({
      success: false,
      message: "Invalid sender"
    }), { status: 200 })
  );
  assert.equal(result.status, 422);
  assert.match(result.body.error, /SMS\.to rejected the request/);
});


test("rejects SMS requests without Firebase Auth and App Check", async () => {
  const response = await worker.fetch(new Request("https://sms.example/bridge/sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Origin": "https://johannejumamoy11-rgb.github.io"
    },
    body: JSON.stringify({ test: true, numbers: ["09123456789"] })
  }), {});
  assert.equal(response.status, 401);
});

test("creates a heat alert with the original reading time", () => {
  const message = createMessage({
    location: "Guard House",
    temperature: 40,
    humidity: 70,
    timestamp: "2026-05-01T10:00:00Z"
  });
  assert.match(message, /^SchoolHeat Hinto warning at Guard House:/);
  assert.match(message, /reading/);
});

test("does not create SMS for readings below the heat-alert threshold", () => {
  assert.throws(() => createMessage({
    location: "Guard House",
    temperature: 20,
    humidity: 40,
    timestamp: "2026-05-01T10:00:00Z"
  }), /only for Hinga or Hinto/);
});

test("rate-limits repeated SMS requests for one account", async () => {
  const stored = {};
  const state = {
    storage: {
      get: async key => stored[key],
      put: async (key, value) => { stored[key] = value; },
      delete: async key => { delete stored[key]; }
    }
  };
  const limiter = new SmsRateLimiter(state);

  const createRequest = requestId => new Request("https://sms-rate-limit/check", {
    method: "POST",
    body: JSON.stringify({ action: "reserve", requestId })
  });
  const first = await (await limiter.fetch(createRequest("request-one"))).json();
  const second = await (await limiter.fetch(createRequest("request-two"))).json();
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.ok(second.retryAfterSeconds > 0);
});

test("returns a cached result when a sent SMS request is retried", async () => {
  let stored = {};
  const state = {
    storage: {
      get: async key => stored[key],
      put: async (key, value) => {
        if (typeof key === "object") Object.assign(stored, key);
        else stored[key] = value;
      },
      delete: async key => { delete stored[key]; }
    }
  };
  const limiter = new SmsRateLimiter(state);
  const request = body => new Request("https://sms-rate-limit/check", {
    method: "POST",
    body: JSON.stringify(body)
  });
  await limiter.fetch(request({ action: "reserve", requestId: "request-one" }));
  const result = { status: 200, body: { sent: 1, failed: 0 } };
  await limiter.fetch(request({
    action: "complete",
    requestId: "request-one",
    response: result
  }));
  const retry = await (await limiter.fetch(
    request({ action: "reserve", requestId: "request-one" })
  )).json();
  assert.deepEqual(retry.cached, result);
});
