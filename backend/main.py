
from __future__ import annotations

import asyncio
import math
import os
from datetime import date, datetime, time, timedelta, timezone
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware


BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
REQUEST_TIMEOUT = 40.0
MAX_CONCURRENT_REQUESTS = 6

app = FastAPI(
    title="Wind Forecast Intelligence",
    version="3.0.0",
    description=(
        "UK national wind generation forecast evaluation using Elexon BMRS data."
    ),
)

origins = [
    item.strip()
    for item in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if item.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)


def parse_time(value: Any) -> datetime | None:
    """Parse a timestamp and normalize it to UTC."""
    if not value:
        return None

    try:
        parsed = datetime.fromisoformat(
            str(value).strip().replace("Z", "+00:00")
        )
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)

        return parsed.astimezone(timezone.utc)

    except (ValueError, TypeError, OverflowError):
        return None


def value_number(row: dict[str, Any]) -> float | None:
    """Read a finite generation value."""
    try:
        value = float(row.get("generation"))
        return value if math.isfinite(value) else None
    except (TypeError, ValueError, OverflowError):
        return None


def extract_records(payload: Any) -> list[dict[str, Any]]:
    """Handle the list and common wrapped-list API response formats."""
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]

    if isinstance(payload, dict):
        for key in ("data", "results", "result", "items"):
            value = payload.get(key)
            if isinstance(value, list):
                return [item for item in value if isinstance(item, dict)]

        print("[Elexon] Unexpected response keys:", list(payload.keys())[:20])

    return []


