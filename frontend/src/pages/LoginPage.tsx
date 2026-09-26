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
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-sm p-8"
      >
        <h1 className="mb-6 text-2xl font-semibold text-zinc-100">Sign in</h1>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {error}
              </div>
              {unverified && (
                <div className="mt-2 flex items-center gap-2">
                  {resendCooldown > 0 ? (
                    <span className="text-xs text-zinc-600">Resend in {resendCooldown}s</span>
                  ) : (
                    <button
                      onClick={handleResend}
                      disabled={resendLoading}
                      className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
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
              className="mb-4 overflow-hidden rounded-lg border border-blue-500/20
                         bg-blue-500/10 px-3 py-2 text-sm text-blue-400"
            >
              {resendInfo}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="label-uppercase mb-1.5 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field w-full"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="label-uppercase mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-field w-full pr-10"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500
                           hover:text-zinc-300 transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon show={showPassword} />
              </button>
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          No account?{' '}
          <Link to="/signup" className="text-zinc-300 hover:text-white underline underline-offset-2">
            Sign up
          </Link>
        </p>
      </motion.div>
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
