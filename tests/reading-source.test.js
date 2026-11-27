const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const scriptPath = path.join(__dirname, '..', 'script.js');
const script = fs.readFileSync(scriptPath, 'utf8');
const indexPath = path.join(__dirname, '..', 'index.html');
const index = fs.readFileSync(indexPath, 'utf8');
const appBootstrap = /\r?\nconst app = new SchoolHeatApp\(\);\r?\nwindow\.app = app;\s*$/;

assert.match(script, appBootstrap);
const isolatedScript = script.replace(appBootstrap, '');
const context = { window: {} };
vm.runInNewContext(
  `${isolatedScript}\nglobalThis.SchoolHeatAppForTest = SchoolHeatApp;\nglobalThis.SchoolHeatLocationsForTest = LOCATIONS;\nglobalThis.SchoolHeatStatusColorForTest = getStatusColor;\nglobalThis.SchoolHeatAccessibleAccentForTest = getAccessibleAccent;\nglobalThis.SchoolHeatAccessibleColorForTest = getAccessibleColor;\nglobalThis.SchoolHeatContrastRatioForTest = getContrastRatio;\nglobalThis.SchoolHeatReadableTextColorForTest = getReadableTextColor;\nglobalThis.SchoolHeatCustomPaletteDefaultsForTest = CUSTOM_THEME_COLOR_DEFAULTS;\nglobalThis.SchoolHeatPaletteValidationForTest = getCustomPaletteValidationError;\nglobalThis.SchoolHeatPaletteNormalizationForTest = normalizeCustomPaletteColors;\nglobalThis.SchoolHeatColorPalettesForTest = APP_COLOR_PALETTES;\nglobalThis.SchoolHeatCustomAccentChoicesForTest = CUSTOM_ACCENT_CHOICES;\nglobalThis.SchoolHeatCustomPaletteGeneratorForTest = createCustomPaletteColors;\nglobalThis.SchoolHeatNormalizeTextSizeForTest = normalizeTextSize;globalThis.ForecastCandidatesForTest = FORECAST_CANDIDATE_MODELS;globalThis.ForecastHorizonForTest = FORECAST_HORIZON_MINUTES;globalThis.ForecastDefaultForTest = FORECAST_DEFAULT_MODEL;`,
  context
);

const app = Object.create(context.SchoolHeatAppForTest.prototype);

test('removes file-import controls and implementation', () => {
  assert.doesNotMatch(index, /history-upload|history-file-input|Choose data file/);
  assert.doesNotMatch(script, /importReadingsFile|parseDelimitedText|parseXlsxFile|normalizeUploadedReadings/);
  assert.doesNotMatch(script, /getReadingSourceLabel/);
});

test('offers one-tap swatches plus one full-spectrum picker', () => {
  const paletteChoices = [...index.matchAll(/data-palette-choice="([^"]+)"/g)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(paletteChoices, ['canopy','coral','lagoon','mint','monochrome','ocean','schoolheat','solar','sunset','twilight','violet','warmfield']);
  const accentChoices = [...index.matchAll(/data-custom-accent-choice="([^"]+)"/g)]
    .map(match => match[1])
    .sort();
  assert.deepEqual(accentChoices, [...context.SchoolHeatCustomAccentChoicesForTest].sort());
  assert.equal(accentChoices.length, 24);
  assert.match(index, /input id="setting-any-color" type="color"/);
  assert.equal((index.match(/type="color"/g) || []).length, 1);
  assert.doesNotMatch(index, /data-custom-palette-field/);
  assert.doesNotMatch(script, /readCustomPaletteInputs|setCustomPaletteStatus/);
  assert.match(script, /addEventListener\('change', \(\) => applyCustomAccent\(anyColorPicker\.value\)\)/);
});

