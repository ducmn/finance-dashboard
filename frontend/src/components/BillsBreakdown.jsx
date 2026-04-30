import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SPACE_LABELS = {
  monthly_bills: 'Monthly bills',
  annual_bills: 'Annual bills',
  charity: 'Charity',
  clothes: 'Clothes',
  investment: 'Investment',
}

export default function BillsBreakdown() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getCashflowBills().then(setData).catch(() => setData(null))
  }, [])

  if (!data || !data.groups?.length) return null

  const featured = data.groups.filter(g => ['monthly_bills', 'annual_bills'].includes(g.space))

  return (
    <section className="bills-breakdown">
      <h2 className="section-title">Bills breakdown</h2>
      <div className="bills-grid">
        {featured.map(g => (
          <div key={g.space} className="bills-card">
            <div className="bills-head">
              <h3>{SPACE_LABELS[g.space] || g.space}</h3>
              <div className="bills-totals">
                <strong>{formatGbpPrecise(g.monthly_total)}</strong> /mo
                <small>{formatGbp(g.annual_total)} /yr</small>
              </div>
            </div>
            <ul className="bills-list">
              {g.items.map(item => (
                <li key={item.id}>
                  <span className="bills-item-name">{item.name}</span>
                  {item.schedule === 'annual' && item.month && (
                    <span className="bills-item-when">{MONTHS[item.month]}</span>
                  )}
                  <span className="bills-item-amount">
                    {formatGbpPrecise(item.amount)}
                    {item.schedule === 'annual' && (
                      <small> · {formatGbpPrecise(-item.monthly_equivalent)}/mo</small>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {g.space === 'monthly_bills' && (
              <div className="bills-reserve">
                + <strong>£42</strong> O2 roaming reserve <small>(idle in space, only used abroad)</small>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
