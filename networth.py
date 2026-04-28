"""Net worth aggregation from accounts.json."""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

ACCOUNTS_PATH = Path(__file__).parent / "accounts.json"
EXAMPLE_PATH = Path(__file__).parent / "accounts.example.json"
SNAPSHOTS_DIR = Path(__file__).parent / "snapshots"


def load_accounts(apply_live: bool = True) -> dict[str, Any]:
    """Load accounts.json, falling back to accounts.example.json if missing.

    When apply_live=True, accounts whose `live_source` matches a configured
    integration get their `value` overridden from the live source, and
    properties with `value_source == "hpi"` get revalued via HM Land Registry.
    """
    path = ACCOUNTS_PATH if ACCOUNTS_PATH.exists() else EXAMPLE_PATH
    with path.open() as f:
        data = json.load(f)
    data["_source"] = path.name
    if apply_live:
        _apply_live_balances(data)
        _apply_hpi(data)
    return data


def _apply_hpi(data: dict[str, Any]) -> None:
    """Revalue properties whose value_source is 'hpi' via HM Land Registry."""
    properties = data.get("properties", [])
    if not any(p.get("value_source") == "hpi" for p in properties):
        return
    try:
        from hpi import revalue
    except ImportError:
        return
    for prop in properties:
        try:
            result = revalue(prop)
        except Exception:
            result = None
        if result is None:
            continue
        prop["_hpi"] = result
        if prop.get("value_source") == "hpi":
            prop["_stored_current_value"] = prop.get("current_value")
            prop["current_value"] = result["value"]


def _apply_live_balances(data: dict[str, Any]) -> None:
    """Override account values from live integrations where configured."""
    needs_starling = any(
        (acc.get("live_source") == "starling")
        or (isinstance(acc.get("live_source"), dict) and acc["live_source"].get("provider") == "starling")
        for acc in data.get("accounts", [])
    )
    if not needs_starling:
        return
    try:
        from starling import fetch_summary
    except ImportError:
        return
    summary = fetch_summary()
    if not summary.get("configured") or summary.get("error") or not summary.get("accounts"):
        return
    primary = summary["accounts"][0]
    primary_balance = primary["effective_balance"]
    for acc in data["accounts"]:
        ls = acc.get("live_source")
        is_starling = ls == "starling" or (isinstance(ls, dict) and ls.get("provider") == "starling")
        if not is_starling:
            continue
        acc["_stored_value"] = acc.get("value")
        acc["value"] = primary_balance
        acc["_live"] = {
            "provider": "starling",
            "balance": primary_balance,
            "cleared_balance": primary["cleared_balance"],
            "main_balance": primary.get("main_balance"),
            "spaces_total": primary.get("spaces_total"),
            "spaces": primary.get("spaces", []),
            "fetched_at": summary.get("fetched_at"),
        }


def _category_for(account: dict[str, Any]) -> str:
    """Bucket accounts into broad categories for allocation charts."""
    t = account.get("type")
    if t == "cash":
        return "Cash"
    if t == "investment":
        sub = account.get("subtype")
        if sub == "isa":
            return "ISA"
        if sub == "lisa":
            return "LISA"
        if sub == "gia":
            return "GIA"
        return "Other Investments"
    if t == "pension":
        return "Pension"
    return "Other"


def _property_equity(prop: dict[str, Any]) -> float:
    value = float(prop.get("current_value") or prop.get("purchase_price") or 0)
    mortgage = prop.get("mortgage_outstanding")
    if mortgage is None:
        return value
    return value - float(mortgage)


def compute_networth(data: dict[str, Any]) -> dict[str, Any]:
    """Compute net worth + breakdowns from accounts data."""
    accounts = data.get("accounts", [])
    properties = data.get("properties", [])
    liabilities = data.get("liabilities", [])

    by_category: dict[str, float] = {}
    by_provider: dict[str, float] = {}
    accounts_total = 0.0

    for acc in accounts:
        value = float(acc.get("value") or 0)
        accounts_total += value
        cat = _category_for(acc)
        by_category[cat] = by_category.get(cat, 0) + value
        provider = acc.get("provider", "Unknown")
        by_provider[provider] = by_provider.get(provider, 0) + value

    property_total = 0.0
    property_gross = 0.0
    property_mortgage = 0.0
    for prop in properties:
        gross = float(prop.get("current_value") or prop.get("purchase_price") or 0)
        property_gross += gross
        mortgage = prop.get("mortgage_outstanding")
        if mortgage is not None:
            property_mortgage += float(mortgage)
        property_total += _property_equity(prop)

    if property_total > 0:
        by_category["Property"] = property_total

    liability_total = sum(float(l.get("value") or 0) for l in liabilities)

    net_worth = accounts_total + property_total - liability_total

    return {
        "currency": data.get("currency", "GBP"),
        "owner": data.get("owner_display_name"),
        "as_of": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "net_worth": round(net_worth, 2),
        "totals": {
            "accounts": round(accounts_total, 2),
            "property_equity": round(property_total, 2),
            "property_gross": round(property_gross, 2),
            "property_mortgage": round(property_mortgage, 2),
            "liabilities": round(liability_total, 2),
        },
        "by_category": [
            {"category": k, "value": round(v, 2)}
            for k, v in sorted(by_category.items(), key=lambda kv: -kv[1])
        ],
        "by_provider": [
            {"provider": k, "value": round(v, 2)}
            for k, v in sorted(by_provider.items(), key=lambda kv: -kv[1])
        ],
        "source": data.get("_source", "accounts.json"),
    }


def grouped_accounts(data: dict[str, Any]) -> dict[str, list[dict[str, Any]]]:
    """Return accounts grouped by type, plus properties separately."""
    groups: dict[str, list[dict[str, Any]]] = {}
    for acc in data.get("accounts", []):
        key = acc.get("type", "other")
        groups.setdefault(key, []).append(acc)
    return {
        "cash": groups.get("cash", []),
        "investment": groups.get("investment", []),
        "pension": groups.get("pension", []),
        "properties": data.get("properties", []),
        "liabilities": data.get("liabilities", []),
    }


def save_snapshot(data: dict[str, Any]) -> dict[str, Any]:
    """Save the current net worth as a dated snapshot."""
    SNAPSHOTS_DIR.mkdir(exist_ok=True)
    nw = compute_networth(data)
    today = date.today().isoformat()
    path = SNAPSHOTS_DIR / f"{today}.json"
    snapshot = {
        "date": today,
        "net_worth": nw["net_worth"],
        "totals": nw["totals"],
        "by_category": nw["by_category"],
    }
    with path.open("w") as f:
        json.dump(snapshot, f, indent=2)
    return snapshot


def load_snapshots() -> list[dict[str, Any]]:
    if not SNAPSHOTS_DIR.exists():
        return []
    out = []
    for path in sorted(SNAPSHOTS_DIR.glob("*.json")):
        with path.open() as f:
            out.append(json.load(f))
    return out
