import { NavLink, Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { DashboardPage } from './pages/DashboardPage'
import { StatsPage } from './pages/StatsPage'
import { SubmitPage } from './pages/SubmitPage'
import './index.css'

function Nav() {
  return (
    <nav className="nav">
      <div className="nav-brand">
        <span className="nav-logo">⚡</span>
        CivicPulse
      </div>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Submit
        </NavLink>
        <NavLink to="/complaints" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Dashboard
        </NavLink>
        <NavLink to="/stats" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
          Stats
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <Router>
      <div className="app">
        <Nav />
        <main className="main">
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
