// ====== CONFIGURATION ======
// Source: Mahaplag NHS School Hazard and Evacuation Map legend (as provided).
const LOCATIONS = [
  { id: 'loc-1', number: 1, name: '3 Classroom, SBP4BE Building AusAID', outdoor: false },
  { id: 'loc-2', number: 2, name: 'School Clinic', outdoor: false },
  { id: 'loc-3', number: 3, name: '6 Classroom, DepEd Modified School Building (For Condemnation)', outdoor: false },
  { id: 'loc-4', number: 4, name: '6 Classroom, JICA - Educational Facilities Improvement Program (EFIP)', outdoor: false },
  { id: 'loc-5', number: 5, name: 'Literacy Office', outdoor: false },
  { id: 'loc-6', number: 6, name: 'Publication Office', outdoor: false },
  { id: 'loc-7', number: 7, name: '4 Classroom, PPSIP Building', outdoor: false },
  { id: 'loc-8', number: 8, name: 'SSLG Office', outdoor: false },
  { id: 'loc-9', number: 9, name: '3 Storey, 15 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-10', number: 10, name: '2 Storey Comp. Lab.', outdoor: false },
  { id: 'loc-11', number: 11, name: 'Guidance Office', outdoor: false },
  { id: 'loc-12', number: 12, name: 'PTA Office', outdoor: false },
  { id: 'loc-13', number: 13, name: '1 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-14', number: 14, name: '3 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-15', number: 15, name: '1 Classroom, SS Building', outdoor: false },
  { id: 'loc-16', number: 16, name: '3 Storey, 9 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-17', number: 17, name: '4 Classroom, SEDP Building', outdoor: false },
  { id: 'loc-18', number: 18, name: 'School Canteen', outdoor: false },
  { id: 'loc-19', number: 19, name: '2 Classroom, Baptist Donated Building', outdoor: false },
  { id: 'loc-20', number: 20, name: '3 Classroom, SBP4BE Building AusAID', outdoor: false },
  { id: 'loc-21', number: 21, name: '2 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-22', number: 22, name: '2 Storey, 4 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-23', number: 23, name: '3 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-24', number: 24, name: 'Handwashing Facility', outdoor: true },
  { id: 'loc-25', number: 25, name: 'Administration Building / DepEd SS Building', outdoor: false },
  { id: 'loc-26', number: 26, name: '1 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-27', number: 27, name: '1 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-28', number: 28, name: '2 Storey, 2 Classroom, DepEd SS Building', outdoor: false },
  { id: 'loc-29', number: 29, name: 'Guard House', outdoor: true }
];
const LOCATIONS_BY_ID = {};
LOCATIONS.forEach(loc => { LOCATIONS_BY_ID[loc.id] = loc; });

function getLocationIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('clinic')) return '🏥';
  if (n.includes('canteen')) return '🍽️';
  if (n.includes('guard')) return '💂';
  if (n.includes('comp')) return '🖥️';
  if (n.includes('wash')) return '🚰';
  if (n.includes('admin')) return '🏛️';
  if (n.includes('office') || n.includes('coordinator')) return '🗂️';
  if (n.includes('classroom') || n.includes('building')) return '🏫';
  return '🏢';
}

let autoMonitorInterval = null;
let heatIndexChart = null;
let comparisonChart = null;
let todayVsTomorrowChart = null;
let autoMonitorActive = {};
let autoMonitorTimers = {};
LOCATIONS.forEach(loc => { autoMonitorActive[loc.id] = false; autoMonitorTimers[loc.id] = null; });

// ====== STEP 1: XSS PREVENTION UTILITY ======
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ====== HEAT INDEX CALCULATION ======
function calculateHeatIndex(tempCelsius, humidity) {
  const tempF = (tempCelsius * 9/5) + 32;
  if (tempF < 80) return tempCelsius;
  const c1 = -42.379, c2 = 2.04901523, c3 = 10.14333127, c4 = -0.22475541;
  const c5 = -0.00683783, c6 = -0.05481717, c7 = 0.00122874, c8 = 0.00085282, c9 = -0.00000199;
  const T = tempF, RH = humidity;
  const heatIndexF = c1 + (c2*T) + (c3*RH) + (c4*T*RH) + (c5*T*T) + (c6*RH*RH) + (c7*T*T*RH) + (c8*T*RH*RH) + (c9*T*T*RH*RH);
  return (heatIndexF - 32) * 5/9;
}

// STEP 1: Harden getHistory against corrupted localStorage
function getHistory(location) {
  const key = `history_${location}`;
  const data = localStorage.getItem(key);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Corrupted history for', location, e);
    return [];
  }
}

// STEP 4: Allow forced timestamp for sleep catch-up
function addToHistory(location, temp, humidity, heatIndex, forcedTimestamp = null) {
  const key = `history_${location}`;
  const history = getHistory(location);
  const now = forcedTimestamp ? new Date(forcedTimestamp) : new Date();
  history.push({
    time: now.toLocaleString(),
    timestamp: now.getTime(),
    hour: now.getHours(),
    temp: parseFloat(temp),
    humidity: parseFloat(humidity),
    heatIndex: parseFloat(heatIndex),
    status: getHeatStatus(heatIndex)
  });
  if (history.length > 500) history.shift();
  localStorage.setItem(key, JSON.stringify(history));
  return history[history.length - 1];
}

