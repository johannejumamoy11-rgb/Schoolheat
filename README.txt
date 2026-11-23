SCHOOLHEAT ESP32 WIFI QUICK START
================================

Each ESP32 reads its DHT22 and saves readings to its own flash. Change the
DEVICE_NAME setting (1 to 32 characters) before uploading to each board; it
sets both Wi-Fi and Bluetooth names. The app keeps each board's readings
separate.

1. In schoolheat-esp32/schoolheat-esp32.ino, set AP_PASSWORD to a private Wi-Fi
   password of at least 8 characters. Do not commit the real password.
2. Set DEVICE_NAME to a different name for each board, then upload and power
   it. Each creates its named Wi-Fi network at 192.168.4.1.
3. While online, open the HTTPS GitHub Pages app. For bridge-free sync, click
   "Sync via Bluetooth" and choose that laptop's assigned device name in the
   browser prompt. The laptop does not need to
   join the ESP32 Wi-Fi.
4. For Wi-Fi sync instead, connect the laptop to its assigned Wi-Fi name; a "No
   internet" warning is expected. In the folder containing
   start-local-bridge.ps1, run:

   powershell -ExecutionPolicy Bypass -File .\start-local-bridge.ps1

5. Keep the PowerShell window open. In the GitHub Pages app, go to Monitor,
   choose the sensor location, and click Auto-Read ESP32.

The ESP32 takes a sample immediately on startup even before a location or
clock is set, then samples every five minutes from that startup time (power on
at 8:01 means about 8:01, 8:06, 8:11). Syncing the clock does not reset this
interval. A later sync assigns the chosen location and reconstructs timestamps
for readings from the current powered session. The ESP32 stores readings while
powered, even when the laptop is off. Bluetooth sync imports saved readings
into that browser's history later; Wi-Fi sync requires the bridge during sync.
Bluetooth requires a secure context and desktop Web Bluetooth support and
should only be used in a trusted environment. Bluetooth sync only transfers
data and does not trigger a sample. The published HTTPS app is recommended.
