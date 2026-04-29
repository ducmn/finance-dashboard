import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

export default function IncomeOverview() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getIncomeOverview().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return null
  const { salary, rent, totals } = data
  if (!salary.gross_annual) return null

  return (
    <section className="income">
      <h2 className="section-title">
        Annual income <small>effective tax {totals.effective_tax_rate_pct}%</small>
      </h2>

      <div className="income-grid">
        <div className="income-card">
          <div className="info-label">Salary</div>
          <div className="income-row"><span>Gross</span><strong>{formatGbpPrecise(salary.gross_annual)}</strong></div>
          <div className="income-row muted"><span>Tax + NI</span><span>−{formatGbpPrecise(salary.tax_and_ni_annual)}</span></div>
          <div className="income-row"><span>Net</span><strong>{formatGbpPrecise(salary.net_annual)}</strong></div>
          <div className="income-meta">{formatGbpPrecise(salary.net_monthly)} / month</div>
        </div>

        <div className="income-card">
          <div className="info-label">BTL rent</div>
          <div className="income-row"><span>Gross</span><strong>{formatGbpPrecise(rent.gross_annual)}</strong></div>
          <div className="income-row muted"><span>BTL tax (forecast)</span><span>−{formatGbpPrecise(rent.btl_tax_annual)}</span></div>
          <div className="income-row"><span>Net</span><strong>{formatGbpPrecise(rent.net_annual)}</strong></div>
          <div className="income-meta">{formatGbp(rent.monthly)} / month gross</div>
        </div>

        <div className="income-card highlight">
          <div className="info-label">Total</div>
          <div className="income-row"><span>Gross</span><strong>{formatGbpPrecise(totals.gross_annual)}</strong></div>
          <div className="income-row muted"><span>All tax</span><span>−{formatGbpPrecise(totals.total_tax_annual)}</span></div>
          <div className="income-row big"><span>Net</span><strong>{formatGbpPrecise(totals.net_annual)}</strong></div>
          <div className="income-meta">{formatGbpPrecise(totals.net_monthly)} / month net</div>
        </div>
      </div>
    </section>
  )
}
