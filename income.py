"""Annual income overview — gross salary + gross rent → net after tax.

Combines:
- gross_salary_annual from accounts.json (user-entered)
- monthly net salary and gross rent from cashflow.json (your splits)
- projected BTL self-assessment tax from tax.py (already computed)

Net salary comes from the user's actual payroll figure rather than computing
income tax + NI from scratch — the payroll figure already accounts for
pension contributions, student loan, marriage allowance, and any tax code
adjustments that a from-scratch calc can't see.
"""
from __future__ import annotations

from typing import Any


def income_overview() -> dict[str, Any]:
    from cashflow import load_cashflow
    from networth import load_accounts
    from tax import project_btl_tax

    accounts = load_accounts(apply_live=False)
    cashflow = load_cashflow()
    tax = project_btl_tax()

    gross_salary = float(accounts.get("gross_salary_annual") or 0)

    net_salary_monthly = 0.0
    rent_monthly = 0.0
    for inc in cashflow.get("income", []):
        if inc.get("id") == "salary":
            net_salary_monthly = float(inc.get("amount", 0))
        elif inc.get("id") == "rent":
            rent_monthly = float(inc.get("amount", 0))

    net_salary_annual = round(net_salary_monthly * 12, 2)
    gross_rent_annual = round(rent_monthly * 12, 2)

    btl_tax_annual = float(tax.get("forecast", {}).get("projected_tax") or 0)
    net_rent_annual = round(gross_rent_annual - btl_tax_annual, 2)

    salary_tax_and_ni = round(gross_salary - net_salary_annual, 2)

    gross_income = round(gross_salary + gross_rent_annual, 2)
    net_income = round(net_salary_annual + net_rent_annual, 2)
    total_tax = round(gross_income - net_income, 2)
    effective_rate = round((total_tax / gross_income) * 100, 1) if gross_income > 0 else 0

    return {
        "salary": {
            "gross_annual": round(gross_salary, 2),
            "net_annual": net_salary_annual,
            "tax_and_ni_annual": salary_tax_and_ni,
            "net_monthly": round(net_salary_monthly, 2),
        },
        "rent": {
            "gross_annual": gross_rent_annual,
            "btl_tax_annual": round(btl_tax_annual, 2),
            "net_annual": net_rent_annual,
            "monthly": round(rent_monthly, 2),
        },
        "totals": {
            "gross_annual": gross_income,
            "net_annual": net_income,
            "total_tax_annual": total_tax,
            "effective_tax_rate_pct": effective_rate,
            "net_monthly": round(net_income / 12, 2),
        },
    }
