import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, getComplaint, updateStatus } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type { ComplaintResponse, ComplaintStatus } from '../types/api'

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

export function ComplaintDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const isOperator = user?.role === 'operator'
  const [complaint, setComplaint] = useState<ComplaintResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<ComplaintStatus | ''>('')

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await getComplaint(id)
      setComplaint(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to load complaint.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { void load() }, [load])

  async function handleStatusUpdate() {
    if (!id || !selectedStatus) return
    setStatusLoading(true)
    setStatusError(null)
    try {
      const updated = await updateStatus(id, { status: selectedStatus })
      setComplaint(updated)
      setSelectedStatus('')
    } catch (err) {
      setStatusError(err instanceof ApiError ? err.detail : 'Failed to update status.')
    } finally {
      setStatusLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-civic-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
        <Link to="/complaints" className="btn-ghost">
          Back to Complaints
        </Link>
      </div>
    )
  }

  if (!complaint) return null

  const nextStatuses = NEXT_STATUSES[complaint.status]

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link to="/complaints" className="hover:text-civic-600 transition-colors">
          {isOperator ? 'Complaints' : 'My Complaints'}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="font-medium text-slate-900">CP-{complaint.id.slice(0, 8).toUpperCase()}</span>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Complaint Details</h1>
        </div>
        <span className={`badge ${STATUS_BADGE[complaint.status] ?? ''} text-sm`}>
          {complaint.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Metadata */}
        <div className="card p-6 space-y-5">
          <DetailRow label="ID" value={`CP-${complaint.id.slice(0, 8).toUpperCase()}`} mono />
          <DetailRow label="Category">
            <span className="badge bg-civic-50 text-civic-700 border border-civic-200 capitalize">
              {complaint.category}
            </span>
          </DetailRow>
          <DetailRow label="Priority">
            <span className={`badge ${PRIORITY_BADGE[complaint.priority] ?? ''} capitalize`}>
              {complaint.priority}
            </span>
          </DetailRow>
          <DetailRow label="Status">
            <span className={`badge ${STATUS_BADGE[complaint.status] ?? ''} capitalize`}>
              {complaint.status.replace('_', ' ')}
            </span>
          </DetailRow>
          <DetailRow label="Location" value={complaint.location} />
          {complaint.reporter_contact && (
            <DetailRow label="Contact" value={complaint.reporter_contact} />
          )}
          <DetailRow label="Submitted" value={new Date(complaint.created_at).toLocaleString()} />

          {complaint.triaged_by && (
            <>
              <div className="border-t border-slate-200 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">AI Analysis</p>
              </div>
              <DetailRow label="Provider" value={complaint.triaged_by} />
              {complaint.ai_confidence != null && (
                <DetailRow label="Confidence" value={`${Math.round(complaint.ai_confidence * 100)}%`} mono />
              )}
              {complaint.triage_latency_ms != null && (
                <DetailRow label="Triage Latency" value={`${complaint.triage_latency_ms} ms`} mono />
              )}
            </>
          )}
        </div>

        {/* Right — Original Complaint + AI Summary */}
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="section-title mb-3">Original Complaint</h3>
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {complaint.text}
            </p>
          </div>

          {complaint.ai_summary && (
            <div className="card p-6">
              <h3 className="section-title mb-3 flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-civic-600">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 16v-4M12 8h.01" />
                </svg>
                AI Summary
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {complaint.ai_summary}
              </p>
            </div>
          )}

          {/* Operator status update */}
          {isOperator && nextStatuses.length > 0 && (
            <div className="card p-6">
              <h3 className="section-title mb-4">Update Status</h3>

              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label htmlFor="status-select" className="label-text mb-1.5 block">New Status</label>
                  <select
                    id="status-select"
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as ComplaintStatus)}
                    className="input-field"
                  >
                    <option value="">Select status...</option>
                    {nextStatuses.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleStatusUpdate}
                  disabled={!selectedStatus || statusLoading}
                  className="btn-primary"
                >
                  {statusLoading ? 'Updating...' : 'Update Status'}
                </button>
              </div>

              <AnimatePresence>
                {statusError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                      {statusError}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  mono,
  children,
}: {
  label: string
  value?: string
  mono?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-slate-500 shrink-0">{label}</span>
      {children ?? (
        <span className={`text-sm font-medium text-slate-900 text-right ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      )}
    </div>
  )
}
