import { useEffect, useState } from 'react'
import { ApiError, getStats } from '../api/client'
import type { StatsResponse } from '../types/api'

const CATEGORY_LABELS: Record<string, string> = {
  water: '💧 Water',
  electricity: '⚡ Electricity',
  sanitation: '🗑️ Sanitation',
  roads: '🛣️ Roads',
  streetlights: '💡 Streetlights',
  other: '📌 Other',
}

const PRIORITY_LABELS: Record<string, string> = {
  high: '🔴 High',
  normal: '🟡 Normal',
  low: '🟢 Low',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  rejected: 'Rejected',
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

  if (loading) return <div className="page"><div className="loading">Loading stats…</div></div>
  if (error) return <div className="page"><div className="alert alert-error">{error}</div></div>
  if (!stats) return null

  const isHit = cacheHeader?.toUpperCase().includes('HIT')

  return (
    <div className="page">
      <div className="stats-header">
        <h1>Platform Statistics</h1>
        <div className="cache-badge-row">
          <span
            className={`cache-badge ${isHit ? 'cache-hit' : 'cache-miss'}`}
            title="Whether this response came from Redis cache (30 s TTL)"
            data-testid="cache-badge"
          >
            Redis {isHit ? 'HIT' : 'MISS'}
          </span>
          <button onClick={() => void load()} className="btn-secondary btn-small">
            Refresh
          </button>
        </div>
      </div>

      <div className="stats-grid">
        <div className="card stat-big">
          <span className="stat-number">{stats.total}</span>
          <span className="stat-label">Total Complaints</span>
        </div>
      </div>

      <div className="stats-section">
        <h2>By Category</h2>
        <div className="bar-list">
          {Object.entries(stats.by_category).map(([cat, count]) => (
            <div key={cat} className="bar-row">
              <span className="bar-label">{CATEGORY_LABELS[cat] ?? cat}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill bar-category-${cat}`}
                  style={{ width: stats.total ? `${(count / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <h2>By Priority</h2>
        <div className="bar-list">
          {Object.entries(stats.by_priority).map(([pri, count]) => (
            <div key={pri} className="bar-row">
              <span className="bar-label">{PRIORITY_LABELS[pri] ?? pri}</span>
              <div className="bar-track">
                <div
                  className={`bar-fill bar-priority-${pri}`}
                  style={{ width: stats.total ? `${(count / stats.total) * 100}%` : '0%' }}
                />
              </div>
              <span className="bar-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stats-section">
        <h2>By Status</h2>
        <div className="status-grid">
          {Object.entries(stats.by_status).map(([st, count]) => (
            <div key={st} className={`card status-card status-card-${st}`}>
              <span className="stat-number">{count}</span>
              <span className="stat-label">{STATUS_LABELS[st] ?? st}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
