// Types derived from the backend's OpenAPI schema (FastAPI auto-generates it at /docs).
// Keep in sync with backend/app/schemas.py.

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'
export type ComplaintCategory =
  | 'water'
  | 'electricity'
  | 'sanitation'
  | 'roads'
  | 'streetlights'
  | 'other'
export type ComplaintPriority = 'high' | 'normal' | 'low'

export interface ComplaintResponse {
  id: string
  text: string
  location: string
  reporter_contact: string | null
  category: ComplaintCategory
  priority: ComplaintPriority
  status: ComplaintStatus
  ai_summary: string | null
  triaged_by: string | null
  triage_latency_ms: number | null
  created_at: string
  updated_at: string
}

export interface ComplaintCreate {
  text: string
  location: string
  reporter_contact?: string | null
}

export interface ComplaintListResponse {
  items: ComplaintResponse[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface StatusUpdate {
  status: ComplaintStatus
}

export interface StatsResponse {
  total: number
  by_status: Record<ComplaintStatus, number>
  by_category: Record<ComplaintCategory, number>
  by_priority: Record<ComplaintPriority, number>
}

export interface ProviderOutcome {
  triaged_by: string
  category: ComplaintCategory
  priority: ComplaintPriority
  latency_ms: number
  fallback: boolean
}

export interface ProviderMetaResponse {
  active_provider: string
  last_outcomes: ProviderOutcome[]
}

export interface ApiError {
  detail: string | { msg: string; loc: string[] }[]
}
