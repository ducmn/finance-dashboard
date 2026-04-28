"""Starling Bank Personal API client.

Reads STARLING_TOKEN from the environment (loaded via python-dotenv in main).
Docs: https://developer.starlingbank.com/personal/docs
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

API_BASE = "https://api.starlingbank.com"
TIMEOUT = 10.0


class StarlingError(RuntimeError):
    pass


class StarlingClient:
    def __init__(self, token: str | None = None):
        self.token = token or os.environ.get("STARLING_TOKEN", "").strip()

    @property
    def configured(self) -> bool:
        return bool(self.token)

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json",
            "User-Agent": "finance-dashboard/2.0",
        }

    def _get(self, path: str, params: dict | None = None) -> dict:
        if not self.configured:
            raise StarlingError("STARLING_TOKEN is not set")
        with httpx.Client(timeout=TIMEOUT) as c:
            r = c.get(f"{API_BASE}{path}", headers=self._headers(), params=params)
            if r.status_code == 401:
                raise StarlingError("Starling rejected the token (401). Regenerate it.")
            if r.status_code == 403:
                raise StarlingError("Token lacks required scopes (403).")
            r.raise_for_status()
            return r.json()

    def list_accounts(self) -> list[dict]:
        return self._get("/api/v2/accounts").get("accounts", [])

    def balance(self, account_uid: str) -> dict:
        return self._get(f"/api/v2/accounts/{account_uid}/balance")

    def feed_items_since(self, account_uid: str, category_uid: str, since: datetime) -> list[dict]:
        ts = since.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
        path = f"/api/v2/feed/account/{account_uid}/category/{category_uid}"
        return self._get(path, params={"changesSince": ts}).get("feedItems", [])


def _to_amount(minor_units: int, currency: str = "GBP") -> float:
    return round(minor_units / 100, 2)


def fetch_summary() -> dict[str, Any]:
    """Return Starling accounts with live balances. Empty when unconfigured."""
    client = StarlingClient()
    if not client.configured:
        return {"configured": False, "accounts": [], "total_balance": 0.0}

    try:
        accounts = client.list_accounts()
    except StarlingError as e:
        return {"configured": True, "error": str(e), "accounts": [], "total_balance": 0.0}

    items = []
    total = 0.0
    for acc in accounts:
        try:
            bal = client.balance(acc["accountUid"])
        except StarlingError as e:
            items.append({"account_uid": acc["accountUid"], "error": str(e)})
            continue
        eff = _to_amount(bal["effectiveBalance"]["minorUnits"])
        cleared = _to_amount(bal["clearedBalance"]["minorUnits"])
        total += eff
        items.append({
            "account_uid": acc["accountUid"],
            "default_category_uid": acc.get("defaultCategory"),
            "name": acc.get("name") or "Starling Account",
            "currency": acc.get("currency", "GBP"),
            "type": acc.get("accountType"),
            "effective_balance": eff,
            "cleared_balance": cleared,
        })

    return {
        "configured": True,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "accounts": items,
        "total_balance": round(total, 2),
    }


def fetch_recent_transactions(days: int = 30, limit: int = 50) -> dict[str, Any]:
    """Return recent feed items across all Starling accounts."""
    client = StarlingClient()
    if not client.configured:
        return {"configured": False, "transactions": []}

    since = datetime.now(timezone.utc) - timedelta(days=days)
    out: list[dict] = []
    for acc in client.list_accounts():
        items = client.feed_items_since(acc["accountUid"], acc["defaultCategory"], since)
        for item in items:
            amount = _to_amount(item["amount"]["minorUnits"])
            if item.get("direction") == "OUT":
                amount = -amount
            out.append({
                "id": item.get("feedItemUid"),
                "date": item.get("transactionTime", "")[:10],
                "party": item.get("counterPartyName", ""),
                "category": item.get("spendingCategory", "UNCATEGORISED"),
                "amount": amount,
                "reference": item.get("reference", ""),
            })

    out.sort(key=lambda x: x["date"], reverse=True)
    return {
        "configured": True,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "since": since.strftime("%Y-%m-%d"),
        "transactions": out[:limit],
    }
