"""Pension forecasting: state pension countdown + DC pot growth projections."""
from __future__ import annotations

from datetime import date, datetime
from typing import Any


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def years_between(start: date, end: date) -> float:
    return (end - start).days / 365.25


def project_pot(
    current_value: float,
    monthly_contribution: float,
    years: float,
    annual_return_pct: float,
) -> float:
    """Project a defined-contribution pot forward, contributions monthly, returns monthly-compounded."""
    if years <= 0:
        return current_value
    months = int(round(years * 12))
    monthly_rate = (1 + annual_return_pct / 100) ** (1 / 12) - 1
    pot = float(current_value)
    for _ in range(months):
        pot = pot * (1 + monthly_rate) + monthly_contribution
    return pot


def forecast(data: dict[str, Any], assumed_return_pct: float = 5.0) -> dict[str, Any]:
    """Forecast pensions to state pension age."""
    today = date.today()
    state = data.get("state_pension") or {}
    spa = _parse_date(state.get("start_date"))

    years_to_spa = years_between(today, spa) if spa else None

    pension_accounts = [a for a in data.get("accounts", []) if a.get("type") == "pension"]

    projected: list[dict[str, Any]] = []
    total_now = 0.0
    total_projected = 0.0
    for acc in pension_accounts:
        current = float(acc.get("value") or 0)
        monthly = float(acc.get("monthly_employer_contribution") or 0) + float(
            acc.get("monthly_employee_contribution") or 0
        )
        future = current
        if years_to_spa is not None:
            future = project_pot(current, monthly, years_to_spa, assumed_return_pct)

        total_now += current
        total_projected += future
        projected.append({
            "id": acc.get("id"),
            "name": acc.get("name"),
            "provider": acc.get("provider"),
            "current_value": round(current, 2),
            "monthly_contribution": round(monthly, 2),
            "projected_value_at_spa": round(future, 2),
        })

    # 4% safe-withdrawal annual income from projected DC pots
    dc_annual_income = round(total_projected * 0.04, 2)
    state_annual = float(state.get("annual_amount") or 0)

    return {
        "today": today.isoformat(),
        "state_pension_age_date": spa.isoformat() if spa else None,
        "years_to_state_pension": round(years_to_spa, 1) if years_to_spa is not None else None,
        "assumed_return_pct": assumed_return_pct,
        "state_pension": {
            "weekly": state.get("weekly_amount"),
            "monthly": state.get("monthly_amount"),
            "annual": state.get("annual_amount"),
        },
        "dc_pensions": {
            "current_total": round(total_now, 2),
            "projected_total_at_spa": round(total_projected, 2),
            "items": projected,
        },
        "estimated_retirement_income": {
            "state_annual": round(state_annual, 2),
            "dc_annual_4pct_rule": dc_annual_income,
            "combined_annual": round(state_annual + dc_annual_income, 2),
            "combined_monthly": round((state_annual + dc_annual_income) / 12, 2),
        },
    }