function updateGauge(heatIndex) {
  const needle = document.getElementById('gauge-needle');
  const valueEl = document.getElementById('gauge-value');
  if (!needle || !valueEl) return;

  const GAUGE_MIN = 20, GAUGE_MAX = 55;
  const clamped = Math.max(GAUGE_MIN, Math.min(GAUGE_MAX, heatIndex));
  const angle = -90 + ((clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 180;

  needle.setAttribute('transform', `rotate(${angle} 110 115)`);
  valueEl.textContent = heatIndex.toFixed(1);
  valueEl.style.color = getStatusColor(getHeatStatus(heatIndex));
}

function getHeatStatus(heatIndex) {
  if (heatIndex < 27) return 'Safe';
  if (heatIndex < 32) return 'Caution';
  if (heatIndex < 41) return 'Extreme Caution';
  if (heatIndex < 51) return 'Danger';
  return 'Extreme Danger';
}

function getStatusColor(status) {
  const colors = {'Safe': '#28a745','Caution': '#ffc107','Extreme Caution': '#fd7e14','Danger': '#e74c3c','Extreme Danger': '#c0392b'};
  return colors[status] || '#999';
}

// ====== HOURLY SENSOR SIMULATION ======
// STEP 4: Accept forcedHour for sleep catch-up
function simulateHourlyReading(location, forcedHour = null) {
  const hour = forcedHour !== null ? forcedHour : new Date().getHours();
  const baseTemp = 25;
  const baseHumidity = 65;

  const tempVariation = Math.sin((hour - 6) * Math.PI / 12) * 8;
  const humidityVariation = Math.cos((hour - 12) * Math.PI / 12) * 15;

  const tempRandom = (Math.random() - 0.5) * 2;
  const humidityRandom = (Math.random() - 0.5) * 5;

  const loc = LOCATIONS_BY_ID[location];
  const locationFactor = (loc && loc.outdoor) ? 3 : 0;

  const temp = Math.max(20, Math.min(40, baseTemp + tempVariation + tempRandom + locationFactor));
  const humidity = Math.max(40, Math.min(90, baseHumidity + humidityVariation + humidityRandom));

  return { temp: parseFloat(temp.toFixed(1)), humidity: parseFloat(humidity.toFixed(1)) };
}

// STEP 4: Accept forced timestamp for sleep catch-up
function recordHourlyReading(location, forcedTimestamp = null) {
  const hour = forcedTimestamp ? new Date(forcedTimestamp).getHours() : new Date().getHours();
  const reading = simulateHourlyReading(location, hour);
  const heatIndex = calculateHeatIndex(reading.temp, reading.humidity);
  addToHistory(location, reading.temp, reading.humidity, heatIndex, forcedTimestamp);

  const status = getHeatStatus(heatIndex);
  const threshold = parseFloat(localStorage.getItem('warning_threshold') || '32');
  if (heatIndex >= threshold) triggerWarning(heatIndex, status, location);

  const logTime = forcedTimestamp ? new Date(forcedTimestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  console.log(`📊 [${logTime}] ${LOCATIONS_BY_ID[location].name}: ${reading.temp}°C, ${reading.humidity}% → HI: ${heatIndex.toFixed(1)}°C`);

  const currentSelection = document.getElementById('location-select');
  if (currentSelection && currentSelection.value === location) updateGauge(heatIndex);
  updateDashboard();
  return { reading, heatIndex, status };
}

// ====== DYNAMIC UI GENERATION (30 real locations) ======
function buildLocationDropdowns() {
  const selectIds = ['location-select', 'history-location', 'prediction-location'];
  selectIds.forEach(selectId => {
    const select = document.getElementById(selectId);
    select.innerHTML = '';
    LOCATIONS.forEach(loc => {
      const option = document.createElement('option');
      option.value = loc.id;
      option.textContent = `${loc.number}. ${loc.name}`;
      select.appendChild(option);
    });
  });
}

// STEP 1: Escape location names in dashboard cards
function buildDashboardCards() {
  const grid = document.querySelector('.dashboard-grid');
  grid.innerHTML = '';
  LOCATIONS.forEach((loc, index) => {
    const card = document.createElement('div');
    card.className = 'dashboard-card';
    card.style.animationDelay = Math.min(index * 0.05, 1) + 's';
    card.innerHTML = `
      <h3><span class="card-icon">${getLocationIcon(loc.name)}</span>${loc.number}. ${escapeHtml(loc.name)}</h3>
      <p class="current-heat" id="heat-${loc.id}">--</p>
      <p class="current-status" id="status-${loc.id}">No data</p>
      <p class="last-update" id="time-${loc.id}">--</p>
    `;
    grid.appendChild(card);
  });
}

const MAP_MARKER_POSITIONS = {
  'loc-1': { x: 30.4, y: 69.8 }, 'loc-2': { x: 23.4, y: 74.9}, 'loc-3': { x: 16.0, y: 75 },
  'loc-4': { x: 7.9, y: 67.2 }, 'loc-5': { x: 7.5, y: 45.9 }, 'loc-6': { x: 7.3, y: 33.3 },
  'loc-7': { x: 12.9, y: 32.8 }, 'loc-8': { x: 19.9, y: 31.9 }, 'loc-9': { x: 28.8, y: 31.9 },
  'loc-10': { x: 42.1, y: 37.3 }, 'loc-11': { x: 47, y: 39.9}, 'loc-12': { x: 48.6, y: 39 },
  'loc-13': { x: 50.4, y: 40.7}, 'loc-14': { x: 55.65, y: 42.6 }, 'loc-15': { x: 61.1, y: 42.6 },
  'loc-16': { x: 61.1, y: 56.3 }, 'loc-17': { x: 15.1, y: 42.8 }, 'loc-18': { x: 20.8, y: 41.4 },
  'loc-19': { x: 24.96, y: 41.9 }, 'loc-20': { x: 35.58, y: 46.2}, 'loc-21': { x: 12.4, y: 56.4 },
  'loc-22': { x: 16.35, y: 55.5 }, 'loc-23': { x: 45.35, y: 55.5 }, 'loc-24': { x: 43, y: 45 },
  'loc-25': { x: 48.76, y: 50.4 }, 'loc-26': { x: 57.15, y: 55 }, 'loc-27': { x: 52.5, y: 51 },
  'loc-28': { x: 56.8, y: 69.9 }, 'loc-29': { x: 51.96, y: 72 }
};

function buildCampusMapMarkers() {
  const wrapper = document.querySelector('.campus-map-wrapper');
  wrapper.querySelectorAll('.map-marker').forEach(m => m.remove());

  LOCATIONS.forEach(loc => {
    const pos = MAP_MARKER_POSITIONS[loc.id];
    if (!pos) return;

    const history = getHistory(loc.id);
    const hasData = history.length > 0;
    const latest = hasData ? history[history.length - 1] : null;
    const color = hasData ? getStatusColor(latest.status) : '#cccccc';

    const marker = document.createElement('div');
    marker.className = 'map-marker';
    marker.style.left = pos.x + '%';
    marker.style.top = pos.y + '%';
    marker.style.background = color;
    marker.title = `${loc.number}. ${loc.name}` +
      (hasData ? ` — ${latest.heatIndex.toFixed(1)}°C (${latest.status})` : ' — No data yet');

    marker.addEventListener('click', () => {
      document.getElementById('location-select').value = loc.id;
      document.querySelector('.tab-btn[data-tab="monitor"]').click();
    });

    wrapper.appendChild(marker);
  });
}

// ====== TAB NAVIGATION ======
function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.getAttribute('data-tab');
      tabContents.forEach(c => c.classList.remove('active'));
      tabBtns.forEach(b => b.classList.remove('active'));
      document.getElementById(tabName).classList.add('active');
      btn.classList.add('active');
      if (tabName === 'history') { updateHistoryChart(); updateHistoryTable(); }
      else if (tabName === 'dashboard') { replayDashboardEntrance(); updateDashboard(); updateComparisonChart(); updateOverviewStats(); }
      else if (tabName === 'prediction') { updatePredictionChart(); updatePredictionSummary(); updateTodayVsTomorrowChart(); updateTomorrowSummary(); }
      else if (tabName === 'map') { buildCampusMapMarkers(); }
      else if (tabName === 'settings') { updateStorageUsed(); }
    });
  });
}

