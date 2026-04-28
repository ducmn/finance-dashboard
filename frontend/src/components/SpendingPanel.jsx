import React, { useEffect, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import api from '../services/api'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

ChartJS.register(ArcElement, Tooltip, Legend)

const CATEGORY_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
  '#a855f7', '#14b8a6', '#f43f5e', '#84cc16', '#06b6d4',
  '#ec4899', '#8b5cf6',
]

export default function SpendingPanel() {
  const [summary, setSummary] = useState(null)
  const [categories, setCategories] = useState([])
  const [topExpenses, setTopExpenses] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getSpendingSummary(),
      api.getSpendingCategories(12),
      api.getTopSpending(10, 'expense'),
    ])
      .then(([s, c, t]) => {
        setSummary(s); setCategories(c); setTopExpenses(t)
      })
      .catch(err => setError(err?.message || 'Could not load spending data'))
  }, [])

  if (error) return <section className="spending"><div className="error">⚠️ {error}</div></section>
  if (!summary) return null

  if (!summary.loaded) {
    if (!summary.configured) {
      return (
        <section className="spending">
          <h2 className="section-title">Spending</h2>
          <div className="info-card">
            Starling not configured. Set <code>STARLING_TOKEN</code> in <code>.env</code> and restart the dashboard.
          </div>
        </section>
      )
    }
    return (
      <section className="spending">
        <h2 className="section-title">Spending</h2>
        <div className="info-card">
          ⏳ Starling is rate-limited or temporarily unreachable, and there's no on-disk fallback yet.
          The dashboard will auto-retry the next time you load this panel — usually fine in a minute or two.
        </div>
      </section>
    )
  }

  const savingsRate = summary.income > 0 ? (summary.net / summary.income) * 100 : 0

  return (
    <section className="spending">
      <h2 className="section-title">
        Spending <small>
          {formatDate(summary.first_date)} → {formatDate(summary.last_date)} · noise filtered
          {summary.stale && (
            <span className="stale-tag" title={`Last successful fetch ${summary.age_hours}h ago`}>
              {' · '}stale ({summary.age_hours}h old)
            </span>
          )}
        </small>
      </h2>

      <div className="spending-summary">
        <Stat label="Income" value={summary.income} positive />
        <Stat label="Expenses" value={summary.expenses} negative />
        <Stat label="Net" value={summary.net} positive={summary.net >= 0} negative={summary.net < 0} />
        <div className="stat-card">
          <div className="stat-label">Savings rate</div>
          <div className={`stat-value ${savingsRate >= 0 ? 'positive' : 'negative'}`}>
            {savingsRate.toFixed(1)}%
          </div>
        </div>
      </div>

      <div className="chart-card">
        <h3>Spending by category (last 12 months)</h3>
        <div className="chart-wrapper">
          <Doughnut data={buildCategoryData(categories)} options={doughnutOptions} />
        </div>
      </div>

      <div className="chart-card">
        <h3>Top 10 expenses</h3>
        <table className="txn-table">
          <thead>
            <tr><th>Date</th><th>Counter party</th><th>Category</th><th className="right">Amount</th></tr>
          </thead>
          <tbody>
            {topExpenses.map((t, i) => (
              <tr key={i}>
                <td>{formatDate(t.date)}</td>
                <td>{t.party}</td>
                <td><span className="tag">{t.category}</span></td>
                <td className="right amount-negative">{formatGbpPrecise(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Stat({ label, value, positive, negative }) {
  const cls = positive ? 'positive' : negative ? 'negative' : 'neutral'
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value ${cls}`}>{formatGbp(value)}</div>
    </div>
  )
}

function buildCategoryData(rows) {
  const top = rows.slice(0, 10)
  const otherTotal = rows.slice(10).reduce((s, r) => s + r.total, 0)
  const labels = top.map(r => r.category)
  const data = top.map(r => r.total)
  if (otherTotal > 0) { labels.push('Other'); data.push(otherTotal) }
  return {
    labels,
    datasets: [{
      data,
      backgroundColor: labels.map((_, i) => CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]),
      borderWidth: 0,
    }],
  }
}

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: { position: 'right', labels: { boxWidth: 12 } },
    tooltip: {
      callbacks: {
        label: ctx => `${ctx.label}: £${Number(ctx.parsed).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      },
    },
  },
}
