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
            <div className="account-row-stack">
              <div className="account-row-head">
                <div className="account-row-main">
                  <span className="account-name">
                    {acc.name}
                    {acc._live && (
                      <span className="live-badge" title={`Live from ${acc._live.provider} · fetched ${acc._live.fetched_at}`}>● LIVE</span>
                    )}
                  </span>
                  <span className="account-provider">
                    {acc.provider}
                    {acc._live?.main_balance != null && (
                      <span className="live-meta">
                        {' · main '}{formatGbpPrecise(acc._live.main_balance)}
                        {acc._live.spaces_total > 0 && <> · spaces {formatGbpPrecise(acc._live.spaces_total)}</>}
                      </span>
                    )}
                  </span>
                </div>
                <div className="account-row-value">{formatGbpPrecise(acc.value)}</div>
              </div>
              {acc._live?.spaces?.length > 0 && (
                <ul className="spaces-list">
                  {acc._live.spaces
                    .filter(s => s.saved > 0 || (s.target != null && s.target > 0))
                    .sort((a, b) => b.saved - a.saved)
                    .map(s => (
                      <li key={s.uid}>
                        <span className="space-name">{s.name}</span>
                        <span className="space-saved">{formatGbpPrecise(s.saved)}</span>
                        {s.target != null && (
                          <span className="space-target">
                            <span className="space-bar"><span style={{ width: `${Math.min(100, s.percent || 0)}%` }} /></span>
                            <small>of {formatGbpPrecise(s.target)}</small>
                          </span>
                        )}
                      </li>
                    ))}
                </ul>
              )}
            </div>
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
          const hpi = prop._hpi
          const hpiActive = prop.value_source === 'hpi' && hpi
          return (
            <li key={prop.id} className="account-row property-row">
              <div className="account-row-main">
                <span className="account-name">
                  {prop.name}
                  {hpiActive && (
                    <span
                      className={`hpi-badge ${hpi.delta_pct >= 0 ? 'positive' : 'negative'}`}
                      title={`HPI ${hpi.region} (${hpi.subtype_key}) · ${hpi.bought_at} → ${hpi.as_of}`}
                    >
                      HPI {hpi.delta_pct >= 0 ? '+' : ''}{hpi.delta_pct.toFixed(2)}%
                    </span>
                  )}
                </span>
                <span className="account-provider">
                  {prop.type.replace('_', ' ')} · bought {formatDate(prop.purchase_date)} · paid {formatGbp(prop.purchase_price)}
                  {hpiActive && (
                    <> · revalued {hpi.as_of} via Land Registry HPI ({hpi.region})</>
                  )}
                </span>
                {mortgage == null && (
                  <span className="warn">Set <code>mortgage_outstanding</code> in accounts.json (currently treated as full equity)</span>
                )}
              </div>
              <div className="account-row-value">
                {formatGbpPrecise(equity)}
                {mortgage != null ? (
                  <small>{formatGbp(value)} − {formatGbp(mortgage)}</small>
                ) : hpiActive ? (
                  <small>was {formatGbp(prop.purchase_price)}</small>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
