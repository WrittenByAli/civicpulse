import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ProtectedRoute } from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ComplaintDetailPage } from './pages/ComplaintDetailPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { OperatorPendingPage } from './pages/OperatorPendingPage'
import { SignupPage } from './pages/SignupPage'
import { StatsPage } from './pages/StatsPage'
import { SubmitPage } from './pages/SubmitPage'
import { getProviderMeta } from './api/client'

/* ── Icons ─────────────────────────────────────────────────────────────────── */

function IconHome() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function IconComplaints() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  )
}

function IconDashboard() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function IconStats() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

function IconAI() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h18M3 6h18M3 18h18" />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

/* ── Logo ──────────────────────────────────────────────────────────────────── */

function CivicPulseLogo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-civic-600">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
      <span className={`text-lg font-bold tracking-tight ${dark ? 'text-white' : 'text-slate-900'}`}>
        CivicPulse
      </span>
    </div>
  )
}

/* ── User Avatar ───────────────────────────────────────────────────────────── */

function UserAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-9 w-9 text-sm'
  return (
    <div className={`${sizeClass} flex items-center justify-center rounded-full bg-civic-600 font-semibold text-white`}>
      {initials}
    </div>
  )
}

/* ── Provider Badge ────────────────────────────────────────────────────────── */

function ProviderBadge() {
  const [provider, setProvider] = useState<string | null>(null)

  useEffect(() => {
    getProviderMeta()
      .then((meta) => setProvider(meta.active_provider))
      .catch(() => setProvider(null))
  }, [])

  if (!provider) return null

  return (
    <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full
                      border border-emerald-200 bg-emerald-50 px-2.5 py-1
                      text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {provider}
    </span>
  )
}

/* ── Citizen Sidebar ───────────────────────────────────────────────────────── */

function CitizenSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { to: '/', label: 'Home', icon: <IconHome />, end: true },
    { to: '/complaints', label: 'My Complaints', icon: <IconComplaints />, end: false },
  ]

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-16 items-center px-5 border-b border-slate-100">
        <CivicPulseLogo />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-civic-50 text-civic-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className={isActive ? 'text-civic-600' : 'text-slate-400'}>{item.icon}</span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {user && (
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <UserAvatar name={user.full_name || user.email} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {user.full_name || user.email.split('@')[0]}
              </p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            <button onClick={logout} className="text-slate-400 hover:text-slate-600 transition-colors" aria-label="Sign out">
              <IconChevronDown />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 lg:z-20">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-full w-60"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Operator Sidebar ──────────────────────────────────────────────────────── */

function OperatorSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth()
  const location = useLocation()

  const navItems = [
    { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
    { to: '/complaints', label: 'Complaints', icon: <IconComplaints />, end: false },
    { to: '/stats', label: 'Statistics', icon: <IconStats />, end: false },
    { to: '/providers', label: 'AI Providers', icon: <IconAI />, end: false },
  ]

  const sidebarContent = (
    <div className="flex h-full flex-col bg-navy-900">
      <div className="flex h-16 items-center px-5 border-b border-white/10">
        <CivicPulseLogo dark />
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-civic-600/20 text-white'
                  : 'text-navy-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-civic-400' : 'text-navy-400'}>{item.icon}</span>
              {item.label}
            </NavLink>
          )
        })}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <UserAvatar name={user.full_name || user.email} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {user.full_name || user.email.split('@')[0]}
              </p>
              <p className="text-xs text-navy-400 capitalize">{user.role}</p>
            </div>
            <button onClick={logout} className="text-navy-400 hover:text-white transition-colors" aria-label="Sign out">
              <IconLogout />
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 lg:z-20">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30"
              onClick={onClose}
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-50 h-full w-60"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

/* ── Top Bar ───────────────────────────────────────────────────────────────── */

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth()

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={onMenuClick}
        className="lg:hidden text-slate-500 hover:text-slate-700 transition-colors"
        aria-label="Open menu"
      >
        <IconMenu />
      </button>

      <div className="flex-1" />

      <ProviderBadge />

      {user && (
        <div className="flex items-center gap-3">
          <UserAvatar name={user.full_name || user.email} size="sm" />
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-900">
              {user.full_name || user.email.split('@')[0]}
            </p>
          </div>
        </div>
      )}
    </header>
  )
}

/* ── App Shell (authenticated layout) ──────────────────────────────────────── */

