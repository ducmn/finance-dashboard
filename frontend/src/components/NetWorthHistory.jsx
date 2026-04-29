import React, { useEffect, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import api from '../services/api'
import { formatGbp, formatGbpCompact, formatDate } from '../utils/format'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip)

export default function NetWorthHistory() {
  const [snapshots, setSnapshots] = useState([])

  useEffect(() => {
    api.getSnapshots().then(setSnapshots).catch(() => setSnapshots([]))
  }, [])

  if (snapshots.length < 2) {
    return (
      <section className="networth-history">
        <h2 className="section-title">Net worth history <small>{snapshots.length} snapshot{snapshots.length === 1 ? '' : 's'}</small></h2>
        <div className="info-card">
          The dashboard auto-records a snapshot once per day. Come back tomorrow to start seeing the trend, or click <strong>＋ Snapshot</strong> in the top bar to add one now.
        </div>
      </section>
    )
  }

  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const delta = last.net_worth - first.net_worth
  const days = Math.max(
    1,
    Math.round((new Date(last.date) - new Date(first.date)) / (1000 * 60 * 60 * 24)),
  )
  // Extrapolating 1-3 days of data to a monthly run-rate gives ridiculous
  // numbers (a £100 daily blip becomes £3,000/mo). Hide the stat until
  // there's enough history for the rate to mean something.
  const MIN_DAYS_FOR_RUN_RATE = 14
  const haveEnoughDataForRunRate = days >= MIN_DAYS_FOR_RUN_RATE
  const monthlyRate = haveEnoughDataForRunRate ? (delta / days) * 30 : null

  const data = {
    labels: sorted.map(s => s.date),
    datasets: [
      {
        label: 'Net worth',
        data: sorted.map(s => s.net_worth),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99, 102, 241, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 5,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => formatGbp(ctx.parsed.y),
        },
      },
    },
    scales: {
      y: { ticks: { callback: v => formatGbpCompact(v) } },
    },
  }

  return (
    <section className="networth-history">
      <h2 className="section-title">
        Net worth history <small>{sorted.length} snapshots · {formatDate(first.date)} → {formatDate(last.date)}</small>
      </h2>

      {haveEnoughDataForRunRate && (
        <div className="networth-history-stats">
          <div className="stat-card">
            <div className="stat-label">Run-rate / month</div>
            <div className={`stat-value ${monthlyRate >= 0 ? 'positive' : 'negative'}`}>
              {monthlyRate >= 0 ? '+' : ''}{formatGbp(monthlyRate)}
            </div>
          </div>
        </div>
      )}

      <div className="chart-card">
        <div className="chart-wrapper" style={{ height: 260 }}>
          <Line data={data} options={options} />
        </div>
      </div>
    </section>
  )
}
