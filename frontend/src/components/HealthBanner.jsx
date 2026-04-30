import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp } from '../utils/format'

export default function HealthBanner() {
  const [data, setData] = useState(null)

  useEffect(() => {
    Promise.all([
      api.getNetworth(),
      api.getSpendingSummary(),
      api.getPaydaySuggestions(),
      api.getPensionForecast(),
    ])
      .then(([networth, spending, sugg, pension]) => {
        setData({
          networth,
          spending,
          suggestions: sugg.suggestions || [],
          pension,
        })
      })
      .catch(() => setData(null))
  }, [])

  if (!data) return null

  const { networth, spending, suggestions, pension } = data
  const high = suggestions.filter(s => s.severity === 'high')
  const medium = suggestions.filter(s => s.severity === 'medium')
  const spendingLoaded = !!spending?.loaded
  const savingsRate = spendingLoaded && spending.income > 0
    ? (spending.net / spending.income) * 100
    : null
  const retirementIncome = pension?.estimated_retirement_income?.combined_annual

  const { status, verdict } = computeVerdict({
    high: high.length,
    medium: medium.length,
    savingsRate,
    firstHigh: high[0],
    suggestions,
  })

  return (
    <section className={`health-banner ${status}`}>
      <div className="health-icon">{statusIcon(status)}</div>
      <div className="health-body">
        <div className="health-verdict">{verdict}</div>
        <div className="health-pills">
          <span className="health-pill">Net worth <strong>{formatGbp(networth.net_worth)}</strong></span>
          {savingsRate != null && (
            <span className="health-pill">
              Savings rate <strong>{savingsRate.toFixed(0)}%</strong>
              <small> · 12mo</small>
            </span>
          )}
          {retirementIncome != null && (
            <span className="health-pill">
              Retirement <strong>{formatGbp(retirementIncome)}/yr</strong>
            </span>
          )}
          {suggestions.length > 0 && (
            <span className="health-pill">
              <strong>{suggestions.length}</strong> suggestion{suggestions.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function computeVerdict({ high, medium, savingsRate, firstHigh, suggestions }) {
  // savingsRate === null means spending data couldn't be loaded — don't
  // false-flag a red 'spending more than you earn' verdict in that case.
  if (savingsRate != null && savingsRate < 10) {
    return {
      status: 'red',
      verdict: `Spending more than you earn — savings rate ${savingsRate.toFixed(0)}%. ${high > 0 ? firstHigh.title + '.' : 'Tighten up before tackling longer-term goals.'}`,
    }
  }
  if (high > 0) {
    return {
      status: 'amber',
      verdict: high === 1
        ? `${firstHigh.title}. Otherwise everything's healthy.`
        : `${high} things need attention — start with: ${firstHigh.title}.`,
    }
  }
  if (medium > 0 || (savingsRate != null && savingsRate < 20)) {
    return {
      status: 'amber',
      verdict: savingsRate != null && savingsRate < 20
        ? `Savings rate ${savingsRate.toFixed(0)}% is below target — bump it up if you can. ${suggestions.length} smaller suggestion${suggestions.length === 1 ? '' : 's'} below.`
        : `${medium} medium-priority item${medium === 1 ? '' : 's'} to look at, but nothing urgent.`,
    }
  }
  if (savingsRate == null) {
    return {
      status: 'green',
      verdict: `Net worth and accounts loaded; spending data temporarily unavailable. Nothing urgent.`,
    }
  }
  return {
    status: 'green',
    verdict: `You're in a strong position — savings rate ${savingsRate.toFixed(0)}%, all spaces solvent, retirement on track. Nothing urgent.`,
  }
}

function statusIcon(status) {
  if (status === 'green') return '✓'
  if (status === 'amber') return '!'
  return '✗'
}
