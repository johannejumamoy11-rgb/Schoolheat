# Manwal sa Operasyon sa App sa SchoolHeat

Kini nga manwal nagpasabot unsaon paggamit ang napatik nga SchoolHeat web app.
Gisulat kini alang sa mga magtutudlo, estudyante, ug mga kawani sa proyekto nga
nagtala sa mga pagbasa sa kainit, nag-sync sa sensor sa ESP32, ug nagdumala sa mga
alerto sa kainit. Wala kini naglangkob sa mga pagbag-o sa firmware o
administrasyon sa cloud.

## 1. Sa dili ka magsugod

- Ablihi ang napatik nga site sa SchoolHeat pinaagi sa **HTTPS**. Ang pag-sync sa
  Bluetooth, Firebase, push sa telepono, App Check, ug SMS nanginahanglan og
  luwas nga konteksto.
- Ablihi ang app online kausa sa matag device, dayon gamita ang opsyon sa browser
  nga **Install app (I-install ang app)** o **Add to Home Screen (Idugang sa Home
  Screen)**. Ang app shell gitipigan (cached) alang sa pagsugod offline.
- Ang mga pagbasa ug setting gitipigan sa **maong browser lamang**. Ang mga
  pagbag-o offline dili awtomatikong mag-sync taliwala sa mga device.
- Gikinahanglan ang internet alang sa **Firebase sync, push sa telepono, App
  Check, ug SMS**. Ang mga pagbasa sa sensor mahimong i-import pinaagi sa local
  bridge o Bluetooth samtang offline.
- Wala'y screen alang sa username/password sa app. Ang pag-sign in sa Firebase
  awtomatiko ug wala'y ngalan. Ang bugtong password nga nalangkit sa normal nga
  operasyon mao ang pribadong password sa Wi-Fi sa ESP32 nga gitakda sa firmware.

## 2. Paglibot sa app

Ang top bar nagpakita sa ngalan nga SchoolHeat, ang buhi nga petsa/orasan, usa ka
badge nga **AUTO** samtang nagdagan ang awtomatikong pagbasa pinaagi sa Wi-Fi, ug
usa ka chip sa kabag-ohan nga nagsugod sa **NO DATA** ug sa ulahi nagpakita sa
**RECENT** o **STALE**.

| Tab | Unsa ang gamit niini |
| --- | --- |
| **Overview (Kinatibuk-an)** | Pinakaulahing natipig nga pagbasa, giya sa kainit, dali nga mga link, ug mga preview sa status. |
| **Sensor Monitor (Monitor sa Sensor)** | Pagsulod sa mga pagbasa nga manual, pag-sync sa ESP32, ug pagsusi sa Sensor Trust. |
| **Campus Map (Mapa sa Campus)** | Tan-awa ang 29 ka naka-map nga pin sa campus ug i-tap ang usa ka pin aron makita ang status niini. |
| **History & Analytics (Kasaysayan ug Pagtuki)** | Pangita, i-filter, i-chart, i-export, ug tangtanga ang mga natipig nga pagbasa. |
| **Forecast (Tagna)** | Tagna sa 30 minutos kung adunay igo nga datos sa samang lokasyon. |
| **Settings (Mga Setting)** | Pinulongan, tema, pag-install, mga kontrol sa alerto, kalibrasyon, ug mga himan sa datos. |
| **Emergency Hotlines (Mga Hotline sa Emerhensya)** | Giya sa pagtawag sa emerhensya ug mga numero nga napamatud-an/naghulat og pagpamatuod. |
| **About (Mahitungod)** | Katuyoan, mga band sa DepEd 4H, daloy sa trabaho, FAQ, ug Ask SchoolHeat. |

Mga shortcut sa keyboard: pindota ang `1`–`8` aron mobalhin og tab, `N` aron
maablihan ang Monitor sa Sensor ug ma-focus ang field sa lokasyon, `C` aron
kuwentahon, ug `D` aron masugdan/mapahunong ang awtomatikong pagbasa.

## 3. Pagrekord sa pagbasa

### 3.1 Pagpili og lokasyon

