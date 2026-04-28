"""Cashflow projection engine.

Reads cashflow.json (or cashflow.example.json), generates dated income/expense
events for the next N months, and projects per-Space running balances. Live
Starling Space balances are used as the starting point when available.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

CASHFLOW_PATH = Path(__file__).parent / "cashflow.json"
EXAMPLE_PATH = Path(__file__).parent / "cashflow.example.json"
BANK_HOLIDAYS_URL = "https://www.gov.uk/bank-holidays.json"
CACHE_DIR = Path(__file__).parent / ".cache"
HOLIDAYS_CACHE = CACHE_DIR / "uk-bank-holidays.json"
HOLIDAYS_TTL_DAYS = 7


def load_cashflow() -> dict[str, Any]:
    path = CASHFLOW_PATH if CASHFLOW_PATH.exists() else EXAMPLE_PATH
    with path.open() as f:
        data = json.load(f)
    data["_source"] = path.name
    return data


def _fetch_uk_bank_holidays() -> set[date]:
    """Return the set of UK (England & Wales) bank holiday dates, cached for 7 days."""
    CACHE_DIR.mkdir(exist_ok=True)
    fresh = (
        HOLIDAYS_CACHE.exists()
        and (datetime.now() - datetime.fromtimestamp(HOLIDAYS_CACHE.stat().st_mtime)).days < HOLIDAYS_TTL_DAYS
    )
    payload: dict[str, Any] | None = None
    if fresh:
        try:
            payload = json.loads(HOLIDAYS_CACHE.read_text())
        except (OSError, ValueError):
            payload = None
    if payload is None:
        try:
            r = httpx.get(BANK_HOLIDAYS_URL, timeout=8.0)
            r.raise_for_status()
            payload = r.json()
            HOLIDAYS_CACHE.write_text(json.dumps(payload))
        except (httpx.HTTPError, ValueError):
            return set()
    events = (payload or {}).get("england-and-wales", {}).get("events", [])
    out: set[date] = set()
    for ev in events:
        try:
            out.add(datetime.strptime(ev["date"], "%Y-%m-%d").date())
        except (KeyError, ValueError):
            continue
    return out


def _is_working_day(d: date, holidays: set[date]) -> bool:
    return d.weekday() < 5 and d not in holidays


def _adjust_for_weekend(d: date, rule: str | None, holidays: set[date]) -> date:
    if not rule or rule == "none":
        return d
    if _is_working_day(d, holidays):
        return d
    direction = -1 if rule == "earlier_working_day" else 1
    cursor = d
    for _ in range(7):
        cursor = cursor + timedelta(days=direction)
        if _is_working_day(cursor, holidays):
            return cursor
    return d


def _safe_day_of_month(year: int, month: int, day: int) -> date:
    """Clamp a day to the last day of the month if needed (e.g. Feb 30 -> Feb 28)."""
    if month == 12:
        next_first = date(year + 1, 1, 1)
    else:
        next_first = date(year, month + 1, 1)
    last_day = (next_first - timedelta(days=1)).day
    return date(year, month, min(day, last_day))


def _ym(d: date) -> str:
    return d.strftime("%Y-%m")


def _amount_for_period(item: dict[str, Any], ym: str) -> float:
    actuals = item.get("actuals") or {}
    if ym in actuals:
        return float(actuals[ym])
    return float(item.get("amount", 0))


def _expand_event(
    item: dict[str, Any],
    direction: str,
    start: date,
    end: date,
    holidays: set[date],
) -> list[dict[str, Any]]:
    """Expand a recurring item into dated events between start and end."""
    schedule = item.get("schedule")
    weekend_rule = item.get("weekend_rule", "none")
    out: list[dict[str, Any]] = []

    if schedule == "monthly":
        day = int(item.get("day", 1))
        cursor = date(start.year, start.month, 1)
        while cursor <= end:
            target = _adjust_for_weekend(_safe_day_of_month(cursor.year, cursor.month, day), weekend_rule, holidays)
            if start <= target <= end:
                out.append(_make_event(item, target, _amount_for_period(item, _ym(target)), direction))
            if cursor.month == 12:
                cursor = date(cursor.year + 1, 1, 1)
            else:
                cursor = date(cursor.year, cursor.month + 1, 1)
    elif schedule == "annual":
        month = int(item.get("month", 1))
        day = int(item.get("day", 1))
        for year in range(start.year, end.year + 2):
            target = _adjust_for_weekend(_safe_day_of_month(year, month, day), weekend_rule, holidays)
            if start <= target <= end:
                out.append(_make_event(item, target, _amount_for_period(item, _ym(target)), direction))
    return out


def _make_event(item: dict[str, Any], on: date, amount: float, direction: str) -> dict[str, Any]:
    splits: list[dict[str, Any]] = []
    if direction == "income":
        for s in item.get("split", []) or []:
            splits.append({"space": s["space"], "amount": float(s["amount"])})
    elif direction == "expense":
        if item.get("from_space"):
            splits.append({"space": item["from_space"], "amount": amount})
    elif direction == "transfer":
        if item.get("from_space"):
            splits.append({"space": item["from_space"], "amount": amount})
        if item.get("to_space"):
            splits.append({"space": item["to_space"], "amount": -amount})

    return {
        "id": item["id"],
        "name": item.get("name", item["id"]),
        "date": on.isoformat(),
        "amount": amount,
        "direction": direction,
        "splits": splits,
        "is_actual": _ym(on) in (item.get("actuals") or {}),
    }


def generate_events(start: date | None = None, months: int = 12) -> list[dict[str, Any]]:
    data = load_cashflow()
    start = start or date.today()
    end = _add_months(start, months)
    holidays = _fetch_uk_bank_holidays()

    events: list[dict[str, Any]] = []
    for income in data.get("income", []):
        events.extend(_expand_event(income, "income", start, end, holidays))
    for expense in data.get("expenses", []):
        events.extend(_expand_event(expense, "expense", start, end, holidays))
    for transfer in data.get("transfers", []):
        events.extend(_expand_event(transfer, "transfer", start, end, holidays))

    direction_order = {"income": 0, "transfer": 1, "expense": 2}
    events.sort(
        key=lambda e: (
            e["date"],
            direction_order.get(e["direction"], 9),
            -abs(e["amount"]),
        )
    )
    return events


def _add_months(d: date, months: int) -> date:
    year = d.year + (d.month - 1 + months) // 12
    month = (d.month - 1 + months) % 12 + 1
    return _safe_day_of_month(year, month, d.day)


def project(
    start: date | None = None,
    months: int = 12,
    starting_balances: dict[str, float] | None = None,
) -> dict[str, Any]:
    """Project per-Space balances and detect risks over `months` months."""
    data = load_cashflow()
    start = start or date.today()
    end = _add_months(start, months)
    events = generate_events(start, months)

    spaces = {s["id"]: dict(s) for s in data.get("spaces", [])}
    starting_balances = starting_balances or {}

    # Initialize series with starting balance
    series: dict[str, list[dict[str, Any]]] = {}
    balances: dict[str, float] = {}
    for sid in spaces:
        bal = float(starting_balances.get(sid, 0.0))
        balances[sid] = bal
        series[sid] = [{"date": start.isoformat(), "balance": round(bal, 2)}]

    # Walk events in order and update balances
    for ev in events:
        for split in ev["splits"]:
            sid = split["space"]
            if sid not in balances:
                balances[sid] = 0.0
                spaces.setdefault(sid, {"id": sid, "name": sid})
                series[sid] = [{"date": start.isoformat(), "balance": 0.0}]
            balances[sid] += split["amount"]
            series[sid].append({
                "date": ev["date"],
                "balance": round(balances[sid], 2),
                "event": ev["name"],
                "delta": round(split["amount"], 2),
            })

    space_summaries: list[dict[str, Any]] = []
    for sid, info in spaces.items():
        points = series[sid]
        balances_only = [p["balance"] for p in points]
        min_idx, min_val = min(enumerate(balances_only), key=lambda kv: kv[1])
        max_idx, max_val = max(enumerate(balances_only), key=lambda kv: kv[1])
        end_balance = balances_only[-1] if balances_only else 0.0
        starting = points[0]["balance"] if points else 0.0
        space_summaries.append({
            "id": sid,
            "name": info.get("name", sid),
            "starling_uid": info.get("starling_uid"),
            "external_destination": info.get("external_destination"),
            "starting_balance": round(starting, 2),
            "ending_balance": round(end_balance, 2),
            "min_balance": {
                "value": round(min_val, 2),
                "date": points[min_idx]["date"],
                "event": points[min_idx].get("event"),
            },
            "max_balance": {
                "value": round(max_val, 2),
                "date": points[max_idx]["date"],
            },
            "in_deficit": min_val < 0,
            "min_balance_rule": info.get("min_balance_rule"),
            "target": info.get("target"),
            "_note": info.get("_note"),
        })

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "months": months,
        "source": data.get("_source"),
        "events": events,
        "spaces": space_summaries,
        "series": series,
    }


def project_with_live_balances(months: int = 12) -> dict[str, Any]:
    """Project starting from current Starling Space balances."""
    starting: dict[str, float] = {}
    try:
        from starling import fetch_summary
        summary = fetch_summary()
        if summary.get("configured") and summary.get("accounts"):
            cashflow = load_cashflow()
            uid_to_sid = {s.get("starling_uid"): s["id"] for s in cashflow.get("spaces", []) if s.get("starling_uid")}
            for acc in summary["accounts"]:
                # Main account → seed monthly_bills + discretionary? No — we don't know the split.
                # Just seed each Starling Space by UID.
                for space in acc.get("spaces", []):
                    sid = uid_to_sid.get(space["uid"])
                    if sid:
                        starting[sid] = float(space["saved"])
    except Exception:
        pass
    return project(months=months, starting_balances=starting)
