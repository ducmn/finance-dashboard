"""Finance Dashboard - FastAPI application."""
from __future__ import annotations

from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()  # noqa: E402  must run before modules read env

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import spending
from networth import (
    auto_snapshot_if_missing,
    compute_networth,
    grouped_accounts,
    load_accounts,
    load_snapshots,
    save_snapshot,
)
from pension_forecast import forecast as pension_forecast
from starling import StarlingError, fetch_recent_transactions, fetch_summary
from cashflow import bills_breakdown, generate_events, project_with_live_balances
from tax import project_btl_tax
from goals import list_goals
from suggestions import compute_suggestions
from sweep import compute_sweep_plan
from income import income_overview

app = FastAPI(title="Finance Dashboard", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/networth")
def get_networth():
    data = load_accounts()
    auto_snapshot_if_missing(data)
    return compute_networth(data)


@app.get("/api/accounts")
def get_accounts():
    data = load_accounts()
    return {
        "currency": data.get("currency", "GBP"),
        "groups": grouped_accounts(data),
    }


@app.get("/api/spending/summary")
def get_spending_summary(months: int = 12):
    return spending.summary(months=months)


@app.get("/api/spending/monthly")
def get_spending_monthly(months: int = 12):
    return spending.monthly(months=months)


@app.get("/api/spending/categories")
def get_spending_categories(months: int = 12):
    return spending.by_category(months=months)


@app.get("/api/spending/top")
def get_top_spending(limit: int = 15, kind: str = "expense", months: int = 12):
    if kind not in ("expense", "income"):
        raise HTTPException(status_code=400, detail="kind must be 'expense' or 'income'")
    return spending.top_transactions(limit=limit, kind=kind, months=months)


@app.get("/api/spending/budgets")
def get_spending_budgets(year: Optional[int] = None, month: Optional[int] = None):
    return spending.budget_status(year=year, month=month)


@app.get("/api/pension/forecast")
def get_pension_forecast(assumed_return_pct: float = 5.0):
    return pension_forecast(load_accounts(), assumed_return_pct=assumed_return_pct)


@app.get("/api/snapshots")
def get_snapshots():
    return load_snapshots()


@app.post("/api/snapshots")
def post_snapshot():
    return save_snapshot(load_accounts())


@app.get("/api/cashflow/events")
def get_cashflow_events(months: int = 6):
    return generate_events(months=months)


@app.get("/api/cashflow/projection")
def get_cashflow_projection(months: int = 12):
    return project_with_live_balances(months=months)


@app.get("/api/cashflow/bills")
def get_cashflow_bills():
    return bills_breakdown()


@app.get("/api/tax/btl")
def get_btl_tax():
    return project_btl_tax()


@app.get("/api/goals")
def get_goals():
    return list_goals()


@app.get("/api/payday/suggestions")
def get_payday_suggestions():
    return compute_suggestions()


@app.get("/api/sweep")
def get_sweep_plan():
    return compute_sweep_plan()


@app.get("/api/income")
def get_income_overview():
    return income_overview()


@app.get("/api/starling/summary")
def get_starling_summary():
    return fetch_summary()


@app.get("/api/starling/transactions")
def get_starling_transactions(days: int = 30, limit: int = 50):
    try:
        return fetch_recent_transactions(days=days, limit=limit)
    except StarlingError as e:
        raise HTTPException(status_code=502, detail=str(e))


@app.post("/api/reload")
def reload_data():
    return spending.reload()


@app.get("/health")
def health():
    return {"status": "ok"}


# Serve the built React app last so /api/* routes win.
dist_path = Path(__file__).parent / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
