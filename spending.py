"""Spending analytics backed by the Starling Personal API.

Pulls feed items for the last N months, caches them in-process for ~10 minutes,
and exposes simple aggregations. Replaces the old CSV-based parser.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
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
        # Window in 30-day chunks to stay friendly with the API.
        chunk_start = start
        while chunk_start < end:
            chunk_end = min(chunk_start + timedelta(days=30), end)
            try:
                page = c.get(
                    f"/api/v2/feed/account/{acc['accountUid']}/category/{category_uid}/transactions-between",
                    params={
                        "minTransactionTimestamp": _ts(chunk_start),
                        "maxTransactionTimestamp": _ts(chunk_end),
                    },
                )
            except StarlingError:
                break
            for raw in page.get("feedItems", []):
                norm = _normalize(raw)
                if norm:
                    items.append(norm)
            chunk_start = chunk_end

    items.sort(key=lambda x: x["date"])
    _cache.update({"items": items, "fetched_at": time.time(), "months": months})
    return items


def _ts(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


INTERNAL_SOURCES = {"INTERNAL_TRANSFER"}
INTERNAL_COUNTERPARTY_TYPES = {"CATEGORY"}  # space-to-space movements


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
    txn_time = item.get("transactionTime") or ""
    return {
        "id": item.get("feedItemUid"),
        "date": txn_time[:10],
        "datetime": txn_time,
        "party": item.get("counterPartyName") or "",
        "category": item.get("spendingCategory") or "UNCATEGORISED",
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
