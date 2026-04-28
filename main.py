"""Finance Dashboard - FastAPI application."""
from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from data_processor import StarlingStatement, find_csv_file
from networth import (
    compute_networth,
    grouped_accounts,
    load_accounts,
    load_snapshots,
    save_snapshot,
)
from pension_forecast import forecast as pension_forecast

app = FastAPI(title="Finance Dashboard", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

statement = StarlingStatement(find_csv_file())


@app.get("/api/networth")
def get_networth():
    return compute_networth(load_accounts())


@app.get("/api/accounts")
def get_accounts():
    data = load_accounts()
    return {
        "currency": data.get("currency", "GBP"),
        "groups": grouped_accounts(data),
    }


@app.get("/api/spending/summary")
def get_spending_summary():
    return statement.summary()


@app.get("/api/spending/monthly")
def get_spending_monthly():
    return statement.monthly()


@app.get("/api/spending/categories")
def get_spending_categories(months: int = 12):
    return statement.by_category(months=months)


@app.get("/api/spending/top")
def get_top_spending(limit: int = 15, kind: str = "expense"):
    if kind not in ("expense", "income"):
        raise HTTPException(status_code=400, detail="kind must be 'expense' or 'income'")
    return statement.top_transactions(limit=limit, kind=kind)


@app.get("/api/pension/forecast")
def get_pension_forecast(assumed_return_pct: float = 5.0):
    return pension_forecast(load_accounts(), assumed_return_pct=assumed_return_pct)


@app.get("/api/snapshots")
def get_snapshots():
    return load_snapshots()


@app.post("/api/snapshots")
def post_snapshot():
    return save_snapshot(load_accounts())


@app.post("/api/reload")
def reload_csv():
    csv = find_csv_file()
    statement.load(csv) if csv else None
    return {"loaded": statement.loaded, "file": csv}


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
