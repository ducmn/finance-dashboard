import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

export default function PensionForecast() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getPensionForecast().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return null

  const dc = data.dc_pensions
  const inc = data.estimated_retirement_income

  return (
    <section className="pension compact">
      <h2 className="section-title">
        Retirement <small>SPA {data.state_pension_age_date} · {data.years_to_state_pension}y · @ {data.assumed_return_pct}%/yr</small>
      </h2>

      <div className="pension-row">
        <div className="pension-cell">
          <div className="info-label">DC pots today</div>
          <div className="info-value">{formatGbpPrecise(dc.current_total)}</div>
        </div>
        <div className="pension-cell highlight">
          <div className="info-label">Projected at SPA</div>
          <div className="info-value">{formatGbp(dc.projected_total_at_spa)}</div>
        </div>
        <div className="pension-cell">
          <div className="info-label">State pension</div>
          <div className="info-value">{formatGbp(data.state_pension.annual)}/yr</div>
        </div>
        <div className="pension-cell positive">
          <div className="info-label">Combined retirement income</div>
          <div className="info-value">{formatGbp(inc.combined_annual)}/yr</div>
          <div className="info-meta">≈ {formatGbp(inc.combined_monthly)}/mo (state + 4% DC)</div>
        </div>
      </div>
    </section>
  )
}
