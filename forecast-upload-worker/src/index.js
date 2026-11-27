const ALLOWED_ORIGINS = [
  "https://johannejumamoy11-rgb.github.io",
  "https://schoolheat-final.web.app",
  "https://schoolheat-final.firebaseapp.com"
];
const FIREBASE_PROJECT_ID = "schoolheat-final";
const FIREBASE_PROJECT_NUMBER = "960776018094";
const FIREBASE_APP_ID = "1:960776018094:web:2d61dc050347340c86f53f";
const APP_CHECK_JWKS_URL = "https://firebaseappcheck.googleapis.com/v1/jwks";
const AUTH_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const GITHUB_API = "https://api.github.com";
const GITHUB_REPO = "johannejumamoy11-rgb/Schoolheat";
const GITHUB_BRANCH = "main";
const DATA_PATH = "data/schoolheat_readings.csv";
const SOURCE_PATH = "data/schoolheat_forecast_source.json";
const WORKFLOW_FILE = "generate-forecast.yml";
const RATE_LIMIT_MS = 5 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 20000;
const jwksCache = new Map();

export function corsHeaders(origin) {
  const headers = { Vary: "Origin", "Cache-Control": "no-store" };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type, Idempotency-Key, X-Firebase-AppCheck, X-Forecast-Upload-Code";
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

function jsonResponse(origin, status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

async function getJwk(url, keyId) {
  let cached = jwksCache.get(url);
  if (!cached || cached.expiresAt <= Date.now() || !cached.keys.some(key => key.kid === keyId)) {
    let response;
    try {
      response = await fetch(url);
    } catch {
      throw new Error("Firebase signing keys are temporarily unavailable.");
    }
    if (!response.ok) throw new Error("Firebase signing keys are temporarily unavailable.");
    const data = await response.json();
    if (!Array.isArray(data.keys)) throw new Error("Firebase signing keys were invalid.");
    cached = { keys: data.keys, expiresAt: Date.now() + 6 * 60 * 60 * 1000 };
    jwksCache.set(url, cached);
  }
  const key = cached.keys.find(candidate => candidate.kid === keyId);
  if (!key) throw new Error("The Firebase token signing key was not found.");
  return key;
}

async function verifyJwt(token, jwksUrl) {
  if (typeof token !== "string" || token.length > 8192) {
    throw new Error("The Firebase token is missing or invalid.");
  }
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("The Firebase token is malformed.");
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== "RS256" || header.typ !== "JWT" || typeof header.kid !== "string") {
    throw new Error("The Firebase token header is invalid.");
  }
  const jwk = await getJwk(jwksUrl, header.kid);
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signatureIsValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    decodeBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );
  if (!signatureIsValid) throw new Error("The Firebase token signature is invalid.");
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(claims.exp) || claims.exp <= nowSeconds ||
      !Number.isFinite(claims.iat) || claims.iat > nowSeconds + 60 ||
      (Number.isFinite(claims.nbf) && claims.nbf > nowSeconds + 60)) {
    throw new Error("The Firebase token has expired or is not yet valid.");
  }
  return claims;
}

async function verifyFirebaseTokens(request) {
  const authorization = request.headers.get("Authorization") || "";
  const idToken = authorization.match(/^Bearer (.+)$/i)?.[1];
  const appCheckToken = request.headers.get("X-Firebase-AppCheck");
  if (!idToken || !appCheckToken) throw new Error("Firebase sign-in and App Check are required.");

  const [authClaims, appCheckClaims] = await Promise.all([
    verifyJwt(idToken, AUTH_JWKS_URL),
    verifyJwt(appCheckToken, APP_CHECK_JWKS_URL)
  ]);
  if (authClaims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}` ||
      authClaims.aud !== FIREBASE_PROJECT_ID ||
      typeof authClaims.sub !== "string" || !authClaims.sub ||
      !Number.isFinite(authClaims.auth_time) || authClaims.auth_time > Date.now() / 1000 + 60) {
    throw new Error("Firebase sign-in is invalid.");
  }
  const appCheckAudience = Array.isArray(appCheckClaims.aud) ? appCheckClaims.aud : [appCheckClaims.aud];
  if (appCheckClaims.iss !== `https://firebaseappcheck.googleapis.com/${FIREBASE_PROJECT_NUMBER}` ||
      !appCheckAudience.includes(`projects/${FIREBASE_PROJECT_NUMBER}`) ||
      appCheckClaims.sub !== FIREBASE_APP_ID) {
    throw new Error("Firebase App Check is invalid.");
  }
  return authClaims.sub;
}

