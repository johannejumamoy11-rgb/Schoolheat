import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { corsHeaders, normalizeForecastCsv, parseCsv } from "../src/index.js";

const workerSource = fs.readFileSync(path.join(import.meta.dirname, "..", "src", "index.js"), "utf8");

const averagesCsv = [
  "Reading #,Location,Date,Time,Average Temperature (ï¿½C),Average Humidity (%),Average Heat Index (ï¿½C)",
  '1,"3 Storey, 15 Classroom, DepEd SS Building",3-Nov-26,7:00:00,29.933,77.767,36.843',
  '2,"3 Storey, 15 Classroom, DepEd SS Building",3-Nov-26,7:05:00,30.133,75.833,36.917'
].join("\r\n");

test("parses quoted CSV headers and values", () => {
  const rows = parseCsv(averagesCsv);
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], "3 Storey, 15 Classroom, DepEd SS Building");
});

test("converts the supplied averages CSV to the Python forecast format", () => {
  const result = normalizeForecastCsv(averagesCsv);
  assert.equal(result.rows, 2);
  assert.equal(result.deviceId, "1");
  assert.equal(result.location, "3 Storey, 15 Classroom, DepEd SS Building");
  assert.equal(result.csv.split("\n")[0], "date,timestamp,device_id,temperature_c,relative_humidity_pct,heat_index_c");
  assert.equal(result.csv.split("\n")[1], "2026-11-03,07:00:00,1,29.933,77.767,36.843");
  assert.equal(result.csv.split("\n")[2], "2026-11-03,07:05:00,1,30.133,75.833,36.917");
});

test("accepts an already normalized six-column CSV", () => {
  const csv = [
    "date,timestamp,device_id,temperature_c,relative_humidity_pct,heat_index_c",
    "2026-11-25,07:00:00,1,22.79,93.81,20.88"
  ].join("\n");
  const result = normalizeForecastCsv(csv);
  assert.equal(result.rows, 1);
  assert.equal(result.location, "");
  assert.match(result.csv, /2026-11-25,07:00:00,1,22.79,93.81,20.88/);
});

test("rejects duplicate timestamps and invalid measurements", () => {
  const header = "date,timestamp,device_id,temperature_c,relative_humidity_pct,heat_index_c";
  assert.throws(
    () => normalizeForecastCsv([header, "2026-11-25,07:00:00,1,22.79,93.81,20.88", "2026-11-25,07:00:00,1,23,90,21"].join("\n")),
    /repeats an earlier timestamp/
  );
  assert.throws(
    () => normalizeForecastCsv([header, "2026-11-25,07:00:00,1,999,93.81,20.88"].join("\n")),
    /invalid temperature/
  );
});

test("only allows known app origins", () => {
  const headers = corsHeaders("https://johannejumamoy11-rgb.github.io");
  assert.equal(headers["Access-Control-Allow-Origin"], "https://johannejumamoy11-rgb.github.io");
  assert.equal(headers["Access-Control-Allow-Headers"], "Content-Type");
  assert.equal(corsHeaders("https://example.com")["Access-Control-Allow-Origin"], undefined);
});

test("does not require sign-in, an access code, or a rate limit", () => {
  assert.doesNotMatch(workerSource, /verifyFirebaseTokens|isAuthorizedUploader|checkRateLimit/);
  assert.doesNotMatch(workerSource, /FORECAST_UPLOAD_CODE|FORECAST_UPLOADER_UIDS|X-Forecast-Upload-Code/);
  assert.doesNotMatch(workerSource, /X-Firebase-AppCheck|Idempotency-Key|ForecastUploadRateLimiter/);
});

test("commits source metadata before the CSV that starts the forecast job", () => {
  const commitForecastData = workerSource.match(/async function commitForecastData[\s\S]*?\n}\n/)?.[0] || "";
  assert.ok(commitForecastData.indexOf("SOURCE_PATH") < commitForecastData.indexOf("DATA_PATH"));
});