def iso_z(value: datetime) -> str:
    return (
        value.astimezone(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )


def in_date_range(
    value: datetime,
    start_date: date,
    end_date: date,
) -> bool:
    return start_date <= value.date() <= end_date


async def fetch_publish_day(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    dataset: str,
    publish_day: date,
) -> list[dict[str, Any]]:
    """
    Fetch one UTC publication day from an Elexon dataset stream.

    Publication-time filters are used because historical forecast evaluation
    must select the forecast vintage that was available before delivery.
    """
    start = datetime.combine(
        publish_day, time.min, tzinfo=timezone.utc
    )
    end = start + timedelta(days=1)

    url = f"{BASE_URL}/datasets/{dataset}/stream"

    async with semaphore:
        response = await client.get(
            url,
            params={
                "publishDateTimeFrom": iso_z(start),
                "publishDateTimeTo": iso_z(end),
            },
        )
        response.raise_for_status()

    records = extract_records(response.json())

    print(
        f"[Elexon {dataset}] "
        f"publish_day={publish_day.isoformat()} "
        f"status={response.status_code} records={len(records)}"
    )

    return records


async def fetch_publish_range(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    dataset: str,
    start: date,
    end: date,
) -> list[dict[str, Any]]:
    """Fetch a range of publication dates with bounded concurrency."""
    if end < start:
        return []

    days = []
    current = start

    while current <= end:
        days.append(current)
        current += timedelta(days=1)

    results = await asyncio.gather(
        *[
            fetch_publish_day(client, semaphore, dataset, day)
            for day in days
        ]
    )

    return [row for batch in results for row in batch]


def normalize_actuals(
    rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
) -> dict[str, dict[str, Any]]:
    """
    Normalize FUELHH wind actuals by delivery startTime.

    If Elexon provides more than one published record for the same delivery
    timestamp, retain the latest published record.
    """
    actuals: dict[str, dict[str, Any]] = {}

    for row in rows:
        if str(row.get("fuelType", "")).strip().upper() != "WIND":
            continue

        delivery = forecast_delivery_time(row)
        generation = value_number(row)

        if delivery is None or generation is None:
            continue

        if not in_date_range(delivery, start_date, end_date):
            continue

        published = parse_time(row.get("publishTime")) or delivery
        key = delivery.isoformat()

        previous = actuals.get(key)

        if previous is None or published > previous["published"]:
            actuals[key] = {
                "start": delivery,
                "published": published,
                "actual": generation,
            }

    return actuals


def forecast_delivery_time(
    row: dict[str, Any],
) -> datetime | None:
    """
    Resolve the delivery timestamp for a WINDFOR record.

    A valid UK settlement period is a 30-minute period numbered 1–48.
    When settlement fields are unavailable, use startTime as supplied by
    the endpoint rather than inventing a timestamp.
    """
    settlement_date = row.get("settlementDate")
    settlement_period = row.get("settlementPeriod")

    if settlement_date is not None and settlement_period is not None:
        try:
            delivery_date = date.fromisoformat(
                str(settlement_date)[:10]
            )
            period = int(settlement_period)

            if 1 <= period <= 48:
                return (
                    datetime.combine(
                        delivery_date,
                        time.min,
                        tzinfo=timezone.utc,
                    )
                    + timedelta(minutes=30 * (period - 1))
                )

        except (ValueError, TypeError, OverflowError):
            pass

    return parse_time(row.get("startTime"))


def normalize_forecasts(
    rows: list[dict[str, Any]],
    start_date: date,
    end_date: date,
) -> list[dict[str, Any]]:
    """Normalize forecast records without discarding publication vintages."""
    forecasts = []

    for row in rows:
        delivery = forecast_delivery_time(row)
        published = parse_time(row.get("publishTime"))
        generation = value_number(row)

        if delivery is None or published is None or generation is None:
            continue

        if not in_date_range(delivery, start_date, end_date):
            continue

        forecasts.append(
            {
                "start": delivery,
                "published": published,
                "forecast": generation,
            }
        )

    return forecasts


def calculate_metrics(points: list[dict[str, Any]]) -> dict[str, Any]:
    """Calculate MAE, RMSE and signed bias in MW."""
    if not points:
        return {
            "mae": None,
            "rmse": None,
            "bias": None,
            "count": 0,
        }

    errors = [
        point["forecast"] - point["actual"]
        for point in points
    ]

    count = len(errors)

    return {
        "mae": round(
            sum(abs(error) for error in errors) / count, 2
        ),
        "rmse": round(
            math.sqrt(
                sum(error * error for error in errors) / count
            ),
            2,
        ),
        "bias": round(sum(errors) / count, 2),
        "count": count,
    }


def infer_interval_minutes(
    points: list[dict[str, Any]],
) -> int | None:
    """
    Infer the most common positive gap between consecutive matched delivery
    timestamps. This describes the returned data; it does not fill gaps.
    """
    timestamps = sorted(
        {
            parse_time(point["startTime"])
            for point in points
            if parse_time(point["startTime"]) is not None
        }
    )

    if len(timestamps) < 2:
        return None

    gaps = []

    for previous, current in zip(timestamps, timestamps[1:]):
        minutes = int((current - previous).total_seconds() / 60)

        if minutes > 0:
            gaps.append(minutes)

    if not gaps:
        return None

    # Use the most frequent gap. In a tie, choose the smaller gap.
    counts: dict[int, int] = {}

    for gap in gaps:
        counts[gap] = counts.get(gap, 0) + 1

    return min(counts, key=lambda gap: (-counts[gap], gap))


def build_analysis_points(
    actuals: dict[str, dict[str, Any]],
    forecasts: list[dict[str, Any]],
    cutoff_hour_utc: int,
) -> tuple[list[dict[str, Any]], int]:
    """
    For each delivery timestamp, select the latest forecast published
    by the configured hour on the preceding UTC calendar day.

    Only exact delivery timestamps present in both the forecast and actual
    data are matched. No missing values or intervals are fabricated.
    """
    selected: dict[str, dict[str, Any]] = {}

    for forecast in forecasts:
        delivery = forecast["start"]

        cutoff = (
            datetime.combine(
                delivery.date() - timedelta(days=1),
                time.min,
                tzinfo=timezone.utc,
            )
            + timedelta(hours=cutoff_hour_utc)
        )

        if forecast["published"] > cutoff:
            continue

        key = delivery.isoformat()
        previous = selected.get(key)

        if (
            previous is None
            or forecast["published"] > previous["published"]
        ):
            selected[key] = forecast

    points = []

    for key, forecast in sorted(selected.items()):
        actual_record = actuals.get(key)

        if actual_record is None:
            continue

        actual = actual_record["actual"]
        predicted = forecast["forecast"]
        error = predicted - actual

        points.append(
            {
                "startTime": key,
                "publishTime": forecast["published"].isoformat(),
                "forecast": round(predicted, 2),
                "actual": round(actual, 2),
                "error": round(error, 2),
                "absoluteError": round(abs(error), 2),
            }
        )

    return points, len(selected)


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "wind-forecast-intelligence",
    }


