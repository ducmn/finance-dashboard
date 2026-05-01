"""Sweep waterfall: compute how much spare cash sits above the buffers in
the configured source spaces, then walk a priority list of destinations
filling each to its target before moving to the next.
"""
from __future__ import annotations

from typing import Any


def compute_sweep_plan() -> dict[str, Any]:
    from cashflow import load_cashflow
    from networth import load_accounts

    cashflow = load_cashflow()
    config = cashflow.get("sweep_waterfall") or {}
    if not config.get("enabled"):
        return {"enabled": False, "sources": [], "priorities": []}

    space_balances = _live_space_balances(cashflow)
    accounts_by_id = {a.get("id"): a for a in load_accounts(apply_live=False).get("accounts", [])}

    sources = []
    spare_total = 0.0
    for src in config.get("sources", []):
        space_id = src.get("space")
        balance = float(space_balances.get(space_id, 0.0))
        buffer = float(src.get("min_buffer", 0))
        spare = max(0.0, balance - buffer)
        spare_total += spare
        sources.append({
            "space": space_id,
            "balance": round(balance, 2),
            "buffer": round(buffer, 2),
            "spare": round(spare, 2),
        })

    remaining = spare_total
    priorities = []
    for prio in config.get("priorities", []):
        kind = prio.get("kind")
        dest_id = prio.get("destination")
        target = prio.get("target")
        current = _current_value(kind, dest_id, space_balances, accounts_by_id)
        gap = (float(target) - current) if target is not None else None
        if gap is not None and gap <= 0:
            priorities.append({
                "kind": kind,
                "destination": dest_id,
                "destination_name": _destination_name(kind, dest_id, accounts_by_id, cashflow),
                "current": round(current, 2),
                "target": round(float(target), 2) if target is not None else None,
                "amount": 0.0,
                "is_full": True,
                "remaining_to_target": 0.0,
            })
            continue

        if remaining <= 0:
            priorities.append({
                "kind": kind,
                "destination": dest_id,
                "destination_name": _destination_name(kind, dest_id, accounts_by_id, cashflow),
                "current": round(current, 2),
                "target": round(float(target), 2) if target is not None else None,
                "amount": 0.0,
                "is_full": False,
                "remaining_to_target": round(gap, 2) if gap is not None else None,
            })
            continue

        amount = min(remaining, gap) if gap is not None else remaining
        priorities.append({
            "kind": kind,
            "destination": dest_id,
            "destination_name": _destination_name(kind, dest_id, accounts_by_id, cashflow),
            "current": round(current, 2),
            "target": round(float(target), 2) if target is not None else None,
            "amount": round(amount, 2),
            "is_full": gap is not None and amount >= gap,
            "remaining_to_target": round(max(0.0, gap - amount), 2) if gap is not None else None,
        })
        remaining -= amount

    return {
        "enabled": True,
        "spare_total": round(spare_total, 2),
        "sources": sources,
        "priorities": priorities,
    }


def _live_space_balances(cashflow: dict[str, Any]) -> dict[str, float]:
    """Map cashflow space ID -> live Starling balance, plus 'main_account'
    as a special id for the primary account's main balance (excluding spaces)."""
    balances: dict[str, float] = {}
    try:
        from starling import fetch_summary
        summary = fetch_summary()
        if not summary.get("configured") or not summary.get("accounts"):
            return balances
        uid_to_sid = {
            s.get("starling_uid"): s["id"]
            for s in cashflow.get("spaces", [])
            if s.get("starling_uid")
        }
        for acc in summary["accounts"]:
            main = acc.get("main_balance")
            if main is not None:
                balances["main_account"] = float(main)
            for space in acc.get("spaces", []):
                sid = uid_to_sid.get(space["uid"])
                if sid:
                    balances[sid] = float(space["saved"])
    except Exception:
        pass
    return balances


def _current_value(
    kind: str,
    dest_id: str,
    space_balances: dict[str, float],
    accounts_by_id: dict[str, Any],
) -> float:
    if kind == "starling_space":
        return float(space_balances.get(dest_id, 0.0))
    if kind == "account":
        acc = accounts_by_id.get(dest_id)
        if acc:
            return float(acc.get("value") or 0)
    return 0.0


def _destination_name(
    kind: str,
    dest_id: str,
    accounts_by_id: dict[str, Any],
    cashflow: dict[str, Any],
) -> str:
    if kind == "starling_space":
        for s in cashflow.get("spaces", []):
            if s["id"] == dest_id:
                return s.get("name") or dest_id
    if kind == "account":
        acc = accounts_by_id.get(dest_id)
        if acc:
            return acc.get("name") or dest_id
    return dest_id
