import { useCallback, useEffect, useState } from 'react'
import { ApiError, listComplaints, updateStatus } from '../api/client'
import type { ComplaintCategory, ComplaintPriority, ComplaintResponse, ComplaintStatus } from '../types/api'

const STATUSES: ComplaintStatus[] = ['open', 'in_progress', 'resolved', 'rejected']
const CATEGORIES: ComplaintCategory[] = [
  'water', 'electricity', 'sanitation', 'roads', 'streetlights', 'other',
]
const PRIORITIES: ComplaintPriority[] = ['high', 'normal', 'low']

// Valid transitions — display only reachable targets in the dropdown.
// The backend is the source of truth; this list is for UX only, not enforcement.
const NEXT_STATUSES: Record<ComplaintStatus, ComplaintStatus[]> = {
  open: ['in_progress', 'rejected'],
  in_progress: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
}

export function DashboardPage() {
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

  function resetFilters() {
    setFilterStatus('')
    setFilterCategory('')
    setFilterPriority('')
    setPage(1)
  }

  return (
    <div className="page">
      <h1>Complaints Dashboard</h1>
      <p className="subtitle">{total} complaint{total !== 1 ? 's' : ''} found</p>

      <div className="card filter-bar">
        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1) }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => { setFilterCategory(e.target.value); setPage(1) }}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => { setFilterPriority(e.target.value); setPage(1) }}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={resetFilters} className="btn-secondary">Reset</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state">No complaints match the current filters.</div>
      ) : (
        <div className="complaint-list">
          {items.map((c) => (
            <div key={c.id} className="card complaint-card">
              <div className="complaint-header">
                <span className="mono complaint-id">{c.id.slice(0, 8)}…</span>
                <span className={`badge badge-category badge-${c.category}`}>{c.category}</span>
                <span className={`badge badge-priority badge-${c.priority}`}>{c.priority}</span>
                <span className={`badge badge-status badge-status-${c.status}`}>
                  {c.status.replace('_', ' ')}
                </span>
              </div>

              <p className="complaint-text">{c.text.slice(0, 200)}{c.text.length > 200 ? '…' : ''}</p>
              <p className="complaint-meta">
                📍 {c.location}
                {c.ai_summary && <> · {c.ai_summary}</>}
              </p>

              {NEXT_STATUSES[c.status].length > 0 && (
                <div className="status-controls">
                  <span>Advance to:</span>
                  {NEXT_STATUSES[c.status].map((next) => (
                    <button
                      key={next}
                      onClick={() => void handleStatusChange(c.id, next)}
                      className="btn-secondary btn-small"
                    >
                      {next.replace('_', ' ')}
                    </button>
                  ))}
                  {transitionErrors[c.id] && (
                    <span className="inline-error" data-testid={`transition-error-${c.id}`}>
                      {transitionErrors[c.id]}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="btn-secondary"
          >
            ← Prev
          </button>
          <span>Page {page} of {pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page >= pages}
            className="btn-secondary"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
