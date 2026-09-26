import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ApiError, getStats } from '../api/client'
import type { StatsResponse } from '../types/api'

const CATEGORY_COLORS: Record<string, string> = {
  water: 'bg-blue-500',
  electricity: 'bg-amber-500',
  sanitation: 'bg-emerald-500',
  roads: 'bg-violet-500',
  streetlights: 'bg-orange-500',
  other: 'bg-zinc-500',
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500',
  normal: 'bg-amber-500',
  low: 'bg-emerald-500',
}

const STATUS_COLORS: Record<string, { dot: string; border: string }> = {
  open: { dot: 'bg-blue-400', border: 'border-blue-500/20' },
  in_progress: { dot: 'bg-amber-400', border: 'border-amber-500/20' },
  resolved: { dot: 'bg-emerald-400', border: 'border-emerald-500/20' },
  rejected: { dot: 'bg-red-400', border: 'border-red-500/20' },
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
      <span className="w-28 shrink-0 text-sm text-zinc-400 capitalize">
        {label.replace('_', ' ')}
      </span>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, delay, ease: 'easeOut' }}
          className={`absolute inset-y-0 left-0 rounded-full ${color}`}
        />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums text-zinc-500">
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
        <div className="h-6 w-6 animate-spin rounded-full border-2
                        border-zinc-700 border-t-zinc-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3
                      text-sm text-red-400">
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
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Analytics
        </h1>
        <div className="flex items-center gap-3">
          {cacheHeader != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1
                          text-[11px] font-semibold tracking-wide ${
                isHit
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
              }`}
              data-testid="cache-badge"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${
                isHit ? 'bg-emerald-400' : 'bg-amber-400'
              }`} />
              X-Cache: {isHit ? 'HIT' : 'MISS'}
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

      {/* Total count */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-xl p-6 text-center"
      >
        <p className="text-5xl font-extrabold tabular-nums tracking-tight text-zinc-100">
          {stats.total}
        </p>
        <p className="label-uppercase mt-2">Total Complaints</p>
      </motion.div>

      {/* Grid: Category + Priority */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Category */}
        <div className="glass-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200">By Category</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_category).map(([cat, count], i) => (
              <BarRow
                key={cat}
                label={cat}
                count={count}
                total={stats.total}
                color={CATEGORY_COLORS[cat] ?? 'bg-zinc-500'}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>

        {/* By Priority */}
        <div className="glass-card space-y-4 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-zinc-200">By Priority</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_priority).map(([pri, count], i) => (
              <BarRow
                key={pri}
                label={pri}
                count={count}
                total={stats.total}
                color={PRIORITY_COLORS[pri] ?? 'bg-zinc-500'}
                delay={i * 0.05}
              />
            ))}
          </div>
        </div>
      </div>

      {/* By Status */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(stats.by_status).map(([st, count], i) => {
          const style = STATUS_COLORS[st] ?? { dot: 'bg-zinc-400', border: 'border-white/[0.06]' }
          return (
            <motion.div
              key={st}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`glass-card rounded-xl border-t-2 p-5 text-center ${style.border}`}
            >
              <p className="text-3xl font-bold tabular-nums text-zinc-100">{count}</p>
              <div className="mt-2 flex items-center justify-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                <span className="label-uppercase capitalize">{st.replace('_', ' ')}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