1. Adto sa **Monitor sa Sensor**.
2. Sa **Lokasyon**, pagpili og site sa campus gikan sa lista. Ang lista naglakip
   sa 29 ka naka-map nga site ug **Einstein Classroom**, **Newton Classroom**, ug
   **Locke Classroom** ubos sa **Mga Classroom sa Pagtuon**.
3. Mahimo usab nimo i-tap ang usa sa mga chip nga **Katulahi:** alang sa imong
   katapusang limang lokasyon.

### 3.2 Pagsulod sa pagbasa nga manual

1. Isulod ang **Temperatura (°C)**, pananglitan `32.5`.
2. Isulod ang **Kabasa (%)**, pananglitan `75`.
3. Tan-awa ang **Preview sa Tinuod nga Oras** nga mag-update sa indeks sa kainit
   ug status.
4. I-click ang **Calculate & Save (Kuwentaha ug I-save)**.

Ang temperatura kinahanglan 0–60 ug ang kabasa 0–100. Kung kulang ang usa ka
field o wala sa sakup, magpakita ang app og mensahe sa pag-validate imbes nga
mo-save. Human sa malampuson nga pag-save, mag-refresh ang dashboard,
kasaysayan, mapa, ug gauge, ug usa ka toast ang magpamatuod sa resulta.

Ang mga band sa DepEd 4H nga gigamit sa app mao ang:

| Status | Indeks sa Kainit |
| --- | --- |
| **Hayo** | ubos sa 27 °C |
| **Hinay** | 27–32 °C |
| **Hinga** | 33–41 °C |
| **Hinto** | 42 °C o pataas |

### 3.3 Pagsabot sa kabag-ohan

Ang pinakaulahing natipig nga pagbasa gimarkahan og **RECENT** sulod sa hangtod
sa 15 ka minuto, dayon **STALE**. Ang kabag-ohan gibase sa timestamp sa pagbasa.
**Dili** kini pamatuod nga konektado o naka-calibrate ang usa ka sensor. Ang marka
nga **DEMO DATA** nagpasabot nga ang pagbasa gihimo sa app alang sa preview ug
wala iapil sa mga tagna.

## 4. Pag-sync sa mga pagbasa gikan sa ESP32

Ang ESP32 mokuha og sample matag limang minuto sukad sa pag-on, dili sukad sa
pag-sync sa orasan. Ang pag-sync sa orasan dili mag-reset niana nga agwat. Ang
matag board nagtipig sa mga pagbasa nga bulag base sa chip ID niini, busa
pagtakda og talagsaong `DEVICE_NAME` sa matag board.

### 4.1 Awtomatikong pagbasa pinaagi sa Wi-Fi (kinahanglan ang bridge)

1. I-on ang gi-assign nga ESP32 ug ipasulod ang laptop sa na-configure nga ngalan
   sa Wi-Fi niini. Normal lang ang pasidaan nga “No internet”.
2. Ipabilin ang `start-local-bridge.ps1` nga nagdagan sa bukas nga PowerShell
   window sa maong laptop. Ang bridge nag-bind sa localhost ug modawat lamang sa
   GitHub Pages origin niining proyekta.
3. Sa **Monitor sa Sensor**, pilia ang **Lokasyon** sa sensor.
4. I-click ang **Auto-Read ESP32 (Wi-Fi) (Awtomatikong Basaha ang ESP32
   (Wi-Fi))**. Ang buton mahimong **Stop ESP32 Auto-Read (Wi-Fi) (Hunonga ang
   Awtomatikong Pagbasa sa ESP32 (Wi-Fi))** ug ang header magpakita sa **AUTO**.
5. Ang app mag-poll sa bridge, magtakda sa orasan sa unang higayon, mangayo og
   usa ka diha-diha nga sample, ug mag-import og bag-ong natipig nga mga pagbasa
   matag 20 segundos.
6. I-click ang **Hunonga ang Awtomatikong Pagbasa sa ESP32 (Wi-Fi)** kung tapus
   na. Ang ESP32 magpadayon sa pag-log samtang naka-on.

### 4.2 Pag-sync pinaagi sa Bluetooth (walay bridge)

