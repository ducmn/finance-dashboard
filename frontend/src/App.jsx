import React, { useEffect, useState } from 'react'
import api from './services/api'
import NetWorthHero from './components/NetWorthHero'
import NetWorthHistory from './components/NetWorthHistory'
import PayDayPlan from './components/PayDayPlan'
import AccountsList from './components/AccountsList'
import CashflowPanel from './components/CashflowPanel'
import BillsBreakdown from './components/BillsBreakdown'
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
  const [savingSnapshot, setSavingSnapshot] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [nw, acc, snaps] = await Promise.all([
        api.getNetworth(),
        api.getAccounts(),
        api.getSnapshots(),
      ])
      setNetworth(nw)
      setAccounts(acc)
      setSnapshots(snaps)
    } catch (err) {
      setError(err?.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onSaveSnapshot = async () => {
    try {
      setSavingSnapshot(true)
      await api.saveSnapshot()
      const snaps = await api.getSnapshots()
      setSnapshots(snaps)
    } finally {
      setSavingSnapshot(false)
    }
  }

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
        <div className="topbar-actions">
          <button className="btn ghost" onClick={load}>↻ Refresh</button>
          <button className="btn" onClick={onSaveSnapshot} disabled={savingSnapshot}>
            {savingSnapshot ? 'Saving…' : '＋ Snapshot'}
          </button>
        </div>
      </header>

      {error && <div className="error">⚠️ {error}</div>}
      {usingExample && (
        <div className="warn-banner">
          Using <code>accounts.example.json</code>. Create a local <code>accounts.json</code> with your real numbers
          (it's gitignored) to see your actual position.
        </div>
      )}

      <NetWorthHero networth={networth} snapshots={snapshots} />
      <NetWorthHistory />
      <PayDayPlan />
      <AccountsList accounts={accounts} />
      <CashflowPanel />
      <BillsBreakdown />
      <BtlTaxPanel />
      <LifeGoals />
      <SpendingPanel />
      <PensionForecast />

      <footer className="foot">
        Data sources: {networth?.source} · Last refreshed {new Date(networth?.as_of).toLocaleString('en-GB')}
      </footer>
    </div>
  )
}
