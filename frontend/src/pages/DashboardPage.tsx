import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, listComplaints, getStats, updateStatus } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintResponse,
  ComplaintStatus,
  StatsResponse,
} from '../types/api'

const STATUSES: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'rejected']
const CATEGORIES: ComplaintCategory[] = [
  'water', 'electricity', 'sanitation', 'roads', 'streetlights', 'other',
]
const PRIORITIES: ComplaintPriority[] = ['high', 'normal', 'low']

const NEXT_STATUSES: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
}

const STATUS_BADGE: Record<string, string> = {
  open: 'badge-open',
  in_progress: 'badge-in_progress',
  resolved: 'badge-resolved',
  rejected: 'badge-rejected',
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-high',
  normal: 'badge-normal',
  low: 'badge-low',
}

const STATUS_COLORS: Record<string, { text: string; bg: string; indicator: string }> = {
  open: { text: 'text-blue-700', bg: 'bg-blue-50', indicator: 'bg-blue-500' },
  in_progress: { text: 'text-amber-700', bg: 'bg-amber-50', indicator: 'bg-amber-500' },
  resolved: { text: 'text-emerald-700', bg: 'bg-emerald-50', indicator: 'bg-emerald-500' },
  rejected: { text: 'text-red-700', bg: 'bg-red-50', indicator: 'bg-red-500' },
}

/* ── Donut Chart ───────────────────────────────────────────────────────────── */

function DonutChart({
  data,
  size = 160,
}: {
  data: { label: string; value: number; color: string }[]
  size?: number
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  if (total === 0) return null

  const strokeWidth = 24
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
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-slate-900 text-2xl font-bold">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-500 text-xs">
        Total
      </text>
    </svg>
  )
}

