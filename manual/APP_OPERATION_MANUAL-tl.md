# Manwal sa Pagpapatakbo ng SchoolHeat App

Ipinaliwanag sa manwal na ito kung paano gamitin ang nai-publish na SchoolHeat web app. Isinulat ito para sa mga guro, mag-aaral, at kawani ng proyekto na nagtatala ng mga pagbasa ng init, nagsi-sync ng ESP32 sensor, at namamahala ng mga alerto sa init. Hindi saklaw ng manwal na ito ang mga pagbabago sa firmware o ang pangangasiwa ng cloud.

## 1. Bago ka magsimula

- Buksan ang nai-publish na **HTTPS** na site ng SchoolHeat. Ang Bluetooth sync, Firebase, phone push, App Check, at SMS ay nangangailangan ng ligtas na konteksto (secure context).
- Buksan ang app nang online nang isang beses sa bawat device, pagkatapos gamitin ang opsyong **Install app (I-install ang app)** o **Add to Home Screen (Idagdag sa Home Screen)** ng browser. Naka-cache ang app shell para sa offline na pagbukas.
- Ang mga pagbasa at setting ay naitatago **sa browser na iyon lamang**. Ang mga pagbabagong offline ay hindi awtomatikong nag-si-sync sa pagitan ng mga device.
- Kailangan ang internet para sa **Firebase sync, phone push, App Check, at SMS**. Maaaring i-import ang mga pagbasa ng sensor gamit ang lokal na bridge o Bluetooth habang offline.
- Walang screen para sa username/password sa app. Awtomatiko at anonymous ang pag-sign-in sa Firebase. Ang tanging password na kasangkot sa normal na operasyon ay ang pribadong password ng Wi-Fi ng ESP32 na naka-configure sa firmware.

## 2. Paglibot sa App

Ipinapakita ng top bar ang pangalang SchoolHeat, ang kasalukuyang petsa/orasan, isang badge na **AUTO** habang tumatakbo ang Wi-Fi auto-read, at isang chip para sa freshness na nagsisimula sa **NO DATA** at kalaunan ay nagpapakita ng **RECENT** o **STALE**.

| Tab | Gamit |
| --- | --- |
| **Overview (Pangkalahatang-ideya)** | Pinakabagong naka-save na pagbasa, gabay sa init, mabilis na link, at mga preview ng status. |
| **Sensor Monitor (Monitor ng Sensor)** | Maglagay ng pagbasa nang manual, i-sync ang ESP32, at suriin ang Sensor Trust. |
| **Campus Map (Mapa ng Kampus)** | Tingnan ang 29 na naka-map na pin ng kampus at i-tap ang isang pin para sa status nito. |
| **History & Analytics (Kasaysayan at Analytics)** | Hanapin, i-filter, gumawa ng tsart, i-export, at burahin ang mga naka-save na pagbasa. |
| **Forecast (Pagtataya)** | 60-minutong outlook na ginawa ng nakaiskedyul na Python job at nai-publish bilang `forecast.json`. |
| **Settings (Mga Setting)** | Wika, tema, pag-install, mga kontrol sa alerto, calibration, at mga kagamitan para sa datos. |
| **Emergency Hotlines (Mga Emergency Hotline)** | Gabay sa emergency call at mga numero na nabe-verify o naghihintay ng verification. |
| **About (Tungkol)** | Layunin, mga DepEd 4H band, daloy ng trabaho, FAQ, at Ask SchoolHeat. |

Mga keyboard shortcut: pindutin ang `1`–`8` para lumipat ng tab, ang `N` para buksan ang Monitor ng Sensor at i-focus ang field na lokasyon, ang `C` para magkalkula, at ang `D` para simulan/ihinto ang auto-read. Pindutin ang `Enter` sa field ng temperatura o halumigmig upang i-save ang pagbasa.

## 3. Pag-record ng pagbasa

### 3.1 Pumili ng lokasyon

1. Pumunta sa **Monitor ng Sensor**.
2. I-click ang **Pumili sa mapa**. Buksan ng app ang mapa ng kampus; i-tap ang isang pin upang itakda ang lokasyon ng sensor at bumalik dito. Lahat ng 29 na naka-map na site ay may pin.
3. Para sa **Einstein Classroom**, **Newton Classroom**, at **Locke Classroom**, gamitin ang listahang **Location (Lokasyon)** sa ilalim ng **Study classrooms (Mga Silid-aralan para sa Pag-aaral)**. Maaari ring i-tap ang isa sa mga chip na **Recent: (Kamakailan:)** para sa huling limang lokasyon mo.

