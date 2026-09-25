import { useEffect, useState } from 'react'
import { NavLink, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPage } from './pages/DashboardPage'
import { StatsPage } from './pages/StatsPage'
import { SubmitPage } from './pages/SubmitPage'
import { getProviderMeta } from './api/client'

const NAV_ITEMS = [
  { to: '/', label: 'Submit', end: true },
  { to: '/complaints', label: 'Operations', end: false },
  { to: '/stats', label: 'Analytics', end: false },
] as const

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
                      border border-white/[0.06] bg-white/[0.04] px-2.5 py-1
                      text-[11px] font-medium tracking-wide text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
      {provider}
    </span>
  )
}

function NavTabs() {
  const location = useLocation()

  const activeIdx = NAV_ITEMS.findIndex((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to),
  )

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-1">
      {NAV_ITEMS.map((item, i) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className="relative z-10 rounded-md px-3 py-1.5 text-sm font-medium
                     text-zinc-400 transition-colors hover:text-zinc-200"
        >
          {activeIdx === i && (
            <motion.span
              layoutId="nav-pill"
              className="absolute inset-0 rounded-md bg-white/[0.08]"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className="relative z-10">{item.label}</span>
        </NavLink>
      ))}
    </div>
  )
}

function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 z-50 h-full w-64 border-l border-white/[0.06]
                       bg-[#09090b] p-6"
          >
            <button
              onClick={onClose}
              className="mb-8 text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Close menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-white/[0.08] text-zinc-100'
                        : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="glass sticky top-0 z-30 border-b border-white/[0.06]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <NavLink to="/" className="flex items-center gap-2.5 text-zinc-100 no-underline">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg
                          bg-gradient-to-br from-blue-500 to-blue-600 text-xs font-bold">
            C
          </div>
          <span className="text-[15px] font-semibold tracking-tight">CivicPulse</span>
        </NavLink>

        <div className="hidden md:flex items-center gap-4">
          <NavTabs />
          <ProviderBadge />
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          className="md:hidden text-zinc-400 hover:text-zinc-200 transition-colors"
          aria-label="Open menu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
      </div>
      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  )
}

export default function App() {
  return (
    <Router>
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<SubmitPage />} />
              <Route path="/complaints" element={<DashboardPage />} />
              <Route path="/stats" element={<StatsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </Router>
  )
}