function ChartLegend({ data }: { data: { label: string; value: number; color: string }[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  return (
    <div className="space-y-2">
      {data.map((d) => (
        <div key={d.label} className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} />
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

/* ── Stat Cards ────────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: { text: string; bg: string; indicator: string }
}) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold tabular-nums ${color?.text ?? 'text-slate-900'}`}>
        {value}
      </p>
      {color && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${color.indicator}`} />
          <span className="text-xs text-slate-500 capitalize">{label}</span>
        </div>
      )}
    </div>
  )
}

/* ── Filter Select ─────────────────────────────────────────────────────────── */

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  options: string[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2
                 text-sm text-slate-700 transition-colors
                 hover:border-slate-400 focus:border-civic-500 focus:outline-none
                 focus:ring-2 focus:ring-civic-500/20"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o.replace('_', ' ')}
        </option>
      ))}
    </select>
  )
}

/* ── Search Input ──────────────────────────────────────────────────────────── */

function SearchInput({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by ID, location..."
        className="input-field pl-9"
      />
    </div>
  )
}

/* ── Dashboard Page ────────────────────────────────────────────────────────── */

const CATEGORY_CHART_COLORS: Record<string, string> = {
  water: '#3b82f6',
  electricity: '#f59e0b',
  sanitation: '#10b981',
  roads: '#8b5cf6',
  streetlights: '#f97316',
  other: '#94a3b8',
}

const PRIORITY_CHART_COLORS: Record<string, string> = {
  high: '#ef4444',
  normal: '#f59e0b',
  low: '#10b981',
}

export function DashboardPage() {
  const { user } = useAuth()
  const isOperator = user?.role === 'operator'

  const [items, setItems] = useState<ComplaintResponse[]>([])
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transitionErrors, setTransitionErrors] = useState<Record<string, string>>({})
  const [stats, setStats] = useState<StatsResponse | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listComplaints({
        page,
        per_page: 10,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        priority: filterPriority || undefined,
      })
      setItems(res.items)
      setPages(res.pages)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load complaints.')
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterCategory, filterPriority])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (isOperator) {
      getStats()
        .then(({ data }) => setStats(data))
        .catch(() => {})
    }
  }, [isOperator])

  async function handleStatusChange(id: string, newStatus: ComplaintStatus) {
    setTransitionErrors((prev) => ({ ...prev, [id]: '' }))
    try {
      const updated = await updateStatus(id, { status: newStatus })
      setItems((prev) => prev.map((c) => (c.id === id ? updated : c)))
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : 'Unexpected error.'
      setTransitionErrors((prev) => ({ ...prev, [id]: msg }))
    }
  }

  const filteredItems = searchQuery
    ? items.filter(
        (c) =>
          c.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.text.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : items

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="page-title">
          {isOperator ? 'Operations Dashboard' : 'My Complaints'}
        </h1>
        <p className="page-subtitle">
          {isOperator
            ? 'Overview of all complaints and system statistics.'
            : 'Track the status of your submitted complaints.'}
        </p>
      </div>

      {/* Operator stat cards */}
      {isOperator && stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total Complaints" value={stats.total} />
          <StatCard label="Open" value={stats.by_status.open ?? 0} color={STATUS_COLORS.open} />
          <StatCard label="In Progress" value={stats.by_status.in_progress ?? 0} color={STATUS_COLORS.in_progress} />
          <StatCard label="Resolved" value={stats.by_status.resolved ?? 0} color={STATUS_COLORS.resolved} />
          <StatCard label="Rejected" value={stats.by_status.rejected ?? 0} color={STATUS_COLORS.rejected} />
        </div>
      )}

      {/* Operator charts */}
      {isOperator && stats && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card p-6">
            <h2 className="section-title mb-4">Complaints by Category</h2>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <DonutChart
                data={Object.entries(stats.by_category).map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: CATEGORY_CHART_COLORS[k] ?? '#94a3b8',
                }))}
              />
              <div className="flex-1">
                <ChartLegend
                  data={Object.entries(stats.by_category).map(([k, v]) => ({
                    label: k,
                    value: v,
                    color: CATEGORY_CHART_COLORS[k] ?? '#94a3b8',
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="section-title mb-4">Complaints by Priority</h2>
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <DonutChart
                data={Object.entries(stats.by_priority).map(([k, v]) => ({
                  label: k,
                  value: v,
                  color: PRIORITY_CHART_COLORS[k] ?? '#94a3b8',
                }))}
              />
              <div className="flex-1">
                <ChartLegend
                  data={Object.entries(stats.by_priority).map(([k, v]) => ({
                    label: k,
                    value: v,
                    color: PRIORITY_CHART_COLORS[k] ?? '#94a3b8',
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section heading for complaints list */}
      {isOperator && stats && (
        <h2 className="section-title">Recent Complaints</h2>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput value={searchQuery} onChange={setSearchQuery} />
        <FilterSelect
          value={filterCategory}
          onChange={(v) => { setFilterCategory(v); setPage(1) }}
          placeholder="All Categories"
          options={CATEGORIES}
        />
        <FilterSelect
          value={filterPriority}
          onChange={(v) => { setFilterPriority(v); setPage(1) }}
          placeholder="All Priorities"
          options={PRIORITIES}
        />
        <FilterSelect
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v); setPage(1) }}
          placeholder="All Statuses"
          options={STATUSES}
        />
        {(filterStatus || filterCategory || filterPriority) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterPriority(''); setPage(1) }}
            className="btn-ghost text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-civic-600" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-medium text-slate-600">No complaints found</p>
          <p className="text-sm text-slate-400">Try adjusting your filters or submit a new complaint.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="table-header px-4 py-3 text-left">ID</th>
                  <th className="table-header px-4 py-3 text-left">Category</th>
                  <th className="table-header px-4 py-3 text-left">Priority</th>
                  <th className="table-header px-4 py-3 text-left">Status</th>
                  <th className="table-header px-4 py-3 text-left">Location</th>
                  <th className="table-header px-4 py-3 text-left">Date</th>
                  <th className="table-header px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((c) => (
                  <ComplaintTableRow
                    key={c.id}
                    complaint={c}
                    isOperator={isOperator}
                    onStatusChange={handleStatusChange}
                    transitionError={transitionErrors[c.id]}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-ghost"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
            const pageNum = i + 1
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  page === pageNum
                    ? 'bg-civic-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            )
          })}
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-ghost"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Table Row ─────────────────────────────────────────────────────────────── */

function ComplaintTableRow({
  complaint,
  isOperator = false,
  onStatusChange,
  transitionError,
}: {
  complaint: ComplaintResponse
  isOperator?: boolean
  onStatusChange?: (id: string, newStatus: ComplaintStatus) => Promise<void>
  transitionError?: string
}) {
  const [transitioning, setTransitioning] = useState(false)
  const nextStatuses = NEXT_STATUSES[complaint.status] ?? []

  async function handleAdvance(newStatus: ComplaintStatus) {
    if (!onStatusChange) return
    setTransitioning(true)
    await onStatusChange(complaint.id, newStatus)
    setTransitioning(false)
  }

  return (
    <>
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 font-mono text-xs text-slate-900">
          CP-{complaint.id.slice(0, 8).toUpperCase()}
        </td>
        <td className="px-4 py-3">
          <span className="badge bg-civic-50 text-civic-700 border border-civic-200 capitalize">
            {complaint.category}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${PRIORITY_BADGE[complaint.priority] ?? ''} capitalize`}>
            {complaint.priority}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`badge ${STATUS_BADGE[complaint.status] ?? ''} capitalize`}>
            {complaint.status.replace('_', ' ')}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
          {complaint.location}
        </td>
        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
          {new Date(complaint.created_at).toLocaleDateString()}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/complaints/${complaint.id}`}
              className="text-sm font-medium text-civic-600 hover:text-civic-700 transition-colors"
            >
              View
            </Link>
            {isOperator && nextStatuses.map((s) => (
              <button
                key={s}
                disabled={transitioning}
                onClick={() => { void handleAdvance(s) }}
                className="text-xs rounded-full border border-slate-300 bg-white px-2 py-0.5
                           text-slate-600 hover:bg-slate-100 hover:border-slate-400 capitalize
                           disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                → {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </td>
      </tr>
      {isOperator && transitionError && (
        <tr>
          <td colSpan={7} className="px-4 pb-2 pt-0">
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {transitionError}
            </p>
          </td>
        </tr>
      )}
    </>
  )
}