1. Gamita ang HTTPS app sa desktop Edge o Chrome nga adunay suporta sa Web
   Bluetooth.
2. Sa **Monitor sa Sensor**, pilia una ang **Lokasyon**.
3. I-click ang **Sync via Bluetooth (I-sync pinaagi sa Bluetooth)** ug pilia ang
   gi-assign nga ngalan sa device sa permission prompt sa browser.
4. Ipabilin ang laptop sa sulod sa Bluetooth range hangtod matapos ang pag-sync.
   Ang app magtakda sa orasan/lokasyon kung gikinahanglan ug mag-import sa mga
   natipig nga talaan, ug laktawan ang mga duplicate nga anaa na niining browser.
5. Ang Bluetooth sync nagbalhin lamang sa gitipigang datos; **dili** kini
   mag-trigger og bag-ong sample. Ang Bluetooth dili protektado og password,
   busa gamita kini sa kasaligang palibot lamang.

## 5. Mga alerto

Mga alerto lamang ang mahimo alang sa **bag-o o nausab nga lebel sa Hinga/Hinto**
gikan sa usa ka pagbasa nga bag-o pa, balido, ug dili demo. Ang pagbalik sa
samang lebel dili magpadala pag-usab. Ang lista sa kalihokan sa alerto nagtala sa
mga pagbasa sa risgo, **dili pamatuod sa paghatod**.

### 5.1 Mga abiso sa browser

1. Adto sa **Mga Setting** ug i-enable ang **Browser Notifications (Mga Abiso sa
   Browser)**.
2. Tugoti ang permission sa abiso kung mangutana ang browser.
3. Gamita ang **Test Browser Notification (Sulayi ang Abiso sa Browser)** aron
   kumpirmahon nga tomo kini.

### 5.2 Mga abiso sa telepono pinaagi sa push

1. I-enable ang **Phone Push Alerts (Mga Abiso sa Telepono pinaagi sa Push)** sa
   **Mga Setting** ug tugoti ang mga abiso.
2. I-enable kini sa laptop nga nagpadagan sa SchoolHeat ug sa matag telepono nga
   makadawat.
3. Gikinahanglan ang internet, HTTPS, ang service worker, Firebase Anonymous
   Auth/App Check, ug ang na-deploy nga Cloud Functions.
4. Gamita ang **Send Test Phone Push (Ipadala ang Test Push sa Telepono)** aron
   mapamatud-an ang paghatod. Ang push sa telepono wala mogamit og credit sa
   SMS, apan ang mga telepono nanginahanglan og internet. Ang server nagtugot og
   usa ka push request matag limang minuto sa tibuok proyekto.

### 5.3 Mga abiso sa SMS

1. Sa **Mga Setting → Alert Notifications (Mga Abiso sa Alerta)**, isulod ang
   1–5 ka numero sa mobile sa Pilipinas sa **SMS recipient numbers (Mga numero sa
   tigdawat sa SMS)**, bulagon og koma, semicolon, o bag-ong linya. Ang gidawat
   nga porma naglakip sa `09XXXXXXXXX` ug `+639XXXXXXXXX`.
2. Idugang lamang ang mga numero nga uyon ang tag-iya. Ang mga numero magpabilin
   niining browser.
3. I-enable ang **SMS Alerts (Mga Abiso sa SMS)**. Naka-off kini sa sinugdan.
4. Ang **Send Test SMS (may queue and use credits) (Ipadala ang Test SMS
   (mahimong mag-queue ug mogamit og credits))** nagpadala og:
   `SchoolHeat test alert: SMS setup is working.`
5. Ang matag pagsulay una nga isulat sa local queue, dayon ipadala pinaagi sa
   na-configure nga SMS Worker gamit ang Firebase ug App Check tokens. Ang Worker
   nagtugot og **usa ka SMS request matag limang minuto kada account, apil ang
   mga test message**.
6. Kung offline ang device, ang mensaje magpabilin sa queue. Ang app mag-retry sa
   pagbalik sa koneksyon ug human sa mga retry delay. Ang queue makakupot hangtod
   sa **20** ka mensaje.
