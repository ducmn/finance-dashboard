# Finance Dashboard

A personal finance dashboard for the UK: tracks **net worth, investments, property, cash flow, Starling spending, and pension forecast** in one place.

Built with **FastAPI** (Python) + **React** + **Vite** + **Chart.js**.

> **Data sources.**
> - **Starling**: live via the Personal API (balances, Spaces, full feed).
> - **Vanguard / Moneybox / Scottish Widows**: manual entry in `accounts.json` (no public retail API).
> - **Property valuation**: HM Land Registry UK House Price Index, scaled by region + property type.
> - **UK State Pension & bank holidays**: HMRC / gov.uk JSON.

---

## What it shows

- **Net worth** — total of all accounts + property − liabilities, with allocation breakdown.
- **Accounts** — Cash / Investments / Pensions, plus a Property panel with HPI-revalued figures.
- **Cash flow** — envelope-style projection over the next 12 months. Per-Space running balance, deficit warnings, recurring income/expense schedule with weekend + UK bank holiday handling.
- **Spending** — pulls every Starling feed item via the API, aggregated by month and category.
- **Pension forecast** — projects DC pots (Vanguard SIPP, workplace) to State Pension Age @ 5%/yr (FCA mid-projection), plus the State Pension forecast and 4% safe-withdrawal income.
- **Snapshots** — save a dated net-worth snapshot any time to track change over time.

## Quick start

```bash
# 1. backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 2. data — copy the example, fill in your real numbers
cp accounts.example.json accounts.json
cp cashflow.example.json cashflow.json
$EDITOR accounts.json cashflow.json   # both gitignored

# 3. Starling token — generate at developer.starlingbank.com/personal/list,
#    put in .env (gitignored)
echo "STARLING_TOKEN=eyJ..." > .env

# 4. run
python main.py                        # http://localhost:8000

# 5. frontend (only when developing — production build already in dist/)
cd frontend && npm install && npm run dev
```

## Daily use

```bash
./bin/install-launchd.sh
```

That's it — the dashboard auto-starts on every macOS login at **http://localhost:8000** and is restarted if it crashes. Logs at `/tmp/finance-dashboard.log`. Stop with `launchctl unload ~/Library/LaunchAgents/com.finance-dashboard.plist`.

**Install as a desktop / phone app (PWA):**
- Chrome / Edge / Brave: click the install icon in the URL bar.
- iPhone / iPad: Safari → Share → "Add to Home Screen".

**Reach it from your phone off-network:** the easiest path is [Tailscale](https://tailscale.com) (free for personal). Install on Mac + phone, log in on both, then `http://<mac-tailscale-name>:8000` works from anywhere.

## File schemas

### `accounts.json`
See [`accounts.example.json`](accounts.example.json). Defines accounts, properties, state pension forecast.

```jsonc
{
  "currency": "GBP",
  "state_pension": { "start_date": "YYYY-MM-DD", "weekly_amount": 0, "monthly_amount": 0, "annual_amount": 0 },
  "accounts": [
    { "id": "...", "type": "cash | investment | pension",
      "subtype": "current | savings | isa | gia | lisa | sipp | workplace_dc",
      "value": 0,
      "live_source": "starling",          // optional — overrides value with live Starling balance
      "monthly_employer_contribution": 0  // pensions only
    }
  ],
  "properties": [
    { "id": "...", "type": "residence | buy_to_let",
      "purchase_date": "YYYY-MM-DD", "purchase_price": 0, "current_value": 0,
      "value_source": "manual | hpi | purchase",
      "region": "london",                 // HPI region slug
      "property_subtype": "flat | terraced | semi-detached | detached | new-build"
    }
  ]
}
```

### `cashflow.json`
See [`cashflow.example.json`](cashflow.example.json). Defines income, expenses, transfers, and Spaces.

```jsonc
{
  "spaces": [
    { "id": "annual_bills", "name": "Annual Bills",
      "starling_uid": "...",              // optional, links to a live Starling Space balance
      "min_balance_rule": "cover_through_december" }
  ],
  "income": [
    { "id": "salary", "amount": 3000, "schedule": "monthly", "day": 25,
      "weekend_rule": "earlier_working_day | later_working_day | none",
      "split": [ { "space": "monthly_bills", "amount": 800 } ] }
  ],
  "expenses": [
    { "id": "council-tax", "amount": -200, "schedule": "monthly | annual",
      "day": 1, "month": 12,               // month required for annual
      "from_space": "monthly_bills",
      "actuals": { "2025-12": -2487.10 }   // record actual paid; overrides amount for that period
    }
  ],
  "transfers": []
}
```

## API

All endpoints under `/api`:

| Method | Path | Notes |
|---|---|---|
| GET | `/networth` | Totals + breakdown by category and provider. |
| GET | `/accounts` | All accounts grouped by type, plus properties. |
| GET | `/cashflow/events?months=6` | Dated events (income, expenses, transfers). |
| GET | `/cashflow/projection?months=12` | Per-Space running balance + deficit warnings. |
| GET | `/spending/summary?months=12` | Income / expenses / net from Starling API. |
| GET | `/spending/monthly?months=12` | Per-month cash flow. |
| GET | `/spending/categories?months=12` | Spend by Starling category. |
| GET | `/spending/top?limit=15&kind=expense&months=12` | Top transactions. |
| GET | `/pension/forecast` | DC pot projection to SPA + state pension. |
| GET | `/starling/summary` | Live Starling accounts + Spaces. |
| GET | `/starling/transactions?days=30` | Recent feed items. |
| GET | `/snapshots` | All saved net-worth snapshots. |
| POST | `/snapshots` | Save today's net worth. |
| POST | `/reload` | Force-refresh the spending cache. |

## Files & secrets

- `accounts.json` — your real account/property numbers. **Gitignored.**
- `cashflow.json` — your real income/expense schedule. **Gitignored.**
- `tax.json` — your marginal rate + HMRC self-assessment dashboard figures. **Gitignored.**
- `.env` — your Starling Personal Access Token. **Gitignored.**
- `snapshots/` — net worth history. Gitignored.
- `.cache/` — bank holiday + HPI caches. Gitignored.

## License

MIT
