"""Spending analytics backed by the Starling Personal API.

Pulls feed items for the last N months, caches them in-process for ~10 minutes,
and exposes simple aggregations. Replaces the old CSV-based parser.
"""
from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

from starling import StarlingClient, StarlingError

CACHE_TTL_SECONDS = 600
_cache: dict[str, Any] = {"items": None, "fetched_at": 0, "months": 0}


def _client() -> StarlingClient | None:
    c = StarlingClient()
    return c if c.configured else None


def _all_feed_items(months: int = 12, force: bool = False) -> list[dict[str, Any]]:
    """Fetch every feed item across all Starling accounts for the last `months` months."""
    if (
        not force
        and _cache["items"] is not None
        and _cache["months"] >= months
        and time.time() - _cache["fetched_at"] < CACHE_TTL_SECONDS
    ):
        return _cache["items"]

    c = _client()
    if c is None:
        return []

    end = datetime.now(timezone.utc)
    start = end - timedelta(days=30 * months + 5)

    items: list[dict[str, Any]] = []
    try:
        accounts = c.list_accounts()
    except StarlingError:
        return []

    for acc in accounts:
        category_uid = acc.get("defaultCategory")
        if not category_uid:
            continue
        # Walk newest -> oldest in 30-day chunks. If a chunk fails (e.g. 429),
        # back off briefly and continue with the next chunk so a single rate-
        # limit hit doesn't drop the rest of the history.
        chunk_end = end
        while chunk_end > start:
            chunk_start = max(chunk_end - timedelta(days=30), start)
            try:
                page = c.get(
                    f"/api/v2/feed/account/{acc['accountUid']}/category/{category_uid}/transactions-between",
                    params={
                        "minTransactionTimestamp": _ts(chunk_start),
                        "maxTransactionTimestamp": _ts(chunk_end),
                    },
                )
            except StarlingError as err:
                if "429" in str(err):
                    time.sleep(2.0)
                # Move to the next chunk regardless rather than dropping the rest.
                chunk_end = chunk_start
                continue
            for raw in page.get("feedItems", []):
                norm = _normalize(raw)
                if norm:
                    items.append(norm)
            chunk_end = chunk_start

    items.sort(key=lambda x: x["date"])
    _cache.update({"items": items, "fetched_at": time.time(), "months": months})
    return items


def _ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


INTERNAL_SOURCES = {"INTERNAL_TRANSFER"}
INTERNAL_COUNTERPARTY_TYPES = {"CATEGORY"}  # space-to-space movements
DEFAULT_LARGE_THRESHOLD = 20000.0
DEFAULT_EXCLUDE_CATEGORIES = {"INVESTMENTS"}


def _config() -> dict[str, Any]:
    """Pull spending config from cashflow.json with sensible defaults."""
    try:
        from cashflow import load_cashflow
        data = load_cashflow()
    except Exception:
        data = {}
    cfg = data.get("spending_filters") or {}
    return {
        "exclude_amount_above": float(cfg.get("exclude_amount_above", DEFAULT_LARGE_THRESHOLD)),
        "exclude_categories": set(cfg.get("exclude_categories", list(DEFAULT_EXCLUDE_CATEGORIES))),
        "exclude_counterparties": [c.lower() for c in cfg.get("exclude_counterparties", [])],
        "category_overrides": data.get("category_overrides") or {},
        "category_budgets": data.get("category_budgets") or {},
    }


def _filter_config() -> dict[str, Any]:
    """Backward-compatible alias used by _normalize."""
    return _config()


def _apply_category_override(party: str, category: str, overrides: dict[str, Any]) -> str:
    """Reclassify a transaction's category if its counterparty matches an override pattern."""
    if not party:
        return category
    party_lower = party.lower()
    for new_category, rule in overrides.items():
        if not isinstance(rule, dict):
            continue
        for needle in rule.get("match_counterparties", []) or []:
            if needle.lower() in party_lower:
                return new_category
    return category


def _normalize(item: dict[str, Any]) -> dict[str, Any] | None:
    minor = (item.get("amount") or {}).get("minorUnits")
    if minor is None:
        return None
    if item.get("status") == "DECLINED":
        return None
    if item.get("source") in INTERNAL_SOURCES:
        return None
    if item.get("counterPartyType") in INTERNAL_COUNTERPARTY_TYPES:
        return None
    amount = minor / 100
    if item.get("direction") == "OUT":
        amount = -amount

    cfg = _config()
    if abs(amount) >= cfg["exclude_amount_above"]:
        return None
    base_category = item.get("spendingCategory") or "UNCATEGORISED"
    if base_category in cfg["exclude_categories"]:
        return None
    party = item.get("counterPartyName") or ""
    party_lower = party.lower()
    if any(needle in party_lower for needle in cfg["exclude_counterparties"]):
        return None

    category = _apply_category_override(party, base_category, cfg["category_overrides"])
    txn_time = item.get("transactionTime") or ""
    return {
        "id": item.get("feedItemUid"),
        "date": txn_time[:10],
        "datetime": txn_time,
        "party": party,
        "category": category,
        "reference": item.get("reference") or "",
        "amount": round(amount, 2),
        "status": item.get("status"),
    }


