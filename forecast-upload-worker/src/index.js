const ALLOWED_ORIGINS = [
  "https://johannejumamoy11-rgb.github.io",
  "https://schoolheat-final.web.app",
  "https://schoolheat-final.firebaseapp.com"
];
const GITHUB_API = "https://api.github.com";
const GITHUB_REPO = "johannejumamoy11-rgb/Schoolheat";
const GITHUB_BRANCH = "main";
const DATA_PATH = "data/schoolheat_readings.csv";
const SOURCE_PATH = "data/schoolheat_forecast_source.json";
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 20000;

export function corsHeaders(origin) {
  const headers = { Vary: "Origin", "Cache-Control": "no-store" };
  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
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
  return {
    ok: true,
    rows: normalized.rows,
    location: normalized.location || null,
    deviceId: normalized.deviceId,
    forecastQueued: true
  };
}

async function handleUpload(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST") {
    return jsonResponse(origin, 405, { error: "Use POST to upload a forecast CSV." });
  }

  try {
    if (!env.GITHUB_TOKEN?.trim()) {
      throw new Error("Forecast upload is not configured on the Worker yet.");
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_BODY_BYTES) {
      throw new Error("Choose a CSV smaller than 2 MB.");
    }
    const normalized = normalizeForecastCsv(new TextDecoder().decode(bytes));
    const result = await commitForecastData(env, normalized);
    return jsonResponse(origin, 202, {
      ...result,
      message: "CSV saved. The 60-minute forecast is regenerating."
    });
  } catch (error) {
    const message = error.message || "The forecast CSV could not be uploaded.";
    const status = /configured on the Worker/i.test(message)
      ? 403
      : /CSV|column|row|date|timestamp|temperature|humidity|heat index|device|location|smaller/i.test(message)
        ? 400
        : 500;
    return jsonResponse(origin, status, { error: message });
  }
}

export default {
  async fetch(request, env) {
    return handleUpload(request, env);
  }
};
