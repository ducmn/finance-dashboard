const gbp = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const gbpPrecise = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 2,
})

const compact = new Intl.NumberFormat('en-GB', {
  notation: 'compact',
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 1,
})

export const formatGbp = (value) => gbp.format(Number(value || 0))
export const formatGbpPrecise = (value) => gbpPrecise.format(Number(value || 0))
export const formatGbpCompact = (value) => compact.format(Number(value || 0))

export const formatPercent = (value, digits = 1) =>
  `${(Number(value || 0)).toFixed(digits)}%`

export const formatDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