def summary(months: int = 12) -> dict[str, Any]:
    items = _all_feed_items(months)
    if not items:
        c = _client()
        return {
            "loaded": False,
            "configured": c is not None,
            "transactions": 0,
            "income": 0.0,
            "expenses": 0.0,
            "net": 0.0,
            "first_date": None,
            "last_date": None,
        }
    income = sum(i["amount"] for i in items if i["amount"] > 0)
    expenses = -sum(i["amount"] for i in items if i["amount"] < 0)
    return {
        "loaded": True,
        "configured": True,
        "transactions": len(items),
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "net": round(income - expenses, 2),
        "first_date": items[0]["date"],
        "last_date": items[-1]["date"],
    }


def monthly(months: int = 12) -> list[dict[str, Any]]:
    items = _all_feed_items(months)
    by_month: dict[str, dict[str, Any]] = {}
    for it in items:
        ym = it["date"][:7]
        bucket = by_month.setdefault(ym, {"month": ym, "income": 0.0, "expenses": 0.0, "transactions": 0})
        if it["amount"] > 0:
            bucket["income"] += it["amount"]
        else:
            bucket["expenses"] += -it["amount"]
        bucket["transactions"] += 1
    out = []
    for ym in sorted(by_month):
        b = by_month[ym]
        out.append({
            "month": b["month"],
            "income": round(b["income"], 2),
            "expenses": round(b["expenses"], 2),
            "net": round(b["income"] - b["expenses"], 2),
            "transactions": b["transactions"],
        })
    return out


def by_category(months: int = 12) -> list[dict[str, Any]]:
    items = [i for i in _all_feed_items(months) if i["amount"] < 0]
    by_cat: dict[str, dict[str, Any]] = {}
    for it in items:
        cat = it["category"]
        bucket = by_cat.setdefault(cat, {"category": cat, "total": 0.0, "transactions": 0})
        bucket["total"] += -it["amount"]
        bucket["transactions"] += 1
    out = sorted(by_cat.values(), key=lambda x: -x["total"])
    return [{"category": x["category"], "total": round(x["total"], 2), "transactions": x["transactions"]} for x in out]


def top_transactions(limit: int = 15, kind: str = "expense", months: int = 12) -> list[dict[str, Any]]:
    items = _all_feed_items(months)
    if kind == "expense":
        filt = [i for i in items if i["amount"] < 0]
        filt.sort(key=lambda x: x["amount"])
    else:
        filt = [i for i in items if i["amount"] > 0]
        filt.sort(key=lambda x: -x["amount"])
    out = []
    for it in filt[:limit]:
        out.append({
            "date": it["date"],
            "party": it["party"],
            "category": it["category"],
            "amount": it["amount"],
        })
    return out


def reload() -> dict[str, Any]:
    _all_feed_items(force=True)
    return {"loaded": True, "transactions": len(_cache["items"] or [])}


def budget_status(year: int | None = None, month: int | None = None) -> dict[str, Any]:
    """Per-category budget vs actual for the given calendar month (defaults to current).

    Includes month-to-date actual, days elapsed, expected end-of-month projection,
    and on/over status. Categories with no budget are skipped.
    """
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    cfg = _config()
    budgets_raw = cfg["category_budgets"]
    budgets = {k: float(v) for k, v in budgets_raw.items() if isinstance(v, (int, float))}
    if not budgets:
        return {"month": f"{year:04d}-{month:02d}", "budgets": []}

    items = [
        i for i in _all_feed_items(months=3)
        if i["date"][:7] == f"{year:04d}-{month:02d}" and i["amount"] < 0
    ]

    spent: dict[str, float] = {cat: 0.0 for cat in budgets}
    spent_count: dict[str, int] = {cat: 0 for cat in budgets}
    for it in items:
        cat = it["category"]
        if cat in spent:
            spent[cat] += -it["amount"]
            spent_count[cat] += 1

    if month == 12:
        next_month_first = date(year + 1, 1, 1)
    else:
        next_month_first = date(year, month + 1, 1)
    days_in_month = (next_month_first - date(year, month, 1)).days
    is_current_month = today.year == year and today.month == month
    days_elapsed = today.day if is_current_month else days_in_month

    out: list[dict[str, Any]] = []
    for cat, budget in budgets.items():
        actual = round(spent[cat], 2)
        pct = round(actual / budget * 100, 1) if budget > 0 else 0
        projected = round(actual / max(1, days_elapsed) * days_in_month, 2) if is_current_month else actual
        on_track = projected <= budget * 1.05  # 5% tolerance
        out.append({
            "category": cat,
            "budget": round(budget, 2),
            "actual": actual,
            "pct": pct,
            "transactions": spent_count[cat],
            "projected": projected,
            "on_track": on_track,
            "is_current_month": is_current_month,
            "days_elapsed": days_elapsed,
            "days_in_month": days_in_month,
        })

    out.sort(key=lambda x: -x["actual"])
    return {"month": f"{year:04d}-{month:02d}", "budgets": out}
