"""Buy-to-let self-assessment tax projection.

Pulls the user's marginal rate and HMRC dashboard figures from `tax.json`,
combines with rent income from `cashflow.json`, and forecasts the next
tax year's bill — using the higher of the £1,000 property allowance or
actual BTL-deductible expenses.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

TAX_PATH = Path(__file__).parent / "tax.json"
EXAMPLE_PATH = Path(__file__).parent / "tax.example.json"

UK_TAX_YEAR_START_MONTH = 4
UK_TAX_YEAR_START_DAY = 6


def _load_tax() -> dict[str, Any]:
    path = TAX_PATH if TAX_PATH.exists() else EXAMPLE_PATH
    with path.open() as f:
        data = json.load(f)
    data["_source"] = path.name
    return data


def _load_cashflow() -> dict[str, Any]:
    from cashflow import load_cashflow
    return load_cashflow()


def _tax_year_bounds(today: date | None = None) -> tuple[date, date, str]:
    """Return start, end, and label for the current UK tax year."""
    today = today or date.today()
    if (today.month, today.day) >= (UK_TAX_YEAR_START_MONTH, UK_TAX_YEAR_START_DAY):
        start_year = today.year
    else:
        start_year = today.year - 1
    start = date(start_year, UK_TAX_YEAR_START_MONTH, UK_TAX_YEAR_START_DAY)
    end = date(start_year + 1, UK_TAX_YEAR_START_MONTH, UK_TAX_YEAR_START_DAY - 1)
    label = f"{start_year}-{str(start_year + 1)[-2:]}"
    return start, end, label


def _annual_btl_rent(cashflow: dict[str, Any]) -> float:
    """Sum projected BTL rental income across a 12-month tax year."""
    total = 0.0
    for income in cashflow.get("income", []):
        if income.get("id") != "rent":
            continue
        if income.get("schedule") == "monthly":
            total += float(income.get("amount", 0)) * 12
        elif income.get("schedule") == "annual":
            total += float(income.get("amount", 0))
    return round(total, 2)


def _btl_deductible_expenses(cashflow: dict[str, Any]) -> float:
    """Sum cashflow expenses explicitly tagged `btl_deductible: true`."""
    total = 0.0
    for ex in cashflow.get("expenses", []):
        if not ex.get("btl_deductible"):
            continue
        amt = abs(float(ex.get("amount", 0)))
        if ex.get("schedule") == "monthly":
            total += amt * 12
        else:
            total += amt
    return round(total, 2)


def _days_to(d: str | None, today: date) -> int | None:
    if not d:
        return None
    try:
        target = datetime.strptime(d, "%Y-%m-%d").date()
    except ValueError:
        return None
    return (target - today).days


def project_btl_tax() -> dict[str, Any]:
    today = date.today()
    tax = _load_tax()
    cashflow = _load_cashflow()

    rate_pct = float(tax.get("marginal_rate_pct", 40))
    allowance = float(tax.get("btl_property_allowance", 1000))

    gross_rent = _annual_btl_rent(cashflow)
    actual_expenses = _btl_deductible_expenses(cashflow)
    deduction_used = max(allowance, actual_expenses)
    deduction_basis = "property_allowance" if deduction_used == allowance else "actual_expenses"
    taxable_profit = max(0.0, gross_rent - deduction_used)
    projected_tax = round(taxable_profit * rate_pct / 100, 2)

    btl_tax_allocation_monthly = _btl_tax_allocation_monthly(cashflow)
    annual_allocation = round(btl_tax_allocation_monthly * 12, 2)
    surplus = round(annual_allocation - projected_tax, 2)

    _, _, current_label = _tax_year_bounds(today)

    bill = tax.get("hmrc_bill") or {}

    return {
        "today": today.isoformat(),
        "marginal_rate_pct": rate_pct,
        "property_allowance": allowance,

        "current_tax_year": current_label,
        "hmrc": {
            "tax_year": bill.get("tax_year"),
            "amount_owed_total": bill.get("amount_owed_total"),
            "amount_paid": bill.get("amount_paid"),
            "outstanding": bill.get("outstanding"),
            "balancing_payment": bill.get("balancing_payment"),
            "first_payment_on_account": bill.get("first_payment_on_account"),
            "second_payment_on_account": bill.get("second_payment_on_account"),
            "balancing_due": bill.get("balancing_due"),
            "balancing_due_in_days": _days_to(bill.get("balancing_due"), today),
            "poa2_due": bill.get("poa2_due"),
            "poa2_due_in_days": _days_to(bill.get("poa2_due"), today),
        },

        "forecast": {
            "tax_year": current_label,
            "gross_rent": gross_rent,
            "deduction_used": deduction_used,
            "deduction_basis": deduction_basis,
            "actual_expenses_tagged": actual_expenses,
            "taxable_profit": round(taxable_profit, 2),
            "projected_tax": projected_tax,
        },

        "allocation": {
            "monthly": btl_tax_allocation_monthly,
            "annual": annual_allocation,
            "surplus_vs_forecast": surplus,
            "covers_forecast": surplus >= 0,
        },

        "source": tax.get("_source"),
    }


def _btl_tax_allocation_monthly(cashflow: dict[str, Any]) -> float:
    """Find the monthly BTL Tax allocation from the rent split, if present."""
    for income in cashflow.get("income", []):
        for split in income.get("split", []) or []:
            if split.get("space") == "btl_tax":
                return float(split.get("amount", 0))
    return 0.0


def _next_label(current: str) -> str:
    try:
        start = int(current.split("-")[0])
        return f"{start + 1}-{str(start + 2)[-2:]}"
    except (ValueError, IndexError):
        return current
