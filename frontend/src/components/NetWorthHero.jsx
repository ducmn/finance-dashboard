import React from 'react'
import { formatGbp, formatGbpCompact } from '../utils/format'

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#3b82f6', '#a855f7', '#14b8a6', '#f43f5e',
]

export default function NetWorthHero({ networth }) {
  if (!networth) return null

  return (
    <section className="hero">
      <div className="hero-main">
        <div className="hero-label">Total Net Worth</div>
        <div className="hero-value">{formatGbp(networth.net_worth)}</div>
      </div>

      <div className="hero-allocation">
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
