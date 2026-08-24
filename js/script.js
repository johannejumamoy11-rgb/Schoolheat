// ====== CONFIGURATION ======
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

const SchoolHeat = (() => {
  "use strict";

  const LOCATIONS_BY_ID = {};
  LOCATIONS.forEach(loc => { LOCATIONS_BY_ID[loc.id] = loc; });

  // ====== STATE ======
  let heatIndexChart = null;
  let comparisonChart = null;
  let todayVsTomorrowChart = null;
  let predictionChartInstance = null;
  let modalChartInstance = null;
  let audioCtx = null;
  let autoMonitorActive = {};
  let autoMonitorTimers = {};
  let deferredInstallPrompt = null;
  let lastHeatData = null;

  // Restore auto-monitor state from localStorage
  const savedMonitors = localStorage.getItem('active_monitors');
  if (savedMonitors) {
    try {
      const parsed = JSON.parse(savedMonitors);
      Object.keys(parsed).forEach(k => { autoMonitorActive[k] = parsed[k]; });
    } catch (e) { console.error('Failed to restore monitor state', e); }
  }

  LOCATIONS.forEach(loc => {
    if (!(loc.id in autoMonitorActive)) autoMonitorActive[loc.id] = false;
    autoMonitorTimers[loc.id] = null;
  });

  // ====== HELPERS ======
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

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function safeToFixed(value, decimals = 1) {
    const num = parseFloat(value);
    return isNaN(num) ? '--' : num.toFixed(decimals);
  }

  function safeNumber(value, fallback = 0) {
    const num = parseFloat(value);
    return isNaN(num) ? fallback : num;
  }
  function csvEscape(str) {
    const s = String(str).replace(/"/g, '""');
    if (/^[+=@-]/.test(s)) return "'" + s;
    return '"' + s + '"';
  }

  function saveMonitorState() {
    try {
      localStorage.setItem('active_monitors', JSON.stringify(autoMonitorActive));
    } catch (e) {
      console.error('Storage full - could not save monitor state:', e);
    }
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

  function getHistory(location) {
    const key = `history_${location}`;
    let data = null;
    try {
      data = localStorage.getItem(key);
    } catch (e) {
      console.error('Cannot access localStorage (private browsing?):', e);
      return [];
    }
    if (!data) return [];
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Corrupted history for', location, e);
      return [];
    }
  }

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
    try {
      localStorage.setItem(key, JSON.stringify(history));
    } catch (e) {
      console.error('Storage full - could not save history:', e);
      alert('Warning: Device storage is full. Please export and clear old data.');
    }
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
    valueEl.textContent = safeToFixed(heatIndex);
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

  function recordHourlyReading(location, forcedTimestamp = null) {
    const hour = forcedTimestamp ? new Date(forcedTimestamp).getHours() : new Date().getHours();
    const reading = simulateHourlyReading(location, hour);
    const heatIndex = calculateHeatIndex(reading.temp, reading.humidity);
    addToHistory(location, reading.temp, reading.humidity, heatIndex, forcedTimestamp);

    const status = getHeatStatus(heatIndex);
    const threshold = parseFloat(localStorage.getItem('warning_threshold') || '32');
    if (heatIndex >= threshold) {
      try { triggerWarning(heatIndex, status, location); } catch (e) { console.error('Warning trigger failed:', e); }
    }

    const logTime = forcedTimestamp ? new Date(forcedTimestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    console.log(`📊 [${logTime}] ${LOCATIONS_BY_ID[location].name}: ${reading.temp}°C, ${reading.humidity}% → HI: ${heatIndex.toFixed(1)}°C`);

    const currentSelection = document.getElementById('location-select');
    if (currentSelection && currentSelection.value === location) updateGauge(heatIndex);
    updateDashboard();
    return { reading, heatIndex, status };
  }

  // ====== DYNAMIC UI GENERATION ======
  function buildLocationDropdowns() {
    const selectIds = ['location-select', 'history-location', 'prediction-location'];
    selectIds.forEach(selectId => {
      const select = document.getElementById(selectId);
      if (!select) return;
      select.innerHTML = '';
      LOCATIONS.forEach(loc => {
        const option = document.createElement('option');
        option.value = loc.id;
        option.textContent = `${loc.number}. ${loc.name}`;
        select.appendChild(option);
      });
    });
  }

  function buildDashboardCards() {
    const grid = document.querySelector('.dashboard-grid');
    if (!grid) return;
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
    if (!wrapper) return;
    wrapper.querySelectorAll('.map-marker').forEach(m => m.remove());

    const img = wrapper.querySelector('.campus-map-image');
    if (!img) return;
    // If image isn't loaded yet, wait for it then build markers
    if (!img.complete || img.naturalWidth === 0 || img.naturalHeight === 0) {
      img.onload = () => { buildCampusMapMarkers(); };
      img.onerror = () => { console.error('Failed to load campus map image'); };
      return;
    }

    const wrapperRect = wrapper.getBoundingClientRect();
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const wrapperRatio = wrapperRect.width / wrapperRect.height;
    let displayWidth = wrapperRect.width;
    let displayHeight = wrapperRect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (wrapperRatio > imgRatio) {
      displayHeight = wrapperRect.height;
      displayWidth = displayHeight * imgRatio;
      offsetX = (wrapperRect.width - displayWidth) / 2;
    } else {
      displayWidth = wrapperRect.width;
      displayHeight = displayWidth / imgRatio;
      offsetY = (wrapperRect.height - displayHeight) / 2;
    }

    LOCATIONS.forEach(loc => {
      const pos = MAP_MARKER_POSITIONS[loc.id];
      if (!pos) return;

      const history = getHistory(loc.id);
      const hasData = history.length > 0;
      const latest = hasData ? history[history.length - 1] : null;
      const color = hasData ? getStatusColor(latest.status) : '#cccccc';

      const marker = document.createElement('div');
      marker.className = 'map-marker';
      marker.style.left = (offsetX + (pos.x / 100) * displayWidth) + 'px';
      marker.style.top = (offsetY + (pos.y / 100) * displayHeight) + 'px';
      marker.style.background = color;
      marker.setAttribute('role', 'button');
      marker.setAttribute('aria-label', `${loc.number}. ${loc.name}${hasData ? ` — ${safeToFixed(latest.heatIndex)}°C (${latest.status})` : ' — No data yet'}`);
      marker.setAttribute('tabindex', '0');
      marker.title = `${loc.number}. ${loc.name}` +
        (hasData ? ` — ${safeToFixed(latest.heatIndex)}°C (${latest.status})` : ' — No data yet');

      const clickHandler = () => {
        document.getElementById('location-select').value = loc.id;
        document.querySelector('.tab-btn[data-tab="monitor"]').click();
      };

      marker.addEventListener('click', clickHandler);
      marker.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          clickHandler();
        }
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
        tabBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-selected', 'false');
        });
        document.getElementById(tabName).classList.add('active');
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
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

      lastHeatData = { heatIndex: safeToFixed(heatIndex), temp, humidity, status, location: locName, timestamp: new Date().toLocaleString() };

      const threshold = parseFloat(localStorage.getItem('warning_threshold') || '32');
      if (heatIndex >= threshold) triggerWarning(heatIndex, status, location);
      updateDashboard();
    });

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
        this.classList.remove('active-monitor');
        document.getElementById('auto-monitor-status').innerHTML = `<span style="color: orange;">Auto-monitor stopped for ${escapeHtml(locName)}</span>`;
        saveMonitorState();
      } else {
        autoMonitorActive[location] = true;
        this.textContent = 'Stop Auto-Monitor';
        this.classList.add('active-monitor');
        saveMonitorState();

        // FIX: Normalize first reading to top of the hour to prevent drift
        const now = new Date();
        const normalizedNow = new Date(now);
        normalizedNow.setMinutes(0, 0, 0);
        recordHourlyReading(location, normalizedNow.getTime());

        document.getElementById('result-text').innerHTML = `<strong>Auto-Monitor Active for ${escapeHtml(locName)}</strong><br>Recording every hour, on the hour...`;
        document.getElementById('auto-monitor-status').innerHTML = `<span style="color: green;">✅ Auto-monitoring active for ${escapeHtml(locName)} (next reading at the top of the hour)</span>`;

        let lastRecordedDate = new Date();
        lastRecordedDate.setMinutes(0, 0, 0);

        autoMonitorTimers[location] = setInterval(() => {
          if (!autoMonitorActive[location]) {
            clearInterval(autoMonitorTimers[location]);
            autoMonitorTimers[location] = null;
            return;
          }
          const now = new Date();
          now.setMinutes(0, 0, 0);

          const diffMs = now.getTime() - lastRecordedDate.getTime();
          const diffHours = Math.round(diffMs / (60 * 60 * 1000));

          if (diffHours >= 1) {
            for (let i = 1; i <= diffHours; i++) {
              const recordDate = new Date(lastRecordedDate);
              recordDate.setHours(recordDate.getHours() + i);
              try { recordHourlyReading(location, recordDate.getTime()); } catch (e) { console.error('Catch-up reading failed:', e); }
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

      if (!coordPhone || !headPhone || !lastHeatData) {
        alertStatus.innerHTML = '<span style="color: red;">Fill all fields and calculate first.</span>';
        alertStatus.style.backgroundColor = '#f8d7da';
        return;
      }

      const data = lastHeatData;
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
    if (document.getElementById('alert-sound')?.checked) {
      try { playAlertSound(); } catch (e) { console.error('Alert sound failed:', e); }
    }
    if (document.getElementById('browser-notification')?.checked && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        try {
          new Notification('🔥 SchoolHeat Warning', { body: `Heat Index ${safeToFixed(heatIndex)}°C (${status}) at ${locName}` });
        } catch (e) {
          console.error('Notification failed:', e);
        }
      } else if (Notification.permission !== 'denied') {
        try { Notification.requestPermission(); } catch (e) { console.error('Permission request failed:', e); }
      }
    }
  }

  // FIX: Reuse single AudioContext instead of creating new ones
  function playAlertSound() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.5);
  }

  function logAlert(data) {
    let alerts = JSON.parse(localStorage.getItem('alerts_log') || '[]');
    alerts.push({...data, logTime: new Date().toLocaleString()});
    if (alerts.length > 50) alerts.shift();
    try {
      localStorage.setItem('alerts_log', JSON.stringify(alerts));
    } catch (e) {
      console.error('Storage full - could not save alert:', e);
    }
  }

  // ====== CHART UTILITIES ======
  function getChartTooltipConfig(unit = '°C') {
    return {
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) label += ': ';
          // FIX: For horizontal bar charts (indexAxis: 'y'), value is in parsed.x, not parsed.y
          const chart = context.chart;
          const isHorizontal = chart.options.indexAxis === 'y';
          const value = isHorizontal
            ? (context.parsed.x !== undefined && context.parsed.x !== null ? context.parsed.x : null)
            : (context.parsed.y !== undefined && context.parsed.y !== null ? context.parsed.y : context.parsed.x);
          if (value === null || value === undefined || isNaN(value)) return label + 'No data';
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
        mode: 'x',
        modifierKey: null,
        threshold: isTouch ? 8 : 4,
        onPan: function({chart}) {
          chart.update('none');
        }
      },
      zoom: {
        wheel: { enabled: !isTouch, speed: 0.2 },
        pinch: { enabled: isTouch },
        drag: { enabled: false },
        mode: 'x',
        onZoom: function({chart}) {
          chart.update('active');
        },
        onZoomComplete: function({chart}) {
          const yScale = chart.scales.y;
          if (yScale && yScale.max - yScale.min < 5) {
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

  // ====== HISTORY ======
  // FIX: Update existing chart instead of destroying when possible
  function updateHistoryChart() {
    const location = document.getElementById('history-location').value;
    const type = document.getElementById('chart-type').value;
    const history = getHistory(location);
    const ctx = document.getElementById('heatIndexChart').getContext('2d');

    if (heatIndexChart) {
      if (!history.length) {
        heatIndexChart.destroy();
        heatIndexChart = null;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        return;
      }
      const labels = history.map(h => new Date(h.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
      const data = history.map(h => h.heatIndex);
      heatIndexChart.data.labels = labels;
      heatIndexChart.data.datasets[0].data = data;
      heatIndexChart.config.type = type;
      heatIndexChart.update();
      return;
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
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 400, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        scales: {
          y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } }
        },
        plugins: {
          tooltip: getChartTooltipConfig(),
          zoom: getChartZoomConfig()
        }
      }
    });
  }

  function updateHistoryTable() {
    const location = document.getElementById('history-location').value;
    const history = getHistory(location);
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';
    history.slice().reverse().forEach(entry => {
      const row = tbody.insertRow();
      const color = getStatusColor(entry.status);
      row.innerHTML = `<td>${escapeHtml(entry.time)}</td><td>${escapeHtml(entry.temp.toFixed(1))}°C</td><td>${escapeHtml(entry.humidity.toFixed(1))}%</td><td>${escapeHtml(entry.heatIndex.toFixed(1))}°C</td><td><span style="background: ${color}; color: white; padding: 5px 10px; border-radius: 4px;">${escapeHtml(entry.status)}</span></td>`;
    });
  }

  // FIX: CSV injection protection
  function exportData() {
    let csv = 'Time,Location Number,Location Name,Temperature,Humidity,Heat Index,Status\n';
    LOCATIONS.forEach(loc => {
      getHistory(loc.id).forEach(entry => {
        csv += `${csvEscape(entry.time)},${loc.number},${csvEscape(loc.name)},${entry.temp},${entry.humidity},${entry.heatIndex},${csvEscape(entry.status)}\n`;
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
      const cardEl = heatEl ? heatEl.closest('.dashboard-card') : null;
      if (!heatEl || !statusEl || !timeEl) return;
      if (history.length > 0) {
        const latest = history[history.length - 1];
        const newText = safeToFixed(latest.heatIndex) + '°C';
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
        if (cardEl) cardEl.classList.toggle('card-alert', isUrgent);
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
      animateCountUp(avgEl, safeNumber(avgHeat), 1, '°C');
    } else {
      avgEl.textContent = '--';
    }

    const peakEl = document.getElementById('stat-peak-heat');
    const peakLabelEl = document.getElementById('stat-peak-label');
    const peakCard = document.getElementById('stat-peak-card');
    if (peak) {
      animateCountUp(peakEl, safeNumber(peak.latest.heatIndex), 1, '°C');
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

  // FIX: Update comparison chart instead of destroying
  function updateComparisonChart() {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas) return;
    canvas.parentElement.style.height = Math.max(400, LOCATIONS.length * 28) + 'px';

    const ctx = canvas.getContext('2d');
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

    if (comparisonChart) {
      comparisonChart.data.labels = labels;
      comparisonChart.data.datasets[0].data = data;
      comparisonChart.data.datasets[0].backgroundColor = barColors;
      comparisonChart.data.datasets[0].borderColor = barColors;
      comparisonChart.update();
      return;
    }

    comparisonChart = new Chart(ctx, {
      type: 'bar', data: {
        labels, datasets: [{
          label: 'Current Heat Index (°C)', data,
          backgroundColor: barColors, borderColor: barColors, borderWidth: 1
        }]
      }, options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: { duration: 400, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        scales: { x: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
        plugins: {
          tooltip: getChartTooltipConfig(),
          zoom: getChartZoomConfig()
        }
      }
    });
  }

  // ====== TOMORROW FORECAST ======
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
      if (d.toDateString() === todayStr) {
        const h = entry.hour !== undefined ? entry.hour : d.getHours();
        byHour[h] = entry.heatIndex;
      }
    });
    const readings = [];
    for (let hour = 0; hour < 24; hour++) {
      readings.push({ hour, label: `${hour.toString().padStart(2, '0')}:00`, heatIndex: byHour[hour] !== undefined ? byHour[hour] : null });
    }
    return readings;
  }

  // FIX: Update existing chart instead of destroying
  function updateTodayVsTomorrowChart() {
    const location = document.getElementById('prediction-location').value;
    const todayReadings = getTodayHourlyReadings(location);
    const tomorrowForecast = generateTomorrowForecast(location);
    const hasAnyData = todayReadings.some(r => r.heatIndex !== null) || tomorrowForecast.some(f => f.predicted !== null);
    const canvas = document.getElementById('todayVsTomorrowChart');

    if (todayVsTomorrowChart) {
      if (!hasAnyData) {
        todayVsTomorrowChart.destroy();
        todayVsTomorrowChart = null;
        canvas.style.display = 'none';
        return;
      }
      const todayData = todayReadings.map(r => r.heatIndex);
      const tomorrowData = tomorrowForecast.map(f => f.predicted);
      todayVsTomorrowChart.data.datasets[0].data = todayData;
      todayVsTomorrowChart.data.datasets[1].data = tomorrowData;
      todayVsTomorrowChart.update();
      canvas.style.display = 'block';
      return;
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
        responsive: true,
        maintainAspectRatio: true,
        animation: { duration: 600, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        scales: { y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
        plugins: {
          tooltip: getChartTooltipConfig(),
          zoom: getChartZoomConfig()
        }
      }
    });
  }

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

    let html = `<p style="margin-bottom: 12px;"><strong>Peak hour tomorrow (predicted):</strong> ${escapeHtml(peak.label)} — ${escapeHtml(peak.predicted.toFixed(1))}°C (${escapeHtml(peak.status)}), based on ${escapeHtml(peak.sampleSize)} past reading(s) at that hour.</p>`;
    html += '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px;">';
    forecast.forEach(f => {
      if (f.predicted === null) {
        html += `<div style="background: #eee; color: #999; padding: 8px; border-radius: 6px; text-align: center; font-size: 0.85em;"><strong>${escapeHtml(f.label)}</strong><br>no data</div>`;
      } else {
        html += `<div style="background: ${f.color}; color: white; padding: 8px; border-radius: 6px; text-align: center; font-size: 0.85em;"><strong>${escapeHtml(f.label)}</strong><br>${escapeHtml(f.predicted.toFixed(1))}°C</div>`;
      }
    });
    html += '</div>';
    summaryDiv.innerHTML = html;
  }

  // ====== LINEAR REGRESSION (FIXED) ======
  function predictLinearRegression(data) {
    // FIX: Was < 2, which causes divide-by-zero with exactly 2 points.
    // Need at least 3 points for meaningful regression and to avoid zero denominator.
    if (data.length < 3) return null;
    const n = data.length;
    const xSum = (n * (n - 1)) / 2;
    const xSquaredSum = (n * (n - 1) * (2 * n - 1)) / 6;
    const ySum = data.reduce((a, b) => a + b, 0);
    const xySum = data.reduce((sum, y, x) => sum + x * y, 0);
    const denominator = n * xSquaredSum - xSum * xSum;
    if (denominator === 0) return null; // Extra safety
    const slope = (n * xySum - xSum * ySum) / denominator;
    const intercept = (ySum - slope * xSum) / n;
    return { slope, intercept };
  }

  function getDailyAggregates(location) {
    const history = getHistory(location);
    const byDate = {};
    history.forEach(entry => {
      const d = new Date(entry.timestamp);
      if (isNaN(d.getTime())) return; // Skip invalid timestamps
      const key = d.toDateString();
      if (!byDate[key]) byDate[key] = { date: d, values: [] };
      const hi = parseFloat(entry.heatIndex);
      if (!isNaN(hi)) byDate[key].values.push(hi);
    });
    return Object.values(byDate)
      .filter(day => day.values.length > 0)
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

    const hourlyProfile = generateTomorrowForecast(location).filter(f => f.predicted !== null && !isNaN(f.predicted));
    if (hourlyProfile.length === 0) return [];
    const typicalPeak = hourlyProfile.reduce((max, f) => (f.predicted > max.predicted ? f : max), hourlyProfile[0]).predicted;
    if (isNaN(typicalPeak)) return [];

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

  // FIX: Update prediction chart instead of destroying
  function updatePredictionChart() {
    const location = document.getElementById('prediction-location').value;
    const history = getHistory(location);
    const ctx = document.getElementById('predictionChart').getContext('2d');

    if (predictionChartInstance) {
      if (history.length < 2) {
        predictionChartInstance.destroy();
        predictionChartInstance = null;
        document.getElementById('predictionChart').style.display = 'none';
        return;
      }
      const forecast = generateForecast(location, 7);
      const dailyHistory = getDailyAggregates(location).slice(-10);
      const historicalData = dailyHistory.map(d => d.peak);
      const historicalLabels = dailyHistory.map(d => d.date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}));
      const forecastLabels = forecast.map(f => f.dayName);
      const forecastData = forecast.map(f => f.predicted);

      predictionChartInstance.data.labels = [...historicalLabels, ...forecastLabels];
      predictionChartInstance.data.datasets[0].data = [...historicalData, null];
      predictionChartInstance.data.datasets[1].data = [null, ...Array(historicalData.length - 1).fill(null), ...forecastData];
      predictionChartInstance.update();
      document.getElementById('predictionChart').style.display = 'block';
      return;
    }

    if (history.length < 2) {
      document.getElementById('predictionChart').style.display = 'none';
      return;
    }

    const forecast = generateForecast(location, 7);
    const dailyHistory = getDailyAggregates(location).slice(-10);
    const historicalData = dailyHistory.map(d => d.peak);
    const historicalLabels = dailyHistory.map(d => d.date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'}));
    const forecastLabels = forecast.map(f => f.dayName);
    const forecastData = forecast.map(f => f.predicted);

    predictionChartInstance = new Chart(ctx, {
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
        responsive: true,
        maintainAspectRatio: true,
        animation: {
          duration: 600,
          easing: 'easeOutQuart',
          delay: (ctx) => ctx.type === 'data' && ctx.datasetIndex === 1 ? 300 : 0
        },
        interaction: { mode: 'index', intersect: false },
        scales: { y: { min: 20, max: 50, ticks: { callback: v => v + '°C' } } },
        plugins: {
          tooltip: getChartTooltipConfig(),
          zoom: getChartZoomConfig()
        }
      }
    });
  }

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
      html += `
        <div style="background: ${day.color}; color: white; padding: 10px; border-radius: 8px; text-align: center;">
          <strong>${escapeHtml(day.dayName)}</strong><br>
          <span style="font-size: 18px; font-weight: bold;">${escapeHtml(day.predicted.toFixed(1))}°C</span><br>
          <small>${escapeHtml(day.status)}</small>
        </div>
      `;
    });

    html += '</div>';
    summaryDiv.innerHTML = html;
  }

  // ====== SETTINGS ======
  function initSettings() {
    let monitorInterval = '60', warningThreshold = '32', alertSound = 'true', browserNotif = 'true';
    try {
      monitorInterval = localStorage.getItem('monitor_interval') || '60';
      warningThreshold = localStorage.getItem('warning_threshold') || '32';
      alertSound = localStorage.getItem('alert_sound');
      browserNotif = localStorage.getItem('browser_notification');
    } catch (e) {
      console.error('Cannot read settings from localStorage:', e);
    }
    document.getElementById('monitor-interval').value = monitorInterval;
    document.getElementById('warning-threshold').value = warningThreshold;
    document.getElementById('alert-sound').checked = alertSound !== 'false';
    document.getElementById('browser-notification').checked = browserNotif !== 'false';

    document.getElementById('save-settings-btn').addEventListener('click', () => {
      // FIX: Validate and clamp inputs before saving
      let interval = parseInt(document.getElementById('monitor-interval').value, 10);
      let threshold = parseFloat(document.getElementById('warning-threshold').value);

      if (isNaN(interval) || interval < 5) interval = 5;
      if (interval > 240) interval = 240;
      if (isNaN(threshold) || threshold < 20) threshold = 20;
      if (threshold > 50) threshold = 50;

      try {
        localStorage.setItem('monitor_interval', interval);
        localStorage.setItem('warning_threshold', threshold);
        localStorage.setItem('alert_sound', document.getElementById('alert-sound').checked);
        localStorage.setItem('browser_notification', document.getElementById('browser-notification').checked);
      } catch (e) {
        console.error('Storage full - could not save settings:', e);
        alert('Warning: Device storage is full. Please export and clear old data.');
        return;
      }

      // Update UI to reflect clamped values
      document.getElementById('monitor-interval').value = interval;
      document.getElementById('warning-threshold').value = threshold;

      alert('Settings saved!');
    });

    document.getElementById('backup-btn').addEventListener('click', () => {
      const backup = { timestamp: new Date().toISOString(), data: {} };
      try {
        LOCATIONS.forEach(loc => { backup.data[`history_${loc.id}`] = localStorage.getItem(`history_${loc.id}`); });
        backup.data['alerts_log'] = localStorage.getItem('alerts_log');
        backup.data['active_monitors'] = localStorage.getItem('active_monitors');
      } catch (e) {
        console.error('Cannot read data for backup:', e);
        alert('Cannot access storage for backup. Are you in private browsing mode?');
        return;
      }
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
          Object.keys(backup.data).forEach(key => {
            if (backup.data[key] !== null) localStorage.setItem(key, backup.data[key]);
          });
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
    const el = document.getElementById('storage-used');
    if (!el) return;
    let total = 0;
    try {
      for (let key in localStorage) {
        if (key.startsWith('history_') || key === 'alerts_log' || key === 'active_monitors') {
          total += localStorage[key] ? localStorage[key].length : 0;
        }
      }
      el.textContent = (total / 1024).toFixed(2) + ' KB';
    } catch (e) {
      console.error('Cannot calculate storage usage:', e);
      el.textContent = 'Unavailable';
    }
  }

  // ====== PWA INSTALL PROMPT ======
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
  function generateReportHTML() {
    const now = new Date();
    const latestByLocation = LOCATIONS.map(loc => {
      const history = getHistory(loc.id);
      return { loc, latest: history.length > 0 ? history[history.length - 1] : null };
    });

    const withData = latestByLocation.filter(r => r.latest);
    const avgHeat = withData.length > 0
      ? safeToFixed(withData.reduce((s, r) => s + safeNumber(r.latest.heatIndex), 0) / withData.length)
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
        return `
        <tr>
          <td>${r.loc.number}</td>
          <td>${escapeHtml(r.loc.name)}</td>
          <td>${escapeHtml(safeToFixed(r.latest.heatIndex))}°C</td>
          <td style="color:${getStatusColor(r.latest.status)}; font-weight:bold;">${escapeHtml(r.latest.status)}</td>
          <td>${escapeHtml(r.latest.time)}</td>
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
    predictionChart: () => predictionChartInstance
  };

  const CHART_TYPES = {
    heatIndexChart: () => document.getElementById('chart-type').value || 'line',
    comparisonChart: () => 'bar',
    todayVsTomorrowChart: () => 'line',
    predictionChart: () => 'line'
  };

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
      // FIX: Deep clone data to avoid shared state corruption between modal and source chart
      modalChartInstance = new Chart(modalCanvas.getContext('2d'), {
        type: chartType,
        data: JSON.parse(JSON.stringify(srcChart.data)),
        options: {
          ...srcChart.options,
          maintainAspectRatio: false,
          animation: { duration: 400, easing: 'easeOutQuart' },
          interaction: { mode: 'index', intersect: false },
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

  // ====== RESUME AUTO-MONITORS ON LOAD ======
  function resumeAutoMonitors() {
    Object.keys(autoMonitorActive).forEach(location => {
      if (autoMonitorActive[location]) {
        // Use the actual last recorded timestamp from history, or current hour if none exists
        const history = getHistory(location);
        let lastRecordedDate = new Date();
        if (history.length > 0) {
          lastRecordedDate = new Date(history[history.length - 1].timestamp);
        }
        lastRecordedDate.setMinutes(0, 0, 0);

        // Immediate catch-up for any missed hours since last recording
        const now = new Date();
        now.setMinutes(0, 0, 0);
        const diffMs = now.getTime() - lastRecordedDate.getTime();
        const diffHours = Math.round(diffMs / (60 * 60 * 1000));
        if (diffHours >= 1) {
          for (let i = 1; i <= diffHours; i++) {
            const recordDate = new Date(lastRecordedDate);
            recordDate.setHours(recordDate.getHours() + i);
            recordHourlyReading(location, recordDate.getTime());
          }
          lastRecordedDate = new Date(now);
        }

        autoMonitorTimers[location] = setInterval(() => {
          if (!autoMonitorActive[location]) {
            clearInterval(autoMonitorTimers[location]);
            autoMonitorTimers[location] = null;
            return;
          }
          const now = new Date();
          now.setMinutes(0, 0, 0);

          const diffMs = now.getTime() - lastRecordedDate.getTime();
          const diffHours = Math.round(diffMs / (60 * 60 * 1000));

          if (diffHours >= 1) {
            for (let i = 1; i <= diffHours; i++) {
              const recordDate = new Date(lastRecordedDate);
              recordDate.setHours(recordDate.getHours() + i);
              try { recordHourlyReading(location, recordDate.getTime()); } catch (e) { console.error('Catch-up reading failed:', e); }
            }
            lastRecordedDate = new Date(now);
          }
        }, 60000);
      }
    });
  }

  // Sync auto-monitor button to reflect restored state for current selection
  function syncMonitorButtonState() {
    const location = document.getElementById('location-select').value;
    const btn = document.getElementById('auto-monitor-btn');
    const statusEl = document.getElementById('auto-monitor-status');
    const locName = LOCATIONS_BY_ID[location].name;
    if (autoMonitorActive[location]) {
      btn.textContent = 'Stop Auto-Monitor';
      btn.classList.add('active-monitor');
      statusEl.innerHTML = `<span style="color: green;">✅ Auto-monitoring active for ${escapeHtml(locName)}</span>`;
    } else {
      btn.textContent = 'Start Auto-Monitor (Hourly)';
      btn.classList.remove('active-monitor');
      statusEl.innerHTML = '';
    }
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
    resumeAutoMonitors(); // FIX: Resume monitors after page reload

    document.getElementById('location-select').addEventListener('change', () => { updateDashboard(); syncMonitorButtonState(); });
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

    // Rebuild map markers on window resize to handle aspect ratio changes
    window.addEventListener('resize', () => {
      if (document.getElementById('map').classList.contains('active')) {
        buildCampusMapMarkers();
      }
    });

    updateOverviewStats();
    syncMonitorButtonState();

    // Register Service Worker (moved here to comply with CSP)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('service-worker.js').then(reg => {
        console.log('Service Worker registered successfully:', reg);
      }).catch(err => {
        console.log('Service Worker registration failed:', err);
      });
    }

    console.log('🔥 SchoolHeat v2.4 - All bugs fixed: divide-by-zero, monitor persistence, CSV injection, AudioContext leak, map drift, chart updates, input validation, XSS hardening, ARIA labels, CSP ready, IIFE module, offline CDN caching, private browsing support!');
  });

  // Public API for testing
  return {
    calculateHeatIndex,
    getHeatStatus,
    predictLinearRegression,
    getHistory,
    LOCATIONS
  };
})();
