"""Life goals tracker — computes required monthly contribution, on-track status,
and pulls live progress from a linked account when configured.
"""
from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any

GOALS_PATH = Path(__file__).parent / "goals.json"
EXAMPLE_PATH = Path(__file__).parent / "goals.example.json"


def _load() -> dict[str, Any]:
    path = GOALS_PATH if GOALS_PATH.exists() else EXAMPLE_PATH
    with path.open() as f:
        data = json.load(f)
    data["_source"] = path.name
    return data


def _months_between(start: date, end: date) -> int:
    return max(0, (end.year - start.year) * 12 + (end.month - start.month))


def _live_balance(funding_account: str | None) -> float | None:
    if not funding_account:
        return None
    try:
        from networth import load_accounts
    except ImportError:
        return None
    data = load_accounts()
    for acc in data.get("accounts", []):
        if acc.get("id") == funding_account:
            return float(acc.get("value") or 0)
    return None


def list_goals() -> dict[str, Any]:
    data = _load()
    today = date.today()
    out = []
    for g in data.get("goals", []):
        target = float(g.get("target_amount") or 0)
        live = _live_balance(g.get("funding_account"))
        current = live if live is not None else float(g.get("current_amount") or 0)
        contribution = float(g.get("monthly_contribution") or 0)

        target_date_str = g.get("target_date")
        target_date = None
        months_left = None
        try:
            if target_date_str:
                target_date = datetime.strptime(target_date_str, "%Y-%m-%d").date()
                months_left = _months_between(today, target_date)
        except ValueError:
            pass

        gap = max(0.0, target - current)
        required = round(gap / months_left, 2) if months_left and months_left > 0 else None
        progress_pct = round((current / target) * 100, 1) if target > 0 else 0
        on_track = required is None or contribution >= required

        # Reference mode: show cost target + note, skip progress/on-track logic.
        track = g.get("track")
        if track is None:
            track = current > 0 or contribution > 0 or target_date is not None

        out.append({
            "id": g["id"],
            "name": g.get("name", g["id"]),
            "target_amount": target,
            "target_date": target_date.isoformat() if target_date else None,
            "current_amount": round(current, 2),
            "monthly_contribution": contribution,
            "funding_account": g.get("funding_account"),
            "live_balance": live is not None,
            "gap": round(gap, 2),
            "months_left": months_left,
            "required_monthly": required,
            "shortfall_per_month": (
                round(required - contribution, 2) if required is not None and contribution < required else 0
            ),
            "progress_pct": progress_pct,
            "on_track": on_track,
            "track": track,
            "note": g.get("_note"),
        })
    return {
        "goals": out,
        "today": today.isoformat(),
        "source": data.get("_source"),
    }
