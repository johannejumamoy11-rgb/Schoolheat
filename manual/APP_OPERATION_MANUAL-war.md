# Manwal han Operasyon han App han SchoolHeat

Ini nga manwal nagpapahayag kon paano gamiton an naka-publish nga web app han SchoolHeat. Ginsurat ini para han mga maestro, mga estudyante, ngan mga staff han proyekto nga nag-rekord han mga pagbasa han kainit, nag-sync han sensor nga ESP32, ngan nagdumara han mga alerto han kainit. Diri ini naglalakip han mga pagbag-o han firmware o han administrasyon han cloud.

## 1. Antes ka magtikang

- Abliha an naka-publish nga **HTTPS** nga site han SchoolHeat. An Bluetooth sync, Firebase, phone push, App Check, ngan SMS nangangahulagan hin secure context.
- Abliha an app online hin makausa ha kada device, tapos gamita an **Install app** o **Add to Home Screen** nga opsyon han browser. An app shell naka-cache para makapagtikang kon offline.
- An mga pagbasa ngan settings natitipig **ha nasabi la nga browser**. An mga pagbag-o kon offline diri awtomatiko nga nag-sync ha butnga han mga device.
- Kinahanglan an internet para han **Firebase sync, phone push, App Check, ngan SMS**. An mga pagbasa han sensor pwede i-import pinaagi han local bridge o Bluetooth samtang offline.
- Waray screen para han username/password ha app. An Firebase sign-in awtomatiko ngan anonymous. An la nga password nga nasalakip ha normal nga operasyon amo an pribado nga password han Wi-Fi han ESP32 nga gin-configure ha firmware.

## 2. Paglibot ha app

An bar ha ibabaw nagpapakita han ngaran han SchoolHeat, han buhi nga petsa/orasan, hin **AUTO** nga badge samtang nagdadalagan an Wi-Fi auto-read, ngan hin chip han kabag-o nga nagtitikang ha **NO DATA** ngan ha urhi nagpapakita hin **RECENT** o **STALE**.

| Tab | Para ha ano ini |
| --- | --- |
| **Overview (Paglantaw ha Kinatibuk-an)** | Pinakabag-o nga natipig nga pagbasa, giya han kainit, mga sumpay, ngan mga preview han status. |
| **Sensor Monitor (Monitor han Sensor)** | Igsulod an mga pagbasa ha kamot, i-sync an ESP32, ngan kinita an Sensor Trust. |
| **Campus Map (Mapa han Campus)** | Kitaa an 29 nga naka-map nga campus pin ngan pindota an pin para makita an status hini. |
| **History & Analytics (Kasaysayan ngan Analytics)** | Mangita, mag-filter, mag-chart, mag-export, ngan magdelado hin mga natipig nga pagbasa. |
| **Forecast (Tagna)** | Paglantaw ha 30 minutos kon may-ada igo nga datos ha pareho nga lokasyon. |
| **Settings (Mga Setting)** | Pinulongan, tema, pag-install, mga kontrol han alerto, calibration, ngan mga kagamitan para han datos. |
| **Emergency Hotlines (Mga Hotline han Emerhensya)** | Mga giya para ha emergency call ngan mga numero nga nakumpirma o naghihulat hin pagkumpirma. |
| **About (Mahitungod)** | Katuyoan, mga banda han DepEd 4H, dalagan han trabaho, FAQ, ngan **Ask SchoolHeat (Pangutana ha SchoolHeat)**. |

Keyboard shortcuts: pindota an `1`–`8` para magbalhin hin tab, an `N` para maablihan an Monitor ngan ma-focus an field han lokasyon, an `C` para magkwenta, ngan an `D` para magtikang/hunongon an auto-read.

## 3. Pagrekord hin pagbasa

### 3.1 Pili-a an lokasyon

