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
  const hasHmrc = hmrc.amount_owed_total != null && hmrc.amount_owed_total > 0

  return (
    <section className="btl-tax">
      <h2 className="section-title">
        BTL self-assessment tax <small>marginal rate {data.marginal_rate_pct}%</small>
      </h2>

      <div className="tax-grid">
        {hasHmrc && (
          <div className="tax-card">
            <div className="info-label">HMRC bill {hmrc.tax_year}</div>
            <div className="info-value">{formatGbp(hmrc.amount_owed_total)}</div>
            <div className="info-meta">
              paid {formatGbp(hmrc.amount_paid)} · outstanding{' '}
              <strong>{formatGbpPrecise(hmrc.outstanding)}</strong>
            </div>
            {hmrc.balancing_due && (
              <div className="info-meta">
                balancing + POA1 due <strong>{formatDate(hmrc.balancing_due)}</strong>{' '}
                <span className="countdown">({hmrc.balancing_due_in_days}d)</span>
              </div>
            )}
            {hmrc.poa2_due && (
              <div className="info-meta">
                POA2 ({formatGbp(hmrc.second_payment_on_account)}) due{' '}
                <strong>{formatDate(hmrc.poa2_due)}</strong>{' '}
                <span className="countdown">({hmrc.poa2_due_in_days}d)</span>
              </div>
            )}
          </div>
        )}

        <div className="tax-card highlight">
          <div className="info-label">Forecast {forecast.tax_year}</div>
          <div className="info-value">{formatGbp(forecast.projected_tax)}</div>
          <div className="info-meta">
            gross rent {formatGbp(forecast.gross_rent)} − {formatGbp(forecast.deduction_used)}{' '}
            ({forecast.deduction_basis === 'property_allowance' ? '£1k allowance' : 'actual expenses'})
          </div>
          <div className="info-meta">
            taxable profit {formatGbp(forecast.taxable_profit)} × {data.marginal_rate_pct}%
          </div>
        </div>

        <div className={`tax-card ${allocation.covers_forecast ? 'positive' : 'risk'}`}>
          <div className="info-label">Allocation</div>
          <div className="info-value">{formatGbpPrecise(allocation.monthly)} / mo</div>
          <div className="info-meta">
            {formatGbp(allocation.annual)} per year · {allocation.covers_forecast ? 'covers' : 'short of'} forecast by{' '}
            <strong className={allocation.surplus_vs_forecast >= 0 ? 'amount-positive' : 'amount-negative'}>
              {formatGbpPrecise(Math.abs(allocation.surplus_vs_forecast))}
            </strong>
          </div>
          {!allocation.covers_forecast && (
            <div className="info-meta">
              Bump monthly allocation to{' '}
              <strong>{formatGbpPrecise(forecast.projected_tax / 12)}</strong> to fully cover.
            </div>
          )}
        </div>
      </div>

      <p className="tax-hint">
        Tag specific cashflow expenses with <code>btl_deductible: true</code> in <code>cashflow.json</code>{' '}
        to swap out the £1,000 property allowance for actual deductible expenses when they're higher. Update HMRC figures in <code>tax.json</code>.
      </p>
    </section>
  )
}