7. Ang **Retry Queued SMS (I-retry ang Naka-queue nga SMS)** magpadayon sa mga
   naka-queue nga mensaje. Ang **Cancel Queued SMS (Ikansela ang Naka-queue nga
   SMS)** magtangtang niini apan magpabilin ang mga tigdawat ug setting. Ang send
   nga anaa na sa proseso dili makansela.
8. Ang SMS nanginahanglan og aktibong provider, credit, ug aprobadong sender nga
   gitakda sa administrator. Kung dili klaro ang resulta sa pagpadala, susiha ang
   message log sa provider sa dili pa mosulay pag-usab; ang app dili awtomatikong
   magpadala pag-usab sa dili klarong kapakyasan.

Gamita ang test SMS lamang kung nag-verify og bag-ong setup. Giihap kini sa
limitasyon sa limang minuto ug mahimong mogamit og usa ka credit.

## 6. Kasaysayan, tagna, ug mapa

### Kasaysayan ug Pagtuki

- Pangita pinaagi sa lokasyon o status ug i-filter pinaagi sa **Tanang Status /
  Hayo / Hinay / Hinga / Hinto**.
- Ang **Trend sa Indeks sa Kainit** nagsuporta sa pag-tap, pag-drag, ug arrow
  keys. Ang **Show Status Summary (Ipakita ang Sumaryo sa Status)** naghatag og
  breakdown.
- Ang **All Readings (Tanang Pagbasa)** nagpakita og 50 kada panid. Gamita ang
  trash button aron tangtangon ang usa ka pagbasa niining browser; dili kini
  ma-undo ug mausab ang input sa tagna.
- Ang **Export CSV (I-export ang CSV)** naglakip og kolumn nga **Demo Data (Data
  sa Demo)**. Ang **Export JSON (I-export ang JSON)** nagtipig og
  `schoolheat_readings.json`.

### Tagna

Ang **30-Minute Forecast (Tagna sa 30 Minutos)** nanginahanglan og labing menos
12 ka kompleto, dili-demo, samang-lokasyon nga mga panig-ingnan (mga duha ka oras
nga pagbasa matag limang minuto). Ang pagtandi sa modelo nanginahanglan og
labing menos 10 ka holdout. Wala iapil ang mga demo reading, ug ang mga badge sa
katukma magpabilin hangtod adunay igo nga na-validate nga mga panig-ingnan.

### Mapa sa Campus

Ang mapa nagpakita og 29 ka naka-fix nga pin sa campus uban ang mga kontrol sa
zoom nga **-**, **+**, ug **Reset (I-reset)**. I-tap ang usa ka pin aron makita
ang status niini. Ang figure sa coverage sa naka-map nga pin nag-ihap sa mga
natipig nga ngalan sa lokasyon nga motakdo sa mga pin; mahimong maglakip kini og
demo o STALE nga datos ug dili kini sukod sa pagsakop sa sensor sa tinuod nga
oras.

## 7. Mga setting ug gusto

- **Install & Offline Use (Pag-install ug Paggamit offline)**: nagpakita sa
  install status ug sa buton nga **Install SchoolHeat (I-install ang
  SchoolHeat)**.
- **Color System (Sistema sa Kolor)**: pagpili og palette, swatch, estilo sa
  harmony, o bug-os nga color picker. Ang **Reset to SchoolHeat (Ibalik sa
  SchoolHeat)** magpasig-uli sa mga default. Ang mga kolor sa risgo sa kainit
  dili gayod mausab.
- **App language (Pinulongan sa App)**: English, Tagalog, Bisaya, o Waray. Ang
  navigation, kasagarang mga label, pipila ka giya sa kaluwasan, ug ang
  Mahitungod gihubad. Ang mga ngalan sa sensor/lokasyon ug pipila ka teknikal nga
  mensaje magpabilin sa English. Ang mga label sa risgo magpabilin nga
  Hayo/Hinay/Hinga/Hinto.
- **Sensor Calibration (Kalibrasyon sa Sensor)**: ang **Temperature Offset
  (Offset sa Temperatura)** ug **Humidity Offset (Offset sa Kabasa)** mag-adjust
  sa umaabot nga mga kalkulasyon.
