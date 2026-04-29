import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise, formatDate } from '../utils/format'

export default function BtlTaxPanel() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getBtlTax().then(setData).catch(() => setData(null))
  }, [])

  if (!data) return null

  const { hmrc, forecast, allocation } = data
  const covers = allocation.covers_forecast
  const surplus = allocation.surplus_vs_forecast

  return (
    <section className="btl-tax">
      <h2 className="section-title">BTL self-assessment tax</h2>
      <div className={`btl-verdict ${covers ? 'ok' : 'risk'}`}>
        <div className="btl-verdict-icon">{covers ? '✓' : '⚠'}</div>
        <div className="btl-verdict-body">
          <div className="btl-verdict-headline">
            {covers ? (
              <>Your <strong>{formatGbpPrecise(allocation.monthly)}/mo</strong> allocation covers the forecast — surplus <strong>{formatGbp(Math.abs(surplus))}/yr</strong>.</>
            ) : (
              <>Your <strong>{formatGbpPrecise(allocation.monthly)}/mo</strong> allocation falls short of the forecast by <strong>{formatGbp(Math.abs(surplus))}/yr</strong>.</>
            )}
          </div>
          <div className="btl-verdict-meta">
            Forecast {forecast.tax_year}: gross rent {formatGbp(forecast.gross_rent)} − £1k allowance × 40% ={' '}
            <strong>{formatGbp(forecast.projected_tax)}/yr</strong>
            {hmrc.outstanding > 0 && (
              <> · HMRC outstanding {formatGbpPrecise(hmrc.outstanding)} due {formatDate(hmrc.balancing_due)} ({hmrc.balancing_due_in_days}d)</>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
