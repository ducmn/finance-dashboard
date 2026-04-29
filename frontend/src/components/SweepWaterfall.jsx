import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

const SWEEP_DONE_KEY = 'finance-dashboard:sweep-done'

export default function SweepWaterfall() {
  const [data, setData] = useState(null)
  const [doneMonths, setDoneMonths] = useState(() => {
    try { return JSON.parse(localStorage.getItem(SWEEP_DONE_KEY) || '{}') }
    catch { return {} }
  })

  useEffect(() => {
    api.getSweepPlan().then(setData).catch(() => setData(null))
  }, [])

  if (!data || !data.enabled) return null

  const sweepable = data.sources.some(s => s.spare > 0)
  const activePriority = data.priorities.find(p => !p.is_full && p.amount > 0)
  const monthKey = new Date().toISOString().slice(0, 7) // YYYY-MM
  const monthDone = !!doneMonths[monthKey]

  const toggleDone = () => {
    const next = { ...doneMonths, [monthKey]: !monthDone }
    if (!next[monthKey]) delete next[monthKey]
    setDoneMonths(next)
    localStorage.setItem(SWEEP_DONE_KEY, JSON.stringify(next))
  }

  return (
    <section className="sweep">
      <h2 className="section-title">
        Sweep waterfall <small>do this before pay day</small>
      </h2>

      {sweepable && activePriority && (
        <div className={`sweep-action ${monthDone ? 'done' : ''}`}>
          <label>
            <input type="checkbox" checked={monthDone} onChange={toggleDone} />
            <div>
              <div className="sweep-action-headline">
                Move <strong>{formatGbpPrecise(activePriority.amount)}</strong> to{' '}
                <strong>{activePriority.destination_name}</strong>
              </div>
              <div className="sweep-action-meta">
                Sweep {data.sources.filter(s => s.spare > 0).map(s => `${formatGbpPrecise(s.spare)} from ${prettySpace(s.space)}`).join(' + ')}.
                Best done the day before salary lands (≈24th), so the next pay day starts from a clean baseline.
                {monthDone && <> · ✓ done for {monthKey}</>}
              </div>
            </div>
          </label>
        </div>
      )}

      <div className="sweep-sources">
        <div className="sweep-sources-label">Sources</div>
        {data.sources.map(s => (
          <div key={s.space} className="sweep-source">
            <span className="sweep-source-name">{prettySpace(s.space)}</span>
            <span className="sweep-source-balance">{formatGbpPrecise(s.balance)}</span>
            <span className="sweep-source-need" title={bufferReason(s.space, s.buffer)}>
              needs {formatGbp(s.buffer)} for upcoming
            </span>
            <span className={`sweep-source-spare ${s.spare > 0 ? 'positive' : 'muted'}`}>
              {s.spare > 0 ? `+${formatGbpPrecise(s.spare)}` : 'no spare'}
            </span>
          </div>
        ))}
      </div>
      <p className="sweep-buffer-note">
        Spaces aren't swept to zero because they have upcoming obligations: Monthly Bills funds the next council-tax/internet/etc. round; Discretionary funds the next weekly £300 Friday transfer. Only the surplus above those commitments is swept. Adjust <code>min_buffer</code> in <code>cashflow.json</code> if you want to be more or less aggressive.
      </p>

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

function bufferReason(space, buffer) {
  if (space === 'monthly_bills') return `Funds next round of council tax / OVO / Hyperoptic / etc. plus £42 O2 roaming reserve`
  if (space === 'discretionary') return `Funds the next weekly £300 Friday transfer`
  return `Required safety floor`
}