- **Demo Mode / Generate Demo Data (Mode sa Demo / Paghimo og Data sa Demo)**:
  nagmugna og sample readings alang sa preview. Ang mga demo reading wala iapil
  sa mga tagna.
- **Clear All Data (Tangtanga ang Tanang Data)**: nagtangtang sa tanang pagbasa
  niining browser. Dili kini ma-undo.
- **Firebase Sync**, **Outlier Detection (Pagtuki sa Outlier)**, **Spike Detection
  (Pagtuki sa Spike)**: kini nga mga toggle gitipigan isip gusto; wala kini
  magbag-o sa kasamtangang pamatasan sa alerto.

## 8. Mga hotline ug Mahitungod

**Mga Hotline sa Emerhensya** nagpakita sa **911 / TAP TO CALL** ug mga prompt sa
pag-andam sa tawag: **Asa ka?**, **Unsa ang nahitabo?**, **Magpabilin ka nga
maabot.** Ang mga numero sa Mahaplag gimarkahan og *Naghulat og pagpamatuod sa
eskwelahan*. Kini nga panid dili serbisyo sa pag-dispatch sa emerhensya o
medikal, ug ang mga alerto sa SMS dili makontak sa mga responder.

**Mahitungod** nagpasabot sa katuyoan, mga band sa DepEd 4H, daloy sa trabaho, ug
mga limitasyon sa datos. Ang **Ask SchoolHeat** mitubag og fixed set sa mga
pangutana lokal gikan sa natipig nga dili-demo nga mga talaan ug dokumentadong
pamatasan. Wala kini magpadala og mga pangutana o pagbasa ngadto sa AI service.

## 9. Importante nga mga limitasyon ug nota sa kaluwasan

- Ang mga pagbasa sa ESP32 lokal lamang sa browser nga nag-import niini.
- Ang label nga **RECENT** dili pamatuod sa koneksyon o kalibrasyon.
- Mga alerto maoy tambag. Sunda ang polisiya sa eskwelahan ug lokal nga mga
  advisories.
- Ang ESP32 walay real-time clock. Ang reboot nga walay konektadong app mahimong
  makamugna og mga talaan nga walay timestamp.
- Ang flash log sa ESP32 mag-rotate sa pinakadaan nga mga talaan kung puno na.
- Ang offline mode wala maghatag og mga serbisyo sa internet.
- Ang pagtangtang sa site data nagtangtang sa naka-queue nga SMS ug lokal nga mga
  pagbasa.
- Ayaw usba ang napatik nga firmware isip bahin sa normal nga operasyon sa app.

## 10. Pag-troubleshoot

| Sintomas | Unsa ang susihon |
| --- | --- |
| Walay pagbasa human sa awtomatikong pagbasa | ESP32 naka-on, husto ang Wi-Fi, nagdagan ang bridge, napili ang lokasyon, ug gitugotan sa bridge ang browser origin. |
| Ang pinakaulahing pagbasa nagpakita og **STALE** | Ang timestamp mas daan na sa 15 ka minuto. I-sync pag-usab o isulod ang bag-ong pagbasa. |
| Tagna dili magamit | Kinahanglan labing menos 12 ka kompleto, dili-demo, samang-lokasyon nga pagbasa ug igo nga holdout. |
| SMS dili moabot | Naka-enable ang Mga Abiso sa SMS, balido ang tigdawat, adunay internet, aktibo ang credit ug aprobadong sender sa provider, ug wala ma-cancel ang queue. |
| Test SMS gi-rate-limit | Usa lang ka SMS request matag limang minuto kada account; hulata ug i-retry nga manual. |
| Push sa telepono dili moabot | Naka-enable ang push sa nagpadala ug tigdawat, gitugotan ang notification permission, adunay internet, ug na-deploy ang Cloud Functions. |
| Ang pin sa mapa walay natipig nga pagbasa | Wala pay natipig nga pagbasa nga motakdo sa maong naka-map nga ngalan sa lokasyon. |
| App moabli apan mga serbisyo mapakyas | Kumpirma nga ang HTTPS site giablihan online kausa ug balido ang configuration sa App Check/Firebase. |
