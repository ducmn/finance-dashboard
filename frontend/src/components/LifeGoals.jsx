import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

export default function LifeGoals() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getGoals().then(setData).catch(() => setData(null))
  }, [])

  if (!data || !data.goals?.length) return null

  return (
    <section className="goals">
      <h2 className="section-title">Life goals</h2>
      <div className="goals-grid">
        {data.goals.map(g => (
          <GoalCard key={g.id} goal={g} />
        ))}
      </div>
    </section>
  )
}

function GoalCard({ goal }) {
  if (goal.track === false) return <ReferenceCard goal={goal} />

  const pct = Math.min(100, Math.max(0, goal.progress_pct))
  const status = goal.on_track ? 'on-track' : 'off-track'
  const monthsLabel = goal.months_left == null
    ? 'no date set'
    : goal.months_left === 0
      ? 'due now'
      : `${goal.months_left} months left`

  return (
    <div className={`goal-card ${status}`}>
      <div className="goal-head">
        <h3>{goal.name}</h3>
        {goal.live_balance && <span className="live-badge">● LIVE</span>}
      </div>

      <div className="goal-target">
        <span>{formatGbp(goal.target_amount)}</span>
        {goal.target_date && <span className="goal-date">by {formatDate(goal.target_date)}</span>}
      </div>

      <div className="goal-progress">
        <div className="goal-progress-bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <div className="goal-progress-meta">
          <strong>{formatGbpPrecise(goal.current_amount)}</strong>
          <span>{pct.toFixed(0)}%</span>
          <small>{monthsLabel}</small>
        </div>
      </div>

      <div className="goal-status">
        {goal.required_monthly == null ? (
          <span className="muted">Set a target date to compute required savings.</span>
        ) : goal.on_track ? (
          <span className="ok">
            ✓ On track — needs <strong>{formatGbp(goal.required_monthly)}/mo</strong>,
            currently saving {formatGbp(goal.monthly_contribution)}/mo
          </span>
        ) : (
          <span className="warn">
            Need <strong>{formatGbp(goal.required_monthly)}/mo</strong> to hit target
            ({formatGbp(goal.shortfall_per_month)}/mo more than current{' '}
            {formatGbp(goal.monthly_contribution)})
          </span>
        )}
      </div>

      {goal.note && <div className="goal-note">{goal.note}</div>}
    </div>
  )
}

function ReferenceCard({ goal }) {
  return (
    <div className="goal-card reference">
      <div className="goal-head">
        <h3>{goal.name}</h3>
        <span className="ref-tag">reference cost</span>
      </div>
      <div className="goal-target">
        <span>{formatGbp(goal.target_amount)}</span>
      </div>
      {goal.note && <div className="goal-note">{goal.note}</div>}
    </div>
  )
}
