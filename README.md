# Finance Dashboard

A personal finance dashboard for the UK: tracks **net worth, investments, cash, property, pensions and Starling spending** in one place.

Built with **FastAPI** (Python) + **React** + **Vite** + **Chart.js**.

> **Note on data sources.** Vanguard UK has no public retail API, so investment values are entered manually in `accounts.json`. Starling has a personal API but it's easier to drop your CSV statement in and re-parse it. Moneybox / Scottish Widows: manual.

---

## What it shows

- **Net worth** — total of all accounts + property equity − liabilities, with allocation breakdown.
- **Accounts** — grouped by Cash / Investments / Pensions, plus a Property panel with purchase price + current value.
- **Spending** — parses Starling CSV statements: monthly cash flow, top categories, biggest expenses.
- **Pension forecast** — projects DC pots (e.g. Vanguard SIPP, workplace) to State Pension Age using compound monthly contributions, plus the State Pension forecast.
- **Snapshots** — save a dated JSON snapshot any time so the hero shows your change since last snapshot.

## Quick start

```bash
# 1. backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. data — copy the example, fill in your real numbers
cp accounts.example.json accounts.json
$EDITOR accounts.json     # accounts.json is gitignored

# 3. (optional) drop a Starling CSV statement in the project root
#    *.csv is gitignored

# 4. run
python main.py            # http://localhost:8000

# 5. frontend (in another terminal)
cd frontend && npm install && npm run dev   # http://localhost:3000
```

Or with Docker:
```bash
docker-compose up --build
```

## `accounts.json` schema

See [`accounts.example.json`](accounts.example.json) for a full example. Key fields:

```jsonc
{
  "currency": "GBP",
  "owner_display_name": "Your name",
  "state_pension": {
    "start_date": "YYYY-MM-DD",
    "weekly_amount": 0,
    "monthly_amount": 0,
    "annual_amount": 0
  },
  "accounts": [
    { "id": "...", "name": "...", "provider": "...",
      "type": "cash | investment | pension",
      "subtype": "current | savings | isa | gia | lisa | sipp | workplace_dc",
      "value": 0.00,
      // pensions only:
      "monthly_employer_contribution": 0,
      "monthly_employee_contribution": 0
    }
  ],
  "properties": [
    { "id": "...", "name": "...",
      "type": "residence | buy_to_let",
      "purchase_date": "YYYY-MM-DD",
      "purchase_price": 0,
      "current_value": 0,
      "mortgage_outstanding": null   // null = unknown; treats full value as equity
    }
  ],
  "liabilities": []
}
```

## API

All endpoints under `/api`:

| Method | Path | Notes |
|---|---|---|
| GET | `/networth` | Totals + breakdown by category and provider. |
| GET | `/accounts` | All accounts grouped by type; properties; liabilities. |
| GET | `/spending/summary` | Income / expenses / net from Starling CSV. |
| GET | `/spending/monthly` | Per-month cash flow. |
| GET | `/spending/categories?months=12` | Spend by Starling category. |
| GET | `/spending/top?limit=15&kind=expense` | Top transactions. |
| GET | `/pension/forecast?assumed_return_pct=5` | DC pot projection to SPA + state pension. |
| GET | `/snapshots` | All saved net-worth snapshots. |
| POST | `/snapshots` | Save today's net worth as a dated JSON in `snapshots/` (gitignored). |
| POST | `/reload` | Re-detect Starling CSV file. |

## Files & secrets

- **`accounts.json`** — your real numbers. **Gitignored.**
- **`accounts.example.json`** — schema example with fake numbers. Committed.
- **`StarlingStatement_*.csv`** — Starling export. `*.csv` is gitignored.
- **`snapshots/`** — net worth history. Gitignored.
- **`financial plan.xlsx`** — your spreadsheet. `*.xlsx` is gitignored.

If you ever want to use the [Starling Personal Access Token API](https://developer.starlingbank.com/personal/list) instead of CSV exports, put the token in `.env` (gitignored) and add a fetcher; right now the dashboard only uses CSV.

## License

MIT
