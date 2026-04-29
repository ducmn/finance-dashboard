import React, { useEffect, useMemo, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

const STORAGE_KEY = 'finance-dashboard:payday-checks'

export default function PayDayPlan() {
  const [projection, setProjection] = useState(null)
  const [checked, setChecked] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
    catch { return {} }
  })

  useEffect(() => {
    api.getCashflowProjection(3).then(setProjection).catch(() => setProjection(null))
  }, [])

  const spaceMap = useMemo(
    () => Object.fromEntries((projection?.spaces || []).map(s => [s.id, s])),
    [projection],
  )

  const upcomingIncomes = useMemo(() => {
    if (!projection) return []
    const seen = new Set()
    const out = []
    for (const ev of projection.events) {
      if (ev.direction !== 'income') continue
      if (seen.has(ev.id)) continue
      seen.add(ev.id)
      out.push(ev)
      if (out.length >= 2) break
    }
    return out
  }, [projection])

  const nextWeekly = useMemo(() => {
    if (!projection) return null
    return projection.events.find(
      e => e.direction === 'transfer' && e.id === 'discretionary-weekly'
    ) || null
  }, [projection])

  if (!projection || upcomingIncomes.length === 0) return null

  const setStep = (key, val) => {
    const next = { ...checked, [key]: val }
    setChecked(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const resetEvent = (eventKey) => {
    const next = { ...checked }
    Object.keys(next).forEach(k => { if (k.startsWith(eventKey + ':')) delete next[k] })
    setChecked(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <section className="payday">
      <h2 className="section-title">Pay day plan</h2>

      {nextWeekly && (
        <div className="weekly-transfer">
          <div className="weekly-transfer-icon">→</div>
          <div className="weekly-transfer-body">
            <div className="weekly-transfer-headline">
              Every Friday: move <strong>{formatGbpPrecise(Math.abs(nextWeekly.amount))}</strong> from Discretionary to current account
            </div>
            <div className="weekly-transfer-meta">
              Next: {formatDate(nextWeekly.date)} · your weekly spending allowance
            </div>
          </div>
        </div>
      )}

      <div className="payday-grid">
        {upcomingIncomes.map(ev => {
          const eventKey = `${ev.id}:${ev.date}`
          const totalSteps = ev.splits.length
          const doneSteps = ev.splits.filter((_, i) => checked[`${eventKey}:${i}`]).length
          const allDone = doneSteps === totalSteps && totalSteps > 0
          return (
            <div key={eventKey} className={`payday-card ${allDone ? 'done' : ''}`}>
              <div className="payday-head">
                <div>
                  <div className="payday-event-name">{ev.name}</div>
                  <div className="payday-event-meta">
                    {formatDate(ev.date)} · <strong>{formatGbpPrecise(ev.amount)}</strong> lands in main
                  </div>
                </div>
                <div className="payday-progress">
                  <span>{doneSteps}/{totalSteps}</span>
                  {doneSteps > 0 && (
                    <button className="payday-reset" onClick={() => resetEvent(eventKey)} title="Clear ticks">↺</button>
                  )}
                </div>
              </div>
              <ol className="payday-steps">
                {ev.splits.map((split, i) => {
                  const space = spaceMap[split.space]
                  const stepKey = `${eventKey}:${i}`
                  const isDone = !!checked[stepKey]
                  const dest = describeDestination(space, split.space)
                  return (
                    <li key={stepKey} className={isDone ? 'done' : ''}>
                      <label>
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={e => setStep(stepKey, e.target.checked)}
                        />
                        <span className="step-amount">{formatGbpPrecise(split.amount)}</span>
                        <span className="step-arrow">→</span>
                        <span className="step-destination">{dest.name}</span>
                        {dest.kind && <span className="step-kind">{dest.kind}</span>}
                      </label>
                    </li>
                  )
                })}
              </ol>
              {allDone && <div className="payday-done-hint">All allocations done for {formatDate(ev.date)} ✓</div>}
            </div>
          )
        })}
      </div>
      <p className="cashflow-hint">Ticks persist in your browser. Hit ↺ to reset a card after the next pay day rolls in.</p>
    </section>
  )
}

function describeDestination(space, fallbackId) {
  if (!space) return { name: fallbackId, kind: null }
  const name = space.name || fallbackId
  if (space.external_destination) {
    return { name: `${space.external_destination}`, kind: `external · ${name}` }
  }
  if (space.starling_uid) {
    return { name, kind: 'Starling Space' }
  }
  return { name, kind: null }
}
