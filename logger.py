import serial
import csv
from datetime import datetime

arduino = serial.Serial("COM4", 9600, timeout=1)

with open("schoolheat_data.csv", "a", newline="") as file:
    writer = csv.writer(file)

    if file.tell() == 0:
        writer.writerow(["Date", "Time", "Temperature (°C)", "Humidity (%)"])

    print("SchoolHeat data logger started.")
    print("Press Ctrl+C to stop.")

    while True:
        line = arduino.readline().decode("utf-8").strip()

        if line and line != "ERROR":
            try:
                temperature, humidity = line.split(",")

                now = datetime.now()

                writer.writerow([
                    now.strftime("%Y-%m-%d"),
                    now.strftime("%H:%M:%S"),
                    temperature,
                    humidity
                ])

                file.flush()

                print(
                    f"{now.strftime('%Y-%m-%d %H:%M:%S')} | "
                    f"{temperature} °C | {humidity} %"
                )

            except ValueError:
                pass