import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, submitComplaint } from '../api/client'
import type { ComplaintResponse } from '../types/api'

const MIN_TEXT = 10
const MAX_TEXT = 2000
const MIN_LOC = 3
const MAX_LOC = 200

function CharCount({ current, max, min }: { current: number; max: number; min: number }) {
  const over = current > max
  const under = current > 0 && current < min
  const color = over || under ? 'text-red-600' : current > 0 ? 'text-slate-400' : 'text-slate-300'
  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {current}/{max}
    </span>
  )
}

function TriageLoading() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="card flex flex-col items-center justify-center gap-4 p-12"
    >
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-civic-100" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-civic-600" />
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-slate-900">Processing your complaint...</p>
        <p className="mt-1 text-sm text-slate-500">Analyzing the issue and preparing your complaint record.</p>
      </div>
    </motion.div>
  )
}

function SuccessScreen({ result }: { result: ComplaintResponse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-8 text-center"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h2 className="text-xl font-bold text-slate-900">Complaint Submitted Successfully!</h2>
      <p className="mt-2 text-sm text-slate-500">
        Thank you for reporting this issue. Our team will review it and take the necessary action.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 text-left">
        <InfoItem label="Complaint ID" value={`CP-${result.id.slice(0, 8).toUpperCase()}`} mono />
        <InfoItem label="Category" value={result.category} badge="category" />
        <InfoItem label="Priority" value={result.priority} badge="priority" />
        <InfoItem label="Status" value={result.status} badge="status" />
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Your voice matters</p>
        <p className="text-sm text-slate-600">Every complaint helps us build a better city.</p>
      </div>

      {result.ai_summary && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">AI Summary</p>
          <p className="text-sm text-slate-700 leading-relaxed">{result.ai_summary}</p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 text-left">
        {result.triaged_by && (
          <InfoItem label="Triaged by" value={result.triaged_by} />
        )}
        <InfoItem label="Submitted At" value={new Date(result.created_at).toLocaleString()} />
      </div>

      <Link
        to="/complaints"
        className="btn-primary mt-8 w-full"
      >
        View My Complaints
      </Link>
    </motion.div>
  )
}

function InfoItem({
  label,
  value,
  mono,
  badge,
}: {
  label: string
  value: string
  mono?: boolean
  badge?: 'category' | 'priority' | 'status'
}) {
  let valueEl: React.ReactNode = value
  if (badge === 'priority') {
    const cls: Record<string, string> = {
      high: 'badge-high',
      normal: 'badge-normal',
      low: 'badge-low',
    }
    valueEl = <span className={`badge ${cls[value] ?? ''}`}>{value}</span>
  } else if (badge === 'status') {
    const cls: Record<string, string> = {
      open: 'badge-open',
      in_progress: 'badge-in_progress',
      resolved: 'badge-resolved',
      rejected: 'badge-rejected',
    }
    valueEl = <span className={`badge ${cls[value] ?? ''}`}>{value.replace('_', ' ')}</span>
  } else if (badge === 'category') {
    valueEl = (
      <span className="badge bg-civic-50 text-civic-700 border border-civic-200">
        {value}
      </span>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-sm ${mono ? 'font-mono' : ''} text-slate-900`}>{valueEl}</p>
    </div>
  )
}

export function SubmitPage() {
  const [text, setText] = useState('')
  const [location, setLocation] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplaintResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const textValid = text.length >= MIN_TEXT && text.length <= MAX_TEXT
  const locValid = location.length >= MIN_LOC && location.length <= MAX_LOC
  const canSubmit = !loading && textValid && locValid

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const complaint = await submitComplaint({
        text,
        location,
        reporter_contact: contact || null,
      })
      setResult(complaint)
      setText('')
      setLocation('')
      setContact('')
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg">
        <SuccessScreen result={result} />
        <button
          onClick={() => setResult(null)}
          className="mt-4 w-full text-center text-sm text-civic-600 hover:text-civic-700 font-medium transition-colors"
        >
          Submit another complaint
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Report a Civic Issue</h1>
        <p className="page-subtitle">
          Help your community by reporting a problem. Our team will take care of it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <form onSubmit={handleSubmit} className="card p-6 space-y-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="complaint-text" className="label-text">
                Complaint Description <span className="text-red-500">*</span>
              </label>
              <CharCount current={text.length} max={MAX_TEXT} min={MIN_TEXT} />
            </div>
            <textarea
              id="complaint-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Describe the issue in detail... (10 - 2000 characters)"
              disabled={loading}
              className="input-field resize-y"
            />
            {text.length > 0 && !textValid && (
              <p className="text-xs text-red-600">
                Must be {MIN_TEXT}–{MAX_TEXT} characters (currently {text.length})
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="complaint-location" className="label-text">
                Location <span className="text-red-500">*</span>
              </label>
              <CharCount current={location.length} max={MAX_LOC} min={MIN_LOC} />
            </div>
            <input
              id="complaint-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Sector G, Street 12 (3 - 200 characters)"
              disabled={loading}
              className="input-field"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="complaint-contact" className="label-text">
              Contact Number <span className="text-slate-400">(Optional)</span>
            </label>
            <input
              id="complaint-contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="e.g. 03XX-XXXXXXX"
              disabled={loading}
              className="input-field"
            />
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Analyzing...
              </>
            ) : (
              'Submit Complaint'
            )}
          </button>
        </form>

        {/* Right panel */}
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            {loading ? (
              <TriageLoading key="loading" />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">AI triage results will appear here</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