// ====== MONITOR TAB ======
function initMonitorTab() {
  document.getElementById('calculate-btn').addEventListener('click', () => {
    const temp = parseFloat(document.getElementById('temperature').value);
    const humidity = parseFloat(document.getElementById('humidity').value);
    const location = document.getElementById('location-select').value;
    const resultText = document.getElementById('result-text');

    if (isNaN(temp) || isNaN(humidity) || temp < -50 || temp > 60 || humidity < 0 || humidity > 100) {
      resultText.innerHTML = '<span style="color: red;">Invalid input. Check ranges.</span>';
      return;
    }

    const heatIndex = calculateHeatIndex(temp, humidity);
    const status = getHeatStatus(heatIndex);
    const color = getStatusColor(status);
    const locName = LOCATIONS_BY_ID[location].name;
    addToHistory(location, temp, humidity, heatIndex);

    resultText.innerHTML = `<strong style="color: ${color};">Heat Index: ${heatIndex.toFixed(1)}°C</strong><br><strong style="color: ${color};">Status: ${status}</strong><br><small>Temp: ${temp}°C | Humidity: ${humidity}% | Location: ${escapeHtml(locName)}</small>`;
    updateGauge(heatIndex);

    window.lastHeatData = { heatIndex: heatIndex.toFixed(1), temp, humidity, status, location: locName, timestamp: new Date().toLocaleString() };

    const threshold = parseFloat(localStorage.getItem('warning_threshold') || '32');
    if (heatIndex >= threshold) triggerWarning(heatIndex, status, location);
    updateDashboard();
  });

  // STEP 3 & 4: Fixed auto-monitor button styling + sleep catch-up
  document.getElementById('auto-monitor-btn').addEventListener('click', function() {
    const location = document.getElementById('location-select').value;
    const locName = LOCATIONS_BY_ID[location].name;

    if (autoMonitorActive[location]) {
      autoMonitorActive[location] = false;
      if (autoMonitorTimers[location]) {
        clearInterval(autoMonitorTimers[location]);
        autoMonitorTimers[location] = null;
      }
      this.textContent = 'Start Auto-Monitor (Hourly)';
      this.classList.remove('active-monitor'); // STEP 3: Use class instead of inline style
      document.getElementById('auto-monitor-status').innerHTML = `<span style="color: orange;">Auto-monitor stopped for ${escapeHtml(locName)}</span>`;
    } else {
      autoMonitorActive[location] = true;
      this.textContent = 'Stop Auto-Monitor';
      this.classList.add('active-monitor'); // STEP 3: Use class instead of inline style

      recordHourlyReading(location);
      document.getElementById('result-text').innerHTML = `<strong>Auto-Monitor Active for ${escapeHtml(locName)}</strong><br>Recording every hour, on the hour...`;
      document.getElementById('auto-monitor-status').innerHTML = `<span style="color: green;">✅ Auto-monitoring active for ${escapeHtml(locName)} (next reading at the top of the hour)</span>`;

      // STEP 4: Robust catch-up for missed hours during device sleep
      let lastRecordedDate = new Date();
      lastRecordedDate.setMinutes(0, 0, 0); // Normalize to start of current hour

      autoMonitorTimers[location] = setInterval(() => {
        if (!autoMonitorActive[location]) {
          clearInterval(autoMonitorTimers[location]);
          autoMonitorTimers[location] = null;
          return;
        }
        const now = new Date();
        now.setMinutes(0, 0, 0); // Normalize to start of current hour

        const diffMs = now.getTime() - lastRecordedDate.getTime();
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));

        if (diffHours >= 1) {
          // Record all missed hours chronologically (handles midnight wrap & multi-day sleep)
          for (let i = 1; i <= diffHours; i++) {
            const recordDate = new Date(lastRecordedDate);
            recordDate.setHours(recordDate.getHours() + i);
            recordHourlyReading(location, recordDate.getTime());
          }
          lastRecordedDate = new Date(now);
        }
      }, 60000);
    }
  });
}

// ====== ALERTS ======
function initAlerts() {
  document.getElementById('send-alert-btn').addEventListener('click', () => {
    const coordPhone = document.getElementById('coordinator-phone').value.trim();
    const headPhone = document.getElementById('head-phone').value.trim();
    const alertStatus = document.getElementById('alert-status');

    if (!coordPhone || !headPhone || !window.lastHeatData) {
      alertStatus.innerHTML = '<span style="color: red;">Fill all fields and calculate first.</span>';
      alertStatus.style.backgroundColor = '#f8d7da';
      return;
    }

    const data = window.lastHeatData;
    const msg = `🔥 SCHOOLHEAT ALERT 🔥\nHeat Index: ${data.heatIndex}°C\nLocation: ${data.location}\nTemp: ${data.temp}°C\nHumidity: ${data.humidity}%\nStatus: ${data.status}\nTime: ${data.timestamp}`;

    if (confirm('Send via WhatsApp?')) {
      const encoded = encodeURIComponent(msg);
      window.open(`https://wa.me/${coordPhone}?text=${encoded}`, '_blank');
      setTimeout(() => window.open(`https://wa.me/${headPhone}?text=${encoded}`, '_blank'), 500);
    } else {
      window.location.href = `sms:${coordPhone}?body=${encodeURIComponent(msg)}`;
    }

    logAlert(data);
    alertStatus.innerHTML = '<span style="color: green;">Alert sent!</span>';
    alertStatus.style.backgroundColor = '#d4edda';
  });
}

