import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SubmitPage } from '../src/pages/SubmitPage'
import { StatsPage } from '../src/pages/StatsPage'

// Mock react-leaflet so tests don't need a real DOM with canvas/map tiles
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'map-container' }, children),
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => null,
}))
vi.mock('leaflet', () => ({
  default: { divIcon: vi.fn(() => ({})) },
  divIcon: vi.fn(() => ({})),
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_target, tag: string) =>
      ({ children, ...props }: React.HTMLAttributes<HTMLElement>) =>
        React.createElement(tag, props, children),
  }),
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}))

// vi.mock is hoisted above the file body, so anything its factory references must
// be created with vi.hoisted() — a plain top-level class/const is still in the
// temporal dead zone when the hoisted factory runs.
const { MockApiError, mockSubmitComplaint, mockGetStats } = vi.hoisted(() => {
  class MockApiError extends Error {
    status: number
    detail: string
    constructor(status: number, detail: string) {
      super(detail)
      this.name = 'ApiError'
      this.status = status
      this.detail = detail
    }
  }
  return { MockApiError, mockSubmitComplaint: vi.fn(), mockGetStats: vi.fn() }
})

vi.mock('../src/api/client', () => ({
  submitComplaint: (...args: unknown[]) => mockSubmitComplaint(...args),
  getStats: (...args: unknown[]) => mockGetStats(...args),
  listComplaints: vi.fn(),
  ApiError: MockApiError,
}))

const STATS_PAYLOAD = {
  total: 42,
  by_status: { open: 10, in_progress: 5, resolved: 20, rejected: 7 },
  by_category: { water: 15, electricity: 10, sanitation: 5, roads: 7, streetlights: 3, other: 2 },
  by_priority: { high: 12, normal: 20, low: 10 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── SubmitPage ────────────────────────────────────────────────────────────────

describe('SubmitPage', () => {
  it('renders the description and location fields', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument()
  })

  it('submit button is disabled when fields are empty', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /submit complaint/i })).toBeDisabled()
  })

  it('submit button enables when both fields meet minimum length', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Water pipe burst near the main junction' },
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Gulberg III' },
    })
    expect(screen.getByRole('button', { name: /submit complaint/i })).not.toBeDisabled()
  })

  it('shows triage result after a successful submission', async () => {
    const complaint = {
      id: 'test-uuid-1234-5678',
      text: 'Water pipe burst near the main junction',
      location: 'Gulberg III',
      reporter_contact: null,
      category: 'water',
      priority: 'high',
      status: 'open',
      ai_summary: 'Burst water main causing flooding',
      triaged_by: 'simulated',
      triage_latency_ms: 23,
      ai_confidence: 0.91,
      created_at: '',
      updated_at: '',
    }
    mockSubmitComplaint.mockResolvedValueOnce(complaint)

    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: complaint.text },
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: complaint.location },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit complaint/i }))

    await waitFor(() => {
      expect(screen.getByText(/complaint submitted successfully/i)).toBeInTheDocument()
    })
    expect(screen.getByText('water')).toBeInTheDocument()
    expect(screen.getByText('Burst water main causing flooding')).toBeInTheDocument()
  })

  it('shows error message when submission fails', async () => {
    mockSubmitComplaint.mockRejectedValueOnce(new MockApiError(422, 'text too short'))

    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'Water pipe burst near the main junction' },
    })
    fireEvent.change(screen.getByLabelText(/location/i), {
      target: { value: 'Gulberg III' },
    })
    fireEvent.click(screen.getByRole('button', { name: /submit complaint/i }))

    await waitFor(() => {
      expect(screen.getByText('text too short')).toBeInTheDocument()
    })
  })
})

// ── StatsPage ─────────────────────────────────────────────────────────────────

describe('StatsPage', () => {
  it('shows loading spinner before data arrives', () => {
    mockGetStats.mockReturnValue(new Promise(() => {}))
    render(<StatsPage />)
    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('renders total complaint count after load', async () => {
    mockGetStats.mockResolvedValueOnce({ data: STATS_PAYLOAD, cacheHeader: null })
    render(<StatsPage />)
    // "42" also appears in both donut centers (category and priority sums both
    // total 42), so anchor on the unique "Total Complaints" label instead.
    const label = await screen.findByText('Total Complaints')
    expect(label.previousElementSibling).toHaveTextContent('42')
  })

  it('shows X-Cache HIT badge when cacheHeader is HIT', async () => {
    mockGetStats.mockResolvedValueOnce({ data: STATS_PAYLOAD, cacheHeader: 'HIT' })
    render(<StatsPage />)
    await waitFor(() => {
      expect(screen.getByTestId('cache-badge')).toHaveTextContent('HIT')
    })
  })

  it('displays an error message when getStats rejects', async () => {
    mockGetStats.mockRejectedValueOnce(new MockApiError(500, 'Service unavailable'))
    render(<StatsPage />)
    await waitFor(() => {
      expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    })
  })
})
