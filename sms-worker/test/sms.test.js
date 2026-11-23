import assert from "node:assert/strict";
import test from "node:test";
import worker, { createMessage, normalizeNumbers, sendSms, SmsRateLimiter } from "../src/index.js";

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

test("requires an SMS.to API key", async () => {
  await assert.rejects(
    sendSms(
      { SMSTO_API_KEY: "   " },
      ["639123456789"],
      "test message"
    ),
    /SMS.to is not configured/
  );
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