function triggerWarning(heatIndex, status, location) {
  const locName = LOCATIONS_BY_ID[location] ? LOCATIONS_BY_ID[location].name : location;
  if (document.getElementById('alert-sound')?.checked) playAlertSound();
  if (document.getElementById('browser-notification')?.checked && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('🔥 SchoolHeat Warning', { body: `Heat Index ${heatIndex.toFixed(1)}°C (${status}) at ${locName}` });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  }
}

function playAlertSound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const osc = audioContext.createOscillator(), gain = audioContext.createGain();
  osc.connect(gain); gain.connect(audioContext.destination);
  osc.frequency.value = 800; osc.type = 'sine';
  gain.gain.setValueAtTime(0.3, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.5);
}

function logAlert(data) {
  let alerts = JSON.parse(localStorage.getItem('alerts_log') || '[]');
  alerts.push({...data, logTime: new Date().toLocaleString()});
  if (alerts.length > 50) alerts.shift();
  localStorage.setItem('alerts_log', JSON.stringify(alerts));
}

// ====== HISTORY ======
function getChartTooltipConfig(unit = '°C') {
  return {
    callbacks: {
      label: function(context) {
        let label = context.dataset.label || '';
        if (label) label += ': ';
        const value = context.parsed.y !== undefined && context.parsed.y !== null
          ? context.parsed.y : context.parsed.x;
        if (value === null || value === undefined) return label + 'No data';
        return label + value.toFixed(1) + unit;
      }
    }
  };
}

function getChartZoomConfig() {
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  return {
    pan: { 
      enabled: true, 
      mode: 'xy', 
      modifierKey: null,
      threshold: 10
    },
    zoom: {
      wheel: { enabled: !isTouch, speed: 0.3 },
      pinch: { enabled: true },
      drag: { enabled: false },
      mode: 'xy',
      onZoomComplete: function({chart}) {
        // Prevent over-zooming
        const yScale = chart.scales.y;
        if (yScale.max - yScale.min < 5) {
          chart.resetZoom();
        }
      }
    },
    limits: { 
      x: { minRange: 2 }, 
      y: { minRange: 5, max: 55, min: 15 } 
    }
  };
}

function resetChartZoom(chart) {
  if (chart && typeof chart.resetZoom === 'function') chart.resetZoom();
}

// STEP 2: Fix chart ghost data — always destroy before early return
function updateHistoryChart() {
  const location = document.getElementById('history-location').value;
  const type = document.getElementById('chart-type').value;
  const history = getHistory(location);

  const ctx = document.getElementById('heatIndexChart').getContext('2d');
  if (heatIndexChart) {
    heatIndexChart.destroy();
    heatIndexChart = null;
  }

  if (!history.length) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    return;
  }

  const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
  const data = history.map(h => h.heatIndex);

  heatIndexChart = new Chart(ctx, {
    type, data: {
      labels, datasets: [{
        label: 'Heat Index (°C)', data, borderColor: '#d9534f', backgroundColor: 'rgba(217, 83, 79, 0.1)',
        borderWidth: 2, tension: 0.1, fill: true, pointRadius: 4, pointBackgroundColor: '#d9534f'
      }]
    }, options: {
      responsive: true, maintainAspectRatio: true,
      scales: { y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
      plugins: { tooltip: getChartTooltipConfig(), zoom: getChartZoomConfig() }
    }
  });
}

// STEP 1: Escape all localStorage data before injecting into innerHTML
function updateHistoryTable() {
  const location = document.getElementById('history-location').value;
  const history = getHistory(location);
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';
  history.slice().reverse().forEach(entry => {
    const row = tbody.insertRow();
    const color = getStatusColor(entry.status);
    const time = escapeHtml(entry.time);
    const temp = escapeHtml(entry.temp.toFixed(1));
    const humidity = escapeHtml(entry.humidity.toFixed(1));
    const heatIndex = escapeHtml(entry.heatIndex.toFixed(1));
    const status = escapeHtml(entry.status);

    row.innerHTML = `<td>${time}</td><td>${temp}°C</td><td>${humidity}%</td><td>${heatIndex}°C</td><td><span style="background: ${color}; color: white; padding: 5px 10px; border-radius: 4px;">${status}</span></td>`;
  });
}

function exportData() {
  let csv = 'Time,Location Number,Location Name,Temperature,Humidity,Heat Index,Status\n';
  LOCATIONS.forEach(loc => {
    getHistory(loc.id).forEach(entry => {
      csv += `"${entry.time}",${loc.number},"${loc.name}",${entry.temp},${entry.humidity},${entry.heatIndex},"${entry.status}"\n`;
    });
  });
  const element = document.createElement('a');
  element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
  element.setAttribute('download', `schoolheat_${new Date().getTime()}.csv`);
  element.click();
}

function clearHistory() {
  if (confirm('Delete all history?')) {
    const location = document.getElementById('history-location').value;
    localStorage.removeItem(`history_${location}`);
    updateHistoryChart();
    updateHistoryTable();
  }
}

// ====== DASHBOARD ======
function updateDashboard() {
  LOCATIONS.forEach(loc => {
    const location = loc.id;
    const history = getHistory(location);
    const heatEl = document.getElementById(`heat-${location}`);
    const statusEl = document.getElementById(`status-${location}`);
    const timeEl = document.getElementById(`time-${location}`);
    const cardEl = heatEl.closest('.dashboard-card');
    if (history.length > 0) {
      const latest = history[history.length - 1];
      const newText = latest.heatIndex.toFixed(1) + '°C';
      if (heatEl.textContent !== newText) {
        heatEl.textContent = newText;
        heatEl.classList.remove('value-updated');
        void heatEl.offsetWidth;
        heatEl.classList.add('value-updated');
      }
      statusEl.textContent = latest.status;
      statusEl.className = 'current-status status-' + latest.status.toLowerCase().replace(' ', '-');
      timeEl.textContent = latest.time;

      const isUrgent = latest.status === 'Danger' || latest.status === 'Extreme Danger';
      cardEl.classList.toggle('card-alert', isUrgent);
    }
  });
  if (document.getElementById('stat-total-locations')) updateOverviewStats();
}

