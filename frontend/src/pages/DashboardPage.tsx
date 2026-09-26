import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, listComplaints, updateStatus } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  ComplaintCategory,
  ComplaintPriority,
  ComplaintResponse,
  ComplaintStatus,
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

const STATUS_DOT: Record<ComplaintStatus, string> = {
  open: 'bg-blue-400',
  in_progress: 'bg-amber-400',
  resolved: 'bg-emerald-400',
  rejected: 'bg-red-400',
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-400',
  normal: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

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
      className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2
                 text-sm text-zinc-300 transition-colors
                 hover:border-white/[0.12] focus:border-blue-500/50 focus:outline-none
                 focus:ring-1 focus:ring-blue-500/30"
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

function ComplaintRow({
  complaint,
  onStatusChange,
  transitionError,
  canChangeStatus,
}: {
  complaint: ComplaintResponse
  onStatusChange: (id: string, status: ComplaintStatus) => void
  transitionError: string | undefined
  canChangeStatus: boolean
}) {
  const next = NEXT_STATUSES[complaint.status]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-4 transition-shadow hover:shadow-card-hover"
    >
      <div className="flex flex-col gap-3">
        {/* Top row: badges */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-500">
            {complaint.id.slice(0, 8)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-md border
                           border-white/[0.08] bg-white/[0.04] px-2 py-0.5
                           text-xs font-medium text-zinc-300">
            {complaint.category}
          </span>
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5
                            text-xs font-medium ${PRIORITY_BADGE[complaint.priority] ?? ''}`}>
            {complaint.priority}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[complaint.status]}`} />
            {complaint.status.replace('_', ' ')}
          </span>
        </div>

        {/* Body */}
        <p className="text-sm leading-relaxed text-zinc-300">
          {complaint.text.length > 200
            ? complaint.text.slice(0, 200) + '...'
            : complaint.text}
        </p>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2" className="text-zinc-600">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {complaint.location}
          </span>
          {complaint.ai_summary && (
            <span className="text-zinc-600">{complaint.ai_summary}</span>
          )}
        </div>

        {/* Status transition — operators only */}
        {canChangeStatus && next.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] pt-3">
            <span className="text-xs text-zinc-600">Advance to</span>
            {next.map((s) => (
              <button
                key={s}
                onClick={() => onStatusChange(complaint.id, s)}
                className="btn-ghost text-xs"
              >
                {s.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}

        {/* 409 error */}
        <AnimatePresence>
          {transitionError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2
                              text-xs text-red-400">
                {transitionError}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const isOperator = user?.role === 'operator'
  const [items, setItems] = useState<ComplaintResponse[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [transitionErrors, setTransitionErrors] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listComplaints({
        page,
        per_page: 20,
        status: filterStatus || undefined,
        category: filterCategory || undefined,
        priority: filterPriority || undefined,
      })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load complaints.')
    } finally {
      setLoading(false)
    }
  }, [page, filterStatus, filterCategory, filterPriority])

  useEffect(() => { void load() }, [load])

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Operations Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {total} complaint{total !== 1 ? 's' : ''} found
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <FilterSelect
          value={filterStatus}
          onChange={(v) => { setFilterStatus(v); setPage(1) }}
          placeholder="All statuses"
          options={STATUSES}
        />
        <FilterSelect
          value={filterCategory}
          onChange={(v) => { setFilterCategory(v); setPage(1) }}
          placeholder="All categories"
          options={CATEGORIES}
        />
        <FilterSelect
          value={filterPriority}
          onChange={(v) => { setFilterPriority(v); setPage(1) }}
          placeholder="All priorities"
          options={PRIORITIES}
        />
        {(filterStatus || filterCategory || filterPriority) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterPriority(''); setPage(1) }}
            className="btn-ghost text-xs"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Global error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3
                       text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-6 w-6 animate-spin rounded-full border-2
                          border-zinc-700 border-t-zinc-300" />
        </div>
      ) : items.length === 0 ? (
        <div className="glass-card flex flex-col items-center gap-3 rounded-xl py-16">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-zinc-500">No complaints match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((c) => (
            <ComplaintRow
              key={c.id}
              complaint={c}
              onStatusChange={handleStatusChange}
              transitionError={transitionErrors[c.id]}
              canChangeStatus={isOperator}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-ghost"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Previous
          </button>
          <span className="text-xs tabular-nums text-zinc-500">
            {page} / {pages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-ghost"
          >
            Next
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
