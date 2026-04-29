import React, { useEffect, useState } from 'react'
import api from './services/api'
import HealthBanner from './components/HealthBanner'
import NetWorthHero from './components/NetWorthHero'
import IncomeOverview from './components/IncomeOverview'
import PayDayPlan from './components/PayDayPlan'
import SweepWaterfall from './components/SweepWaterfall'
import AccountsList from './components/AccountsList'
import BillsBreakdown from './components/BillsBreakdown'
import BudgetTracker from './components/BudgetTracker'
import BtlTaxPanel from './components/BtlTaxPanel'
import LifeGoals from './components/LifeGoals'
import SpendingPanel from './components/SpendingPanel'
import PensionForecast from './components/PensionForecast'

export default function App() {
  const [networth, setNetworth] = useState(null)
  const [accounts, setAccounts] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getNetworth(),
      api.getAccounts(),
      api.getSnapshots(),
    ])
      .then(([nw, acc, snaps]) => {
        setNetworth(nw)
        setAccounts(acc)
        setSnapshots(snaps)
      })
      .catch(err => setError(err?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="loading"><div className="spinner" /><p>Loading dashboard…</p></div>
      </div>
    )
  }

  const usingExample = networth?.source === 'accounts.example.json'

  return (
    <div className="container">
      <header className="topbar">
        <div>
          <h1>Finance Dashboard</h1>
          <p className="subtitle">Net worth, investments, spending and retirement — one place.</p>
        </div>
      </header>

      {error && <div className="error">⚠️ {error}</div>}
      {usingExample && (
        <div className="warn-banner">
          Using <code>accounts.example.json</code>. Create a local <code>accounts.json</code> with your real numbers
          (it's gitignored) to see your actual position.
        </div>
      )}

      <HealthBanner />
      <NetWorthHero networth={networth} snapshots={snapshots} />
      <IncomeOverview />
      <SweepWaterfall />
      <PayDayPlan />
      <AccountsList accounts={accounts} />
      <BillsBreakdown />
      <BtlTaxPanel />
      <LifeGoals />
      <BudgetTracker />
      <SpendingPanel />
      <PensionForecast />

      <footer className="foot">
        Data sources: {networth?.source} · Last refreshed {new Date(networth?.as_of).toLocaleString('en-GB')}
      </footer>
    </div>
  )
}