### 3.2 Maglagay ng pagbasa nang manual

1. Ipasok ang **Temperature (°C) (Temperatura (°C))**, halimbawa `32.5`.
2. Ipasok ang **Humidity (%) (Halumigmig (%))**, halimbawa `75`.
3. Panoorin ang **Live Preview (Live na Preview)** na mag-update ng heat index at status.
4. I-click ang **Calculate & Save (Kalkulahin at I-save)**.

Ang temperatura ay dapat nasa 0–60 at ang halumigmig ay 0–100. Kung may nawawalang field o wala sa saklaw, nagpapakita ang app ng validation message sa halip na mag-save. Matapos ang matagumpay na pag-save, nagre-refresh ang dashboard, kasaysayan, mapa, at gauge, at may toast na nagpapatunay sa resulta.

Ang mga DepEd 4H band na ginagamit ng app ay:

| Status | Heat index |
| --- | --- |
| **Hayo** | mas mababa sa 27 °C |
| **Hinay** | 27–32 °C |
| **Hinga** | 33–41 °C |
| **Hinto** | 42 °C o mas mataas |

### 3.3 Unawain ang freshness

Ang pinakabagong naka-save na pagbasa ay minamarkahang **RECENT** sa loob ng hanggang 15 minuto, pagkatapos ay **STALE**. Batay sa timestamp ng pagbasa ang freshness. Hindi nito **pinatutunayan** na nakakonekta o na-calibrate ang isang sensor. Ang marker na **DEMO DATA** ay nangangahulugang ang pagbasa ay ginenerate ng app para sa preview at hindi kasama sa mga forecast.

## 4. I-sync ang mga pagbasa mula sa ESP32

Kumukuha ng sample ang ESP32 tuwing limang minuto mula sa pag-on ng kuryente, hindi mula sa clock sync. Ang pag-sync ng orasan ay hindi nagre-reset ng agwat na iyon. Pinapanatiling hiwalay ng bawat board ang mga pagbasa ayon sa chip ID nito, kaya magtakda ng natatanging `DEVICE_NAME` sa bawat board.

### 4.1 Awtomatikong pagbasa sa Wi-Fi (kailangan ang bridge)

1. I-on ang itinalagang ESP32 at ikonekta ang laptop sa naka-configure nitong pangalan ng Wi-Fi. Inaasahan ang babalang “No internet”.
2. Panatilihing tumatakbo ang `start-local-bridge.ps1` sa isang bukas na PowerShell window sa laptop na iyon. Nakatali ang bridge sa localhost at tinatanggap lamang ang GitHub Pages origin ng proyektong ito.
3. Sa **Monitor ng Sensor**, pumili ng lokasyon ng sensor sa mapa o sa listahang **Lokasyon**.
4. I-click ang **Auto-Read ESP32 (Wi-Fi) (Awtomatikong Pagbasa sa ESP32 sa Wi-Fi)**. Nagiging **Stop ESP32 Auto-Read (Wi-Fi) (Ihinto ang Awtomatikong Pagbasa sa ESP32 sa Wi-Fi)** ang button at ipinapakita ng header ang **AUTO**.
5. Ine-poll ng app ang bridge, itinatakda ang orasan sa unang pagtakbo, humihingi ng isang agarang sample, at nag-i-import ng mga bagong naka-save na pagbasa tuwing 20 segundo.
6. I-click ang **Ihinto ang Awtomatikong Pagbasa sa ESP32 sa Wi-Fi** kapag tapos na. Patuloy pa ring nagtatala ang ESP32 habang naka-on.

### 4.2 Bluetooth sync (walang bridge)

1. Gamitin ang HTTPS app sa desktop Edge o Chrome na may suporta sa Web Bluetooth.
2. Sa **Monitor ng Sensor**, pumili muna ng lokasyon sa mapa o sa listahang **Lokasyon**.
3. I-click ang **Sync via Bluetooth (I-sync gamit ang Bluetooth)** at piliin ang itinalagang pangalan ng device sa permission prompt ng browser.
4. Panatilihin ang laptop sa loob ng Bluetooth range hanggang matapos ang sync. Itinatakda ng app ang orasan/lokasyon kung kinakailangan at nag-i-import ng mga naka-save na tala, nilalaktawan ang mga duplicate na nasa browser na ito.
5. Ang Bluetooth sync ay naglilipat lamang ng naka-imbak na data; hindi nito **pinapalitaw** ang bagong sample. Hindi protektado ng password ang Bluetooth, kaya gamitin ito sa pinagkatiwalaang kapaligiran lamang.

