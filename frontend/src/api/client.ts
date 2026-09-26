// Typed API client — all requests go to /api (relative), proxied by nginx in
// production and by Vite dev server in local development. No absolute URL ever
// baked into the build. See docs/adr/001-nginx-api-proxy.md.

import type {
  ComplaintCreate,
  ComplaintListResponse,
  ComplaintResponse,
  LoginRequest,
  ProviderMetaResponse,
  ResendCodeRequest,
  SignupPendingResponse,
  SignupRequest,
  StatusUpdate,
  TokenResponse,
  User,
  VerifyEmailRequest,
} from '../types/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
  ) {
    super(detail)
    this.name = 'ApiError'
  }
}

const TOKEN_KEY = 'civicpulse_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<{ data: T; headers: Headers }> {
  const token = getStoredToken()
  const headers = new Headers({ 'Content-Type': 'application/json' })
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (init?.headers) {
    new Headers(init.headers as HeadersInit).forEach((v, k) => headers.set(k, v))
  }
  const res = await fetch(path, { ...init, headers })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') detail = body.detail
      else if (Array.isArray(body.detail))
        detail = body.detail.map((e: { msg: string }) => e.msg).join(', ')
    } catch {
      // ignore JSON parse errors — keep the HTTP status message
    }
    throw new ApiError(res.status, detail)
  }
  const data: T = await res.json()
  return { data, headers: res.headers }
}

export async function submitComplaint(
  payload: ComplaintCreate,
): Promise<ComplaintResponse> {
  const { data } = await request<ComplaintResponse>('/api/complaints', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function getComplaint(id: string): Promise<ComplaintResponse> {
  const { data } = await request<ComplaintResponse>(`/api/complaints/${id}`)
  return data
}

export interface ListParams {
  page?: number
  per_page?: number
  status?: string
  category?: string
  priority?: string
}

export async function listComplaints(
  params: ListParams = {},
): Promise<ComplaintListResponse> {
  const qs = new URLSearchParams()
  if (params.page) qs.set('page', String(params.page))
  if (params.per_page) qs.set('per_page', String(params.per_page))
  if (params.status) qs.set('status', params.status)
  if (params.category) qs.set('category', params.category)
  if (params.priority) qs.set('priority', params.priority)
  const { data } = await request<ComplaintListResponse>(
    `/api/complaints?${qs.toString()}`,
  )
  return data
}

export async function updateStatus(
  id: string,
  payload: StatusUpdate,
): Promise<ComplaintResponse> {
  const { data } = await request<ComplaintResponse>(
    `/api/complaints/${id}/status`,
    { method: 'PATCH', body: JSON.stringify(payload) },
  )
  return data
}

export interface StatsResult {
  data: import('../types/api').StatsResponse
  cacheHeader: string | null
}

export async function getStats(): Promise<StatsResult> {
  const { data, headers } = await request<import('../types/api').StatsResponse>(
    '/api/stats',
  )
  return { data, cacheHeader: headers.get('x-cache') }
}

export async function getProviderMeta(): Promise<ProviderMetaResponse> {
  const { data } = await request<ProviderMetaResponse>('/api/meta/providers')
  return data
}

export async function signup(payload: SignupRequest): Promise<SignupPendingResponse> {
  const { data } = await request<SignupPendingResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function verifyEmail(payload: VerifyEmailRequest): Promise<TokenResponse> {
  const { data } = await request<TokenResponse>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function resendCode(payload: ResendCodeRequest): Promise<{ message: string }> {
  const { data } = await request<{ message: string }>('/api/auth/resend-code', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const { data } = await request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data
}

export async function getMe(): Promise<User> {
  const { data } = await request<User>('/api/auth/me')
  return data
}