1. Adto ha **Monitor han Sensor**.
2. Ha **Location (Lokasyon)**, pumili hin lugar ha campus tikang ha lista. An lista may-ada 29 nga naka-map nga lugar pati an **Einstein Classroom**, **Newton Classroom**, ngan **Locke Classroom** ha ilarom han **Study classrooms (Mga Classroom ha Pagar-adal)**.
3. Pwede ka liwat mopindota hin usa han mga chip nga **Recent: (Ha Urhi:)** para han imo katapusan nga lima nga lokasyon.

### 3.2 Igsulod an pagbasa ha kamot

1. Igsulod an **Temperature (°C) (Temperatura (°C))**, pananglitan `32.5`.
2. Igsulod an **Humidity (%) (Kahumidad (%))**, pananglitan `75`.
3. Kitaa an **Live Preview (Buhi nga Preview)** kon na-update an index han kainit ngan status.
4. Pindota an **Calculate & Save (Kwentaha ngan Tipigi)**.

An temperatura kinahanglan 0–60 ngan an kahumidad 0–100. Kon may kulang nga field o labaw ha sakop, an app nagpapakita hin mensahe hin validasyon imbes nga magtipig. Katapos han malampuson nga pagtipig, an dashboard han Paglantaw ha Kinatibuk-an, an kasaysayan, an mapa, ngan an gauge magre-refresh ngan may toast nga nagkumpirma han resulta.

An mga banda han DepEd 4H nga ginagamit han app amo an:

| Status | Heat index (Index han Kainit) |
| --- | --- |
| **Hayo** | ubos han 27 °C |
| **Hinay** | 27–32 °C |
| **Hinga** | 33–41 °C |
| **Hinto** | 42 °C o labaw pa |

### 3.3 Pagsabot han kabag-o

An katapusan nga natipig nga pagbasa gimarkahan hin **RECENT** ha sulod hin 15 minutos, tapos **STALE**. An kabag-o basado ha timestamp han pagbasa. Diri ini **nga** nagpapatunay nga konektado o naka-calibrate an sensor. An marka nga **DEMO DATA** nangangahulogan nga an pagbasa gin-generate han app para hin preview ngan gin-i-exclude ha mga tagna.

## 4. Pag-sync han mga pagbasa tikang ha ESP32

An ESP32 nakuha hin sample kada lima ka minuto tikang ha pag-on, diri tikang ha pag-sync han orasan. An pag-sync han orasan diri nagre-reset han mao nga agwat. Kada board natipig hin mga pagbasa nga bulag-base ha chip ID niini, salit pag-set hin unique nga `DEVICE_NAME` ha kada board.

### 4.1 Wi-Fi auto-read (kinahanglan an bridge)

1. I-on an natalaga nga ESP32 ngan paapila an laptop ha naka-configure nga ngaran han Wi-Fi niini. Normal la an pahibalo nga “No internet”.
2. Padayon nga ipadalagan an `start-local-bridge.ps1` ha bukas nga PowerShell window ha mao nga laptop. An bridge nagbi-bind ha localhost ngan tinatanggap la an GitHub Pages origin han mao nga proyekto.
3. Ha **Monitor han Sensor**, pilia an **Lokasyon** han sensor.
4. Pindota an **Auto-Read ESP32 (Wi-Fi) (Awtomatiko nga Pagbasa han ESP32 pinaagi han Wi-Fi)**. Nababag-o an buton ngadto ha **Stop ESP32 Auto-Read (Wi-Fi) (Hunonga an Awtomatiko nga Pagbasa han ESP32 pinaagi han Wi-Fi)** ngan an header nagpapakita hin **AUTO**.
5. An app nagpapangutana ha bridge, nagse-set han orasan ha siyahan nga pagdalagan, nanghahangad hin usa nga sample dayon, ngan nag-i-import hin mga bag-o nga natipig nga pagbasa kada 20 segundo.
6. Pindota an **Hunonga an Awtomatiko nga Pagbasa han ESP32 pinaagi han Wi-Fi** kon tapos na. Nagpapatulod an ESP32 pag-log samtang naka-on.

### 4.2 Bluetooth sync (waray bridge)

