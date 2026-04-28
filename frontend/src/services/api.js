import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

const api = {
  getNetworth: () => client.get('/networth').then(r => r.data),
  getAccounts: () => client.get('/accounts').then(r => r.data),
  getSpendingSummary: () => client.get('/spending/summary').then(r => r.data),
  getSpendingMonthly: () => client.get('/spending/monthly').then(r => r.data),
  getSpendingCategories: (months = 12) =>
    client.get(`/spending/categories?months=${months}`).then(r => r.data),
  getTopSpending: (limit = 10, kind = 'expense') =>
    client.get(`/spending/top?limit=${limit}&kind=${kind}`).then(r => r.data),
  getPensionForecast: (assumed = 5) =>
    client.get(`/pension/forecast?assumed_return_pct=${assumed}`).then(r => r.data),
  getSnapshots: () => client.get('/snapshots').then(r => r.data),
  saveSnapshot: () => client.post('/snapshots').then(r => r.data),
  getCashflowEvents: (months = 6) =>
    client.get(`/cashflow/events?months=${months}`).then(r => r.data),
  getCashflowProjection: (months = 12) =>
    client.get(`/cashflow/projection?months=${months}`).then(r => r.data),
  getBtlTax: () => client.get('/tax/btl').then(r => r.data),
}

export default api
