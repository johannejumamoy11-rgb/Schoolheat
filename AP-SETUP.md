# SchoolHeat ESP32 access-point setup

The ESP32 creates its own password-protected Wi-Fi network and can also expose
saved readings over Bluetooth Low Energy (BLE). Wi-Fi sync from GitHub Pages
requires the localhost bridge because Edge blocks the HTTPS app from directly
fetching the ESP32's HTTP API. Bluetooth sync does not require the bridge or
joining the ESP32 Wi-Fi.

Set `DEVICE_NAME` to a different name (1–32 characters) before uploading to
each board; the configured name is used for both Wi-Fi and Bluetooth. The app keeps readings
separated by the board's chip ID. Assign one named ESP32 to each laptop and
choose that exact name during Bluetooth connection.

## Hardware

- DHT22 VCC -> ESP32 3V3
- DHT22 DATA -> ESP32 GPIO 4
- DHT22 GND -> ESP32 GND

## Configure and upload

1. Open `schoolheat-esp32/schoolheat-esp32.ino` in Arduino IDE.
2. Set `AP_PASSWORD` to a private Wi-Fi password of at least 8 characters.
   Do not commit the real password to GitHub. No API token is needed.
3. Install Adafruit DHT sensor library, Adafruit Unified Sensor, and
   ArduinoJson. Select the appropriate ESP32 board and upload the sketch.
4. Open Serial Monitor at 115200 baud. The board prints its configured Wi-Fi and
   Bluetooth names; its API is normally at `192.168.4.1`.

If LittleFS cannot mount, the sketch automatically formats it, which erases
stored readings. Look for `LittleFS mounted successfully.` in Serial Monitor.

## Sync the GitHub Pages app over Bluetooth (no bridge)

1. Change `DEVICE_NAME` and upload the firmware to each assigned board. It
   advertises using that configured name and takes an initial sample on
   startup even if no location has been selected.
   It then samples every five minutes measured from startup (for example,
   power-on at 8:01 means about 8:01, 8:06, 8:11). Clock sync does not reset
   this interval.
2. Open the HTTPS GitHub Pages app in desktop Edge or Chrome. Go to **Monitor**,
   select the sensor location, and click **Sync via Bluetooth**.
3. Select the assigned device name in the browser permission prompt and keep the
   laptop within Bluetooth range until sync completes. Select the sensor
   location before syncing; the app sets the device clock/location, assigns
   them to unlabeled current-session samples, and imports saved records into
   this browser's history.
4. The app rescans the ESP32's stored log and deduplicates readings already in
   this browser, then saves new readings to local history. This can recover
   records that became timestamped after an earlier sync. The ESP32 continues
   logging while powered, even when the laptop is off; sync later to import
   those readings.

Bluetooth requires a secure context and Web Bluetooth support; use the HTTPS
GitHub Pages app for the supported workflow. Browser behavior when opening the
app as a local file can vary. The BLE service is not protected by the Wi-Fi
password, so use it only in a trusted environment. This hardware has no
real-time clock; if it reboots without a connected app, records may not have
reliable timestamps.

Bluetooth sync only transfers saved data; it does not trigger an extra sample.
Before the clock is set, samples are stored without timestamps. Syncing the
clock later reconstructs timestamps for readings from the current powered
session without resetting the five-minute interval.
The sync status also reports whether the latest DHT22 read was valid, its
temperature/humidity when available, and whether that sample was saved to
flash. Every Bluetooth sync rescans saved records and deduplicates them in the
browser, so samples whose timestamps became available after an earlier sync
can be recovered.

## Sync the GitHub Pages app over Wi-Fi (bridge required)

1. While online, open the published SchoolHeat GitHub Pages app on the Windows
   laptop so its files are cached. Download or copy `start-local-bridge.ps1` to
   that laptop.
2. Power the assigned ESP32 and connect the laptop to its configured Wi-Fi
   name using the private
   password configured in `AP_PASSWORD`. A "No internet" warning is expected.
3. In PowerShell, from the folder containing the bridge script, run:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\start-local-bridge.ps1
   ```

4. Keep that PowerShell window open. In the GitHub Pages app, go to **Monitor**,
   select the sensor location, and click **Auto-Read ESP32**. The first sync
   sets the clock and requests an immediate sample; after that, the ESP32
   samples every five minutes.
5. Readings are saved in that browser's local storage. Each teammate's device
   needs its own copy of the app data; readings are not automatically shared.

The bridge binds to localhost and only accepts this project's GitHub Pages
origin. The ESP32 API stays on its password-protected Wi-Fi network. Firebase
sync and phone push alerts still require internet.