1. Gamita an HTTPS app ha desktop Edge o Chrome nga may suporta ha Web Bluetooth.
2. Ha **Monitor han Sensor**, pilia anay an **Lokasyon**.
3. Pindota an **Sync via Bluetooth (Sync pinaagi han Bluetooth)** ngan pilia an natalaga nga ngaran han device ha prompt han permiso han browser.
4. Tipigi an laptop ha sakop han Bluetooth hasta matapos an sync. An app nagse-set han orasan/lokasyon kon kinahanglan ngan nag-i-import hin mga natipig nga rekord, ginlalaktawan an mga duplicate nga aada na ha mao nga browser.
5. An Bluetooth sync nagbabalhin la hin natipig nga datos; diri ini **nga** nagpapatikang hin bag-o nga sample. An Bluetooth diri protektado hin password, salit gamita la ini ha ginsasalian nga palibot.

## 5. Mga Alerto

Mga alerto la an nahihimo para han **bag-o o nagbag-o nga lebel nga Hinga/Hinto** tikang ha bag-o, balido, ngan diri-demo nga pagbasa. An pag-uutro han pareho nga lebel diri nagpapadala utro. An lista han aktibidad han alerto nagtatala hin mga pagbasa han peligro, **diri pamatud-an han pagdeliver**.

### 5.1 Mga pahibalo han browser

1. Adto ha **Mga Setting** ngan i-enable an **Browser Notifications (Mga Pahibalo han Browser)**.
2. Tuguti an permiso hin pahibalo kon mangutana an browser.
3. Gamita an **Test Browser Notification (Pagsulay han Pahibalo han Browser)** para kumpirmahon nga nag-aandar ini.

### 5.2 Mga phone push alert

1. I-enable an **Phone Push Alerts (Mga Phone Push Alert)** ha **Mga Setting** ngan tuguti an mga pahibalo.
2. I-enable ini ha laptop nga nagpapatakbo han SchoolHeat ngan ha kada phone nga makakarawat.
3. Kinahanglan an internet, HTTPS, an service worker, an Firebase Anonymous Auth/App Check, ngan an naka-deploy nga Cloud Functions.
4. Gamita an **Send Test Phone Push (Ipadala an Pagsulay nga Phone Push)** para berifikahon an pag-abot. An phone push diri nagagamit hin SMS credits, pero kinahanglan internet an mga phone. An server tinatanggap hin usa nga push request kada lima ka minuto ha bug-os nga proyekto.

### 5.3 Mga SMS alert

1. Ha **Mga Setting → Alert Notifications (Mga Pahibalo han Alerto)**, igsulod an 1–5 nga numero han cellphone ha Pilipinas ha **SMS recipient numbers (Mga numero nga makakarawat hin SMS)**, nga bulag-bulag pinaagi hin comma, semicolon, o bag-o nga linya. An mga pormat nga tinatanggap naglalakip han `09XXXXXXXXX` ngan `+639XXXXXXXXX`.
2. Idda la an mga numero nga may pag-uyon han tag-iya. An mga numero natitipig la ha mao nga browser.
3. I-enable an **SMS Alerts (Mga SMS Alert)**. Naka-off ini ha default.
4. **Send Test SMS (may queue and use credits) (Ipadala an Pagsulay nga SMS — pwede ma-queue ngan gumamit hin credits)** nagpapadala hin: `SchoolHeat test alert: SMS setup is working.`
5. Kada pagsulay siyahan ginsusulat ha local queue, tapos ipinapadala pinaagi han naka-configure nga SMS Worker upod an Firebase ngan App Check tokens. An Worker nagtutugot hin **usa nga SMS request kada lima ka minuto kada account, pati an mga test message**.
6. Kon offline an device, an mensahe nagpapabilin ha queue. An app nagbabag-o hin pagsulay kon makakonekta utro ngan katapos han mga delay han pag-retry. An queue may kapasidad tubtob ha **20** ka mensahe.
7. **Retry Queued SMS (Ipadayon an Queued SMS)** nagpapatulod han mga mensahe ha queue. **Cancel Queued SMS (Ikansela an Queued SMS)** nagtatanggal ha ira pero natitipig an mga makakarawat ngan settings. An send nga aada na ha dalan diri pwede ikansela.
8. An SMS nangangahulagan hin aktibo nga provider, credits, ngan aprubado nga sender nga gin-set han administrator. Kon diri klaro an kahimtang han pagpadala, kita-a an message log han provider antes magsulay utro; an app diri awtomatiko nga nagpapadala utro han mga diri klaro nga kapakyasan.

