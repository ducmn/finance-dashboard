import React from 'react'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

const GROUP_META = {
  cash: { title: 'Cash', icon: '💷' },
  investment: { title: 'Investments', icon: '📈' },
  pension: { title: 'Pensions', icon: '🏖️' },
}

export default function AccountsList({ accounts }) {
  if (!accounts) return null
  const { cash, investment, pension, properties } = accounts.groups

  return (
    <section className="accounts">
      <h2 className="section-title">Accounts</h2>
      <div className="accounts-grid">
        <AccountGroup type="cash" items={cash} />
        <AccountGroup type="investment" items={investment} />
        <AccountGroup type="pension" items={pension} />
        <PropertyGroup items={properties} />
      </div>
    </section>
  )
}

function AccountGroup({ type, items }) {
  if (!items || items.length === 0) return null
  const total = items.reduce((s, x) => s + Number(x.value || 0), 0)
  const meta = GROUP_META[type]
  return (
    <div className="account-group">
      <div className="account-group-head">
        <span className="icon">{meta.icon}</span>
        <h3>{meta.title}</h3>
        <span className="total">{formatGbp(total)}</span>
      </div>
      <ul>
        {items.map(acc => (
          <li key={acc.id} className="account-row">
            <div className="account-row-main">
              <span className="account-name">
                {acc.name}
                {acc._live && <span className="live-badge" title={`Live from ${acc._live.provider} · fetched ${acc._live.fetched_at}`}>● LIVE</span>}
              </span>
              <span className="account-provider">
                {acc.provider}
                {acc._live && acc._live.cleared_balance != null && acc._live.cleared_balance !== acc._live.balance && (
                  <span className="live-meta"> · cleared {formatGbpPrecise(acc._live.cleared_balance)}</span>
                )}
              </span>
            </div>
            <div className="account-row-value">{formatGbpPrecise(acc.value)}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PropertyGroup({ items }) {
  if (!items || items.length === 0) return null
  const total = items.reduce((s, p) => {
    const v = Number(p.current_value || p.purchase_price || 0)
    const m = Number(p.mortgage_outstanding || 0)
    return s + (v - m)
  }, 0)
  return (
    <div className="account-group">
      <div className="account-group-head">
        <span className="icon">🏠</span>
        <h3>Property</h3>
        <span className="total">{formatGbp(total)}</span>
      </div>
      <ul>
        {items.map(prop => {
          const value = Number(prop.current_value || prop.purchase_price || 0)
          const mortgage = prop.mortgage_outstanding != null ? Number(prop.mortgage_outstanding) : null
          const equity = mortgage != null ? value - mortgage : value
          return (
            <li key={prop.id} className="account-row property-row">
              <div className="account-row-main">
                <span className="account-name">{prop.name}</span>
                <span className="account-provider">
                  {prop.type.replace('_', ' ')} · bought {formatDate(prop.purchase_date)} · paid {formatGbp(prop.purchase_price)}
                </span>
                {mortgage == null && (
                  <span className="warn">No mortgage info — set <code>mortgage_outstanding</code> in accounts.json</span>
                )}
              </div>
              <div className="account-row-value">
                {formatGbpPrecise(equity)}
                {mortgage != null && (
                  <small>{formatGbp(value)} − {formatGbp(mortgage)}</small>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