## 5. Mga Alerto

Ang mga alerto ay nabubuo lamang para sa **bago o binagong antas na Hinga/Hinto** mula sa kamakailan, wasto, at hindi-demo na pagbasa. Ang pag-ulit ng parehong antas ay hindi muling nagpapadala. Itinatala ng alert activity list ang mga pagbasang may panganib, **hindi patunay ng paghahatid**.

### 5.1 Mga abiso sa browser

1. Pumunta sa **Mga Setting** at i-enable ang **Browser Notifications (Mga Abiso sa Browser)**.
2. Payagan ang notification permission kapag hiniling ito ng browser.
3. Gamitin ang **Test Browser Notification (Subukan ang Abiso sa Browser)** para kumpirmahing gumagana ito.

### 5.2 Mga alerto sa phone push

1. I-enable ang **Phone Push Alerts (Mga Alerto sa Phone Push)** sa **Mga Setting** at payagan ang mga notification.
2. I-enable ito sa laptop na nagpapatakbo ng SchoolHeat at sa bawat tumatanggap na telepono.
3. Kailangan ang internet, HTTPS, ang service worker, Firebase Anonymous Auth/App Check, at ang na-deploy na Cloud Functions.
4. Gamitin ang **Send Test Phone Push (Magpadala ng Test Phone Push)** para beripikahin ang paghahatid. Hindi gumagamit ng SMS credits ang phone push, ngunit kailangan ng internet ang mga telepono. Pinapayagan ng server ang isang push request tuwing limang minuto sa buong proyekto.

### 5.3 Mga alerto sa SMS

1. Sa **Mga Setting → Alert Notifications (Mga Abiso sa Alerto)**, maglagay ng 1–5 Pilipinong mobile number sa **SMS recipient numbers (Mga numero ng tatanggap ng SMS)**, na pinaghihiwalay ng kuwit, semicolon, o bagong linya. Kabilang sa tinatanggap na anyo ang `09XXXXXXXXX` at `+639XXXXXXXXX`.
2. Magdagdag lamang ng mga numero na may pahintulot ang mga may-ari. Nananatili ang mga numero sa browser na ito.
3. I-enable ang **SMS Alerts (Mga Alerto sa SMS)**. Naka-off ito bilang default.
4. Ang **Send Test SMS (may queue and use credits) (Magpadala ng Test SMS; maaaring ma-queue at gumamit ng credits)** ay nagpapadala ng: `SchoolHeat test alert: SMS setup is working.`
5. Unang isinusulat sa lokal na queue ang bawat pagtatangka, pagkatapos ay ipinapadala sa pamamagitan ng naka-configure na SMS Worker gamit ang Firebase at App Check tokens. Pinapayagan ng Worker ang **isang SMS request tuwing limang minuto bawat account, kasama na ang test messages**.
6. Kung offline ang device, nananatiling naka-queue ang mensahe. Muling sinusubukan ng app kapag muling nakonekta at pagkatapos ng retry delays. Ang queue ay may hawak na hanggang **20** mensahe.
7. Ang **Retry Queued SMS (Ipagpatuloy ang Queued SMS)** ay nagpapatuloy sa mga naka-queue na mensahe. Ang **Cancel Queued SMS (Kanselahin ang Queued SMS)** ay nagbubura sa mga ito ngunit pinapanatili ang mga tatanggap at setting. Ang isang send na kasalukuyang isinasagawa ay hindi maaaring kanselahin.
8. Nangangailangan ang SMS ng aktibong provider, credits, at naaprubahang sender na itinakda ng administrator. Kung malabo ang resulta ng pagpapadala, suriin muna ang message log ng provider bago muling subukan; hindi awtomatikong muling ipinapadala ng app ang malabong pagkabigo.

Gamitin ang test SMS kapag beripikasyon lamang ng bagong setup. Nabibilang ito sa limang-minutong limitasyon at maaaring gumamit ng isang credit.

## 6. Kasaysayan, Pagtataya, at Mapa