@app.get("/api/analysis")
async def analysis(
    start_date: date = Query(default=date(2026, 1, 1)),
    end_date: date = Query(default=date(2026, 1, 31)),
    cutoff_hour_utc: int = Query(default=10, ge=0, le=23),
):
    if end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date must be on or after start_date",
        )

    if (end_date - start_date).days > 31:
        raise HTTPException(
            status_code=400,
            detail="Please request a maximum of 32 calendar days",
        )

    # The first delivery date can use a forecast published on the preceding day.
    forecast_publish_start = start_date - timedelta(days=1)

    try:
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            follow_redirects=True,
        ) as client:
            actual_rows, forecast_rows = await asyncio.gather(
                fetch_publish_range(
                    client,
                    semaphore,
                    "FUELHH",
                    start_date,
                    end_date,
                ),
                fetch_publish_range(
                    client,
                    semaphore,
                    "WINDFOR",
                    forecast_publish_start,
                    end_date,
                ),
            )

    except httpx.HTTPStatusError as exc:
        print(
            "[Elexon] HTTP status error:",
            exc.response.status_code,
            str(exc.request.url),
        )
        raise HTTPException(
            status_code=502,
            detail=(
                f"Elexon returned HTTP {exc.response.status_code}. "
                "Check the backend logs."
            ),
        ) from exc

    except httpx.HTTPError as exc:
        print("[Elexon] Request error:", repr(exc))
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Elexon: {exc.__class__.__name__}",
        ) from exc

    except (ValueError, TypeError) as exc:
        print("[Elexon] Response parsing error:", repr(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not parse the Elexon response.",
        ) from exc

    actuals = normalize_actuals(
        actual_rows, start_date, end_date
    )
    forecasts = normalize_forecasts(
        forecast_rows, start_date, end_date
    )

    points, selected_count = build_analysis_points(
        actuals,
        forecasts,
        cutoff_hour_utc,
    )

    interval_minutes = infer_interval_minutes(points)

    if interval_minutes == 30:
        interval_label = "30-minute"
    elif interval_minutes == 60:
        interval_label = "hourly"
    elif interval_minutes is None:
        interval_label = "undetermined"
    else:
        interval_label = f"{interval_minutes}-minute"

    notice_parts = [
        (
            "Forecast selection uses an explicit evaluation assumption: "
            f"the latest forecast published by {cutoff_hour_utc:02d}:00 UTC "
            "on the preceding UTC calendar day. This cutoff is not claimed "
            "to be a client-confirmed trading rule."
        )
    ]

    if not actuals:
        notice_parts.append(
            "No usable actual wind records were found for the requested "
            "delivery dates."
        )

    if not forecasts:
        notice_parts.append(
            "No usable forecast records were found for the requested "
            "delivery dates."
        )

    if not points:
        notice_parts.append(
            "No exact timestamp matches were found between selected forecasts "
            "and actuals. Metrics are unavailable; no values were fabricated."
        )
    elif interval_minutes != 30:
        notice_parts.append(
            f"The most common gap between matched delivery timestamps is "
            f"{interval_label}. Verify the source interval convention before "
            "describing these results as half-hourly."
        )

    return {
        "period": {
            "startDate": start_date.isoformat(),
            "endDate": end_date.isoformat(),
        },
        "selectionPolicy": (
            f"Latest forecast published by {cutoff_hour_utc:02d}:00 UTC "
            "on the preceding calendar day"
        ),
        "intervalMinutes": interval_minutes,
        "intervalLabel": interval_label,
        "dataCounts": {
            "actualRecords": len(actuals),
            "forecastRecords": len(forecasts),
            "matchedIntervals": len(points),
        },
        "metrics": calculate_metrics(points),
        "points": points,
        "notice": " ".join(notice_parts),
        "diagnostics": {
            "rawActualRows": len(actual_rows),
            "rawForecastRows": len(forecast_rows),
            "normalizedActualIntervals": len(actuals),
            "normalizedForecastRows": len(forecasts),
            "selectedForecastIntervals": selected_count,
            "matchedIntervals": len(points),
            "observedIntervalMinutes": interval_minutes,
        },
    }


@app.get("/api/demo")
def demo():
    """
    Clearly labelled illustrative data for UI development only.
    These values are not observations retrieved from Elexon.
    """
    points = []
    base = datetime(2026, 1, 12, tzinfo=timezone.utc)

    for index in range(48):
        actual = (
            8500
            + 1100 * math.sin(index / 5.2)
            + 300 * math.cos(index / 2.8)
        )
        forecast = actual + 250 * math.sin(index / 3.5) + 120
        start = base + timedelta(minutes=30 * index)

        points.append(
            {
                "startTime": start.isoformat(),
                "publishTime": (
                    start - timedelta(days=1, hours=4)
                ).isoformat(),
                "forecast": round(forecast, 2),
                "actual": round(actual, 2),
                "error": round(forecast - actual, 2),
                "absoluteError": round(
                    abs(forecast - actual), 2
                ),
            }
        )

    return {
        "period": {
            "startDate": "2026-01-12",
            "endDate": "2026-01-12",
        },
        "selectionPolicy": "Illustrative demo data only",
        "intervalMinutes": 30,
        "intervalLabel": "30-minute",
        "dataCounts": {
            "actualRecords": 48,
            "forecastRecords": 48,
            "matchedIntervals": 48,
        },
        "metrics": calculate_metrics(points),
        "points": points,
        "notice": (
            "DEMO DATA: illustrative values only, "
            "not observations from Elexon."
        ),
    }
