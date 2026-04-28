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

  const risks = useMemo(
    () => (projection ? projection.spaces.filter(s => s.in_deficit) : []),
    [projection],
  )

  if (error) {
    return (
      <section className="cashflow">
        <h2 className="section-title">Cash flow</h2>
        <div className="error">⚠️ {error}</div>
      </section>
    )
  }
  if (!projection) return null

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
    </section>
  )
}

function SpaceCard({ space, series }) {
  const path = useMemo(() => sparkPath(series), [series])
  const trend = space.ending_balance - space.starting_balance
  const trendClass = trend >= 0 ? 'positive' : 'negative'

  const amplitude = Math.abs(space.max_balance.value - space.min_balance.value)
  const drift = Math.abs(trend)
  // Hide the sparkline when the projection just oscillates around the
  // starting balance with no meaningful drift (e.g. Monthly Bills, Charity).
  const isCyclical = amplitude > 1 && drift / amplitude < 0.1
  const showChart = !isCyclical

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

        {showChart ? (
          <svg viewBox="0 0 200 50" className="sparkline" preserveAspectRatio="none">
            <path d={path} fill="none" strokeWidth="1.5" />
          </svg>
        ) : (
          <div className="space-cycle">
            cycles between {formatGbp(space.min_balance.value)} and {formatGbp(space.max_balance.value)} · no drift
          </div>
        )}

        {showChart && (
          <div className="space-min">
            <span className="info-label">Lowest</span>
            <span className={space.in_deficit ? 'amount-negative' : ''}>
              {formatGbpPrecise(space.min_balance.value)} on {formatDate(space.min_balance.date)}
            </span>
          </div>
        )}

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