export function parseCsv(text) {
  const source = String(text ?? "").replace(/^\uFEFF/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  let delimiter = ",";
  let maxCount = -1;
  for (const candidate of [",", ";", "\t"]) {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < firstLine.length; index++) {
      if (firstLine[index] === '"') {
        if (quoted && firstLine[index + 1] === '"') index++;
        else quoted = !quoted;
      } else if (!quoted && firstLine[index] === candidate) {
        count++;
      }
    }
    if (count > maxCount) {
      delimiter = candidate;
      maxCount = count;
    }
  }
  if (maxCount < 1) throw new Error("The CSV file does not appear to contain a header row.");

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index++;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index++;
      row.push(cell);
      if (row.some(value => String(value).trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("The CSV file has an unclosed quoted field.");
  row.push(cell);
  if (row.some(value => String(value).trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findColumn(headers, aliases) {
  return headers.findIndex(header => aliases.includes(header));
}

function parseNumber(value) {
  const text = String(value ?? "").trim().replace(/[^\d.,-]/g, "");
  if (!text) return Number.NaN;
  if (text.includes(",") && !text.includes(".")) return Number(text.replace(",", "."));
  return Number(text.replace(/,/g, ""));
}

function formatNumber(value) {
  return String(Number(value.toFixed(3)));
}

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function normalizeDate(value) {
  const text = String(value ?? "").trim();
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      throw new Error("A CSV date is not valid.");
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const short = text.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/);
  if (short) {
    const month = MONTHS[short[2].toLowerCase()];
    if (!month) throw new Error("A CSV date uses an unknown month.");
    const year = short[3].length === 2 ? 2000 + Number(short[3]) : Number(short[3]);
    const day = Number(short[1]);
    const check = new Date(Date.UTC(year, month - 1, day));
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
      throw new Error("A CSV date is not valid.");
    }
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  throw new Error("Use ISO dates such as 2026-11-25 or dates such as 25-Nov-26.");
}

function normalizeTime(value) {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) throw new Error("A CSV timestamp is not valid.");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) throw new Error("A CSV timestamp is not valid.");
  return [hour, minute, second].map(part => String(part).padStart(2, "0")).join(":");
}

export function normalizeForecastCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The CSV has no data rows.");
  if (rows.length - 1 > MAX_ROWS) throw new Error(`Use at most ${MAX_ROWS} CSV rows.`);

  const headers = rows[0].map(normalizeHeader);
  const dateIndex = findColumn(headers, ["date", "readingdate", "recordedat"]);
  const timeIndex = findColumn(headers, ["timestamp", "time", "readingtime"]);
  const temperatureIndex = findColumn(headers, [
    "temperaturec", "temperature", "temp", "tempc", "averagetemperaturec"
  ]);
  const humidityIndex = findColumn(headers, [
    "relativehumiditypct", "humidity", "humiditypercent", "relativehumidity", "rh", "averagehumidity"
  ]);
  const heatIndexColumn = findColumn(headers, [
    "heatindexc", "heatindex", "averageheatindexc", "averageheatindex"
  ]);
  const locationIndex = findColumn(headers, ["location", "site", "campuslocation"]);
  const deviceIndex = findColumn(headers, ["deviceid", "device", "serieskey"]);

  if ([dateIndex, timeIndex, temperatureIndex, humidityIndex, heatIndexColumn].some(index => index < 0)) {
    throw new Error("Include date, timestamp, temperature, humidity, and heat index columns.");
  }

  const lines = ["date,timestamp,device_id,temperature_c,relative_humidity_pct,heat_index_c"];
  const seen = new Set();
  const locations = new Set();
  let deviceId = "1";

  rows.slice(1).forEach((row, rowIndex) => {
    const date = normalizeDate(row[dateIndex]);
    const timestamp = normalizeTime(row[timeIndex]);
    const temperature = parseNumber(row[temperatureIndex]);
    const humidity = parseNumber(row[humidityIndex]);
    const heatIndex = parseNumber(row[heatIndexColumn]);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 60 ||
        !Number.isFinite(humidity) || humidity < 0 || humidity > 100 ||
        !Number.isFinite(heatIndex) || heatIndex < 0 || heatIndex > 70) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid temperature, humidity, or heat index.`);
    }
    const candidateDevice = deviceIndex >= 0 ? String(row[deviceIndex] ?? "").trim() : deviceId;
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(candidateDevice)) {
      throw new Error(`CSV row ${rowIndex + 2} has an invalid device ID.`);
    }
    if (rowIndex === 0) deviceId = candidateDevice;
    else if (candidateDevice !== deviceId) throw new Error("Upload one device or series key per CSV.");
    if (locationIndex >= 0) {
      const location = String(row[locationIndex] ?? "").trim().slice(0, 160);
      if (location) locations.add(location);
    }
    const key = `${date}\t${timestamp}\t${deviceId}`;
    if (seen.has(key)) throw new Error(`CSV row ${rowIndex + 2} repeats an earlier timestamp.`);
    seen.add(key);
    lines.push([
      date,
      timestamp,
      deviceId,
      formatNumber(temperature),
      formatNumber(humidity),
      formatNumber(heatIndex)
    ].join(","));
  });

  if (locations.size > 1) throw new Error("Upload one location per CSV.");
  return {
    csv: `${lines.join("\n")}\n`,
    deviceId,
    location: locations.values().next().value || "",
    rows: lines.length - 1
  };
}

export function base64Encode(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function githubFetch(env, path, options = {}) {
  const token = env.GITHUB_TOKEN?.trim();
  if (!token) throw new Error("The forecast upload Worker has no GitHub token configured.");
  return fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "User-Agent": "SchoolHeat-Forecast-Upload",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.headers || {})
    }
  });
}

async function getFileSha(env, path) {
  const response = await githubFetch(env, `/repos/${GITHUB_REPO}/contents/${path}?ref=${GITHUB_BRANCH}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub could not read ${path} (HTTP ${response.status}).`);
  const data = await response.json();
  return typeof data.sha === "string" ? data.sha : null;
}

async function putFile(env, path, content, sha, message) {
  const body = { message, content: base64Encode(content), branch: GITHUB_BRANCH };
  if (sha) body.sha = sha;
  const response = await githubFetch(env, `/repos/${GITHUB_REPO}/contents/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`GitHub could not save ${path} (HTTP ${response.status}). ${detail.slice(0, 160)}`);
  }
}

