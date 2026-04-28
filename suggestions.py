"""Smart suggestions for the PayDayPlan: detects drift between the user's
fixed income splits and what the rest of the dashboard data implies.

Rules surfaced:
- Annual Bills projected to dip negative → suggest a one-off top-up.
- BTL Tax allocation under the projected tax / 12 → suggest bumping the split.
- Monthly Bills allocation under the actual sum of monthly bills → suggest bumping.
- Goal off-track with no monthly contribution → suggest a contribution amount.
- Goal off-track with some contribution but short → suggest topping up.
"""
from __future__ import annotations

from typing import Any

THRESHOLD_GBP = 5.0  # ignore drifts below this — noise


def compute_suggestions() -> dict[str, Any]:
    from cashflow import bills_breakdown, load_cashflow, project_with_live_balances
    from goals import list_goals
    from tax import project_btl_tax

    suggestions: list[dict[str, Any]] = []

    # 1. Annual Bills deficit → one-off top-up
    proj = project_with_live_balances(months=12)
    annual = next((s for s in proj.get("spaces", []) if s["id"] == "annual_bills"), None)
    if annual and annual.get("in_deficit"):
        gap = round(abs(annual["min_balance"]["value"]), 2)
        suggestions.append({
            "kind": "topup",
            "severity": "high",
            "title": f"Top up Annual Bills by £{gap:,.0f} as a one-off",
            "reason": (
                f"Projected to dip to {annual['min_balance']['value']:,.2f} on "
                f"{annual['min_balance']['date']} ({annual['min_balance'].get('event') or 'bill'}). "
                "Recurring contribution alone is enough year-on-year, but the buffer is needed to "
                "absorb the December service charge."
            ),
            "action": f"Move £{gap:,.0f} from Discretionary or Emergency to the Annual Bills space "
                      "before the next service charge lands.",
            "amount": gap,
            "space": "annual_bills",
        })

    # 2. BTL Tax allocation drift
    try:
        tax = project_btl_tax()
        forecast = float(tax["forecast"]["projected_tax"])
        recommended_monthly = round(forecast / 12, 2)
        actual_monthly = float(tax["allocation"]["monthly"])
        delta = round(recommended_monthly - actual_monthly, 2)
        if delta > THRESHOLD_GBP:
            suggestions.append({
                "kind": "adjust_split",
                "severity": "medium",
                "title": f"Bump BTL Tax allocation by £{delta:,.2f}/mo",
                "reason": (
                    f"Forecast {tax['forecast']['tax_year']} tax is £{forecast:,.2f} "
                    f"(£{recommended_monthly:,.2f}/mo) but you allocate £{actual_monthly:,.2f}/mo "
                    f"in cashflow.json."
                ),
                "action": f"Edit the rent split in cashflow.json to send £{recommended_monthly:,.2f} "
                          "to btl_tax (and reduce discretionary by the same).",
                "amount": delta,
                "space": "btl_tax",
            })
        elif delta < -THRESHOLD_GBP:
            suggestions.append({
                "kind": "adjust_split",
                "severity": "low",
                "title": f"BTL Tax allocation £{abs(delta):,.2f}/mo over-funded",
                "reason": (
                    f"Forecast {tax['forecast']['tax_year']} tax is only £{forecast:,.2f} "
                    f"(£{recommended_monthly:,.2f}/mo). You're salting away "
                    f"£{abs(delta):,.2f}/mo more than needed."
                ),
                "action": "Consider redirecting the surplus to a goal (e.g. NS&I emergency, "
                          "first-child fund) rather than parking it idle in Chase Saver.",
                "amount": delta,
                "space": "btl_tax",
            })
    except Exception:
        pass

    # 3. Monthly Bills allocation vs actual bills
    try:
        bills = bills_breakdown()
        cashflow = load_cashflow()
        monthly_total = next(
            (g["monthly_total"] for g in bills.get("groups", []) if g["space"] == "monthly_bills"),
            0.0,
        )
        salary_split = next(
            (inc.get("split") or [] for inc in cashflow.get("income", []) if inc.get("id") == "salary"),
            [],
        )
        mb_alloc = next(
            (float(s.get("amount", 0)) for s in salary_split if s.get("space") == "monthly_bills"),
            0.0,
        )
        delta = round(monthly_total - mb_alloc, 2)
        if abs(delta) > THRESHOLD_GBP:
            direction = "Bump" if delta > 0 else "Trim"
            suggestions.append({
                "kind": "adjust_split",
                "severity": "low" if delta < 0 else "medium",
                "title": f"{direction} Monthly Bills allocation by £{abs(delta):,.2f}/mo",
                "reason": (
                    f"Sum of monthly bills is £{monthly_total:,.2f}/mo but the salary split "
                    f"sends £{mb_alloc:,.2f}/mo to the space."
                ),
                "action": f"Edit the salary split in cashflow.json to allocate £{monthly_total:,.2f} "
                          "to monthly_bills.",
                "amount": delta,
                "space": "monthly_bills",
            })
    except Exception:
        pass

    # 4. Goals: off-track and under-funded
    try:
        goals = list_goals()
        for goal in goals.get("goals", []):
            if goal.get("on_track") or goal.get("required_monthly") is None:
                continue
            shortfall = goal.get("shortfall_per_month", 0)
            if shortfall <= THRESHOLD_GBP:
                continue
            suggestions.append({
                "kind": "fund_goal",
                "severity": "low",
                "title": f"Add £{shortfall:,.2f}/mo to {goal['name']}",
                "reason": (
                    f"Currently saving £{goal['monthly_contribution']:,.2f}/mo, "
                    f"need £{goal['required_monthly']:,.2f}/mo to hit £{goal['target_amount']:,.0f} "
                    f"by {goal.get('target_date')}."
                ),
                "action": "Either set monthly_contribution in goals.json once you commit, "
                          "or pull from Discretionary surplus on pay day.",
                "amount": shortfall,
                "goal": goal["id"],
            })
    except Exception:
        pass

    return {"suggestions": suggestions}
