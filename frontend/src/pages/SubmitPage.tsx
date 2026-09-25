import { useState } from 'react'
import { ApiError, submitComplaint } from '../api/client'
import type { ComplaintResponse } from '../types/api'

const MIN_TEXT = 10
const MAX_TEXT = 2000
const MIN_LOC = 3
const MAX_LOC = 200

export function SubmitPage() {
  const [text, setText] = useState('')
  const [location, setLocation] = useState('')
  const [contact, setContact] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ComplaintResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const textError =
    text.length > 0 && (text.length < MIN_TEXT || text.length > MAX_TEXT)
      ? `Must be ${MIN_TEXT}–${MAX_TEXT} characters (currently ${text.length})`
      : null

  const locError =
    location.length > 0 && (location.length < MIN_LOC || location.length > MAX_LOC)
      ? `Must be ${MIN_LOC}–${MAX_LOC} characters`
      : null

  const canSubmit =
    !loading &&
    text.length >= MIN_TEXT &&
    text.length <= MAX_TEXT &&
    location.length >= MIN_LOC &&
    location.length <= MAX_LOC

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
    <div className="page">
      <h1>Submit a Complaint</h1>
      <p className="subtitle">
        Describe the issue and our system will triage it automatically.
      </p>

      <form onSubmit={handleSubmit} className="card form-card">
        <div className="field">
          <label htmlFor="text">
            Complaint description <span className="required">*</span>
          </label>
          <textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Describe the issue in detail (min 10 characters)…"
            disabled={loading}
          />
          <div className="field-meta">
            {textError ? (
              <span className="field-error">{textError}</span>
            ) : (
              <span className="char-count">{text.length} / {MAX_TEXT}</span>
            )}
          </div>
        </div>

        <div className="field">
          <label htmlFor="location">
            Location <span className="required">*</span>
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Gulberg III, Lahore"
            disabled={loading}
          />
          {locError && <span className="field-error">{locError}</span>}
        </div>

        <div className="field">
          <label htmlFor="contact">Contact (optional)</label>
          <input
            id="contact"
            type="text"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Email or phone number"
            disabled={loading}
          />
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <button type="submit" disabled={!canSubmit} className="btn-primary">
          {loading ? 'Submitting — AI triage in progress…' : 'Submit Complaint'}
        </button>
      </form>

      {result && (
        <div className="card result-card" data-testid="submission-result">
          <h2>Complaint Received</h2>
          <div className="result-grid">
            <div className="result-item">
              <span className="result-label">ID</span>
              <span className="result-value mono">{result.id}</span>
            </div>
            <div className="result-item">
              <span className="result-label">Category</span>
              <span className={`badge badge-category badge-${result.category}`}>
                {result.category}
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Priority</span>
              <span className={`badge badge-priority badge-${result.priority}`}>
                {result.priority}
              </span>
            </div>
            <div className="result-item">
              <span className="result-label">Triaged by</span>
              <span className="result-value">{result.triaged_by ?? '—'}</span>
            </div>
            {result.triage_latency_ms != null && (
              <div className="result-item">
                <span className="result-label">Triage latency</span>
                <span className="result-value">{result.triage_latency_ms} ms</span>
              </div>
            )}
            {result.ai_summary && (
              <div className="result-item full-width">
                <span className="result-label">AI summary</span>
                <span className="result-value">{result.ai_summary}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
