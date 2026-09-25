import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ApiError, submitComplaint } from '../api/client'
import type { ComplaintResponse } from '../types/api'

const MIN_TEXT = 10
const MAX_TEXT = 2000
const MIN_LOC = 3
const MAX_LOC = 200

const PRIORITY_STYLES: Record<string, string> = {
  high: 'border-red-500/30 bg-red-500/10 text-red-400',
  normal: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  low: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
}

function CharCount({ current, max, min }: { current: number; max: number; min: number }) {
  const over = current > max
  const under = current > 0 && current < min
  const color = over || under ? 'text-red-400' : current > 0 ? 'text-zinc-500' : 'text-zinc-600'
  return (
    <span className={`text-xs tabular-nums ${color}`}>
      {current} / {max}
    </span>
  )
}

function TriageLoading() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-blue-500" />
        <div className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-blue-400"
             style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-zinc-300">AI triage in progress</p>
        <p className="mt-1 text-xs text-zinc-500">Analyzing complaint — typically 2-4 seconds</p>
      </div>
    </div>
  )
}

function TriageResult({ result }: { result: ComplaintResponse }) {
  const items = [
    { label: 'ID', value: result.id.slice(0, 8), mono: true },
    {
      label: 'Category',
      value: (
        <span className="inline-flex items-center rounded-md border border-blue-500/30
                         bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400">
          {result.category}
        </span>
      ),
    },
    {
      label: 'Priority',
      value: (
        <span className={`inline-flex items-center rounded-md border px-2 py-0.5
                          text-xs font-medium ${PRIORITY_STYLES[result.priority] ?? ''}`}>
          {result.priority}
        </span>
      ),
    },
    { label: 'Provider', value: result.triaged_by ?? '—' },
    ...(result.triage_latency_ms != null
      ? [{ label: 'Latency', value: `${result.triage_latency_ms}ms`, mono: true }]
      : []),
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="glass-card rounded-xl p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.5" className="text-emerald-400">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-zinc-200">Complaint Triaged</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label}>
            <p className="label-uppercase mb-1">{item.label}</p>
            <p className={`text-sm text-zinc-200 ${
              'mono' in item && item.mono ? 'font-mono' : ''
            }`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      {result.ai_summary && (
        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <p className="label-uppercase mb-1.5">AI Summary</p>
          <p className="text-sm leading-relaxed text-zinc-300">{result.ai_summary}</p>
        </div>
      )}
    </motion.div>
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Submit a Complaint
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Describe the issue and our system will triage it automatically.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: Form */}
        <form onSubmit={handleSubmit} className="glass-card space-y-5 rounded-xl p-5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="text" className="text-sm font-medium text-zinc-300">
                Description <span className="text-red-400">*</span>
              </label>
              <CharCount current={text.length} max={MAX_TEXT} min={MIN_TEXT} />
            </div>
            <textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Describe the issue in detail (min 10 characters)..."
              disabled={loading}
              className="input-field resize-y"
            />
            {text.length > 0 && !textValid && (
              <p className="text-xs text-red-400">
                Must be {MIN_TEXT}–{MAX_TEXT} characters (currently {text.length})
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="location" className="text-sm font-medium text-zinc-300">
                Location <span className="text-red-400">*</span>
              </label>
              <CharCount current={location.length} max={MAX_LOC} min={MIN_LOC} />
            </div>
            <input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Gulberg III, Lahore"
              disabled={loading}
              className="input-field"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="contact" className="text-sm font-medium text-zinc-300">
              Contact <span className="text-zinc-600">(optional)</span>
            </label>
            <input
              id="contact"
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email or phone number"
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
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5
                                text-sm text-red-400">
                  {error}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button type="submit" disabled={!canSubmit} className="btn-primary w-full">
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2
                                 border-white/30 border-t-white" />
                Analyzing...
              </>
            ) : (
              'Submit Complaint'
            )}
          </button>
        </form>

        {/* Right: Result */}
        <div className="flex flex-col">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="glass-card flex-1 rounded-xl"
              >
                <TriageLoading />
              </motion.div>
            ) : result ? (
              <TriageResult key="result" result={result} />
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="glass-card flex flex-1 flex-col items-center justify-center
                           gap-3 rounded-xl p-8"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl
                                bg-white/[0.04]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.5" className="text-zinc-600">
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </div>
                <p className="text-sm text-zinc-500">
                  AI triage results will appear here
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
