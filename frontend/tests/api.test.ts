import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, getStats, listComplaints, submitComplaint } from '../src/api/client'

const mockFetch = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', mockFetch) })
afterEach(() => { vi.restoreAllMocks() })

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  })
}

describe('submitComplaint', () => {
  it('posts to /api/complaints and returns the complaint', async () => {
    const complaint = {
      id: 'abc-123', text: 'Water pipe burst', location: 'Lahore',
      reporter_contact: null, category: 'water', priority: 'high',
      status: 'open', ai_summary: null, triaged_by: 'simulated',
      triage_latency_ms: 12, created_at: '', updated_at: '',
    }
    mockFetch.mockReturnValueOnce(makeResponse(complaint, 201))

    const result = await submitComplaint({ text: 'Water pipe burst', location: 'Lahore' })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/complaints',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.id).toBe('abc-123')
    expect(result.category).toBe('water')
  })

  it('throws ApiError with server detail on 400', async () => {
    mockFetch.mockReturnValueOnce(makeResponse({ detail: 'text too short' }, 400))

    await expect(
      submitComplaint({ text: 'short', location: 'Lahore' }),
    ).rejects.toMatchObject({ status: 400, detail: 'text too short' })
  })
})

describe('listComplaints', () => {
  it('fetches /api/complaints and returns paginated data', async () => {
    const payload = { items: [], total: 0, page: 1, per_page: 20, pages: 0 }
    mockFetch.mockReturnValueOnce(makeResponse(payload))

    const result = await listComplaints({ page: 1, status: 'open' })

    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toContain('/api/complaints')
    expect(calledUrl).toContain('status=open')
    expect(result.total).toBe(0)
  })
})

describe('getStats', () => {
  it('returns stats and exposes the X-Cache header', async () => {
    const stats = {
      total: 42,
      by_status: { open: 10, in_progress: 5, resolved: 20, rejected: 7 },
      by_category: { water: 15, electricity: 10, sanitation: 5, roads: 7, streetlights: 3, other: 2 },
      by_priority: { high: 12, normal: 20, low: 10 },
    }
    mockFetch.mockReturnValueOnce(makeResponse(stats, 200, { 'x-cache': 'HIT' }))

    const { data, cacheHeader } = await getStats()

    expect(data.total).toBe(42)
    expect(cacheHeader).toBe('HIT')
  })

  it('cacheHeader is null when X-Cache header is absent', async () => {
    const stats = {
      total: 0,
      by_status: { open: 0, in_progress: 0, resolved: 0, rejected: 0 },
      by_category: { water: 0, electricity: 0, sanitation: 0, roads: 0, streetlights: 0, other: 0 },
      by_priority: { high: 0, normal: 0, low: 0 },
    }
    mockFetch.mockReturnValueOnce(makeResponse(stats, 200))

    const { cacheHeader } = await getStats()
    expect(cacheHeader).toBeNull()
  })
})

describe('ApiError', () => {
  it('is an instance of Error with status and detail', () => {
    const err = new ApiError(409, 'Cannot transition from resolved to open')
    expect(err).toBeInstanceOf(Error)
    expect(err.status).toBe(409)
    expect(err.detail).toBe('Cannot transition from resolved to open')
    expect(err.name).toBe('ApiError')
  })
})
