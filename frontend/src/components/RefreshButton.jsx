import React, { useEffect, useState } from 'react'
import api from '../services/api'

const STORAGE_KEY = 'finance-dashboard:last-refresh'
const THROTTLE_SECONDS = 60

export default function RefreshButton() {
  const [state, setState] = useState('idle') // idle | loading | done
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    const tick = () => {
      const last = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
      const elapsed = (Date.now() - last) / 1000
      setSecondsLeft(Math.max(0, Math.ceil(THROTTLE_SECONDS - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const onClick = async () => {
    if (state !== 'idle' || secondsLeft > 0) return
    setState('loading')
    try {
      await api.forceReload()
      localStorage.setItem(STORAGE_KEY, String(Date.now()))
      setState('done')
      setTimeout(() => window.location.reload(), 600)
    } catch {
      setState('idle')
    }
  }

  const disabled = state !== 'idle' || secondsLeft > 0
  const label = state === 'loading'
    ? 'Refreshing…'
    : state === 'done'
      ? 'Refreshed ✓'
      : secondsLeft > 0
        ? `Wait ${secondsLeft}s`
        : '↻ Refresh from Starling'

  return (
    <button
      className="refresh-btn"
      onClick={onClick}
      disabled={disabled}
      title="Force-fetch fresh data from Starling. Use after manual transfers."
    >
      {label}
    </button>
  )
}
