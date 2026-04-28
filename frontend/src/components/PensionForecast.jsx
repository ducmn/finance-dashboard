import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

export default function PensionForecast() {
  const [data, setData] = useState(null)
  const [returnPct, setReturnPct] = useState(5)

  useEffect(() => {
    api.getPensionForecast(returnPct).then(setData).catch(() => setData(null))
  }, [returnPct])

  if (!data) return null

  const dc = data.dc_pensions
  const inc = data.estimated_retirement_income

  return (
    <section className="pension">
      <h2 className="section-title">Pension Forecast</h2>

      <div className="pension-grid">
        <div className="info-card big">
          <div className="info-label">UK State Pension begins</div>
          <div className="info-value">{data.state_pension_age_date}</div>
          <div className="info-meta">{data.years_to_state_pension} years away</div>
        </div>
        <div className="info-card">
          <div className="info-label">State pension (today's £)</div>
          <div className="info-value">{formatGbp(data.state_pension.annual)}</div>
          <div className="info-meta">{formatGbpPrecise(data.state_pension.weekly)} / week</div>
        </div>
        <div className="info-card">
          <div className="info-label">DC pots today</div>
          <div className="info-value">{formatGbp(dc.current_total)}</div>
        </div>
        <div className="info-card highlight">
          <div className="info-label">Projected DC pots at SPA</div>
          <div className="info-value">{formatGbp(dc.projected_total_at_spa)}</div>
          <div className="info-meta">@ {data.assumed_return_pct}% / year</div>
        </div>
      </div>

      <div className="pension-controls">
        <label>
          Assumed annual return:
          <input
            type="range"
            min="0"
            max="10"
            step="0.5"
            value={returnPct}
            onChange={e => setReturnPct(parseFloat(e.target.value))}
          />
          <span>{returnPct.toFixed(1)}%</span>
        </label>
      </div>

      <div className="chart-card">
        <h3>Per-pot projection</h3>
        <table className="txn-table">
          <thead>
            <tr>
              <th>Pension</th>
              <th>Provider</th>
              <th className="right">Today</th>
              <th className="right">Monthly contribution</th>
              <th className="right">Projected at SPA</th>
            </tr>
          </thead>
          <tbody>
            {dc.items.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.provider}</td>
                <td className="right">{formatGbpPrecise(item.current_value)}</td>
                <td className="right">{formatGbpPrecise(item.monthly_contribution)}</td>
                <td className="right strong">{formatGbp(item.projected_value_at_spa)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="info-card retirement-income">
        <div className="info-label">Estimated retirement income (state + 4% rule on DC pots)</div>
        <div className="info-value big-number">{formatGbp(inc.combined_annual)} / year</div>
        <div className="info-meta">
          ≈ {formatGbp(inc.combined_monthly)} / month — state {formatGbp(inc.state_annual)} + DC {formatGbp(inc.dc_annual_4pct_rule)}
        </div>
      </div>
    </section>
  )
}
