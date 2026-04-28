import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

export default function CashflowPanel() {
  const [projection, setProjection] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.getCashflowProjection(12)
      .then(setProjection)
      .catch(err => setError(err?.message || 'Could not load cashflow projection'))
  }, [])

  if (error) {
    return (
      <section className="cashflow">
        <h2 className="section-title">Cash flow</h2>
        <div className="error">⚠️ {error}</div>
      </section>
    )
  }
  if (!projection) return null

  const risks = projection.spaces.filter(s => s.in_deficit)
  const upcoming = useMemo(() => projection.events.slice(0, 30), [projection])

  return (
    <section className="cashflow">
      <h2 className="section-title">
        Cash flow <small>{formatDate(projection.start)} → {formatDate(projection.end)}</small>
      </h2>

      {risks.length > 0 && (
        <div className="cashflow-risks">
          {risks.map(r => (
            <div key={r.id} className="risk-card">
              <span className="risk-icon">⚠</span>
              <div>
                <strong>{r.name}</strong> projected to dip to{' '}
                <span className="amount-negative">{formatGbpPrecise(r.min_balance.value)}</span>{' '}
                on <strong>{formatDate(r.min_balance.date)}</strong>
                {r.min_balance.event && <> ({r.min_balance.event})</>}.
                <div className="risk-suggestion">
                  Top up by <strong>{formatGbp(Math.abs(r.min_balance.value))}</strong> before then to keep the rule satisfied.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cashflow-spaces">
        {projection.spaces.map(s => (
          <SpaceCard key={s.id} space={s} series={projection.series[s.id] || []} />
        ))}
      </div>

      <div className="chart-card">
        <h3>Upcoming events <small>(next ~6 months)</small></h3>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Event</th>
              <th>Direction</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {upcoming.map((ev, i) => (
              <tr key={`${ev.id}-${ev.date}-${i}`}>
                <td>{formatDate(ev.date)}{ev.is_actual && <span className="actual-tag" title="Recorded actual"> ●</span>}</td>
                <td>{ev.name}</td>
                <td>
                  <span className={`tag ${directionClass(ev.direction)}`}>
                    {ev.direction}
                  </span>
                </td>
                <td className={`right ${ev.amount >= 0 ? 'amount-positive' : 'amount-negative'}`}>
                  {formatGbpPrecise(ev.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="cashflow-hint">
        Edit <code>cashflow.json</code> to update recurring amounts. Use the per-event{' '}
        <code>actuals: {`{"YYYY-MM": amount}`}</code> map to record what was actually paid in a given month.
      </p>
    </section>
  )
}

function SpaceCard({ space, series }) {
  const path = useMemo(() => sparkPath(series), [series])
  const trend = space.ending_balance - space.starting_balance
  const trendClass = trend >= 0 ? 'positive' : 'negative'
  return (
    <div className={`space-card ${space.in_deficit ? 'risk' : ''}`}>
      <div className="space-card-head">
        <h3>{space.name}</h3>
        {space.starling_uid && <span className="live-badge">● LIVE</span>}
      </div>

      <div className="space-card-body">
        <div className="space-balances">
          <div>
            <div className="info-label">Now</div>
            <div className="info-value">{formatGbpPrecise(space.starting_balance)}</div>
          </div>
          <div>
            <div className="info-label">In 12 months</div>
            <div className={`info-value ${trendClass}`}>{formatGbpPrecise(space.ending_balance)}</div>
          </div>
        </div>

        <svg viewBox="0 0 200 50" className="sparkline" preserveAspectRatio="none">
          <path d={path} fill="none" strokeWidth="1.5" />
        </svg>

        <div className="space-min">
          <span className="info-label">Lowest</span>
          <span className={space.in_deficit ? 'amount-negative' : ''}>
            {formatGbpPrecise(space.min_balance.value)} on {formatDate(space.min_balance.date)}
          </span>
        </div>

        {space.target != null && (
          <div className="space-target-row">
            target {formatGbp(space.target)}
          </div>
        )}
        {space._note && <div className="space-note">{space._note}</div>}
      </div>
    </div>
  )
}

function sparkPath(series) {
  if (!series.length) return ''
  const xs = series.map((_, i) => i)
  const ys = series.map(p => p.balance)
  const minY = Math.min(0, ...ys)
  const maxY = Math.max(0, ...ys)
  const range = maxY - minY || 1
  const w = 200
  const h = 50
  const pad = 2
  return xs
    .map((x, i) => {
      const px = pad + (x / Math.max(1, xs.length - 1)) * (w - pad * 2)
      const py = h - pad - ((ys[i] - minY) / range) * (h - pad * 2)
      return `${i === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)}`
    })
    .join(' ')
}

function directionClass(dir) {
  if (dir === 'income') return 'tag-income'
  if (dir === 'expense') return 'tag-expense'
  return 'tag-transfer'
}