function replayDashboardEntrance() {
  document.querySelectorAll('.dashboard-card').forEach(card => {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  });
  document.querySelectorAll('.stat-card').forEach(card => {
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
  });
}

function animateCountUp(el, target, decimals = 0, suffix = '') {
  const start = parseFloat(el.dataset.rawValue || '0') || 0;
  const duration = 700;
  const startTime = performance.now();

  function step(now) {
    const t = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const current = start + (target - start) * eased;
    el.textContent = current.toFixed(decimals) + suffix;
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      el.textContent = target.toFixed(decimals) + suffix;
      el.dataset.rawValue = target;
    }
  }
  requestAnimationFrame(step);
}

function updateOverviewStats() {
  const latestByLocation = LOCATIONS.map(loc => {
    const history = getHistory(loc.id);
    return history.length > 0 ? { loc, latest: history[history.length - 1] } : null;
  }).filter(Boolean);

  const totalLocations = LOCATIONS.length;
  const activeMonitors = Object.values(autoMonitorActive).filter(Boolean).length;

  const avgHeat = latestByLocation.length > 0
    ? latestByLocation.reduce((sum, r) => sum + r.latest.heatIndex, 0) / latestByLocation.length
    : null;

  let peak = null;
  latestByLocation.forEach(r => {
    if (!peak || r.latest.heatIndex > peak.latest.heatIndex) peak = r;
  });

  const dangerCount = latestByLocation.filter(r =>
    r.latest.status === 'Danger' || r.latest.status === 'Extreme Danger'
  ).length;

  animateCountUp(document.getElementById('stat-total-locations'), totalLocations, 0);
  animateCountUp(document.getElementById('stat-active-monitors'), activeMonitors, 0);
  animateCountUp(document.getElementById('stat-danger-count'), dangerCount, 0);

  const avgEl = document.getElementById('stat-avg-heat');
  if (avgHeat !== null) {
    animateCountUp(avgEl, avgHeat, 1, '°C');
  } else {
    avgEl.textContent = '--';
  }

  const peakEl = document.getElementById('stat-peak-heat');
  const peakLabelEl = document.getElementById('stat-peak-label');
  const peakCard = document.getElementById('stat-peak-card');
  if (peak) {
    animateCountUp(peakEl, peak.latest.heatIndex, 1, '°C');
    peakLabelEl.textContent = `${peak.loc.number}. ${peak.loc.name}`;
    const isUrgent = peak.latest.status === 'Danger' || peak.latest.status === 'Extreme Danger';
    peakCard.classList.toggle('stat-urgent', isUrgent);
  } else {
    peakEl.textContent = '--';
    peakLabelEl.textContent = 'Highest Right Now';
    peakCard.classList.remove('stat-urgent');
  }

  const dangerCard = document.getElementById('stat-danger-card');
  dangerCard.classList.toggle('stat-urgent', dangerCount > 0);
}

function updateComparisonChart() {
  const canvas = document.getElementById('comparisonChart');
  canvas.parentElement.style.height = Math.max(400, LOCATIONS.length * 28) + 'px';

  const ctx = canvas.getContext('2d');
  if (comparisonChart) comparisonChart.destroy();

  const labels = LOCATIONS.map(loc => `${loc.number}. ${loc.name}`);
  const data = [];
  const barColors = [];
  LOCATIONS.forEach(loc => {
    const history = getHistory(loc.id);
    if (history.length > 0) {
      const latest = history[history.length - 1];
      data.push(latest.heatIndex);
      barColors.push(getStatusColor(latest.status));
    } else {
      data.push(0);
      barColors.push('#cccccc');
    }
  });

  comparisonChart = new Chart(ctx, {
    type: 'bar', data: {
      labels, datasets: [{
        label: 'Current Heat Index (°C)', data,
        backgroundColor: barColors, borderColor: barColors, borderWidth: 1
      }]
    }, options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      scales: { x: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
      plugins: { tooltip: getChartTooltipConfig(), zoom: getChartZoomConfig() }
    }
  });
}

// ====== TOMORROW FORECAST (same-hour averaging) ======
function generateTomorrowForecast(location) {
  const history = getHistory(location);
  const byHour = {};
  history.forEach(entry => {
    const h = entry.hour !== undefined ? entry.hour : new Date(entry.timestamp).getHours();
    if (!byHour[h]) byHour[h] = [];
    byHour[h].push(entry.heatIndex);
  });

  const forecast = [];
  for (let hour = 0; hour < 24; hour++) {
    const readings = byHour[hour] || [];
    let predicted = null;
    if (readings.length > 0) {
      predicted = readings.reduce((a, b) => a + b, 0) / readings.length;
    }
    forecast.push({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      predicted,
      sampleSize: readings.length,
      status: predicted !== null ? getHeatStatus(predicted) : null,
      color: predicted !== null ? getStatusColor(getHeatStatus(predicted)) : '#ccc'
    });
  }
  return forecast;
}

function getTodayHourlyReadings(location) {
  const history = getHistory(location);
  const todayStr = new Date().toDateString();
  const byHour = {};
  history.forEach(entry => {
    const d = new Date(entry.timestamp);
    if (d.toDateString() === todayStr) byHour[entry.hour] = entry.heatIndex;
  });
  const readings = [];
  for (let hour = 0; hour < 24; hour++) {
    readings.push({ hour, label: `${hour.toString().padStart(2, '0')}:00`, heatIndex: byHour[hour] !== undefined ? byHour[hour] : null });
  }
  return readings;
}