Gamita an test SMS la kon nagbe-verify hin bag-o nga setup. Nalakip ini ha lima ka minuto nga limitasyon ngan pwede gumamit hin usa ka credit.

## 6. Kasaysayan, tagna, ngan mapa

### Kasaysayan ngan Analytics

- Mangita pinaagi han lokasyon o status ngan mag-filter pinaagi han **All Status (Ngatanan nga Status) / Hayo / Hinay / Hinga / Hinto**.
- An **Heat Index Trend (Trend han Heat Index)** nag-aabtos hin tap, drag, ngan arrow keys. An **Show Status Summary (Ipakita an Buod han Status)** nagbibigay hin breakdown.
- **All Readings (Ngatanan nga Pagbasa)** nagpapakita hin 50 kada pahina. Gamita an trash button para deladohon an usa nga pagbasa tikang ha mao nga browser; diri ini pwede ibalik ngan nagbabag-o han input han tagna.
- An **Export CSV (I-export an CSV)** may-ada kolum nga **Demo Data (Datos Demo)**. An **Export JSON (I-export an JSON)** nagtitipig han `schoolheat_readings.json`.

### Tagna

An **30-Minute Forecast (30-Minuto nga Tagna)** nangangahulagan hin diri mubsob ha 12 nga kompleto, diri-demo, pareho-lokasyon nga ehemplo (mga duha ka oras nga lima ka minuto nga pagbasa). An model comparison nangangahulagan hin diri mubsob ha 10 ka holdout. An mga demo reading gin-i-exclude, ngan an mga badge han accuracy nagpapabilin tubtob may-ada igo nga na-validate nga ehemplo.

### Mapa han Campus

An mapa nagpapakita hin 29 nga nakapirmi nga campus pin upod an mga kontrol ha zoom nga **-**, **+**, ngan **Reset (I-reset)**. Pindota an pin para makita an status hini. An ihap han coverage han naka-map nga pin nagkakarkulo han mga natipig nga ngaran han lokasyon nga nag-aangay ha mga pin; pwede ini maglakip hin demo o stale nga datos ngan diri ini sukod han live nga sensor coverage.

## 7. Mga Setting ngan mga preference

- **Install & Offline Use (Pag-install ngan Paggamit kon Offline)**: nagpapakita han install status ngan han buton nga **Install SchoolHeat (I-install an SchoolHeat)**.
- **Color System (Sistema han Kolor)**: pumili hin palette, swatch, harmony style, o full color picker. An **Reset to SchoolHeat (Ibalik ha SchoolHeat)** nagbabalik han mga default. An mga kolor han peligro han kainit diri nagbabag-o.
- **App language (Pinulongan han app)**: English, Tagalog, Bisaya, o Waray. An navigation, mga komon nga label, pipira nga giya han kaluwasan, ngan an Mahitungod ginhubad na. An mga ngaran han sensor/lokasyon ngan pipira nga teknikal nga mensahe nagpapabilin ha English. An mga label han peligro nagpapabilin nga Hayo/Hinay/Hinga/Hinto.
- **Sensor Calibration (Calibration han Sensor)**: An **Temperature Offset (Offset han Temperatura)** ngan **Humidity Offset (Offset han Kahumidad)** nag-aadjust han mga sunod nga kalkulasyon.
- **Demo Mode / Generate Demo Data (Demo Mode / Paghimo hin Datos Demo)**: naghimo hin mga sample nga pagbasa para ha preview. An mga demo reading gin-i-exclude ha mga tagna.
- **Clear All Data (Hawan an Ngatanan nga Datos)**: nagtatanggal han ngatanan nga pagbasa ha mao nga browser. Diri ini pwede ibalik.
- **Firebase Sync, Outlier Detection, Spike Detection**: kini nga mga toggle natitipig nga preference; diri nila gibabaag-o an yana nga pamatasan han alerto.

