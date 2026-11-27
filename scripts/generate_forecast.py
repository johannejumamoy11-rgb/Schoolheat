#!/usr/bin/env python3
"""Generate SchoolHeat's 60-minute forecast with real Python tree models.

The job reads the six-column classroom CSV, validates it without inventing
values, builds lagged heat-index features, and evaluates Random Forest,
XGBoost, and LightGBM on non-overlapping 60-minute walk-forward holdouts.
The lowest validated RMSE model is used for the published prediction.

Outputs forecast.json for GitHub Pages. This script never sends SMS, never
changes sensor firmware, and never deploys anything by itself.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from xgboost import XGBRegressor

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python 3.9+ always has zoneinfo
    ZoneInfo = None

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(os.environ.get("FORECAST_SOURCE", str(ROOT / "data" / "schoolheat_readings.csv")))
OUTPUT = Path(os.environ.get("FORECAST_OUTPUT", str(ROOT / "forecast.json")))
LOCAL_TZ = ZoneInfo("Asia/Manila") if ZoneInfo else None

INTERVAL_MINUTES = 5
HORIZON_MINUTES = 60
HORIZON_STEPS = HORIZON_MINUTES // INTERVAL_MINUTES
SCHOOL_START_MINUTE = 7 * 60
SCHOOL_END_MINUTE = 17 * 60
MIN_HOLDOUTS = 10
RANDOM_SEED = 42

REQUIRED_COLUMNS = [
    "date",
    "timestamp",
    "device_id",
    "temperature_c",
    "relative_humidity_pct",
    "heat_index_c",
]
FEATURES = [
    "heat_index",
    "hi_lag_5",
    "hi_lag_15",
    "hi_lag_30",
    "delta_15",
    "temperature",
    "humidity",
    "sin_time",
    "cos_time",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def write_pending(message: str) -> None:
    payload = {
        "schemaVersion": 1,
        "status": "pending",
        "horizonMinutes": HORIZON_MINUTES,
        "generatedAt": utc_now(),
        "message": message,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"FORECAST_STATUS=pending: {message}")


def status_for(value: float) -> str:
    if value < 27:
        return "safe"
    if value < 33:
        return "caution"
    if value < 42:
        return "danger"
    return "extreme"


def make_models():
    return {
        "random-forest": lambda: RandomForestRegressor(
            n_estimators=300,
            max_depth=6,
            min_samples_leaf=3,
            random_state=RANDOM_SEED,
            n_jobs=-1,
        ),
        "xgboost-style": lambda: XGBRegressor(
            n_estimators=400,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            objective="reg:squarederror",
            random_state=RANDOM_SEED,
            n_jobs=-1,
            verbosity=0,
        ),
        "lightgbm-style": lambda: LGBMRegressor(
            n_estimators=400,
            num_leaves=15,
            learning_rate=0.05,
            min_child_samples=10,
            objective="regression",
            random_state=RANDOM_SEED,
            n_jobs=-1,
            verbose=-1,
        ),
    }


def load_readings() -> pd.DataFrame:
    if not SOURCE.is_file():
        raise FileNotFoundError(f"Source CSV not found: {SOURCE}")
    raw = pd.read_csv(SOURCE)
    missing = [column for column in REQUIRED_COLUMNS if column not in raw.columns]
    if missing:
        raise ValueError(f"Source CSV is missing required columns: {', '.join(missing)}")
    raw = raw[REQUIRED_COLUMNS].copy()

    stamp = raw["timestamp"].astype(str).str.strip()
    combined = np.where(
        stamp.str.contains(" ", regex=False),
        stamp,
        raw["date"].astype(str).str.strip() + " " + stamp,
    )
    parsed = pd.Series(pd.to_datetime(combined, errors="coerce"), index=raw.index)
    if LOCAL_TZ is not None and getattr(parsed.dt, "tz", None) is None:
        parsed = parsed.dt.tz_localize(LOCAL_TZ, ambiguous="NaT", nonexistent="NaT")
    raw["datetime"] = parsed

    for column in ("temperature_c", "relative_humidity_pct", "heat_index_c"):
        raw[column] = pd.to_numeric(raw[column], errors="coerce")

    raw = raw.dropna(subset=["datetime", "temperature_c", "relative_humidity_pct", "heat_index_c"])
    raw["heat_index_c"] = raw["heat_index_c"].clip(lower=0, upper=54)
    raw["device_id"] = raw["device_id"].astype(str).str.strip()
    return raw.sort_values("datetime")


def select_device(raw: pd.DataFrame) -> tuple[str, pd.DataFrame]:
    devices = sorted(value for value in raw["device_id"].unique() if value)
    if not devices:
        raise ValueError("No usable device_id values were found in the source CSV.")
    requested = os.environ.get("FORECAST_DEVICE_ID", "").strip()
    device_id = requested if requested in devices else devices[0]
    frame = raw[raw["device_id"] == device_id].copy()
    minute_of_day = frame["datetime"].dt.hour * 60 + frame["datetime"].dt.minute
    frame = frame[
        (minute_of_day >= SCHOOL_START_MINUTE) & (minute_of_day <= SCHOOL_END_MINUTE)
    ].copy()
    frame = frame.drop_duplicates("datetime", keep="last").sort_values("datetime")
    if len(frame) < 40:
        raise ValueError(f"Device {device_id} has too few school-hour readings to forecast.")
    return device_id, frame


def build_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    grid = pd.date_range(frame["datetime"].iloc[0], frame["datetime"].iloc[-1], freq=f"{INTERVAL_MINUTES}min")
    indexed = frame.set_index("datetime")
    heat = indexed["heat_index_c"].reindex(grid).astype(float)
    temperature = indexed["temperature_c"].reindex(grid).astype(float)
    humidity = indexed["relative_humidity_pct"].reindex(grid).astype(float)

    out = pd.DataFrame({"date": grid})
    out["minute"] = [int(timestamp.timestamp() // 60) for timestamp in grid]
    out["school_date"] = [timestamp.date() for timestamp in grid]
    out["minute_of_day"] = np.asarray(grid.hour) * 60 + np.asarray(grid.minute)
    out["heat_index"] = heat.to_numpy()
    out["temperature"] = temperature.to_numpy()
    out["humidity"] = humidity.to_numpy()

    for lag_minutes in (5, 15, 30):
        out[f"hi_lag_{lag_minutes}"] = heat.shift(lag_minutes // INTERVAL_MINUTES).to_numpy()

    out["delta_15"] = out["heat_index"] - out["hi_lag_15"]
    angle = 2 * np.pi * out["minute_of_day"].to_numpy() / 1440
    out["sin_time"] = np.sin(angle)
    out["cos_time"] = np.cos(angle)

    future_heat = heat.shift(-HORIZON_STEPS).to_numpy()
    out["future_heat"] = future_heat
    out["target"] = future_heat - out["heat_index"].to_numpy()

    out = out.dropna(subset=FEATURES).copy()
    out = out[out["minute_of_day"] + HORIZON_MINUTES <= SCHOOL_END_MINUTE].copy()
    return out.reset_index(drop=True)


def compute_metrics(items: list[dict]) -> dict:
    if not items:
        return {
            "mae": None,
            "rmse": None,
            "mape": None,
            "r2": None,
            "samples": 0,
            "hazardMisses": 0,
            "hazardSamples": 0,
            "hazardMissRate": None,
            "evaluationStart": None,
            "evaluationEnd": None,
        }
    actual = np.array([item["actual"] for item in items], dtype=float)
    predicted = np.array([item["predicted"] for item in items], dtype=float)
    error = predicted - actual
    nonzero = actual != 0
    hazardous = actual >= 33
    dates = [item["date"] for item in items]
    return {
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(actual, predicted))), 4),
        "mape": round(float(np.mean(np.abs(error[nonzero] / actual[nonzero])) * 100), 4)
        if nonzero.any()
        else None,
        "r2": round(float(r2_score(actual, predicted)), 4)
        if len(actual) > 1 and np.var(actual) > 0
        else None,
        "samples": len(items),
        "hazardMisses": int(np.sum(hazardous & (predicted < 33))),
        "hazardSamples": int(np.sum(hazardous)),
        "hazardMissRate": round(float(np.sum(hazardous & (predicted < 33)) / np.sum(hazardous)), 4)
        if hazardous.any()
        else None,
        "evaluationStart": min(dates).isoformat(),
        "evaluationEnd": max(dates).isoformat(),
    }


def evaluate(train_rows: pd.DataFrame, models: dict) -> dict:
    errors = {name: [] for name in models}
    all_dates = sorted(train_rows["school_date"].unique())
    if len(all_dates) >= 9:
        test_dates = all_dates[8:]
    else:
        test_dates = all_dates[max(3, len(all_dates) // 2) :]

    for test_date in test_dates:
        train = train_rows[train_rows["school_date"] < test_date]
        test = train_rows[train_rows["school_date"] == test_date]
        test = test[test["minute_of_day"] % 60 == 0]
        if len(train) < 20 or test.empty:
            continue
        x_train = train[FEATURES].to_numpy(dtype=float)
        y_train = train["target"].to_numpy(dtype=float)
        lower, upper = float(y_train.min()), float(y_train.max())
        x_test = test[FEATURES].to_numpy(dtype=float)
        current = test["heat_index"].to_numpy(dtype=float)
        actual = test["future_heat"].to_numpy(dtype=float)
        for name, factory in models.items():
            model = factory()
            model.fit(x_train, y_train)
            delta = np.clip(model.predict(x_test), lower, upper)
            predicted = np.clip(current + delta, 0, 54)
            for date, actual_value, predicted_value in zip(test["date"], actual, predicted):
                errors[name].append(
                    {
                        "date": date,
                        "actual": float(actual_value),
                        "predicted": float(predicted_value),
                    }
                )
    return {name: compute_metrics(items) for name, items in errors.items()}


def json_date(value) -> str | None:
    if value is None or pd.isna(value):
        return None
    return value.isoformat()


def generate() -> None:
    raw = load_readings()
    devices = [
        {
            "deviceId": device,
            "label": f"Classroom device {device}",
            "readings": int((raw["device_id"] == device).sum()),
        }
        for device in sorted(raw["device_id"].unique())
    ]
    device_id, frame = select_device(raw)
    full = build_feature_frame(frame)
    train_rows = full.dropna(subset=["target", "future_heat"]).copy()
    if full.empty or train_rows.empty:
        write_pending("Not enough complete 60-minute examples in the source CSV to generate a forecast.")
        return

    models = make_models()
    metrics = evaluate(train_rows, models)
    ranked = [
        (name, metric)
        for name, metric in metrics.items()
        if metric["rmse"] is not None
    ]
    best_model = (
        sorted(ranked, key=lambda item: (item[1]["rmse"], item[1]["mae"]))[0][0]
        if ranked
        else "xgboost-style"
    )
    provisional = metrics[best_model]["samples"] < MIN_HOLDOUTS

    x_train = train_rows[FEATURES].to_numpy(dtype=float)
    y_train = train_rows["target"].to_numpy(dtype=float)
    lower, upper = float(y_train.min()), float(y_train.max())
    latest = full.iloc[-1]
    x_latest = latest[FEATURES].to_numpy(dtype=float).reshape(1, -1)

    model_predictions = {}
    for name, factory in models.items():
        model = factory()
        model.fit(x_train, y_train)
        delta = float(np.clip(model.predict(x_latest)[0], lower, upper))
        value = float(np.clip(latest["heat_index"] + delta, 0, 54))
        model_predictions[name] = {
            "value": round(value, 2),
            "status": status_for(value),
        }

    forecast_value = model_predictions[best_model]["value"]
    forecast_date = latest["date"] + pd.Timedelta(minutes=HORIZON_MINUTES)
    history = [
        {
            "minute": int(row["minute"]),
            "date": json_date(row["date"]),
            "value": round(float(row["heat_index"]), 2),
        }
        for _, row in full.tail(HORIZON_STEPS).iterrows()
    ]

    notes = [
        "Real scikit-learn RandomForestRegressor, xgboost.XGBRegressor, and lightgbm.LGBMRegressor models.",
        "Validation uses non-overlapping 60-minute school-hour holdouts from sequential future days.",
        "The selected model has the lowest validated RMSE.",
    ]
    if provisional:
        notes.append(
            f"Fewer than {MIN_HOLDOUTS} holdout samples are available, so this forecast is provisional."
        )
    notes.append("Sensor calibration is not verified by this forecast.")

    payload = {
        "schemaVersion": 1,
        "status": "ready",
        "horizonMinutes": HORIZON_MINUTES,
        "generatedAt": utc_now(),
        "sourceFile": str(SOURCE.relative_to(ROOT)) if SOURCE.is_relative_to(ROOT) else str(SOURCE),
        "dataStart": json_date(full.iloc[0]["date"]),
        "dataEnd": json_date(latest["date"]),
        "deviceId": device_id,
        "location": f"Classroom device {device_id}",
        "locationNote": "Device ID from the source CSV; not mapped to a campus map pin.",
        "devices": devices,
        "current": {
            "minute": int(latest["minute"]),
            "date": json_date(latest["date"]),
            "value": round(float(latest["heat_index"]), 2),
            "temperature": round(float(latest["temperature"]), 2),
            "humidity": round(float(latest["humidity"]), 2),
        },
        "forecast": [
            {
                "date": json_date(forecast_date),
                "value": forecast_value,
                "status": status_for(forecast_value),
            }
        ],
        "history": history,
        "models": model_predictions,
        "bestModel": best_model,
        "metrics": metrics,
        "trainingSamples": len(train_rows),
        "notes": notes,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"FORECAST_STATUS=ready model={best_model} samples={metrics[best_model]['samples']} output={OUTPUT}")


if __name__ == "__main__":
    try:
        generate()
    except Exception as error:
        write_pending(f"Forecast generation failed: {error}")