// STEP 2: Destroy old chart when no data to prevent ghost charts
function updateTodayVsTomorrowChart() {
  const location = document.getElementById('prediction-location').value;
  const todayReadings = getTodayHourlyReadings(location);
  const tomorrowForecast = generateTomorrowForecast(location);
  const hasAnyData = todayReadings.some(r => r.heatIndex !== null) || tomorrowForecast.some(f => f.predicted !== null);

  const canvas = document.getElementById('todayVsTomorrowChart');

  if (todayVsTomorrowChart) {
    todayVsTomorrowChart.destroy();
    todayVsTomorrowChart = null;
  }

  if (!hasAnyData) {
    canvas.style.display = 'none';
    return;
  }
  canvas.style.display = 'block';

  const ctx = canvas.getContext('2d');

  const labels = todayReadings.map(r => r.label);
  const todayData = todayReadings.map(r => r.heatIndex);
  const tomorrowData = tomorrowForecast.map(f => f.predicted);

  todayVsTomorrowChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Today (recorded)', data: todayData, borderColor: '#d9534f', backgroundColor: 'rgba(217, 83, 79, 0.1)',
          borderWidth: 2, tension: 0.1, fill: true, pointRadius: 4, spanGaps: false
        },
        {
          label: 'Tomorrow (predicted, same-hour avg)', data: tomorrowData, borderColor: '#0066cc', borderDash: [5, 5],
          backgroundColor: 'rgba(0, 102, 204, 0.1)', borderWidth: 2, tension: 0.1, pointRadius: 4, spanGaps: true
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      scales: { y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
      animation: { duration: 900, easing: 'easeOutQuart' },
      plugins: { tooltip: getChartTooltipConfig(), zoom: getChartZoomConfig() }
    }
  });
}

// STEP 1: Escape HTML in forecast summary
function updateTomorrowSummary() {
  const location = document.getElementById('prediction-location').value;
  const forecast = generateTomorrowForecast(location);
  const summaryDiv = document.getElementById('tomorrow-summary');
  const known = forecast.filter(f => f.predicted !== null);

  if (known.length === 0) {
    summaryDiv.innerHTML = '<p style="color: red;">No historical hourly data yet for this location. Start auto-monitor and let it collect readings across different hours first.</p>';
    return;
  }

  const peak = known.reduce((max, f) => (f.predicted > max.predicted ? f : max), known[0]);
  const peakLabel = escapeHtml(peak.label);
  const peakPredicted = escapeHtml(peak.predicted.toFixed(1));
  const peakStatus = escapeHtml(peak.status);
  const peakSampleSize = escapeHtml(peak.sampleSize);

  let html = `<p style="margin-bottom: 12px;"><strong>Peak hour tomorrow (predicted):</strong> ${peakLabel} — ${peakPredicted}°C (${peakStatus}), based on ${peakSampleSize} past reading(s) at that hour.</p>`;
  html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px;">';
  forecast.forEach(f => {
    if (f.predicted === null) {
      const label = escapeHtml(f.label);
      html += `<div style="background: #eee; color: #999; padding: 8px; border-radius: 6px; text-align: center; font-size: 0.85em;"><strong>${label}</strong><br>no data</div>`;
    } else {
      const label = escapeHtml(f.label);
      const predicted = escapeHtml(f.predicted.toFixed(1));
      html += `<div style="background: ${f.color}; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 0.85em;"><strong>${label}</strong><br>${predicted}°C</div>`;
    }
  });
  html += '</div>';
  summaryDiv.innerHTML = html;
}


function predictLinearRegression(data) {
  if (data.length < 2) return null;
  const n = data.length;
  const xSum = (n * (n - 1)) / 2;
  const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
  const ySum = data.reduce((a, b) => a + b, 0);
  const xySum = data.reduce((sum, y, x) => sum + x * y, 0);
  const slope = (n * xySum - xSum * ySum) / (n * xSquaredSum - xSum * xSum);
  const intercept = (ySum - slope * xSum) / n;
  return { slope, intercept };
}

function getDailyAggregates(location) {
  const history = getHistory(location);
  const byDate = {};
  history.forEach(entry => {
    const d = new Date(entry.timestamp);
    const key = d.toDateString();
    if (!byDate[key]) byDate[key] = { date: d, values: [] };
    byDate[key].values.push(entry.heatIndex);
  });
  return Object.values(byDate)
    .map(day => ({
      date: day.date,
      peak: Math.max(...day.values),
      avg: day.values.reduce((a, b) => a + b, 0) / day.values.length
    }))
    .sort((a, b) => a.date - b.date);
}

function generateForecast(location, days = 7) {
  const history = getHistory(location);
  if (history.length < 3) return [];

  const hourlyProfile = generateTomorrowForecast(location).filter(f => f.predicted !== null);
  if (hourlyProfile.length === 0) return [];
  const typicalPeak = hourlyProfile.reduce((max, f) => (f.predicted > max.predicted ? f : max), hourlyProfile[0]).predicted;

  const dailyAggregates = getDailyAggregates(location);
  let slope = 0;
  if (dailyAggregates.length >= 4) {
    const regression = predictLinearRegression(dailyAggregates.map(d => d.peak));
    if (regression) slope = regression.slope;
  }
  const maxTrendContribution = 3;

  const forecast = [];
  const today = new Date();

  for (let i = 1; i <= days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);

    const dayOfWeek = date.getDay();
    const weekFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? -1 : 0;
    const trendContribution = Math.max(-maxTrendContribution, Math.min(maxTrendContribution, slope * i));

    const predictedValue = Math.max(20, Math.min(55, typicalPeak + trendContribution + weekFactor));
    const status = getHeatStatus(predictedValue);

    forecast.push({
      date: date.toLocaleDateString(),
      dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayOfWeek],
      predicted: predictedValue,
      status: status,
      color: getStatusColor(status)
    });
  }

  return forecast;
}

