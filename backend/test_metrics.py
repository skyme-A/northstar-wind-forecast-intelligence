from datetime import date
from main import calculate_metrics, normalize_actuals, normalize_forecasts, forecast_delivery_time


def test_metrics():
    result = calculate_metrics([
        {"forecast": 110, "actual": 100},
        {"forecast": 90, "actual": 100},
    ])
    assert result["mae"] == 10
    assert result["rmse"] == 10
    assert result["bias"] == 0
    assert result["count"] == 2


def test_actuals_filters_wind():
    result = normalize_actuals([
        {"fuelType": "WIND", "startTime": "2026-01-01T00:00:00Z", "generation": 12},
        {"fuelType": "GAS", "startTime": "2026-01-01T00:00:00Z", "generation": 50},
    ], date(2026, 1, 1), date(2026, 1, 31))
    assert len(result) == 1
    assert list(result.values()) == [12.0]


def test_forecast_needs_publish_and_delivery_time():
    result = normalize_forecasts([
        {"startTime": "2026-01-01T00:00:00Z", "publishTime": "2025-12-31T10:00:00Z", "generation": 12},
        {"startTime": "bad", "publishTime": "2025-12-31T10:00:00Z", "generation": 12},
    ], date(2026, 1, 1), date(2026, 1, 31))
    assert len(result) == 1


def test_settlement_period_maps_to_utc_delivery_interval():
    result = forecast_delivery_time({"settlementDate": "2026-01-01", "settlementPeriod": 2})
    assert result.isoformat() == "2026-01-01T00:30:00+00:00"



def test_actual_settlement_period_maps_to_half_hour_delivery():
    result = normalize_actuals([
        {
            "fuelType": "WIND",
            "settlementDate": "2026-01-01",
            "settlementPeriod": 2,
            "startTime": "2026-01-01T00:00:00Z",
            "generation": 12,
        },
    ], date(2026, 1, 1), date(2026, 1, 31))
    assert list(result.keys()) == ["2026-01-01T00:30:00+00:00"]