test('offers balanced warm and cool palette harmonies instead of a one-color system', () => {
  assert.equal((index.match(/data-custom-palette-style="[^"]+"/g) || []).length, 6);
  assert.match(index, /data-custom-palette-style="balanced"/);
  assert.match(index, /data-custom-palette-style="warm"/);
  assert.match(index, /data-custom-palette-style="cool"/);
  assert.match(script, /customPaletteStyle: 'balanced'/);
  for (const style of ['balanced', 'warm', 'cool', 'analogous', 'complementary', 'monochrome']) {
    const palette = context.SchoolHeatCustomPaletteGeneratorForTest('dark', '#287985', style);
    assert.notEqual(palette.accent, palette.secondaryAccent);
  }
});

test('shows the same labeled 4H gauge range on dashboard and monitor', () => {
  assert.equal((index.match(/class="gauge-range-key/g) || []).length, 2);
  assert.match(index, /aria-label="DepEd 4H heat-index range"/);
  for (const label of ['Hayo', 'Hinay', 'Hinga', 'Hinto']) {
    assert.ok(index.includes(`>${label}</span>`));
  }
});

test('makes the heat-index gauge the visual focus on dashboard and monitor', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(style, /GAUGE EMPHASIS/);
  assert.match(style, /#tab-dashboard \.dashboard-gauge-block\s*\{[^}]*flex-basis: 260px;/);
  assert.match(style, /#tab-dashboard \.reading-gauge-wrap\s*\{[^}]*width: min\(260px, 46vw\);[^}]*var\(--latest-reading-bg\)/);
  assert.match(style, /#tab-monitor \.monitor-gauge-wrap\s*\{[^}]*max-width: 320px;[^}]*var\(--bg-card\)/);
  assert.match(style, /#tab-dashboard \.gauge-value\s*\{[^}]*font-size: clamp\(2rem, 3\.6vw, 2\.8rem\)/);
  assert.match(style, /#tab-monitor \.monitor-gauge-value\s*\{[^}]*font-size: 2\.6rem/);
  assert.match(style, /\.gauge-range-key \.safe\s*\{[^}]*background: color-mix/);
  assert.match(script, /ctx\.lineWidth = lineWidth \* 0\.58;[\s\S]{0,80}ctx\.globalAlpha = 0\.32;/);
  assert.match(script, /ctx\.lineWidth = lineWidth \* 0\.55;[\s\S]{0,80}ctx\.globalAlpha = 0\.4;/);
});

test('uses the wide monitor card without oversizing the gauge or classification', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  assert.match(index, /class="monitor-gauge-details"/);
  assert.match(index, /class="monitor-classification"/);
  assert.match(index, /id="monitor-gauge-status" aria-live="polite"/);
  assert.match(style, /MONITOR GAUGE & CLASSIFICATION FOCUS/);
  assert.match(style, /#tab-monitor \.monitor-gauge-status\s*\{[^}]*font-size: clamp\(1\.5rem, 3vw, 2\.1rem\)/);
  assert.match(style, /@media \(min-width: 820px\) \{[\s\S]*?#tab-monitor \.monitor-gauge-card\s*\{[^}]*grid-template-areas:/);
  assert.match(style, /"gauge details"/);
  assert.match(style, /"note note"/);
  assert.match(style, /#tab-monitor \.monitor-gauge-details\s*\{[^}]*justify-content: space-between[^}]*min-height: 280px/);
  assert.match(style, /#tab-monitor \.monitor-scales\s*\{[^}]*flex-direction: column/);
  assert.match(style, /@media \(min-width: 1100px\) \{[\s\S]*?#tab-monitor \.monitor-gauge-wrap\s*\{[^}]*min-height: 300px/);
  assert.match(script, /if \(this\.currentTab === 'monitor'\) \{\s*this\.updateMonitorGauge\(\);\s*\}/);
  assert.equal(locales.split(`'DepEd 4H classification':`).length - 1, 3);
});

test('keeps the latest-reading card neutral instead of using the selected accent as a giant background', () => {
  assert.doesNotMatch(script, /setProperty\('--latest-reading-bg', accent\)/);
  assert.match(script, /theme === 'dark' \? '#1d5147' : '#1d5e54'/);
  assert.match(script, /setProperty\('--latest-reading-text', '#fffdf6'\)/);
});

test('builds readable full palettes from one selected color in both themes', () => {
  const defaults = context.SchoolHeatCustomPaletteDefaultsForTest;
  const createPalette = context.SchoolHeatCustomPaletteGeneratorForTest;
  const validate = context.SchoolHeatPaletteValidationForTest;
  context.SchoolHeatCustomAccentChoicesForTest.forEach(color => {
    ['dark', 'light'].forEach(theme => {
      const palette = createPalette(theme, color);
      assert.equal(validate(palette), '');
      assert.notEqual(palette.background, defaults[theme].background);
      assert.notEqual(palette.surface, defaults[theme].surface);
      assert.equal(palette.text, defaults[theme].text);
      assert.equal(palette.secondaryText, defaults[theme].secondaryText);
    });
  });
  ['dark', 'light'].forEach(theme => {
    assert.equal(validate(createPalette(theme, '#e83e92')), '');
  });
});

test('keeps reading history out of Settings and preserves alert controls', () => {
  assert.doesNotMatch(index, /Heat Alert Activity|alert-history-list/);
  assert.doesNotMatch(script, /renderAlertHistory/);
  assert.match(index, /id="alerts-center"/);
});

test('uses plain language for old readings', () => {
  const freshnessApp = Object.create(context.SchoolHeatAppForTest.prototype);
  const freshness = freshnessApp.getReadingFreshness({
    timestamp: new Date(Date.now() - 16 * 60 * 1000).toISOString()
  });

  assert.equal(freshness.state, 'stale');
  assert.equal(freshness.label, 'OLD DATA');
  assert.equal(freshness.detail, 'Last reading 16 min ago. Update the sensor to get a new reading.');
});

test('keeps user-selected accent colors readable against both theme surfaces', () => {
  const accents = ['#ffffff', '#000000', '#ff4f8b', '#287985'];
  const surfaces = ['#fffdf6', '#192624'];
  accents.forEach(accent => {
    const textColor = context.SchoolHeatReadableTextColorForTest(accent);
    assert.ok(
      context.SchoolHeatContrastRatioForTest(textColor, accent) >= 4.5,
      `${textColor} must meet 4.5:1 contrast on ${accent}`
    );
    surfaces.forEach(surface => {
      const readableAccent = context.SchoolHeatAccessibleAccentForTest(accent, surface);
      assert.ok(
        context.SchoolHeatContrastRatioForTest(readableAccent, surface) >= 4.5,
        `${readableAccent} must meet 4.5:1 contrast on ${surface}`
      );
    });
  });
});

test('validates full custom palettes for readable text in each theme', () => {
  const defaults = context.SchoolHeatCustomPaletteDefaultsForTest;
  const validation = context.SchoolHeatPaletteValidationForTest;
  ['dark', 'light'].forEach(theme => {
    const palettes = [
      defaults[theme],
      context.SchoolHeatColorPalettesForTest.canopy[theme],
      context.SchoolHeatColorPalettesForTest.lagoon[theme],
      context.SchoolHeatColorPalettesForTest.solar[theme],
      context.SchoolHeatColorPalettesForTest.twilight[theme],
      context.SchoolHeatColorPalettesForTest.sunset[theme],
      context.SchoolHeatColorPalettesForTest.coral[theme],
      context.SchoolHeatColorPalettesForTest.mint[theme],
      context.SchoolHeatColorPalettesForTest.ocean[theme],
      context.SchoolHeatColorPalettesForTest.violet[theme],
      context.SchoolHeatColorPalettesForTest.monochrome[theme],
      context.SchoolHeatColorPalettesForTest.warmfield[theme]
    ];
    palettes.forEach(colors => {
      assert.equal(validation(colors), '');
      const surfaces = [colors.background, colors.surface];
      [colors.accent, colors.secondaryAccent].forEach(accent => {
        const readableAccent = context.SchoolHeatAccessibleAccentForTest(accent, surfaces);
        assert.ok(readableAccent);
        surfaces.forEach(surface => {
          assert.ok(context.SchoolHeatContrastRatioForTest(readableAccent, surface) >= 4.5);
        });
      });
      const readableBorder = context.SchoolHeatAccessibleColorForTest(colors.border, surfaces, 3);
      assert.ok(readableBorder);
      surfaces.forEach(surface => {
        assert.ok(context.SchoolHeatContrastRatioForTest(readableBorder, surface) >= 3);
      });
    });
  });

  const unreadable = { ...defaults.light, text: '#ffffff' };
  assert.match(validation(unreadable), /Main text needs at least 4\.5:1 contrast/);
});

test('keeps custom palettes separate for light and dark themes and migrates saved accents', () => {
  const normalized = context.SchoolHeatPaletteNormalizationForTest(null, '#c14eb3');
  assert.equal(normalized.dark.accent, '#c14eb3');
  assert.equal(normalized.light.accent, '#c14eb3');
  assert.notEqual(normalized.dark.background, normalized.light.background);

  const edited = {
    dark: { ...normalized.dark, background: '#183129' },
    light: { ...normalized.light, background: '#f5f0dc' }
  };
  const restored = context.SchoolHeatPaletteNormalizationForTest(edited, '#287985');
  assert.equal(restored.dark.background, '#183129');
  assert.equal(restored.light.background, '#f5f0dc');
});

test('does not show stale or demo danger readings as active heat alerts', () => {
  const previousDocument = context.document;
  const makeAlertApp = reading => {
    const calls = [];
    const banner = { style: { display: 'none' } };
    const text = { textContent: '' };
    context.document = {
      getElementById: id => ({
        'alert-banner': banner,
        'alert-text': text
      })[id] || null
    };
    const alertApp = Object.create(context.SchoolHeatAppForTest.prototype);
    alertApp.readings = [reading];
    alertApp.lastObservedReadingId = 'previous-reading';
    alertApp.settings = { pushAlerts: true, smsAlerts: true };
    alertApp.translateText = value => value;
    alertApp.formatTime = () => '3:00 PM';
    alertApp.toast = () => calls.push('toast');
    alertApp.showBrowserNotification = () => calls.push('browser');
    alertApp.sendHeatPushAlert = () => calls.push('push');
    alertApp.sendHeatSmsAlert = () => calls.push('sms');
    return { alertApp, banner, text, calls };
  };

  try {
    const staleReading = {
      id: 'stale-reading',
      location: 'School Clinic',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      temperature: 38,
      humidity: 80,
      heatIndex: 45,
      status: 'extreme'
    };
    const stale = makeAlertApp(staleReading);
    stale.alertApp.checkAlerts();
    assert.equal(stale.banner.style.display, 'none');
    assert.deepEqual(stale.calls, []);

    const demoReading = {
      ...staleReading,
      id: 'demo-reading',
      timestamp: new Date().toISOString(),
      isDemo: true
    };
    const demo = makeAlertApp(demoReading);
    demo.alertApp.checkAlerts();
    assert.equal(demo.banner.style.display, 'none');
    assert.deepEqual(demo.calls, []);
  } finally {
    if (previousDocument === undefined) delete context.document;
    else context.document = previousDocument;
  }
});

test('shows and sends a warning for a recent, valid, non-demo danger reading', () => {
  const previousDocument = context.document;
  const calls = [];
  const banner = { style: { display: 'none' } };
  const text = { textContent: '' };
  context.document = {
    getElementById: id => ({
      'alert-banner': banner,
      'alert-text': text
    })[id] || null
  };
  const alertApp = Object.create(context.SchoolHeatAppForTest.prototype);
  const reading = {
    id: 'recent-reading',
    location: 'School Clinic',
    timestamp: new Date().toISOString(),
    temperature: 38,
    humidity: 80,
    heatIndex: 45,
    status: 'extreme'
  };
  alertApp.readings = [reading];
  alertApp.lastObservedReadingId = 'previous-reading';
  alertApp.settings = { pushAlerts: true, smsAlerts: true };
  alertApp.translateText = value => value;
  alertApp.formatTime = () => '3:00 PM';
  alertApp.toast = () => calls.push('toast');
  alertApp.showBrowserNotification = () => calls.push('browser');
  alertApp.sendHeatPushAlert = () => calls.push('push');
  alertApp.sendHeatSmsAlert = () => calls.push('sms');

  try {
    alertApp.checkAlerts();

    assert.equal(banner.style.display, 'flex');
    assert.match(text.textContent, /Recent high heat reading: Hinto at School Clinic — 45\.0°C · 3:00 PM/);
    assert.deepEqual(calls, ['toast', 'browser', 'push', 'sms']);
  } finally {
    if (previousDocument === undefined) delete context.document;
    else context.document = previousDocument;
  }
});

test('uses the active theme color for chart risk statuses', () => {
  const previousDocument = context.document;
  const previousGetComputedStyle = context.getComputedStyle;
  context.document = { documentElement: {} };
  context.getComputedStyle = () => ({
    getPropertyValue: name => name === '--safe' ? '#176a4d' : ''
  });

  try {
    assert.equal(context.SchoolHeatStatusColorForTest('safe'), '#176a4d');
    assert.equal(context.SchoolHeatStatusColorForTest('caution'), '#f0c66c');
  } finally {
    if (previousDocument === undefined) delete context.document;
    else context.document = previousDocument;
    if (previousGetComputedStyle === undefined) delete context.getComputedStyle;
    else context.getComputedStyle = previousGetComputedStyle;
  }
});

test('shows the pending published forecast without evaluating local JS models', async () => {
  const forecastApp = Object.create(context.SchoolHeatAppForTest.prototype);
  const attributes = {};
  let selectedTab = '';
  const elements = {
    'dashboard-forecast-empty': { hidden: true },
    'dashboard-forecast-empty-title': { textContent: '' },
    'dashboard-forecast-empty-detail': { textContent: '' },
    'dashboard-forecast-action': { onclick: null },
    'dashboard-forecast-action-label': { textContent: '' },
    'dashboard-forecast-content': { hidden: false },
    'dashboard-forecast-chart': {
      setAttribute: (name, value) => { attributes[name] = value; }
    }
  };
  context.document = { getElementById: id => elements[id] || null };
  forecastApp.translateText = text => text;
  forecastApp.switchTab = tab => { selectedTab = tab; };
  forecastApp.currentTab = 'dashboard';
  forecastApp.buildForecastComparison = async () => ({
    published: true,
    pending: true,
    message: 'The scheduled Python forecast has not run yet.',
    horizonMinutes: 60
  });
  forecastApp.getBestForecastModel = () => {
    throw new Error('A pending forecast must not select a local JS model.');
  };

  await forecastApp.renderDashboardForecast();

  assert.equal(elements['dashboard-forecast-empty'].hidden, false);
  assert.equal(elements['dashboard-forecast-content'].hidden, true);
  assert.equal(elements['dashboard-forecast-empty-title'].textContent, 'Forecast not generated');
  assert.match(elements['dashboard-forecast-empty-detail'].textContent, /Python forecast/);
  assert.equal(elements['dashboard-forecast-action-label'].textContent, 'View forecast details');
  elements['dashboard-forecast-action'].onclick();
  assert.equal(selectedTab, 'forecast');
  assert.match(attributes['aria-label'], /not been generated/);
});

test('normalizes the published 60-minute forecast and selects the lowest-RMSE model', () => {
  const publishedApp = Object.create(context.SchoolHeatAppForTest.prototype);
  const now = Date.now();
  const at = minutes => new Date(now + minutes * 60000).toISOString();
  const metric = rmse => ({
    mae: rmse * 0.8,
    rmse,
    mape: 2,
    r2: 0.9,
    samples: 12,
    hazardMisses: 0,
    hazardSamples: 2,
    hazardMissRate: 0,
    evaluationStart: at(-720),
    evaluationEnd: at(-60)
  });
  const payload = {
    schemaVersion: 1,
    status: 'ready',
    horizonMinutes: 60,
    generatedAt: at(0),
    dataStart: at(-1440),
    dataEnd: at(0),
    deviceId: '1',
    location: 'Classroom device 1',
    current: { minute: Math.floor(now / 60000), date: at(0), value: 36 },
    forecast: [{ date: at(60), value: 38, status: 'danger' }],
    history: [{ minute: Math.floor(now / 60000) - 5, date: at(-5), value: 35.8 }],
    models: {
      'random-forest': { value: 37.5, status: 'danger' },
      'xgboost-style': { value: 38, status: 'danger' },
      'lightgbm-style': { value: 37.9, status: 'danger' }
    },
    bestModel: 'xgboost-style',
    metrics: {
      'random-forest': metric(1.2),
      'xgboost-style': metric(0.9),
      'lightgbm-style': metric(1.0)
    },
    trainingSamples: 900
  };

  const normalized = publishedApp.normalizePublishedForecast(payload);
  assert.equal(normalized.published, true);
  assert.equal(normalized.pending, false);
  assert.equal(normalized.horizonMinutes, 60);
  assert.equal(normalized.history.length, 1);

  const best = publishedApp.getBestForecastModel(normalized);
  assert.equal(best.name, 'xgboost-style');
  assert.equal(best.label, 'XGBoost (Python)');
  assert.equal(best.metric.rmse, 0.9);
});

test('honors the published best model when holdouts are provisional', () => {
  const provisionalApp = Object.create(context.SchoolHeatAppForTest.prototype);
  const metric = rmse => ({
    mae: rmse * 0.8, rmse, mape: 2, r2: 0.8, samples: 9,
    hazardMisses: 0, hazardSamples: 9, hazardMissRate: 0
  });
  const best = provisionalApp.getBestForecastModel({
    bestModel: 'random-forest',
    models: {
      'random-forest': { value: 35.47, status: 'danger' },
      'xgboost-style': { value: 37.42, status: 'danger' },
      'lightgbm-style': { value: 37.28, status: 'danger' }
    },
    metrics: {
      'random-forest': metric(2.202),
      'xgboost-style': metric(2.3325),
      'lightgbm-style': metric(2.5933)
    }
  });

  assert.equal(best.name, 'random-forest');
  assert.equal(best.label, 'Random Forest (Python)');
  assert.equal(best.metric.samples, 9);
  assert.equal(best.result.value, 35.47);
});

test('publishes a real Python 60-minute forecast job', () => {
  const root = path.join(__dirname, '..');
  for (const file of [
    'forecast.json',
    'requirements-forecast.txt',
    'scripts/generate_forecast.py',
    '.github/workflows/generate-forecast.yml',
    'data/schoolheat_readings.csv',
    'data/schoolheat_forecast_source.json'
  ]) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} should exist`);
  }

  const publishedForecast = JSON.parse(fs.readFileSync(path.join(root, 'forecast.json'), 'utf8'));
  assert.equal(publishedForecast.horizonMinutes, 60);
  if (publishedForecast.status === 'pending') {
    assert.equal(publishedForecast.generatedAt, null);
  } else {
    assert.equal(publishedForecast.status, 'ready');
    assert.match(publishedForecast.generatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(publishedForecast.bestModel);
    const rankedModels = Object.entries(publishedForecast.metrics)
      .filter(([, metric]) => Number.isFinite(metric.rmse))
      .sort((a, b) => a[1].rmse - b[1].rmse);
    if (rankedModels.length) {
      assert.equal(publishedForecast.bestModel, rankedModels[0][0]);
    }
  }

  const requirements = fs.readFileSync(path.join(root, 'requirements-forecast.txt'), 'utf8');
  for (const dependency of [
    'numpy==2.3.5',
    'pandas==2.2.3',
    'scikit-learn==1.8.0',
    'xgboost==3.1.3',
    'lightgbm==4.6.0'
  ]) {
    assert.ok(requirements.includes(dependency), `${dependency} should be pinned`);
  }

  const python = fs.readFileSync(path.join(root, 'scripts', 'generate_forecast.py'), 'utf8');
  assert.match(python, /from sklearn\.ensemble import RandomForestRegressor/);
  assert.match(python, /from xgboost import XGBRegressor/);
  assert.match(python, /from lightgbm import LGBMRegressor/);
  assert.match(python, /HORIZON_MINUTES = 60/);
  assert.match(python, /out\["minute_of_day"\] >= SCHOOL_START_MINUTE/);
  assert.match(python, /SOURCE_METADATA/);
  assert.match(python, /load_source_metadata\(\)/);
  assert.match(python, /metadata\.get\("locationNote"\)/);
  assert.match(python, /VALIDATION_DAYS = 4/);
  assert.match(python, /all_dates\[-VALIDATION_DAYS:\]/);
  assert.doesNotMatch(python, /all_dates\[8:\]/);
  assert.match(python, /lowest validated RMSE/i);
  assert.doesNotMatch(python, /metric\["samples"\] >= MIN_HOLDOUTS/);
  assert.match(python, /Fewer than \{MIN_HOLDOUTS\} holdout samples are available, so this forecast is provisional\./);
  assert.doesNotMatch(python, /send_sms|twilio|semaphore/i);

  const workflow = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'generate-forecast.yml'),
    'utf8'
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /branches:\s*\n\s*- forecast-python-60min-test/);
  assert.match(workflow, /github\.event_name != 'push' \|\| github\.actor != 'github-actions\[bot\]'/);
  assert.match(workflow, /cron: '17 2 \* \* \*'/);
  assert.match(workflow, /python-version: '3\.11'/);
  assert.match(workflow, /python -m pip install -r requirements-forecast\.txt/);
  assert.match(workflow, /FORECAST_DEVICE_ID: \$\{\{ vars\.FORECAST_DEVICE_ID \}\}/);
  assert.match(workflow, /git add forecast\.json/);

  const csvHeader = fs.readFileSync(path.join(root, 'data', 'schoolheat_readings.csv'), 'utf8')
    .split(/\r?\n/)[0]
    .trim();
  assert.equal(
    csvHeader,
    'date,timestamp,device_id,temperature_c,relative_humidity_pct,heat_index_c'
  );
  const csvRows = fs.readFileSync(path.join(root, 'data', 'schoolheat_readings.csv'), 'utf8')
    .trim()
    .split(/\r?\n/);
  assert.ok(csvRows[csvRows.length - 1].startsWith('2026-11-25,'));
  const sourceMetadata = JSON.parse(
    fs.readFileSync(path.join(root, 'data', 'schoolheat_forecast_source.json'), 'utf8')
  );
  assert.equal(sourceMetadata.location, '3 Storey, 15 Classroom, DepEd SS Building');
  assert.match(sourceMetadata.locationNote, /series key/i);

  assert.deepEqual([...context.ForecastCandidatesForTest], [
    'random-forest', 'xgboost-style', 'lightgbm-style'
  ]);
  assert.equal(context.ForecastHorizonForTest, 60);
  assert.equal(context.ForecastDefaultForTest, 'xgboost-style');

  const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
  assert.match(serviceWorker, /pathname\.endsWith\('\/forecast\.json'\)/);
  assert.match(serviceWorker, /fetch\(e\.request, \{ cache: 'reload' \}\)/);
  assert.match(serviceWorker, /caches\.open\(CACHE_NAME\)\.then\(cache => cache\.put\(requestUrl\.href, copy\)\)/);
  assert.match(index, /60-Minute Forecast/);
  assert.doesNotMatch(index, /30-Minute Forecast|custom JavaScript|offline custom JavaScript models|at least 12 complete/i);

  const i18nContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'locales.js'), 'utf8'), i18nContext);
  const dictionaries = i18nContext.window.SCHOOLHEAT_I18N.translations;
  const pendingMessage = 'The scheduled Python forecast has not run yet. A real 60-minute forecast using Random Forest, XGBoost, and LightGBM will appear after the GitHub Actions workflow completes.';
  for (const language of ['tl', 'ceb', 'war']) {
    assert.ok(dictionaries[language]['Forecast not generated'], `${language} needs the pending forecast title`);
    assert.ok(
      dictionaries[language][pendingMessage],
      `${language} needs the pending forecast message`
    );
  }

  for (const language of ['en', 'tl', 'ceb', 'war']) {
    const manual = fs.readFileSync(
      path.join(root, 'manual', `APP_OPERATION_MANUAL-${language}.md`),
      'utf8'
    );
    assert.doesNotMatch(
      manual,
      /30-Minute Forecast|Tagna sa 30 Minutos|30-Minolutong|30-minutong outlook|Tagna sa 30 minutos|Paglantaw ha 30 minutos/
    );
  }
});

test('forecast validation yields between bounded walk-forward folds', async () => {
  const validationApp = Object.create(context.SchoolHeatAppForTest.prototype);
  let yieldCount = 0;
  const previousSetTimeout = context.window.setTimeout;
  context.window.setTimeout = callback => {
    yieldCount++;
    return setTimeout(callback, 0);
  };
  validationApp.getForecastSeed = () => 1;
  validationApp.getExtendedMlrFeatures = features => features;
  validationApp.fitForecastModel = () => () => 0;
  validationApp.getStatus = () => 'safe';
  const examples = Array.from({ length: 14 }, (_, index) => ({
    minute: index * 35,
    current: 30,
    actual: 31,
    target: 0.1,
    features: [index]
  }));

  try {
    const metrics = await validationApp.evaluateForecastModels(examples);
    assert.equal(metrics['random-forest'].samples, 2);
    assert.equal(yieldCount, 2);
  } finally {
    context.window.setTimeout = previousSetTimeout;
  }
});

test('defers dashboard forecast work until the preview is near the viewport and idle', () => {
  let idleCallback = null;
  let renderCount = 0;
  const card = {
    rect: { width: 100, top: 900, bottom: 1000 },
    getBoundingClientRect() { return this.rect; }
  };
  context.window.innerHeight = 500;
  context.window.requestIdleCallback = callback => { idleCallback = callback; };
  context.document = {
    documentElement: { clientHeight: 500 },
    querySelector: selector => selector === '.forecast-preview-card' ? card : null
  };
  app.currentTab = 'dashboard';
  app.dashboardForecastRenderScheduled = false;
  app.renderDashboardForecast = () => { renderCount++; };

  app.scheduleDashboardForecastRender();
  assert.equal(idleCallback, null);
  assert.equal(renderCount, 0);

  card.rect = { width: 100, top: 600, bottom: 700 };
  app.scheduleDashboardForecastRender();
  assert.equal(renderCount, 0);
  idleCallback();
  assert.equal(renderCount, 1);
});

test('does not render the history list while its tab is hidden', () => {
  const list = { innerHTML: 'placeholder' };
  context.document = {
    getElementById: id => id === 'history-list' ? list : null
  };
  app.currentTab = 'dashboard';
  app.readings = Array.from({ length: 60 }, (_, index) => ({
    location: `Location ${index}`,
    status: 'safe',
    heatIndex: 25,
    timestamp: new Date().toISOString()
  }));

  app.renderHistory();

  assert.equal(list.innerHTML, 'placeholder');
});

test('keeps history to one page, hides ordinary source labels, and filters all readings', () => {
  const list = { innerHTML: '' };
  const search = { value: '' };
  const filter = { value: 'all' };
  let pendingFilter = null;
  context.window.setTimeout = callback => {
    pendingFilter = callback;
    return 1;
  };
  context.window.clearTimeout = () => {};
  context.document = {
    getElementById: id => ({
      'history-list': list,
      'history-search': search,
      'history-filter': filter
    })[id] || null
  };
  app.currentTab = 'history';
  app.historyPage = 0;
  app.readings = Array.from({ length: 75 }, (_, index) => ({
    location: `Location ${index}`,
    status: 'safe',
    heatIndex: 25,
    temperature: 24,
    humidity: 50,
    timestamp: new Date().toISOString(),
    source: 'manual',
    sourceFile: 'private-file.csv',
    isDemo: index === 74
  }));
  app.escapeHTML = text => text;
  app.formatDate = () => 'date';
  app.formatClockTime = () => 'time';
  app.formatTime = () => 'time';
  app.translateText = text => text;
  app.drawDistributionChart = () => {};
  app.drawTrendChart = () => {};

  app.renderHistory();
  assert.equal((list.innerHTML.match(/class="history-item"/g) || []).length, 50);
  assert.match(list.innerHTML, /data-history-page="1"/);
  assert.doesNotMatch(list.innerHTML, /MANUAL ENTRY|private-file\.csv|IMPORTED/);

  app.historyPage = 1;
  app.renderHistory(false);
  assert.equal((list.innerHTML.match(/class="history-item"/g) || []).length, 25);
  assert.match(list.innerHTML, /data-history-page="-1"/);

  search.value = 'location 74';
  app.filterHistory();
  pendingFilter();
  assert.equal((list.innerHTML.match(/class="history-item"/g) || []).length, 1);
  assert.match(list.innerHTML, /Location 74/);
  assert.match(list.innerHTML, /DEMO DATA/);
});

test('draws heat-index bar graphs and peak for each saved location in history', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  assert.match(index, /id="location-trend-grid"/);
  assert.match(index, /Heat Index by Location/);
  assert.match(script, /renderLocationTrends\(\)/);
  assert.match(script, /this\.renderLocationTrends\(\);/);
  assert.match(script, /setupLocationTrendEvents\(\)/);
  assert.match(script, /this\.setupLocationTrendEvents\(\);/);
  assert.match(style, /Location Heat Index Bar Graphs/);
  for (const key of [
    'Heat Index by Location',
    'Highest heat index',
    'Cards are sorted by highest heat index. Tap a bar to see its time, heat index, and status.',
    'Tap a bar',
    'Selected reading:',
    'Oldest',
    'Newest',
    'No saved readings yet'
  ]) {
    assert.equal(locales.split(`'${key}':`).length - 1, 3, `${key} is translated into tl, ceb, and war`);
  }

  const grid = { innerHTML: '' };
  context.document = {
    getElementById: id => id === 'location-trend-grid' ? grid : null
  };
  app.readings = [
    { location: 'Room A', status: 'safe', heatIndex: 28, timestamp: '2026-11-27T01:00:00Z' },
    { location: 'Room A', status: 'danger', heatIndex: 39, timestamp: '2026-11-27T02:00:00Z' },
    { location: 'Room B', status: 'caution', heatIndex: 31, timestamp: '2026-11-27T01:30:00Z' },
    { location: '', status: 'safe', heatIndex: 50, timestamp: '2026-11-27T03:00:00Z' }
  ];
  app.escapeHTML = text => String(text);
  app.translateText = text => text;
  app.renderLocationTrends();

  assert.equal((grid.innerHTML.match(/class="location-trend-item"/g) || []).length, 2);
  assert.ok(grid.innerHTML.indexOf('Room A') < grid.innerHTML.indexOf('Room B'), 'highest location is first');
  assert.match(grid.innerHTML, /39\.0°C/);
  assert.match(grid.innerHTML, /31\.0°C/);
  assert.doesNotMatch(grid.innerHTML, /50\.0°C/);
  assert.equal((grid.innerHTML.match(/class="location-trend-bar-button"/g) || []).length, 3);
  assert.equal((grid.innerHTML.match(/class="location-trend-bar [a-z]+ peak"/g) || []).length, 2);
  assert.match(style, /\.location-trend-bar-button\s*\{\s*flex: 0 0 44px;/);
  assert.match(grid.innerHTML, /class="location-trend-axis"><span>Oldest<\/span><span>Newest<\/span>/);
  assert.match(grid.innerHTML, /class="location-trend-detail" aria-live="polite" hidden/);
  assert.match(grid.innerHTML, /class="location-trend-hint">Tap a bar/);
  assert.match(grid.innerHTML, /data-label="[^"]*39\.0°C/);
  assert.match(grid.innerHTML, /title="[^"]*39\.0°C/);
  assert.doesNotMatch(grid.innerHTML, /<svg/);
  assert.doesNotMatch(grid.innerHTML, /<rect/);
  assert.doesNotMatch(grid.innerHTML, /<polyline/);
});

test('shows reading details when a location bar is tapped', () => {
  let clickHandler = null;
  const grid = { addEventListener: (type, handler) => { if (type === 'click') clickHandler = handler; } };
  context.document = {
    getElementById: id => id === 'location-trend-grid' ? grid : null
  };
  const interactionApp = Object.create(context.SchoolHeatAppForTest.prototype);
  interactionApp.translateText = text => text;
  interactionApp.setupLocationTrendEvents();

  const classes = new Set();
  const attributes = {};
  const button = {
    classList: {
      contains: name => classes.has(name),
      add: name => classes.add(name),
      remove: name => classes.delete(name)
    },
    dataset: { label: 'Nov 27, 2026 • 39.0°C • Hinga' },
    setAttribute: (name, value) => { attributes[name] = value; },
    closest: selector => {
      if (selector === '.location-trend-bar-button') return button;
      if (selector === '.location-trend-item') return card;
      return null;
    }
  };
  const detail = { textContent: '', hidden: true };
  const card = {
    querySelector: selector => selector === '.location-trend-detail' ? detail : null,
    querySelectorAll: () => [button]
  };

  clickHandler({ target: button });
  assert.equal(detail.textContent, 'Selected reading: Nov 27, 2026 • 39.0°C • Hinga');
  assert.equal(detail.hidden, false);
  assert.equal(attributes['aria-pressed'], 'true');
  assert.ok(classes.has('active'));

  clickHandler({ target: button });
  assert.equal(detail.textContent, '');
  assert.equal(detail.hidden, true);
  assert.equal(attributes['aria-pressed'], 'false');
  assert.ok(!classes.has('active'));
});

test('shows what each overview classification means and explains it on hover or focus', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  assert.equal(
    (index.match(/<div class="status-card [a-z]+" data-status="[a-z]+" tabindex="0" aria-describedby="tooltip-[a-z]+">/g) || []).length,
    4
  );
  assert.deepEqual(
    [...index.matchAll(/<div class="status-meaning">([^<]+)<\/div>/g)].map(match => match[1]),
    ['Continue', 'Ease-in', 'Check-in', 'Stop']
  );
  assert.deepEqual(
    [...index.matchAll(/<div class="status-tooltip" role="tooltip" id="tooltip-[a-z]+">\s*<span class="status-tooltip-detail">([^<]+)<\/span>\s*<span class="status-tooltip-source">([^<]+)<\/span>\s*<\/div>/g)].map(match => match[1]),
    [
      'Hayo (Continue): Continue in-person classroom learning. In heat, scheduled hydration breaks and cooler-hour outdoor activities.',
      'Hinay (Ease-in): Ease into structured distance learning. In heat, shorten face-to-face hours or use hybrid/home-based schedules.',
      'Hinga (Check-in): Check-ins and light distance learning. In heat, suspend face-to-face classes and reduce academic demands.',
      'Hinto (Stop): All forms of learning are suspended. In heat, stop face-to-face and home-based activities; safety checks come first.'
    ]
  );
  assert.deepEqual(
    [...index.matchAll(/<span class="status-tooltip-source">([^<]+)<\/span>/g)].map(match => match[1]),
    Array(4).fill('DepEd basis: DO No. 014, s. 2026 · DM No. 064, s. 2026')
  );
  assert.match(index, /<p class="status-source">Sources: DO No\. 014, s\. 2026 \(4H levels\) and DM No\. 064, s\. 2026 \(heat actions\)\. Hover or focus a card for details\.<\/p>/);
  assert.doesNotMatch(index, /memorandum-card|DM_s2026_064r\.pdf|DO_s2026_014r\.pdf/);
  assert.doesNotMatch(index, /classification-dialog|classification-hint/);
  assert.doesNotMatch(script, /CLASSIFICATION_DETAILS|setupClassificationCards|showClassificationDialog/);
  assert.match(style, /\.status-meaning/);
  assert.match(style, /\.status-tooltip/);
  assert.match(style, /\.status-card:hover \.status-tooltip/);
  assert.match(style, /\.status-card:focus \.status-tooltip/);
  assert.match(style, /\.status-card:focus-within \.status-tooltip/);
  assert.match(style, /cursor: help;/);
  assert.match(style, /border-color: var\(--status-accent\);/);
  assert.match(style, /html\[data-theme\] #tab-dashboard \.status-card:hover/);
  assert.match(style, /\.status-card:hover \.status-meaning/);
  assert.match(style, /border: 1px solid var\(--status-accent\);/);
  assert.match(style, /border-right: 1px solid var\(--status-accent\);/);
  assert.match(style, /\.status-source/);
  assert.match(style, /\.status-tooltip-detail/);
  assert.match(style, /\.status-tooltip-source/);
  assert.match(style, /@media \(max-height: 650px\)/);
  assert.match(style, /@media \(max-height: 650px\) and \(min-width: 761px\)/);
  assert.match(style, /top: calc\(100% \+ 6px\)/);
  assert.match(style, /#tab-dashboard > \.status-grid \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/);
  for (const key of [
    'Continue',
    'Ease-in',
    'Check-in',
    'Stop',
    'Hayo (Continue): Continue in-person classroom learning. In heat, scheduled hydration breaks and cooler-hour outdoor activities.',
    'Hinay (Ease-in): Ease into structured distance learning. In heat, shorten face-to-face hours or use hybrid/home-based schedules.',
    'Hinga (Check-in): Check-ins and light distance learning. In heat, suspend face-to-face classes and reduce academic demands.',
    'Hinto (Stop): All forms of learning are suspended. In heat, stop face-to-face and home-based activities; safety checks come first.',
    'Sources: DO No. 014, s. 2026 (4H levels) and DM No. 064, s. 2026 (heat actions). Hover or focus a card for details.',
    'DepEd basis: DO No. 014, s. 2026 · DM No. 064, s. 2026'
  ]) {
    assert.equal(locales.split(`'${key}':`).length - 1, 3, `${key} is translated into tl, ceb, and war`);
  }
});

test('caps impossible heat-index values and keeps demo readings realistic', () => {
  assert.match(script, /const cappedHeatIndexC = Math\.min\(54, heatIndexC\);/);
  assert.match(script, /if \(readingsChanged\) localStorage\.setItem\('sh_readings'/);
  assert.match(script, /const temp = 26 \+ Math\.random\(\) \* 7 \+ \(hour - 12\) \* 0\.2;/);
  assert.match(script, /const hum = 45 \+ Math\.random\(\) \* 30;/);

  const demoApp = Object.create(context.SchoolHeatAppForTest.prototype);
  assert.equal(demoApp.calculateHeatIndex(41, 90), 54);
  assert.ok(demoApp.calculateHeatIndex(30, 65) < 40);

  demoApp.readings = [];
  demoApp.currentTab = 'dashboard';
  demoApp.updateDashboard = () => {};
  demoApp.renderHistory = () => {};
  demoApp.renderMap = () => {};
  demoApp.saveReadings = () => {};
  const originalRandom = Math.random;
  Math.random = () => 0.999;
  try {
    demoApp.generateDemoData(true);
  } finally {
    Math.random = originalRandom;
  }
  assert.ok(demoApp.readings.length > 0);
  assert.ok(demoApp.readings.every(reading => reading.heatIndex <= 50));
  assert.ok(demoApp.readings.every(reading => reading.temperature <= 35.1));
  assert.ok(demoApp.readings.every(reading => reading.humidity <= 75));
});

test('counts mapped pins and saved location names separately in the dashboard summary', () => {
  const coverageAttributes = {};
  const coverageFill = { style: {} };
  const elements = {
    'dashboard-location-summary': { textContent: '' },
    'dashboard-map-summary': { textContent: '' },
    'dashboard-coverage-count': { textContent: '' },
    'dashboard-coverage-total': { textContent: '' },
    'dashboard-coverage-missing': { textContent: '' },
    'dashboard-coverage-meter': {
      setAttribute: (name, value) => { coverageAttributes[name] = value; }
    },
    'dashboard-coverage-fill': coverageFill,
    'about-map-pin-count': { textContent: '' },
    'dashboard-map-site-count': { textContent: '' }
  };
  context.document = { getElementById: id => elements[id] || null };
  app.readings = [
    { location: context.SchoolHeatLocationsForTest[0].name, timestamp: '2026-01-02T00:00:00Z' },
    { location: 'Einstein Classroom', timestamp: '2026-01-02T00:01:00Z' }
  ];
  app.translateText = text => text;

  app.renderDashboardLocationSummary();

  assert.match(elements['dashboard-location-summary'].textContent, /^2 /);
  assert.match(elements['dashboard-map-summary'].textContent, /^1 mapped pin has/);
  assert.equal(elements['dashboard-coverage-count'].textContent, '1');
  assert.equal(elements['dashboard-coverage-total'].textContent, String(context.SchoolHeatLocationsForTest.length));
  assert.equal(elements['dashboard-coverage-missing'].textContent, '28 map pins have no saved readings');
  assert.equal(coverageAttributes['aria-valuenow'], '1');
  assert.equal(coverageAttributes['aria-valuemax'], '29');
  assert.equal(coverageAttributes['aria-valuetext'], '1 / 29 map pins with saved readings');
  assert.equal(coverageFill.style.transform, `scaleX(${1 / 29})`);
  assert.equal(elements['about-map-pin-count'].textContent, '29');
  assert.equal(elements['dashboard-map-site-count'].textContent, '29 map pins');
});

test('reports every map pin that shares a saved location name', () => {
  const locations = context.SchoolHeatLocationsForTest;
  const pinsByName = new Map();
  locations.forEach(location => pinsByName.set(location.name, (pinsByName.get(location.name) || 0) + 1));
  const duplicate = [...pinsByName.entries()].find(([, count]) => count > 1);
  assert.ok(duplicate, 'expected the campus map to contain repeated location labels');
  const [locationName, markerCount] = duplicate;
  const coverageAttributes = {};
  const elements = {
    'dashboard-location-summary': { textContent: '' },
    'dashboard-map-summary': { textContent: '' },
    'dashboard-coverage-count': { textContent: '' },
    'dashboard-coverage-total': { textContent: '' },
    'dashboard-coverage-missing': { textContent: '' },
    'dashboard-coverage-meter': {
      setAttribute: (name, value) => { coverageAttributes[name] = value; }
    },
    'dashboard-coverage-fill': { style: {} }
  };
  context.document = { getElementById: id => elements[id] || null };
  app.readings = [{ location: locationName, timestamp: '2026-01-02T00:00:00Z' }];
  app.translateText = text => text;

  app.renderDashboardLocationSummary();

  assert.equal(elements['dashboard-location-summary'].textContent, '1 location with a saved reading.');
  assert.equal(elements['dashboard-coverage-count'].textContent, String(markerCount));
  assert.equal(
    elements['dashboard-map-summary'].textContent,
    `${markerCount} mapped pins have saved readings, including demo data. Pins without readings remain unclassified.`
  );
  assert.equal(
    elements['dashboard-coverage-missing'].textContent,
    `${locations.length - markerCount} map pins have no saved readings`
  );
});

test('shows zero mapped-pin coverage without making an empty map look complete', () => {
  const coverageAttributes = {};
  const coverageFill = { style: {} };
  const elements = {
    'dashboard-coverage-count': { textContent: '' },
    'dashboard-coverage-total': { textContent: '' },
    'dashboard-coverage-missing': { textContent: '' },
    'dashboard-coverage-meter': {
      setAttribute: (name, value) => { coverageAttributes[name] = value; }
    },
    'dashboard-coverage-fill': coverageFill
  };
  context.document = { getElementById: id => elements[id] || null };
  app.readings = [];
  app.translateText = text => text;

  app.renderDashboardLocationSummary(new Map());

  assert.equal(elements['dashboard-coverage-count'].textContent, '0');
  assert.equal(coverageAttributes['aria-valuenow'], '0');
  assert.equal(coverageAttributes['aria-valuemax'], '29');
  assert.equal(coverageFill.style.transform, 'scaleX(0)');
});

test('escapes imported location names in the forecast summary', () => {
  assert.ok(script.includes("this.escapeHTML(modelResult.location || 'the current location')"));
});

test('removes a queued SMS by id after re-reading storage', () => {
  assert.ok((script.match(/removeQueuedSmsItem\(item\.id\)/g) || []).length >= 2);
  assert.match(script, /const queue = this\.readPendingSmsQueue\(\);\s*const index = queue\.findIndex/);
  assert.doesNotMatch(script, /queue\.shift\(\)/);
});

test('keeps the offline shell independent of the optional campus illustration', () => {
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  assert.doesNotMatch(serviceWorker, /campus-heat-atlas\.svg/);
  assert.doesNotMatch(index, /campus-heat-atlas\.svg/);
});

test('shows one flat campus map with user-marked pins', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  const referencePath = path.join(__dirname, '..', 'assets', 'mnhs-campus-reference.png');

  assert.ok(fs.existsSync(referencePath), `${referencePath} exists`);
  assert.match(serviceWorker, /\.\/assets\/mnhs-campus-reference\.png/);
  assert.doesNotMatch(serviceWorker, /campus-map\.(png|jpg)/);
  assert.doesNotMatch(serviceWorker, /mnhs-campus-whole\.png/);
  assert.equal((index.match(/src="assets\/mnhs-campus-reference\.png"/g) || []).length, 2);
  assert.doesNotMatch(index, /assets\/campus-map\.(png|jpg)/);
  assert.doesNotMatch(index, /mnhs-campus-whole\.png/);
  assert.doesNotMatch(index, /campus-gallery|school-map-heading/);
  assert.doesNotMatch(index, /campus-reference-(stage|tilt|glare)/);
  assert.doesNotMatch(index, /3D-style|map-fallback|campus-preview-image-button/);
  assert.match(index, /id="map-pins"/);
  assert.doesNotMatch(index, /id="campus-reference-pins"/);
  assert.match(index, /id="campus-reference-caption"/);
  assert.match(index, /Flat campus image · pins follow the marked building positions\./);
  assert.match(index, /<h3>School map<\/h3>/);
  assert.match(index, /id="map-scroll-wrap"/);
  assert.match(index, /id="map-zoom-in"/);
  assert.match(index, /dashboard-map-preview-button/);
  assert.match(style, /\.campus-map-pins \.map-pin\.tooltip-below \.map-pin-tooltip/);
  assert.match(style, /\.campus-map-pins \.map-pin\.tooltip-right \.map-pin-tooltip/);
  assert.match(style, /\.campus-map-pins \.map-pin\.tooltip-left \.map-pin-tooltip/);
  assert.match(style, /\.dashboard-map-preview/);
  assert.match(style, /\.dashboard-map-pin/);
  assert.match(style, /\.campus-map-pins \.map-pin\s*\{[^}]*width: 22px;[^}]*height: 22px;/);
  assert.match(style, /\.campus-map-pins \.map-pin::before\s*\{[^}]*width: 16px;[^}]*height: 16px;/);
  assert.match(style, /border: 2px solid #fffdf6;/);
  assert.match(style, /--pin-ring: 0 0 0 1px rgba\(8, 16, 14, 0\.7\)/);
  assert.match(style, /box-shadow: var\(--pin-ring\);/);
  assert.doesNotMatch(style, /pin-pulse|--pin-glow/);
  assert.match(style, /\.dashboard-map-pin\s*\{[^}]*width: 8px;[^}]*height: 8px;/);
  assert.match(index, /id="choose-location-on-map"/);
  assert.match(index, /id="location-picker-hint"/);
  assert.match(index, /id="map-pick-banner"/);
  assert.match(script, /updateLocationPickerUI\(\)/);
  assert.match(script, /syncSelectedMapPin\(\)/);
  assert.match(script, /classList\.toggle\('selected', Boolean\(loc\)/);
  assert.match(style, /\.map-pin\.selected::before \{ outline: 2px solid var\(--accent-blue\);/);
  assert.match(style, /\.sr-only\s*\{[^}]*position: absolute;[^}]*clip: rect\(0, 0, 0, 0\)/);
  assert.match(style, /@media \(pointer: coarse\), \(max-width: 760px\)/);
  assert.match(index, /id="monitor-steps"/);
  assert.match(index, /id="input-values-hint"/);
  assert.match(index, /id="monitor-form-status"[^>]*hidden/);
  assert.match(script, /openMapLocationPicker\(\)/);
  assert.match(script, /finishMapLocationPicker\(loc\)/);
  assert.match(script, /if \(this\.mapLocationPickMode && loc\)[\s\S]*?this\.finishMapLocationPicker\(loc\)/);
  assert.match(script, /if \(this\.mapLocationPickMode && tabId !== 'map'\) this\.clearMapLocationPicker\(\)/);
  assert.doesNotMatch(style, /\.campus-reference-tilt|rotateX\(var\(--campus-rx/);
  assert.doesNotMatch(style, /\.map-fallback|\.svg-map/);
  assert.match(script, /const CAMPUS_IMAGE_PINS = \[/);
  assert.equal((script.match(/number: \d+, x: [\d.]+, y: [\d.]+/g) || []).length, 29);
  for (let number = 1; number <= 29; number++) {
    assert.match(script, new RegExp(`number: ${number}, x: [\\d.]+, y: [\\d.]+`));
  }
  assert.match(script, /renderMap\(\)[\s\S]*?getElementById\('map-pins'\)[\s\S]*?CAMPUS_IMAGE_PINS\.map/);
  assert.match(script, /if \(pin\.y < 60\) edgeClasses\.push\('tooltip-below'\)/);
  assert.match(script, /if \(pin\.x < 24\) edgeClasses\.push\('tooltip-right'\)/);
  assert.match(script, /if \(pin\.x > 73\) edgeClasses\.push\('tooltip-left'\)/);
  assert.match(script, /setupMapZoomControls\(\)/);
  assert.doesNotMatch(script, /setupCampusReferenceTilt|tryNextMapImage|assets\/campus-map\.(png|jpg)/);
  assert.doesNotMatch(script, /setupCampusGallery/);
  assert.doesNotMatch(script, /campus-gallery-choice/);

  for (const label of [
    'MNHS CAMPUS VIEW',
    'School map',
    'Mahaplag National High School campus map with heat pins',
    'Flat campus image · pins follow the marked building positions.'
  ]) {
    assert.match(locales, new RegExp(`'${label}':`));
  }
});

test('uses plain monitor guidance and inline feedback in every language', () => {
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  const guidanceKeys = [
    '1. Choose a location · 2. Enter temperature and humidity · 3. Save or sync',
    'Type the numbers from your sensor here. The heat index updates as you type.',
    'Heat index estimate',
    'Choose a location first.',
    'Enter a temperature from 0 to 60°C.',
    'Enter humidity from 0 to 100%.',
    'Temperature must be from 0 to 60°C.',
    'Humidity must be from 0 to 100%.',
    'Saved. You can add another reading.'
  ];
  for (const key of guidanceKeys) {
    assert.equal(locales.split(`'${key}':`).length - 1, 3, `${key} is translated into tl, ceb, and war`);
  }
  assert.match(script, /setMonitorFormStatus\(messageKey, type = 'info'\)/);
  assert.match(script, /this\.setMonitorFormStatus\('Choose a location first\.', 'warning'\)/);
  assert.match(script, /this\.setMonitorFormStatus\('Saved\. You can add another reading\.', 'success'\)/);
  assert.match(script, /event\.key !== 'Enter'/);
  assert.match(script, /this\.clearMonitorFormStatus\(\);\s*this\.updatePreview\(\)/);
  assert.match(script, /this\.updateLocationPickerUI\(\);\s*this\.applyMonitorFormStatus\(\)/);
  for (const language of ['en', 'tl', 'ceb', 'war']) {
    const manual = fs.readFileSync(path.join(__dirname, '..', `manual/APP_OPERATION_MANUAL-${language}.md`), 'utf8');
    assert.match(manual, /`Enter`/);
  }
});

test('keeps controls and labels readable across all tabs', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(style, /FULL-APP USABILITY FLOOR/);
  assert.match(style, /\.btn-text\s*\{[^}]*min-height: 40px;/);
  assert.match(style, /\.local-contact-form-actions \.btn-sm\s*\{[^}]*min-height: 40px;/);
  assert.match(style, /#history-search,[^}]*#local-contact-number\s*\{[^}]*min-height: 40px;/);
  assert.match(style, /\.dashboard-eyebrow,[^}]*\.dashboard-hero-meta span,[^}]*\.hotlines-call-step > span,[^}]*\.about-card-kicker\s*\{[^}]*font-size: 0\.7rem;/);
  assert.match(style, /@media \(pointer: coarse\), \(max-width: 760px\) \{\s*\.btn-text \{ min-height: 44px; \}\s*\}/);
});

test('keeps long recent location chips inside narrow screens', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  assert.match(style, /\.recent-chips\s*\{[^}]*max-width: 100%/);
  assert.match(style, /\.recent-chip\s*\{[^}]*text-overflow: ellipsis/);
});

test('demo readings never receive future timestamps', () => {
  const previousTZ = process.env.TZ;
  process.env.TZ = 'Asia/Manila';
  try {
    const demoApp = Object.create(context.SchoolHeatAppForTest.prototype);
    demoApp.readings = [];
    demoApp.saveReadings = () => {};
    demoApp.updateDashboard = () => {};
    demoApp.renderHistory = () => {};
    demoApp.renderMap = () => {};
    demoApp.generateDemoData(true);
    const now = Date.now();
    assert.ok(demoApp.readings.length > 0);
    assert.ok(demoApp.readings.every(reading => Date.parse(reading.timestamp) <= now));
  } finally {
    if (previousTZ === undefined) delete process.env.TZ;
    else process.env.TZ = previousTZ;
  }
});

test('offers a downloadable user manual that follows the app language and theme', () => {
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const manualDir = path.join(__dirname, '..', 'manual');
  const manuals = ['en', 'tl', 'ceb', 'war'];

  assert.equal((index.match(/class="btn-secondary manual-download-link"/g) || []).length, 2);
  assert.match(index, /href="manual\/index\.html#en"/);
  assert.match(index, /target="_blank" rel="noopener"/);
  assert.doesNotMatch(index, /class="btn-secondary manual-download-link"[^>]*\sdownload=/);
  assert.match(script, /updateManualLinks\(\)/);
  assert.match(script, /manual\/index\.html#\$\{language\}/);
  assert.match(script, /getManualThemeParams\(\)/);
  assert.match(script, /getComputedStyle\(document\.documentElement\)/);
  assert.match(script, /new URLSearchParams\(/);
  assert.match(script, /this\.applyAccentPalette\(\);\s*this\.updateManualLinks\(\);/);
  assert.match(script, /themeParams \? `&\$\{themeParams\}` : ''/);
  assert.match(script, /removeAttribute\('download'\)/);
  const readerPath = path.join(manualDir, 'index.html');
  assert.ok(fs.existsSync(readerPath), `${readerPath} exists`);
  const reader = fs.readFileSync(readerPath, 'utf8');
  assert.match(reader, /function renderMarkdown\(markdown\)/);
  assert.match(reader, /id="download"/);
  assert.match(reader, /name="theme-color"/);
  assert.match(reader, /function applyThemeParams\(params\)/);
  assert.match(reader, /function themeSuffix\(\)/);
  assert.match(reader, /replace\(\/\\\+\/g, ' '\)/);
  assert.match(reader, /location\.hash\.replace\(\/\^#\/, ''\)/);
  assert.match(reader, /App_Operation_Manual-\$\{lang\.code\}\.md/);
  assert.match(serviceWorker, /\.\/manual\/index\.html/);
  for (const language of manuals) {
    const manualPath = path.join(manualDir, `APP_OPERATION_MANUAL-${language}.md`);
    assert.ok(fs.existsSync(manualPath), `${manualPath} exists`);
    const manual = fs.readFileSync(manualPath, 'utf8');
    assert.ok((manual.match(/^## /gm) || []).length >= 10);
    assert.match(serviceWorker, new RegExp(`APP_OPERATION_MANUAL-${language}\\.md`));
  }
  assert.match(locales, /'Open User Manual': 'Buksan ang Manwal ng Gumagamit'/);
  assert.match(locales, /'Open User Manual': 'Abliha ang Manwal sa Gumagamit'/);
  assert.match(locales, /'Open User Manual': 'Abliha an Manwal han Nagamit'/);
});

test('stores role-and-number contacts locally with tel links and no SMS sending', () => {
  const locales = fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const manuals = ['en', 'tl', 'ceb', 'war'];

  assert.match(index, /id="local-contact-form"/);
  assert.match(index, /id="local-contact-role"/);
  assert.match(index, /id="local-contact-number"/);
  assert.match(index, /id="local-contacts-list"[^>]*data-no-translate/);
  assert.match(index, /id="local-contact-submit"[^>]*data-no-translate/);
  assert.doesNotMatch(index, /Awaiting school verification/);
  assert.doesNotMatch(index, /local-contact-sms|local-contact.*testSmsAlert/);
  assert.match(script, /LOCAL_CONTACTS_STORAGE_KEY = 'sh_local_contacts'/);
  assert.match(script, /LOCAL_CONTACTS_MAX_ITEMS = 50/);
  assert.match(script, /getLocalContactTelHref\(/);
  assert.match(script, /localStorage\.setItem\(LOCAL_CONTACTS_STORAGE_KEY/);
  assert.match(script, /data-edit-contact/);
  assert.match(script, /data-delete-contact/);
  assert.match(script, /call\.href = tel/);
  assert.match(script, /node\.closest\?\.\('\[data-no-translate\]'\)/);
  assert.match(serviceWorker, /schoolheat-v145/);
  assert.match(serviceWorker, /fetch\(url, \{ cache: 'reload' \}\)/);
  assert.match(serviceWorker, /if \(!response\.ok\) throw new Error/);
  assert.doesNotMatch(serviceWorker, /cache\.addAll\(/);

  for (const language of manuals) {
    const manual = fs.readFileSync(path.join(__dirname, '..', `manual/APP_OPERATION_MANUAL-${language}.md`), 'utf8');
    assert.doesNotMatch(manual, /Awaiting school verification/);
    assert.match(manual, /Call|Tumawag|Tawag/);
  }
  assert.match(locales, /'Role': 'Tungkulin'/);
  assert.match(locales, /'Role': 'Papel'/);
  assert.match(locales, /'Add contact': 'Magdagdag ng kontakt'/);
  assert.match(locales, /'Add contact': 'Pagdugang og kontak'/);
  assert.match(locales, /'Add contact': 'Magdugang hin kontak'/);

  const i18nContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8'), i18nContext);
  const dictionaries = i18nContext.window.SCHOOLHEAT_I18N.translations;
  const contactKeys = [
    'LOCAL SCHOOL CONTACTS', 'Saved local contacts', 'Save a role and number on this device for quick dialing.',
    'Role', 'Phone number', 'e.g., School clinic', '09XX XXX XXXX', 'Add contact', 'Save changes',
    'Cancel edit', 'No contacts saved', 'Add a role and number to make calls quickly.',
    'Saved on this device only. SchoolHeat does not verify these contacts or send them alerts.',
    'Call', 'Edit', 'Delete', 'Enter a role and a valid phone number.',
    'Local contacts could not be saved on this device.', 'This device can store up to 50 local contacts.',
    'Local contact added.', 'Local contact updated.', 'Local contact removed.'
  ];
  for (const language of ['tl', 'ceb', 'war']) {
    for (const key of contactKeys) {
      assert.ok(dictionaries[language][key], `${language} is missing ${key}`);
    }
  }

  const previousLocalStorage = context.localStorage;
  const store = new Map();
  context.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key)
  };
  try {
    const contactApp = Object.create(context.SchoolHeatAppForTest.prototype);
    contactApp.toast = () => {};
    contactApp.renderLocalContacts = () => {};

    assert.equal(contactApp.getLocalContactTelHref('0919 123 4567'), 'tel:09191234567');
    assert.equal(contactApp.getLocalContactTelHref('+63 919 123 4567'), 'tel:+639191234567');
    assert.equal(contactApp.getLocalContactTelHref('javascript:alert(1)'), '');
    assert.equal(contactApp.getLocalContactTelHref('123'), '');

    const saved = contactApp.saveLocalContacts([
      { id: 'lc_1', role: 'School clinic', number: '0919 123 4567' },
      { id: 'lc_2', role: '', number: '0919 000 0000' }
    ]);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].role, 'School clinic');
    assert.equal(JSON.stringify(contactApp.readLocalContacts()), JSON.stringify(saved));
    assert.equal(store.get('sh_local_contacts'), JSON.stringify(saved));
  } finally {
    if (previousLocalStorage === undefined) delete context.localStorage;
    else context.localStorage = previousLocalStorage;
  }
});

test('lets users choose any text size and carries it into the manual', () => {
  const style = fs.readFileSync(path.join(__dirname, '..', 'style.css'), 'utf8');
  const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'service-worker.js'), 'utf8');
  const reader = fs.readFileSync(path.join(__dirname, '..', 'manual', 'index.html'), 'utf8');

  assert.match(index, /id="setting-text-size-label"[^>]*>Text size</);
  assert.match(index, /id="setting-text-size-hint"[^>]*>Drag the slider or enter 50–250% for the text size you want\.</);
  assert.match(index, /id="setting-text-size-output"[^>]*>100%</);
  assert.match(index, /id="setting-text-size-range"[^>]*type="range"[^>]*min="50"[^>]*max="250"[^>]*step="1"[^>]*value="100"/);
  assert.match(index, /id="setting-text-size-value"[^>]*type="number"[^>]*min="50"[^>]*max="250"[^>]*step="1"[^>]*value="100"/);
  assert.match(index, /aria-label="Text size percent"/);
  assert.match(script, /TEXT_SIZE_MIN_PERCENT = 50/);
  assert.match(script, /TEXT_SIZE_MAX_PERCENT = 250/);
  assert.match(script, /TEXT_SIZE_PRESETS = \{ normal: 100, large: 115, xlarge: 130, xxlarge: 145 \}/);
  assert.match(script, /function normalizeTextSize\(value\)/);
  assert.doesNotMatch(script, /TEXT_SIZE_SCALES/);
  assert.match(script, /textSize: 100/);
  assert.match(script, /textSizeRange\.addEventListener\('input'/);
  assert.match(script, /textSizeNumber\.addEventListener\('change'/);
  assert.match(script, /document\.documentElement\.dataset\.textSize = String\(percent\)/);
  assert.match(script, /setProperty\('--text-size-scale', String\(percent \/ 100\)\)/);
  assert.match(script, /fs: String\(normalizeTextSize\(this\.settings\.textSize\) \/ 100\)/);
  assert.match(style, /--text-size-scale: 1/);
  assert.match(style, /html \{[\s\S]*?font-size: calc\(16px \* var\(--text-size-scale\)\)/);
  assert.match(style, /\.text-size-control/);
  assert.doesNotMatch(style, /html\[data-text-size=/);
  assert.match(reader, /--text-scale: 1/);
  assert.match(reader, /font-size: calc\(16px \* var\(--text-scale, 1\)\)/);
  assert.match(reader, /font-size: 0\.875rem/);
  assert.match(reader, /Number\.parseFloat\(params\.fs\)/);
  assert.match(reader, /scale >= 0\.5 && scale <= 2\.5/);
  assert.match(reader, /setProperty\('--text-scale', String\(scale\)\)/);
  assert.doesNotMatch(reader, /font-size:\s*\d+px/);
  assert.match(serviceWorker, /schoolheat-v145/);
  assert.match(serviceWorker, /fetch\(url, \{ cache: 'reload' \}\)/);
  assert.match(serviceWorker, /if \(!response\.ok\) throw new Error/);
  assert.doesNotMatch(serviceWorker, /cache\.addAll\(/);

  const i18nContext = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'locales.js'), 'utf8'), i18nContext);
  const dictionaries = i18nContext.window.SCHOOLHEAT_I18N.translations;
  const textSizeKeys = [
    'Text size', 'Text size percent',
    'Drag the slider or enter 50–250% for the text size you want.'
  ];
  for (const language of ['tl', 'ceb', 'war']) {
    for (const key of textSizeKeys) {
      assert.ok(dictionaries[language][key], `${language} is missing ${key}`);
    }
  }
  for (const language of ['en', 'tl', 'ceb', 'war']) {
    const manual = fs.readFileSync(path.join(__dirname, '..', `manual/APP_OPERATION_MANUAL-${language}.md`), 'utf8');
    assert.match(manual, /Text size|Laki ng teksto|Gidak-on sa teksto|Gidak-on han teksto/);
    assert.match(manual, /50%[\s\S]{0,30}250%/);
  }

  const normalizeTextSize = context.SchoolHeatNormalizeTextSizeForTest;
  assert.equal(normalizeTextSize('normal'), 100);
  assert.equal(normalizeTextSize('137'), 137);
  assert.equal(normalizeTextSize(49), 50);
  assert.equal(normalizeTextSize(251), 250);
  assert.equal(normalizeTextSize('abc'), 100);

  const previousDocument = context.document;
  const appliedProperties = {};
  context.document = {
    documentElement: {
      dataset: {},
      style: { setProperty: (key, value) => { appliedProperties[key] = value; } }
    }
  };
  try {
    const sizeApp = Object.create(context.SchoolHeatAppForTest.prototype);
    sizeApp.settings = { textSize: 137 };
    sizeApp.updateManualLinks = () => {};
    sizeApp.applyTextSize();
    assert.equal(sizeApp.settings.textSize, 137);
    assert.equal(context.document.documentElement.dataset.textSize, '137');
    assert.equal(appliedProperties['--text-size-scale'], '1.37');

    sizeApp.settings = { textSize: 'unknown' };
    sizeApp.applyTextSize();
    assert.equal(sizeApp.settings.textSize, 100);
    assert.equal(context.document.documentElement.dataset.textSize, '100');
    assert.equal(appliedProperties['--text-size-scale'], '1');
  } finally {
    if (previousDocument === undefined) delete context.document;
    else context.document = previousDocument;
  }
});
