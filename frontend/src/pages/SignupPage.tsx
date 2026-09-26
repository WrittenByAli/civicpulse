import { useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { signup as apiSignup, verifyEmail as apiVerifyEmail, resendCode as apiResendCode } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import type { UserRole } from '../types/api'

type Step = 'form' | 'otp'

export function SignupPage() {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [role, setRole] = useState<UserRole>('citizen')

  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    try {
      const res = await apiSignup({ full_name: fullName, email, password, confirm_password: confirmPassword, role })
      setInfo(res.message)
      setStep('otp')
      startResendCooldown()
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault()
    const code = otp.join('')
    if (code.length !== 6) {
      setError('Enter the full 6-digit code')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { access_token } = await apiVerifyEmail({ email, otp: code })
      await login(access_token)
      if (role === 'operator') {
        navigate('/operator-pending', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Verification failed')
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    const digit = value.replace(/\D/, '').slice(-1)
    const next = [...otp]
    next[index] = digit
    setOtp(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (digits.length === 6) {
      setOtp(digits.split(''))
    }
  }

  function startResendCooldown() {
    setResendCooldown(60)
    const id = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(id); return 0 }
        return s - 1
      })
    }, 1000)
  }

  async function handleResend() {
    if (resendCooldown > 0) return
    setError(null)
    setLoading(true)
    try {
      const res = await apiResendCode({ email })
      setInfo(res.message)
      startResendCooldown()
      setOtp(['', '', '', '', '', ''])
      otpRefs.current[0]?.focus()
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Failed to resend')
    } finally {
      setLoading(false)
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
      <div className="flex flex-1 items-center justify-center bg-white px-4 sm:px-8 py-8">
        <AnimatePresence mode="wait">
          {step === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
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

              <h1 className="text-2xl font-bold text-slate-900">Create Account</h1>
              <p className="mt-1 text-sm text-slate-500">Join CivicPulse and make a difference</p>

              {/* Role toggle */}
              <div className="mt-6 flex rounded-lg border border-slate-200 p-1">
                {(['citizen', 'operator'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`flex-1 rounded-md py-2 text-sm font-medium capitalize transition-colors ${
                      role === r
                        ? 'bg-civic-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <ErrorBox error={error} />

              <form onSubmit={handleFormSubmit} className="mt-6 flex flex-col gap-4">
                <div>
                  <label htmlFor="signup-name" className="label-text mb-1.5 block">Full Name</label>
                  <input
                    id="signup-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="input-field"
                    placeholder="e.g. Ahmed Khan"
                  />
                </div>
                <div>
                  <label htmlFor="signup-email" className="label-text mb-1.5 block">Email address</label>
                  <input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-field"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="signup-password" className="label-text mb-1.5 block">Password</label>
                  <div className="relative">
                    <input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      className="input-field pr-10"
                      placeholder="Create a password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon show={showPassword} />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-confirm" className="label-text mb-1.5 block">Confirm password</label>
                  <div className="relative">
                    <input
                      id="signup-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={8}
                      className="input-field pr-10"
                      placeholder="Repeat password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    >
                      <EyeIcon show={showConfirm} />
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary mt-1">
                  {loading ? 'Sending code…' : 'Create Account'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-medium text-civic-600 hover:text-civic-700 transition-colors">
                  Sign in
                </Link>
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="otp"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="w-full max-w-sm"
            >
              <button
                onClick={() => { setStep('form'); setError(null) }}
                className="mb-6 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Back
              </button>

              <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
              <p className="mt-1 text-sm text-slate-500">
                We sent a 6-digit code to <span className="font-medium text-slate-700">{email}</span>
              </p>

              {info && (
                <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
                  {info}
                </div>
              )}
              <ErrorBox error={error} />

              <form onSubmit={handleOtpSubmit} className="mt-8 flex flex-col gap-6">
                <div className="flex justify-between gap-2" onPaste={handleOtpPaste}>
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => { otpRefs.current[i] = el }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className="h-12 w-12 rounded-lg border border-slate-300 bg-white
                                 text-center text-lg font-semibold text-slate-900
                                 focus:border-civic-500 focus:outline-none focus:ring-2
                                 focus:ring-civic-500/20 transition-all"
                    />
                  ))}
                </div>

                <button type="submit" disabled={loading || otp.join('').length !== 6} className="btn-primary">
                  {loading ? 'Verifying…' : 'Verify & create account'}
                </button>
              </form>

              <div className="mt-4 text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-slate-500">Resend code in {resendCooldown}s</p>
                ) : (
                  <button
                    onClick={handleResend}
                    disabled={loading}
                    className="text-xs text-civic-600 hover:text-civic-700 underline underline-offset-2 transition-colors"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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

function ErrorBox({ error }: { error: string | null }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mt-4 overflow-hidden rounded-lg border border-red-200
                     bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
