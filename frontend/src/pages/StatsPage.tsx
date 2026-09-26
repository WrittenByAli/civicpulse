import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ApiError, getStats } from '../api/client'
import type { StatsResponse } from '../types/api'

const CATEGORY_COLORS: Record<string, string> = {
  water: '#3b82f6',
  electricity: '#f59e0b',
  sanitation: '#10b981',
  roads: '#8b5cf6',
  streetlights: '#f97316',
  other: '#94a3b8',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  normal: '#f59e0b',
  low: '#10b981',
}

const STATUS_STYLES: Record<string, { bg: string; text: string; indicator: string; border: string }> = {
  open: { bg: 'bg-blue-50', text: 'text-blue-700', indicator: 'bg-blue-500', border: 'border-blue-200' },
  in_progress: { bg: 'bg-amber-50', text: 'text-amber-700', indicator: 'bg-amber-500', border: 'border-amber-200' },
  resolved: { bg: 'bg-emerald-50', text: 'text-emerald-700', indicator: 'bg-emerald-500', border: 'border-emerald-200' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', indicator: 'bg-red-500', border: 'border-red-200' },
}

function DonutChart({
  data,
  size = 180,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const strokeWidth = 28
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const cx = size / 2
  const cy = size / 2

  let offset = 0

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d) => {
        const pct = d.value / total
        const dashLength = pct * circumference
        const currentOffset = offset
        offset += dashLength
        return (
          <circle
            key={d.label}
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={d.color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
            strokeDashoffset={-currentOffset}
            transform={`rotate(-90 ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        )
      })}
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-900 text-3xl font-bold">
        {total}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-slate-500 text-xs">
        Total
      </text>
    </svg>
  )
}

function ChartLegend({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2.5">
            <span className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-slate-600 capitalize">{d.label.replace('_', ' ')}</span>
          </div>
          <span className="text-slate-900 font-medium tabular-nums">
            {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
          </span>
        </div>
      ))}
    </div>
  )
}

function BarRow({
  label,
  count,
  total,
  color,
  delay,
}: {
  label: string
  count: number
  total: number
  color: string
  delay: number
}) {
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-sm text-slate-600 capitalize">
        {label.replace('_', ' ')}
      </span>
      <div className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums text-slate-500">
        {count}
      </span>
    </div>
  )
}

export function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [cacheHeader, setCacheHeader] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data, cacheHeader: ch } = await getStats()
      setStats(data)
      setCacheHeader(ch)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load stats.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-civic-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!stats) return null

  const isHit = cacheHeader?.toUpperCase().includes('HIT')

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Statistics</h1>
          <p className="page-subtitle">Detailed analytics and system statistics.</p>
        </div>
        <div className="flex items-center gap-3">
          {cacheHeader != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
                          text-xs font-semibold ${
                isHit
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
              data-testid="cache-badge"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                isHit ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
              Cache: {isHit ? 'HIT' : 'MISS'}
            </span>
          )}
          <button onClick={() => void load()} className="btn-ghost text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2">
              <path d="M1 4v6h6M23 20v-6h-6" />
              <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(stats.by_status).map(([st, count], i) => {
          const style = STATUS_STYLES[st]
          return (
            <motion.div
              key={st}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`card border-l-4 p-5 ${style?.border ?? 'border-slate-200'}`}
            >
              <p className="text-3xl font-bold tabular-nums text-slate-900">{count}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${style?.indicator ?? 'bg-slate-400'}`} />
                <span className="text-sm text-slate-500 capitalize">{st.replace('_', ' ')}</span>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Category — Donut */}
        <div className="card p-6">
          <h2 className="section-title mb-6">By Category</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart
              data={Object.entries(stats.by_category).map(([k, v]) => ({
                label: k,
                value: v,
                color: CATEGORY_COLORS[k] ?? '#94a3b8',
              }))}
            />
            <div className="flex-1 w-full">
              <ChartLegend
                data={Object.entries(stats.by_category).map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: CATEGORY_COLORS[k] ?? '#94a3b8',
                }))}
              />
            </div>
          </div>
        </div>

        {/* By Priority — Donut */}
        <div className="card p-6">
          <h2 className="section-title mb-6">By Priority</h2>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <DonutChart
              data={Object.entries(stats.by_priority).map(([k, v]) => ({
                label: k,
                value: v,
                color: PRIORITY_COLORS[k] ?? '#94a3b8',
              }))}
            />
            <div className="flex-1 w-full">
              <ChartLegend
                data={Object.entries(stats.by_priority).map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: PRIORITY_COLORS[k] ?? '#94a3b8',
                }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bar charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="section-title mb-4">Category Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_category).map(([cat, count], i) => (
              <BarRow
                key={cat}
                label={cat}
                count={count}
                total={stats.total}
                color={CATEGORY_COLORS[cat] ?? '#94a3b8'}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="section-title mb-4">Priority Distribution</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_priority).map(([pri, count], i) => (
              <BarRow
                key={pri}
                label={pri}
                count={count}
                total={stats.total}
                color={PRIORITY_COLORS[pri] ?? '#94a3b8'}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Total */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card p-6 text-center"
      >
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-slate-900">
          {stats.total}
        </p>
        <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          Total Complaints
        </p>
      </motion.div>
    </div>
  )
}
