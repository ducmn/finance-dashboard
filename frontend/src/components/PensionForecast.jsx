import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp } from '../utils/format'

// PLSA Retirement Living Standards (single, UK 2024/25, ex-London):
//   Minimum £14,400/yr · Moderate £31,300/yr · Comfortable £43,100/yr
const COMFORTABLE = 43000
const MODERATE = 30000

export default function PensionForecast() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getPensionForecast().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return null
  const inc = data.estimated_retirement_income
  const dc = data.dc_pensions
  const total = inc.combined_annual

  let status, verdict
  if (total >= COMFORTABLE) {
    status = 'ok'
    verdict = (
      <>You'll be comfortable in retirement: <strong>{formatGbp(total)}/yr</strong> ({formatGbp(inc.combined_monthly)}/mo).</>
    )
  } else if (total >= MODERATE) {
    status = 'moderate'
    verdict = (
      <>Retirement income lands at <strong>{formatGbp(total)}/yr</strong> — moderate band, could be tighter than you'd like.</>
    )
  } else {
    status = 'risk'
    verdict = (
      <>Retirement looks light at <strong>{formatGbp(total)}/yr</strong> — consider boosting pension contributions.</>
    )
  }

  return (
    <section className="retirement">
      <h2 className="section-title">Retirement</h2>
      <div className={`btl-verdict ${status === 'ok' ? 'ok' : 'risk'}`}>
        <div className="btl-verdict-icon">{status === 'ok' ? '✓' : status === 'moderate' ? '⚠' : '✗'}</div>
        <div className="btl-verdict-body">
          <div className="btl-verdict-headline">{verdict}</div>
          <div className="btl-verdict-meta">
            State pension {formatGbp(data.state_pension.annual)}/yr from {data.state_pension_age_date} ({data.years_to_state_pension}y away)
            {' + '}DC pots projected to {formatGbp(dc.projected_total_at_spa)} @ {data.assumed_return_pct}%/yr → {formatGbp(inc.dc_annual_4pct_rule)}/yr at 4% safe-withdrawal.
          </div>
        </div>
      </div>
    </section>
  )
}
