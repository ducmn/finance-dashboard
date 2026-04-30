import React, { useEffect, useState } from 'react'
import api from '../services/api'
import { formatGbp, formatGbpPrecise } from '../utils/format'

const CATEGORY_LABELS = {
  SHOPPING: 'Shopping',
  CLOTHES: 'Clothes',
  EATING_OUT: 'Eating out',
  TAKEAWAY: 'Takeaway',
  GROCERIES: 'Groceries',
  ENTERTAINMENT: 'Entertainment',
  TRANSPORT: 'Transport',
  HOLIDAYS: 'Holidays',
  FITNESS: 'Fitness',
  HOME: 'Home',
}

export default function BudgetTracker() {
  const [data, setData] = useState(null)

  useEffect(() => {
    api.getSpendingBudgets().then(setData).catch(() => setData(null))
  }, [])

  if (!data || !data.budgets?.length) return null

  const monthLabel = new Date(`${data.month}-01`).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className="budgets">
      <h2 className="section-title">
        Budgets <small>{monthLabel}{data.fallback_used && ' · current month data not yet cached'}</small>
      </h2>
      <div className="budgets-grid">
        {data.budgets.map(b => (
          <BudgetCard key={b.category} budget={b} />
        ))}
      </div>
    </section>
  )
}

function BudgetCard({ budget }) {
  const pct = Math.min(150, budget.pct)
  const overBudget = budget.actual > budget.budget
  const projectedOver = budget.is_current_month && budget.projected > budget.budget * 1.05
  const status = overBudget ? 'over' : projectedOver ? 'projected-over' : 'on-track'

  return (
    <div className={`budget-card ${status}`}>
      <div className="budget-head">
        <h3>{CATEGORY_LABELS[budget.category] || budget.category}</h3>
        <span className="budget-pct">{budget.pct.toFixed(0)}%</span>
      </div>

      <div className="budget-bar">
        <span style={{ width: `${Math.min(100, pct)}%` }} />
        {pct > 100 && <span className="budget-bar-over" style={{ width: `${pct - 100}%` }} />}
      </div>

      <div className="budget-amounts">
        <strong>{formatGbpPrecise(budget.actual)}</strong>
        <span> / {formatGbp(budget.budget)}</span>
      </div>

      {budget.is_current_month ? (
        <div className="budget-meta">
          {budget.transactions} transaction{budget.transactions === 1 ? '' : 's'} ·{' '}
          day {budget.days_elapsed}/{budget.days_in_month} ·{' '}
          {projectedOver ? (
            <span className="amount-negative">on pace for {formatGbp(budget.projected)}</span>
          ) : (
            <>on pace for {formatGbp(budget.projected)}</>
          )}
        </div>
      ) : (
        <div className="budget-meta">
          {budget.transactions} transaction{budget.transactions === 1 ? '' : 's'} ·{' '}
          {overBudget ? <span className="amount-negative">over by {formatGbp(budget.actual - budget.budget)}</span> :
            <>under by {formatGbp(budget.budget - budget.actual)}</>}
        </div>
      )}
    </div>
  )
}
