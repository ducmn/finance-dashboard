import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

export default function SweepWaterfall() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getSweepPlan().then(setData).catch(() => setData(null))
  }, [])

  if (!data || !data.enabled) return null

  const sweepable = data.sources.some(s => s.spare > 0)

  return (
    <section className="sweep">
      <h2 className="section-title">
        Sweep waterfall <small>£{data.spare_total.toFixed(2)} spare</small>
      </h2>

      <div className="sweep-sources">
        <div className="sweep-sources-label">Sources</div>
        {data.sources.map(s => (
          <div key={s.space} className="sweep-source">
            <span className="sweep-source-name">{prettySpace(s.space)}</span>
            <span className="sweep-source-balance">{formatGbpPrecise(s.balance)}</span>
            <span className="sweep-source-buffer">keep {formatGbp(s.buffer)}</span>
            <span className={`sweep-source-spare ${s.spare > 0 ? 'positive' : 'muted'}`}>
              {s.spare > 0 ? `+${formatGbpPrecise(s.spare)}` : 'no spare'}
            </span>
          </div>
        ))}
      </div>

      {!sweepable ? (
        <div className="sweep-empty">
          Source spaces are at or below their buffers — nothing to sweep right now.
        </div>
      ) : (
        <ol className="sweep-steps">
          {data.priorities.map((p, i) => (
            <li
              key={i}
              className={`sweep-step ${p.is_full ? 'full' : p.amount > 0 ? 'active' : 'pending'}`}
            >
              <div className="sweep-step-num">{i + 1}</div>
              <div className="sweep-step-body">
                <div className="sweep-step-head">
                  <strong>{p.destination_name}</strong>
                  {p.is_full && <span className="sweep-tag full-tag">full</span>}
                  {p.kind === 'starling_space' && <span className="sweep-tag">Starling Space</span>}
                  {p.kind === 'account' && <span className="sweep-tag">Account</span>}
                </div>
                <div className="sweep-step-progress">
                  <div className="sweep-step-bar">
                    <span style={{ width: progressPct(p) + '%' }} />
                    {p.amount > 0 && p.target != null && (
                      <span
                        className="sweep-step-bar-add"
                        style={{ width: addPct(p) + '%' }}
                      />
                    )}
                  </div>
                  <div className="sweep-step-meta">
                    {formatGbpPrecise(p.current)}
                    {p.target != null && <> / {formatGbp(p.target)}</>}
                    {p.amount > 0 && (
                      <span className="sweep-step-add"> → +{formatGbpPrecise(p.amount)}</span>
                    )}
                    {p.target == null && p.amount === 0 && !p.is_full && (
                      <span className="muted"> · open-ended</span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

function progressPct(p) {
  if (p.target == null || p.target <= 0) return p.is_full ? 100 : 5
  return Math.min(100, (p.current / p.target) * 100)
}

function addPct(p) {
  if (p.target == null || p.target <= 0) return 0
  return Math.min(100 - (p.current / p.target) * 100, (p.amount / p.target) * 100)
}

function prettySpace(id) {
  const map = {
    discretionary: 'Discretionary',
    monthly_bills: 'Monthly Bills',
    annual_bills: 'Annual Bills',
    investment: 'Investment',
    charity: 'Charity',
    clothes: 'Clothes',
    emergency: 'Emergency',
    btl_tax: 'BTL Tax',
  }
  return map[id] || id
}