// STEP 2: Destroy old prediction chart when insufficient data
function updatePredictionChart() {
  const location = document.getElementById('prediction-location').value;
  const history = getHistory(location);

  if (window.predictionChartInstance) {
    window.predictionChartInstance.destroy();
    window.predictionChartInstance = null;
  }

  if (history.length < 2) {
    document.getElementById('predictionChart').style.display = 'none';
    return;
  }

  const forecast = generateForecast(location, 7);
  const ctx = document.getElementById('predictionChart').getContext('2d');

  const dailyHistory = getDailyAggregates(location).slice(-10);
  const historicalData = dailyHistory.map(d => d.peak);
  const historicalLabels = dailyHistory.map(d => d.date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}));

  const forecastLabels = forecast.map(f => f.dayName);
  const forecastData = forecast.map(f => f.predicted);

  window.predictionChartInstance = new Chart(ctx, {
    type: 'line', data: {
      labels: [...historicalLabels, ...forecastLabels], datasets: [
        {
          label: 'Recent Daily Peak (°C)', data: [...historicalData, null], borderColor: '#d9534f', borderWidth: 2,
          backgroundColor: 'rgba(217, 83, 79, 0.1)', tension: 0.1, fill: true, pointRadius: 4
        },
        {
          label: '7-Day Forecast', data: [null, ...Array(historicalData.length - 1).fill(null), ...forecastData],
          borderColor: '#0066cc', borderDash: [5, 5], borderWidth: 2, pointRadius: 4,
          backgroundColor: 'rgba(0, 102, 204, 0.1)', tension: 0.1, pointBackgroundColor: '#0066cc'
        }
      ]
    }, options: {
      responsive: true, maintainAspectRatio: true,
      scales: { y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
      animation: {
        duration: 900,
        easing: 'easeOutQuart',
        delay: (ctx) => ctx.type === 'data' && ctx.datasetIndex === 1 ? 300 : 0
      },
      plugins: { tooltip: getChartTooltipConfig(), zoom: getChartZoomConfig() }
    }
  });
}

// STEP 1: Escape HTML in prediction summary
function updatePredictionSummary() {
  const location = document.getElementById('prediction-location').value;
  const forecast = generateForecast(location, 7);
  const summaryDiv = document.getElementById('forecast-summary');

  if (forecast.length === 0) {
    summaryDiv.innerHTML = '<p style="color: red;">Need at least 3 historical data points to generate forecast.</p>';
    return;
  }

  let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px;">';

  forecast.forEach(day => {
    const dayName = escapeHtml(day.dayName);
    const predicted = escapeHtml(day.predicted.toFixed(1));
    const status = escapeHtml(day.status);
    html += `
      <div style="background: ${day.color}; color: white; padding: 10px; border-radius: 8px; text-align: center;">
        <strong>${dayName}</strong><br>
        <span style="font-size: 18px; font-weight: bold;">${predicted}°C</span><br>
        <small>${status}</small>
      </div>
    `;
  });

  html += '</div>';
  summaryDiv.innerHTML = html;
}

// ====== SETTINGS ======
function initSettings() {
  document.getElementById('monitor-interval').value = localStorage.getItem('monitor_interval') || '60';
  document.getElementById('warning-threshold').value = localStorage.getItem('warning_threshold') || '32';
  document.getElementById('alert-sound').checked = localStorage.getItem('alert_sound') !== 'false';
  document.getElementById('browser-notification').checked = localStorage.getItem('browser_notification') !== 'false';

  document.getElementById('save-settings-btn').addEventListener('click', () => {
    localStorage.setItem('monitor_interval', document.getElementById('monitor-interval').value);
    localStorage.setItem('warning_threshold', document.getElementById('warning-threshold').value);
    localStorage.setItem('alert_sound', document.getElementById('alert-sound').checked);
    localStorage.setItem('browser_notification', document.getElementById('browser-notification').checked);
    alert('Settings saved!');
  });

  document.getElementById('backup-btn').addEventListener('click', () => {
    const backup = { timestamp: new Date().toISOString(), data: {} };
    LOCATIONS.forEach(loc => { backup.data[`history_${loc.id}`] = localStorage.getItem(`history_${loc.id}`); });
    backup.data['alerts_log'] = localStorage.getItem('alerts_log');
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backup, null, 2)));
    element.setAttribute('download', `schoolheat_backup_${new Date().getTime()}.json`);
    element.click();
  });

  document.getElementById('restore-btn').addEventListener('click', () => {
    document.getElementById('restore-file').click();
  });

  document.getElementById('restore-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const backup = JSON.parse(evt.target.result);
        Object.keys(backup.data).forEach(key => localStorage.setItem(key, backup.data[key]));
        alert('Restored!');
        location.reload();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  });
}

function updateStorageUsed() {
  let total = 0;
  for (let key in localStorage) {
    if (key.startsWith('history_') || key === 'alerts_log') total += localStorage[key].length;
  }
  document.getElementById('storage-used').textContent = (total / 1024).toFixed(2) + ' KB';
}

// ====== PWA INSTALL PROMPT ======
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const section = document.getElementById('install-section');
  if (section) section.style.display = 'block';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  const section = document.getElementById('install-section');
  if (section) section.style.display = 'none';
});

