"""Starling CSV statement parsing and spending analytics."""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import pandas as pd


STARLING_DATE_FORMATS = ["%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"]


def _parse_dates(series: pd.Series) -> pd.Series:
    for fmt in STARLING_DATE_FORMATS:
        parsed = pd.to_datetime(series, format=fmt, errors="coerce")
        if parsed.notna().any():
            return parsed
    return pd.to_datetime(series, errors="coerce")


def find_csv_file() -> str | None:
    """Find the first Starling-style CSV statement in the project root."""
    for file in sorted(Path(".").glob("*.csv")):
        return str(file)
    return None


class StarlingStatement:
    """Parses a Starling CSV statement and derives spending insights."""

    AMOUNT_COL = "Amount (GBP)"
    BALANCE_COL = "Balance (GBP)"
    DATE_COL = "Date"
    CATEGORY_COL = "Spending Category"
    PARTY_COL = "Counter Party"

    def __init__(self, csv_path: str | None = None):
        self.csv_path = csv_path
        self.df: pd.DataFrame | None = None
        if csv_path:
            self.load(csv_path)

    @property
    def loaded(self) -> bool:
        return self.df is not None and not self.df.empty

    def load(self, csv_path: str) -> pd.DataFrame:
        if not csv_path or not os.path.exists(csv_path):
            self.df = None
            return pd.DataFrame()

        df = pd.read_csv(csv_path)
        if self.DATE_COL in df.columns:
            df["__date"] = _parse_dates(df[self.DATE_COL])
        else:
            df["__date"] = pd.NaT

        if self.AMOUNT_COL in df.columns:
            df["__amount"] = pd.to_numeric(df[self.AMOUNT_COL], errors="coerce")
        else:
            df["__amount"] = 0.0

        df = df.dropna(subset=["__amount"])
        self.df = df
        self.csv_path = csv_path
        return df

    def summary(self) -> dict[str, Any]:
        if not self.loaded:
            return {
                "loaded": False,
                "transactions": 0,
                "income": 0.0,
                "expenses": 0.0,
                "net": 0.0,
                "first_date": None,
                "last_date": None,
                "current_balance": None,
            }
        df = self.df
        income = float(df.loc[df["__amount"] > 0, "__amount"].sum())
        expenses = float(-df.loc[df["__amount"] < 0, "__amount"].sum())
        first = df["__date"].min()
        last = df["__date"].max()

        balance = None
        if self.BALANCE_COL in df.columns:
            latest = df.sort_values("__date").iloc[-1]
            try:
                balance = float(latest[self.BALANCE_COL])
            except (TypeError, ValueError):
                balance = None

        return {
            "loaded": True,
            "transactions": int(len(df)),
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "net": round(income - expenses, 2),
            "first_date": first.strftime("%Y-%m-%d") if pd.notna(first) else None,
            "last_date": last.strftime("%Y-%m-%d") if pd.notna(last) else None,
            "current_balance": round(balance, 2) if balance is not None else None,
        }

    def monthly(self) -> list[dict[str, Any]]:
        if not self.loaded:
            return []
        df = self.df.dropna(subset=["__date"]).copy()
        df["__ym"] = df["__date"].dt.to_period("M").astype(str)
        rows = []
        for ym, group in df.groupby("__ym"):
            income = float(group.loc[group["__amount"] > 0, "__amount"].sum())
            expenses = float(-group.loc[group["__amount"] < 0, "__amount"].sum())
            rows.append({
                "month": ym,
                "income": round(income, 2),
                "expenses": round(expenses, 2),
                "net": round(income - expenses, 2),
                "transactions": int(len(group)),
            })
        return sorted(rows, key=lambda r: r["month"])

    def by_category(self, months: int | None = 12) -> list[dict[str, Any]]:
        if not self.loaded or self.CATEGORY_COL not in self.df.columns:
            return []
        df = self.df[self.df["__amount"] < 0].copy()
        if months:
            cutoff = df["__date"].max() - pd.DateOffset(months=months)
            df = df[df["__date"] >= cutoff]
        out = (
            df.assign(spend=-df["__amount"])
            .groupby(self.CATEGORY_COL)["spend"]
            .agg(["sum", "count"])
            .reset_index()
            .rename(columns={self.CATEGORY_COL: "category", "sum": "total", "count": "transactions"})
            .sort_values("total", ascending=False)
        )
        return [
            {
                "category": str(row["category"]) if pd.notna(row["category"]) else "Uncategorised",
                "total": round(float(row["total"]), 2),
                "transactions": int(row["transactions"]),
            }
            for _, row in out.iterrows()
        ]

    def top_transactions(self, limit: int = 15, kind: str = "expense") -> list[dict[str, Any]]:
        if not self.loaded:
            return []
        df = self.df.copy()
        if kind == "expense":
            df = df[df["__amount"] < 0]
            df["__sortkey"] = -df["__amount"]
        else:
            df = df[df["__amount"] > 0]
            df["__sortkey"] = df["__amount"]
        df = df.sort_values("__sortkey", ascending=False).head(limit)
        out = []
        for _, row in df.iterrows():
            d = row["__date"]
            out.append({
                "date": d.strftime("%Y-%m-%d") if pd.notna(d) else "",
                "party": str(row.get(self.PARTY_COL, "")) if pd.notna(row.get(self.PARTY_COL, "")) else "",
                "category": str(row.get(self.CATEGORY_COL, "")) if pd.notna(row.get(self.CATEGORY_COL, "")) else "",
                "amount": round(float(row["__amount"]), 2),
            })
        return out