### Kasaysayan at Analytics

- Hanapin ayon sa lokasyon o status at i-filter gamit ang **All Status / Hayo / Hinay / Hinga / Hinto (Lahat ng Status / Hayo / Hinay / Hinga / Hinto)**.
- Sinusuportahan ng **Heat Index Trend (Trend ng Heat Index)** ang tap, drag, at arrow keys. Nagbibigay ng breakdown ang **Show Status Summary (Ipakita ang Buod ng Status)**.
- Ang **All Readings (Lahat ng Pagbasa)** ay nagpapakita ng 50 bawat pahina. Gamitin ang trash button para tanggalin ang isang pagbasa mula sa browser na ito; hindi ito maaaring i-undo. Ang nai-publish na Python forecast ay gumagamit ng hiwalay na CSV dataset at hindi nagbabago.
- Ang **Choose data file (Pumili ng data file)** ay nag-i-import ng CSV o XLSX sa browser na ito lamang. Hindi nito ipinapadala ang readings sa Firebase at hindi nito binabago ang live forecast.
- Ang **Upload CSV to live forecast (I-upload ang CSV sa live forecast)** ay pumapalit sa nai-publish na source data at nagsisimula ng Python job. Ilagay ang forecast access code, pumili ng six-column CSV o SchoolHeat averages CSV, at hintayin ang job. Kailangan ang Firebase sign-in, App Check, at isang upload bawat account bawat limang minuto. Ang GitHub token ay nasa upload Worker lamang.
- Kasama sa **Export CSV (I-export ang CSV)** ang isang column na **Demo Data (Data mula sa Demo)**. Ini-save ng **Export JSON (I-export ang JSON)** ang `schoolheat_readings.json`.

### Pagtataya

Ang **60-Minute Forecast (60-Minolutong Pagtataya)** ay ginawa ng nakaiskedyul na Python job mula sa `data/schoolheat_readings.csv`, hindi mula sa mga naka-save na pagbasa sa browser na ito. Ihinahambing nito ang Random Forest, XGBoost, at LightGBM sa hindi magkakapatong na 60-minutong holdout at pinipili ang pinakamababang pinagsamang ranggo ng RMSE at MAPE. Ipinapakita ng panel ng paghahambing ang RMSE at MAPE. Hangga't hindi naipapublish ang `forecast.json`, sasabihin ng app na hindi pa generated ang forecast. Hindi pinatutunayan ng forecast ang calibration ng sensor.

### Mapa ng Kampus

Ipinapakita ng mapa ang 29 na nakapirming pin ng kampus na may mga kontrol sa zoom na **-**, **+**, at **Reset (I-reset)**. I-tap ang isang pin para makita ang status nito. Binibilang ng mapped-pin coverage figure ang mga naka-save na pangalan ng lokasyon na tumutugma sa mga pin; maaaring may kasama itong demo o stale na data at hindi ito sukatan ng live na saklaw ng sensor.

## 7. Mga Setting at Kagustuhan

- **Install & Offline Use (Pag-install at Paggamit nang Offline)**: ipinapakita ang install status at ang button na **Install SchoolHeat (I-install ang SchoolHeat)**.
- **Color System (Sistema ng Kulay)**: pumili ng palette, swatch, harmony style, o buong color picker. Ibinabalik ng **Reset to SchoolHeat (Ibalik sa SchoolHeat)** ang mga default. Hindi nagbabago ang mga kulay para sa panganib ng init.
- **Text size (Laki ng teksto)**: i-drag ang slider o ilagay ang anumang halaga mula 50% hanggang 250%. Naitatagong kagustuhan ito sa browser na ito at ginagamit din kapag binuksan ang manwal.
- **App language (Wika ng App)**: English, Tagalog, Bisaya, o Waray. Naisasalin ang navigation, mga karaniwang label, ilang gabay sa kaligtasan, at Tungkol. Nananatiling nasa English ang mga pangalan ng sensor/lokasyon at ilang technical message. Nananatiling Hayo/Hinay/Hinga/Hinto ang mga risk label.
- **Sensor Calibration (Calibration ng Sensor)**: inaayos ng **Temperature Offset (Offset ng Temperatura)** at **Humidity Offset (Offset ng Halumigmig)** ang mga susunod na kalkulasyon.
- **Demo Mode / Generate Demo Data (Demo Mode / Bumuo ng Demo Data)**: gumagawa ng mga sample reading para sa preview. Hindi kasama sa forecast ang mga demo reading.
- **Clear All Data (Burahin Lahat ng Data)**: binubura ang lahat ng pagbasa sa browser na ito. Hindi ito maaaring i-undo.
- **Firebase Sync, Outlier Detection, Spike Detection (Firebase Sync, Pagtukoy ng Outlier, Pagtukoy ng Spike)**: ang mga toggle na ito ay naitatagong kagustuhan; hindi nila binabago ang kasalukuyang pag-uugali ng alerto.