// ====== HEAT ADVISORY REPORT ======
// STEP 1: Escape all dynamic data in report
function generateReportHTML() {
  const now = new Date();
  const latestByLocation = LOCATIONS.map(loc => {
    const history = getHistory(loc.id);
    return { loc, latest: history.length > 0 ? history[history.length - 1] : null };
  });

  const withData = latestByLocation.filter(r => r.latest);
  const avgHeat = withData.length > 0
    ? (withData.reduce((s, r) => s + r.latest.heatIndex, 0) / withData.length).toFixed(1)
    : 'N/A';
  const dangerLocations = withData.filter(r => r.latest.status === 'Danger' || r.latest.status === 'Extreme Danger');
  let peak = null;
  withData.forEach(r => { if (!peak || r.latest.heatIndex > peak.latest.heatIndex) peak = r; });

  let overallAdvice, overallColor;
  if (!peak) {
    overallAdvice = 'No readings recorded yet. Start monitoring to generate a live advisory.';
    overallColor = '#999';
  } else if (dangerLocations.length > 0) {
    overallAdvice = `⚠️ ${dangerLocations.length} location(s) at Danger level or above. Consider suspending outdoor activities in affected areas.`;
    overallColor = '#e74c3c';
  } else if (peak.latest.heatIndex >= 32) {
    overallAdvice = 'Elevated heat index detected. Limit prolonged outdoor activity and ensure water access.';
    overallColor = '#fd7e14';
  } else {
    overallAdvice = 'Campus heat levels are within safe range.';
    overallColor = '#28a745';
  }

  const rows = withData
    .sort((a, b) => b.latest.heatIndex - a.latest.heatIndex)
    .map(r => {
      const locName = escapeHtml(r.loc.name);
      const heatIndex = escapeHtml(r.latest.heatIndex.toFixed(1));
      const status = escapeHtml(r.latest.status);
      const time = escapeHtml(r.latest.time);
      return `
      <tr>
        <td>${r.loc.number}</td>
        <td>${locName}</td>
        <td>${heatIndex}°C</td>
        <td style="color:${getStatusColor(r.latest.status)}; font-weight:bold;">${status}</td>
        <td>${time}</td>
      </tr>`;
    }).join('');

  return `
    <div class="report-header">
      <img src="assets/school-logo.png" alt="School logo">
      <div>
        <h2>Mahaplag National High School</h2>
        <p>SchoolHeat — Heat Index Advisory Report</p>
        <p>Generated: ${now.toLocaleString()}</p>
      </div>
    </div>
    <p style="background:${overallColor}; color:white; padding:12px 16px; border-radius:8px; font-weight:bold;">${overallAdvice}</p>
    <div class="report-summary-grid">
      <div><strong>Locations Tracked:</strong> ${LOCATIONS.length}</div>
      <div><strong>Locations Reporting:</strong> ${withData.length}</div>
      <div><strong>Campus Average Heat Index:</strong> ${avgHeat}${avgHeat !== 'N/A' ? '°C' : ''}</div>
      <div><strong>Locations in Danger:</strong> ${dangerLocations.length}</div>
    </div>
    ${withData.length > 0 ? `
    <table class="report-table">
      <thead><tr><th>#</th><th>Location</th><th>Heat Index</th><th>Status</th><th>Last Reading</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p>No readings recorded yet for any location.</p>'}
  `;
}

function openReportModal() {
  document.getElementById('report-content').innerHTML = generateReportHTML();
  document.getElementById('report-modal-overlay').classList.add('active');
}

function closeReportModal() {
  document.getElementById('report-modal-overlay').classList.remove('active');
}

// ====== EXPANDABLE CHARTS ======
const CHART_INSTANCE_GETTERS = {
  heatIndexChart: () => heatIndexChart,
  comparisonChart: () => comparisonChart,
  todayVsTomorrowChart: () => todayVsTomorrowChart,
  predictionChart: () => window.predictionChartInstance
};

const CHART_TYPES = {
  heatIndexChart: () => document.getElementById('chart-type').value || 'line',
  comparisonChart: () => 'bar',
  todayVsTomorrowChart: () => 'line',
  predictionChart: () => 'line'
};

let modalChartInstance = null;

function openChartModal(chartId, title) {
  const getInstance = CHART_INSTANCE_GETTERS[chartId];
  const srcChart = getInstance ? getInstance() : null;
  if (!srcChart) {
    alert('Nothing to expand yet — this chart has no data. Record a reading first.');
    return;
  }

  document.getElementById('chart-modal-title').textContent = title;
  const modalCanvas = document.getElementById('chart-modal-canvas');
  if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }

  try {
    const chartType = CHART_TYPES[chartId] ? CHART_TYPES[chartId]() : 'line';
    modalChartInstance = new Chart(modalCanvas.getContext('2d'), {
      type: chartType,
      data: srcChart.data,
      options: {
        ...srcChart.options,
        maintainAspectRatio: false,
        animation: { duration: 500 },
        plugins: { ...(srcChart.options.plugins || {}), tooltip: getChartTooltipConfig(), zoom: getChartZoomConfig() }
      }
    });
    document.getElementById('chart-modal-overlay').classList.add('active');
  } catch (err) {
    console.error('Chart expand failed:', err);
    alert('Could not open the expanded chart. Check the browser console for details.');
  }
}

function closeChartModal() {
  document.getElementById('chart-modal-overlay').classList.remove('active');
  if (modalChartInstance) { modalChartInstance.destroy(); modalChartInstance = null; }
}

// ====== INITIALIZATION ======
document.addEventListener('DOMContentLoaded', () => {
  buildLocationDropdowns();
  buildDashboardCards();
  buildCampusMapMarkers();
  initTabs();
  initMonitorTab();
  initAlerts();
  initSettings();
  updateDashboard();

  document.getElementById('location-select').addEventListener('change', updateDashboard);
  document.getElementById('history-location').addEventListener('change', updateHistoryChart);
  document.getElementById('chart-type').addEventListener('change', updateHistoryChart);
  document.getElementById('prediction-location').addEventListener('change', () => { updatePredictionChart(); updatePredictionSummary(); updateTodayVsTomorrowChart(); updateTomorrowSummary(); });
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('clear-history-btn').addEventListener('click', clearHistory);

  document.getElementById('generate-report-btn').addEventListener('click', openReportModal);
  document.getElementById('report-close-btn').addEventListener('click', closeReportModal);
  document.getElementById('report-close-btn-2').addEventListener('click', closeReportModal);
  document.getElementById('report-print-btn').addEventListener('click', () => window.print());
  document.getElementById('report-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'report-modal-overlay') closeReportModal();
  });

  document.querySelectorAll('.expand-chart-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('[data-chart-id]');
      openChartModal(container.dataset.chartId, container.dataset.chartTitle);
    });
  });
  document.querySelectorAll('.reset-zoom-btn-small').forEach(btn => {
    btn.addEventListener('click', () => {
      const container = btn.closest('[data-chart-id]');
      const getInstance = CHART_INSTANCE_GETTERS[container.dataset.chartId];
      if (getInstance) resetChartZoom(getInstance());
    });
  });
  document.getElementById('chart-modal-reset-zoom-btn').addEventListener('click', () => {
    resetChartZoom(modalChartInstance);
  });
  document.getElementById('install-app-btn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  });
  document.getElementById('chart-modal-close-btn').addEventListener('click', closeChartModal);
  document.getElementById('chart-modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'chart-modal-overlay') closeChartModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeChartModal(); closeReportModal(); }
  });

  updateOverviewStats();

  console.log('🔥 SchoolHeat v2.3 - XSS hardening + sleep catch-up + chart ghosting fixed!');
});