function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const isOperator = user?.role === 'operator'

  return (
    <div className="min-h-screen bg-slate-50">
      {isOperator ? (
        <OperatorSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <CitizenSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      )}

      <div className="lg:pl-60 flex flex-col min-h-screen">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

/* ── Landing Page (public) ──────────────────────────────────────────────────── */

function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <CivicPulseLogo />
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-sm font-medium text-slate-700 hover:text-civic-600 transition-colors">Home</Link>
            <Link to="/complaints" className="text-sm font-medium text-slate-500 hover:text-civic-600 transition-colors">My Complaints</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-700 hover:text-civic-600 transition-colors">Login</Link>
            <Link to="/signup" className="btn-primary !py-2 !px-4 !text-sm">Sign Up</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-800 to-civic-900">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.15\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }} />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            A Cleaner, Safer,<br />Stronger Community
          </h1>
          <p className="mt-6 max-w-xl text-lg text-navy-200">
            Report civic issues, track progress, and help build a better tomorrow.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-navy-900 shadow-lg hover:bg-slate-50 transition-colors">
              Get Started
            </Link>
            <Link to="/login" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: 'Report Issues',
              desc: 'Quick and easy complaint submission',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-civic-600">
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              ),
            },
            {
              title: 'Track Progress',
              desc: 'Stay updated in real time',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-civic-600">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              ),
            },
            {
              title: 'AI Powered',
              desc: 'Smart categorization and prioritization',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-civic-600">
                  <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z" />
                </svg>
              ),
            },
            {
              title: 'Better Communities',
              desc: 'Together for a cleaner, safer city',
              icon: (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-civic-600">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              ),
            },
          ].map((feature) => (
            <div key={feature.title} className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-civic-50">
                {feature.icon}
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{feature.title}</h3>
              <p className="text-sm text-slate-500">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Home Page Wrapper ─────────────────────────────────────────────────────── */

function HomePage() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-civic-600" />
      </div>
    )
  }

  if (!user) return <LandingPage />

  return (
    <AppShell>
      <SubmitPage />
    </AppShell>
  )
}

/* ── App ───────────────────────────────────────────────────────────────────── */

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<HomePage />} />
            <Route
              path="/operator-pending"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <OperatorPendingPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/complaints"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <DashboardPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/complaints/:id"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ComplaintDetailPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute role="operator">
                  <AppShell>
                    <StatsPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/providers"
              element={
                <ProtectedRoute role="operator">
                  <AppShell>
                    <ProvidersPage />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </Router>
  )
}

/* ── AI Providers Page ─────────────────────────────────────────────────────── */

function ProvidersPage() {
  const [meta, setMeta] = useState<import('./types/api').ProviderMetaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    getProviderMeta()
      .then(setMeta)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load provider info'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-civic-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!meta) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">AI Providers</h1>
        <p className="page-subtitle">Monitor AI triage provider status and performance.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Provider</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{meta.active_provider}</p>
          <div className="mt-3 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-medium text-emerald-700">Online</span>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cache Performance</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {meta.cache_hit_rate != null ? `${Math.round(meta.cache_hit_rate * 100)}%` : '—'}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
            <span>Hits: {meta.cache_hits}</span>
            <span>Misses: {meta.cache_misses}</span>
          </div>
        </div>

        <div className="card p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Recent Triages</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{meta.last_outcomes.length}</p>
        </div>
      </div>

      {meta.last_outcomes.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="section-title">Recent Outcomes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="table-header px-5 py-3 text-left">Provider</th>
                  <th className="table-header px-5 py-3 text-left">Category</th>
                  <th className="table-header px-5 py-3 text-left">Priority</th>
                  <th className="table-header px-5 py-3 text-left">Latency</th>
                  <th className="table-header px-5 py-3 text-left">Confidence</th>
                  <th className="table-header px-5 py-3 text-left">Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {meta.last_outcomes.map((outcome, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-900">{outcome.triaged_by}</td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{outcome.category}</td>
                    <td className="px-5 py-3">
                      <span className={`badge badge-${outcome.priority}`}>{outcome.priority}</span>
                    </td>
                    <td className="px-5 py-3 font-mono text-slate-600">{outcome.latency_ms}ms</td>
                    <td className="px-5 py-3 text-slate-600">
                      {outcome.confidence != null ? `${Math.round(outcome.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      {outcome.fallback ? (
                        <span className="badge badge-high">Yes</span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