## 8. Mga Hotline at Tungkol

Ang **Mga Emergency Hotline** ay nagpapakita ng **911 / TAP TO CALL** at mga
paalala bago tumawag: **Nasaan ka?**, **Ano ang nangyari?**, **Manatiling
handa.** Maaari ka ring magdagdag ng lokal na kontakt sa pamamagitan ng
pag-save ng tungkulin at numero lamang. Nananatili ang mga ito sa browser na
ito, maaaring i-edit o burahin, at binubuksan ng pindutang **Tumawag** ang
dialer ng device. Hindi pinapatunayan ng SchoolHeat ang mga kontakt na ito,
hindi nito sine-sync, at hindi nito pinapadalhan ng alerto; walang
naka-hardcode na numero sa Mahaplag. Hindi ito serbisyo para sa emergency
dispatch o medikal, at hindi kinokontak ng mga alerto sa SMS ang mga responder.

Ang **Tungkol** ay nagpapaliwanag ng layunin, mga DepEd 4H band, daloy ng trabaho, at mga limitasyon ng data. Sumasagot ang **Ask SchoolHeat** sa isang nakapirming hanay ng mga tanong nang lokal mula sa mga naka-save na hindi-demo na tala at sa dokumentadong pag-uugali. Hindi nito ipinapadala ang mga tanong o pagbasa sa isang AI service.

## 9. Mahahalagang Limitasyon at Paalala sa Kaligtasan

- Ang mga pagbasa ng ESP32 ay lokal sa browser na nag-i-import sa mga ito.
- Ang label na **RECENT** ay hindi patunay ng koneksyon o calibration.
- Ang mga alerto ay payo lamang. Sundin ang patakaran ng paaralan at mga lokal na abiso.
- Walang real-time clock ang ESP32. Ang pag-reboot nang walang konektadong app ay maaaring makagawa ng mga talang walang timestamp.
- Pinapalitan ng ESP32 flash log ang pinakalumang tala kapag puno na ang imbakan.
- Hindi nagbibigay ng internet services ang offline mode.
- Ang pag-clear sa site data ay nagbubura ng queued SMS at mga lokal na pagbasa.
- Huwag baguhin ang nai-publish na firmware bilang bahagi ng normal na operasyon ng app.

## 10. Pag-troubleshoot

| Sintomas | Dapat suriin |
| --- | --- |
| Walang pagbasa pagkatapos ng auto-read | ESP32 na naka-on, tamang Wi-Fi, tumatakbong bridge, napiling lokasyon, at pinapayagan ng bridge ang browser origin. |
| Pinakabagong pagbasa ay nagpapakitang **STALE** | Mas luma na sa 15 minuto ang timestamp. Muling mag-sync o maglagay ng bagong pagbasa. |
| Hindi available ang forecast | Tingnan kung nai-publish ang `forecast.json` at natapos na ang nakaiskedyul na Python job. |
| Hindi dumadating ang SMS | Naka-enable ang Mga Alerto sa SMS, wasto ang tatanggap, may internet, aktibo ang credits at naaprubahang sender ng provider, at hindi nakansela ang queue. |
| Na-rate-limit ang test SMS | Isang SMS request lamang tuwing limang minuto bawat account; maghintay at muling subukan nang manual. |
| Hindi dumadating ang phone push | Naka-enable ang push sa nagpapadala at tumatanggap, naibigay ang notification permission, may internet, at na-deploy ang Cloud Functions. |
| Walang naka-save na pagbasa ang pin sa mapa | Wala pang naka-save na pagbasa na tumutugma sa pangalan ng naka-map na lokasyong iyon. |
| Bumubukas ang app ngunit nabibigo ang mga serbisyo | Kumpirmahing binuksan nang online ang HTTPS site nang isang beses at wasto ang configuration ng App Check/Firebase. |
