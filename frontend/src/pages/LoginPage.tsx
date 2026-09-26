import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { login as apiLogin, resendCode as apiResendCode } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unverified, setUnverified] = useState(false)
  const [resendInfo, setResendInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setUnverified(false)
    setResendInfo(null)
    setLoading(true)
    try {
      const { access_token } = await apiLogin({ email, password })
      await login(access_token)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setUnverified(true)
        setError(err.detail)
      } else {
        setError(err instanceof ApiError ? err.detail : 'Login failed')
      }
    } finally {
      setLoading(false)
    }
  }

  function startCooldown() {
    setResendCooldown(60)
    const id = setInterval(() => {
      setResendCooldown((s) => { if (s <= 1) { clearInterval(id); return 0 } return s - 1 })
    }, 1000)
  }

  async function handleResend() {
    setResendInfo(null)
    setError(null)
    setResendLoading(true)
    try {
      const res = await apiResendCode({ email })
      setResendInfo(res.message)
      startCooldown()
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to resend code')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left — Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-civic-900 px-12 xl:px-20">
        <div className="flex items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-civic-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">CivicPulse</span>
        </div>
        <p className="text-navy-300 text-sm font-medium uppercase tracking-widest mb-3">Municipal Complaint Portal</p>
        <h2 className="text-3xl font-bold text-white leading-tight">
          Stronger Communities<br />Through Better Governance
        </h2>
      </div>

      {/* Right — Form */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-civic-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-slate-900">CivicPulse</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">Welcome Back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your account</p>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  {error}
                </div>
                {unverified && (
                  <div className="mt-2 flex items-center gap-2">
                    {resendCooldown > 0 ? (
                      <span className="text-xs text-slate-500">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        onClick={handleResend}
                        disabled={resendLoading}
                        className="text-xs text-civic-600 hover:text-civic-700 underline underline-offset-2 transition-colors"
                      >
                        {resendLoading ? 'Sending…' : 'Resend verification code'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
            {resendInfo && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mt-4 overflow-hidden rounded-lg border border-blue-200
                           bg-blue-50 px-3 py-2.5 text-sm text-blue-700"
              >
                {resendInfo}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
            <div>
              <label htmlFor="login-email" className="label-text mb-1.5 block">Email address</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-field"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="label-text mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-field pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400
                             hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary mt-1">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-civic-600 hover:text-civic-700 transition-colors">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