## 8. Mga Hotline ngan Mahitungod

An **Mga Hotline han Emerhensya** nagpapakita hin **911 / PINDUTA PARA
TUMAWAG** ngan mga panahap para ha pagtawag: **Hain ka?**, **Ano an nangyari?**,
**Magpabilin nga maabot.** Makadugang ka liwat hin lokal nga kontak pinaagi han
pagtipig hin papel ngan numero la. Ini natitipig hini nga browser, pwede usbon
o tanggalon, ngan an butones nga **Tawag** nagbubukas han dialer han device.
Diri ginpapatud-an han SchoolHeat ini nga mga kontak, diri ini ginsine-sync,
ngan diri ini ginpapadalan hin alerto; waray naka-hardcode nga numero ha
Mahaplag. Ini nga pahina diri emergency dispatch o serbisyong medikal, ngan an
mga SMS alert diri nakakontak han mga responder.

An **Mahitungod** nagpapahayag han katuyoan, mga banda han DepEd 4H, dalagan han trabaho, ngan mga limitasyon han datos. An **Pangutana ha SchoolHeat** nagsasabat hin naka-fix nga grupo hin mga pangutana ha lokal tikang ha natipig nga diri-demo nga rekord ngan dokumentado nga pamatasan. Diri ini nagpapadala hin mga pangutana o pagbasa ha serbisyo han AI.

## 9. Importante nga mga limitasyon ngan mga pahinumdom ha kaluwasan

- An mga pagbasa han ESP32 lokal la ha browser nga nag-import ha ira.
- An label nga **RECENT** diri pamatud-an han koneksyon o calibration.
- An mga alerto tambag la. Sundon an polisiya han eskwelahan ngan an mga lokal nga pahibalo.
- Waray real-time clock an ESP32. An reboot nga waray konektado nga app pwede makahimo hin mga rekord nga waray timestamp.
- An flash log han ESP32 nagtatanggal han gimaihaan nga rekord kon mapuno.
- An offline mode diri naghahatag hin mga serbisyo ha internet.
- An paghawan han datos han site nagtatanggal han queued SMS ngan han mga lokal nga pagbasa.
- Diri pagbag-oha an naka-publish nga firmware bilang bahin han normal nga operasyon han app.

## 10. Pagsulbad hin mga problema

| Sintomas | Ano an kikitaan |
| --- | --- |
| Waray pagbasa katapos han auto-read | Naka-on an ESP32, tama an Wi-Fi, nagdadalagan an bridge, napili an lokasyon, ngan tugutan han bridge an browser origin. |
| An pinakabag-o nga pagbasa nagpapakita hin **STALE** | An timestamp mas daan na ha 15 ka minuto. Mag-sync utro o igsulod an bag-o nga pagbasa. |
| Diri magamit an Tagna | Kinahanglan hin diri mubsob ha 12 nga kompleto, diri-demo, pareho-lokasyon nga pagbasa ngan igo nga holdout. |
| Diri inaabot an SMS | Naka-enable an mga SMS Alert, balido an makakarawat, may-ada internet, aktibo an credits han provider ngan an aprubado nga sender, ngan diri nakansela an queue. |
| Na-rate-limit an test SMS | Usa la nga SMS request kada lima ka minuto kada account; paghulat ngan magsulay utro ha kamot. |
| Diri inaabot an phone push | Naka-enable an push ha nagpapadala ngan ha makakarawat, na-grant an permiso hin pahibalo, may-ada internet, ngan naka-deploy an Cloud Functions. |
| An pin ha mapa waray natipig nga pagbasa | Waray pa natipig nga pagbasa nga nag-aangay han ngaran han naka-map nga lokasyon. |
| Naabli an app pero nagf-fail an mga serbisyo | Kumpirmaha nga naabli online an HTTPS site hin makausa ngan balido an configuration han App Check/Firebase. |
