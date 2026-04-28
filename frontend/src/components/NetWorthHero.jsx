import React from 'react'
import { formatGbp, formatGbpCompact } from '../utils/format'

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e',
]

export default function NetWorthHero({ networth, snapshots }) {
  if (!networth) return null

  const change = computeChange(networth, snapshots)
  const totals = networth.totals

  return (
    <section className="hero">
      <div className="hero-main">
        <div className="hero-label">Total Net Worth</div>
        <div className="hero-value">{formatGbp(networth.net_worth)}</div>
        {change && (
          <div className={`hero-change ${change.delta >= 0 ? 'positive' : 'negative'}`}>
            {change.delta >= 0 ? '▲' : '▼'} {formatGbp(Math.abs(change.delta))}
            <span className="hero-change-meta"> since {change.from}</span>
          </div>
        )}
      </div>

      <div className="hero-breakdown">
        <BreakdownRow label="Investments + Cash" value={totals.accounts} color={PALETTE[0]} total={networth.net_worth} />
        <BreakdownRow label="Property" value={totals.property} color={PALETTE[1]} total={networth.net_worth} />
      </div>

      <div className="hero-allocation">
        <h3>Allocation</h3>
        <AllocationBar items={networth.by_category} />
        <ul className="allocation-legend">
          {networth.by_category.map((item, i) => (
            <li key={item.category}>
              <span className="dot" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="name">{item.category}</span>
              <span className="value">{formatGbpCompact(item.value)}</span>
              <span className="pct">
                {((item.value / sumOf(networth.by_category)) * 100).toFixed(1)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function BreakdownRow({ label, value, color, total }) {
  const pct = total ? Math.abs(value / total) * 100 : 0
  return (
    <div className="breakdown-row">
      <div className="breakdown-row-head">
        <span className="dot" style={{ background: color }} />
        <span>{label}</span>
        <strong>{formatGbp(value)}</strong>
      </div>
      <div className="bar"><span style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  )
}

function AllocationBar({ items }) {
  const total = sumOf(items)
  if (!total) return null
  return (
    <div className="alloc-bar">
      {items.map((item, i) => (
        <span
          key={item.category}
          title={`${item.category}: ${formatGbpCompact(item.value)}`}
          style={{
            width: `${(item.value / total) * 100}%`,
            background: PALETTE[i % PALETTE.length],
          }}
        />
      ))}
    </div>
  )
}

function sumOf(items) {
  return items.reduce((s, x) => s + Number(x.value || 0), 0)
}

function computeChange(networth, snapshots) {
  if (!snapshots || snapshots.length === 0) return null
  const last = snapshots[snapshots.length - 1]
  return {
    delta: networth.net_worth - last.net_worth,
    from: last.date,
  }
}
