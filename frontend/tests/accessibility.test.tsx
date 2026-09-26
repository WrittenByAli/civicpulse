/**
 * Accessibility smoke tests — verify ARIA labels and keyboard-navigable roles
 * are present on the primary user-facing pages.
 */
import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { SubmitPage } from '../src/pages/SubmitPage'

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
  AnimatePresence: ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
}))

vi.mock('../src/api/client', () => ({
  submitComplaint: vi.fn(),
  getStats: vi.fn(),
  listComplaints: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    detail: string
    constructor(status: number, detail: string) {
      super(detail)
      this.name = 'ApiError'
      this.status = status
      this.detail = detail
    }
  },
}))

beforeEach(() => vi.clearAllMocks())

describe('SubmitPage accessibility', () => {
  it('description textarea has an associated label', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    const textarea = screen.getByLabelText(/description/i)
    expect(textarea).toBeInTheDocument()
    expect(textarea.tagName.toLowerCase()).toBe('textarea')
  })

  it('location input has an associated label', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    const input = screen.getByLabelText(/location/i)
    expect(input).toBeInTheDocument()
    expect(input.tagName.toLowerCase()).toBe('input')
  })

  it('submit button is reachable by role', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /submit complaint/i })).toBeInTheDocument()
  })

  it('page has a visible heading', () => {
    render(<MemoryRouter><SubmitPage /></MemoryRouter>)
    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toBeInTheDocument()
  })
})