async function queueForecastWorkflow(env) {
  const response = await githubFetch(
    env,
    `/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: GITHUB_BRANCH })
    }
  );
  if (!response.ok) throw new Error(`The forecast workflow could not be queued (HTTP ${response.status}).`);
}

function sourceMetadata(normalized) {
  const location = normalized.location || "3 Storey, 15 Classroom, DepEd SS Building";
  return {
    deviceId: normalized.deviceId,
    deviceLabels: {
      [normalized.deviceId]: `${location} row-by-row averages`
    },
    location,
    locationNote: "Row-by-row averages from the uploaded CSV; device_id is a series key, not a physical classroom device, and it is not mapped to a campus map pin."
  };
}

async function commitForecastData(env, normalized) {
  const csvSha = await getFileSha(env, DATA_PATH);
  await putFile(env, DATA_PATH, normalized.csv, csvSha, "Update forecast data from uploaded CSV");
  if (normalized.location) {
    const sourceSha = await getFileSha(env, SOURCE_PATH);
    await putFile(
      env,
      SOURCE_PATH,
      `${JSON.stringify(sourceMetadata(normalized), null, 2)}\n`,
      sourceSha,
      "Update forecast source label from uploaded CSV"
    );
  }
  let workflowQueued = true;
  let workflowError = "";
  try {
    await queueForecastWorkflow(env);
  } catch (error) {
    workflowQueued = false;
    workflowError = error.message;
  }
  return {
    ok: true,
    rows: normalized.rows,
    location: normalized.location || null,
    deviceId: normalized.deviceId,
    workflowQueued,
    workflowError
  };
}

function limiterStub(env, uid) {
  const binding = env.FORECAST_UPLOAD_RATE_LIMITER;
  if (!binding || typeof uid !== "string") return null;
  return binding.get(binding.idFromName(uid));
}

async function checkRateLimit(env, uid, requestId) {
  const stub = limiterStub(env, uid);
  if (!stub) return null;
  const response = await stub.fetch(new Request("https://forecast-upload/", {
    method: "POST",
    body: JSON.stringify({ requestId })
  }));
  return response.json();
}

async function completeRateLimit(env, uid, requestId, response) {
  const stub = limiterStub(env, uid);
  if (!stub) return;
  await stub.fetch(new Request("https://forecast-upload/", {
    method: "POST",
    body: JSON.stringify({ action: "complete", requestId, response: await response.clone().json() })
  }));
}

export function isAuthorizedUploader(env, uid, request) {
  const allowedUids = String(env.FORECAST_UPLOADER_UIDS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  if (uid && allowedUids.includes(uid)) return true;

  const expectedCode = env.FORECAST_UPLOAD_CODE?.trim();
  if (!expectedCode) return false;
  const providedCode = request.headers.get("X-Forecast-Upload-Code") || "";
  return providedCode.length > 0 && providedCode.length <= 200 && providedCode === expectedCode;
}

async function handleUpload(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Use POST to upload a forecast CSV." });
  }

  let uid = null;
  let requestId = "";
  try {
    uid = await verifyFirebaseTokens(request);
    if (!isAuthorizedUploader(env, uid, request)) {
      throw new Error("This account is not allowed to refresh the published forecast.");
    }
    requestId = (request.headers.get("Idempotency-Key") || crypto.randomUUID()).slice(0, 120);
    const decision = await checkRateLimit(env, uid, requestId);
    if (decision?.cached) return jsonResponse(origin, decision.cached.status || 200, decision.cached.body);
    if (decision && decision.allowed === false) {
      return jsonResponse(origin, 429, {
        error: "Please wait before uploading another forecast CSV.",
        retryAfterSeconds: decision.retryAfterSeconds
      });
    }
    if (!env.GITHUB_TOKEN?.trim()) {
      throw new Error("Forecast upload is not configured on the Worker yet.");
    }

    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_BODY_BYTES) {
      throw new Error("Choose a CSV smaller than 2 MB.");
    }
    const normalized = normalizeForecastCsv(new TextDecoder().decode(bytes));
    const result = await commitForecastData(env, normalized);
    const response = jsonResponse(origin, 202, {
      ...result,
      message: result.workflowQueued
        ? "CSV saved. The 60-minute forecast is regenerating."
        : "CSV saved, but the forecast workflow could not be queued."
    });
    await completeRateLimit(env, uid, requestId, response);
    return response;
  } catch (error) {
    const message = error.message || "The forecast CSV could not be uploaded.";
    const status = /sign-in|App Check|token/i.test(message)
      ? 401
      : /not allowed|access|configured on the Worker/i.test(message)
        ? 403
        : /CSV|column|row|date|timestamp|temperature|humidity|heat index|device|location|smaller/i.test(message)
          ? 400
          : 500;
    const response = jsonResponse(origin, status, { error: message });
    if (uid) await completeRateLimit(env, uid, requestId, response);
    return response;
  }
}

export default {
  async fetch(request, env) {
    return handleUpload(request, env);
  }
};

export class ForecastUploadRateLimiter {
  constructor(state) {
    this.state = state;
    this.pendingCheck = Promise.resolve();
  }

  async fetch(request) {
    const body = await request.json();
    const operation = this.pendingCheck.then(async () => {
      if (body.action === "complete") {
        const lastRequestId = await this.state.storage.get("lastRequestId");
        if (lastRequestId === body.requestId) {
          await this.state.storage.put("lastResponse", body.response);
        }
        return { completed: true };
      }

      const lastRequestId = await this.state.storage.get("lastRequestId");
      const lastResponse = await this.state.storage.get("lastResponse");
      if (lastRequestId === body.requestId && lastResponse) {
        return { cached: lastResponse };
      }

      const now = Date.now();
      const lastUploadAt = await this.state.storage.get("lastUploadAt");
      if (Number.isFinite(lastUploadAt) && now - lastUploadAt < RATE_LIMIT_MS) {
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil((RATE_LIMIT_MS - (now - lastUploadAt)) / 1000)
        };
      }
      await this.state.storage.put("lastUploadAt", now);
      await this.state.storage.put("lastRequestId", body.requestId);
      await this.state.storage.delete("lastResponse");
      return { allowed: true };
    });
    this.pendingCheck = operation.then(() => undefined, () => undefined);
    return Response.json(await operation);
  }
}
