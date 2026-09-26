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

  // Step 1: form
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>('citizen')

  // Step 2: OTP
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  // ── Step 1: submit form ────────────────────────────────────────────────────
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

  // ── Step 2: verify OTP ─────────────────────────────────────────────────────
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
      navigate('/', { replace: true })
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

  // ── Resend cooldown timer ─────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <AnimatePresence mode="wait">
        {step === 'form' ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="glass-card w-full max-w-sm p-8"
          >
            <h1 className="mb-6 text-2xl font-semibold text-zinc-100">Create account</h1>

            <ErrorBox error={error} />

            <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
              <div>
                <label className="label-uppercase mb-1.5 block">Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="input-field w-full"
                  placeholder="Ali Hassan"
                />
              </div>
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
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="input-field w-full"
                  placeholder="min. 8 characters"
                />
              </div>
              <div>
                <label className="label-uppercase mb-1.5 block">Confirm password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  className="input-field w-full"
                  placeholder="repeat password"
                />
              </div>
              <div>
                <label className="label-uppercase mb-1.5 block">Role</label>
                <div className="flex gap-3">
                  {(['citizen', 'operator'] as UserRole[]).map((r) => (
                    <label
                      key={r}
                      className={`flex flex-1 cursor-pointer items-center justify-center gap-2
                                  rounded-lg border px-3 py-2 text-sm font-medium capitalize
                                  transition-colors
                        ${role === r
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                          : 'border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.05]'
                        }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary mt-2">
                {loading ? 'Sending code…' : 'Send verification code'}
              </button>
            </form>

            <p className="mt-4 text-center text-sm text-zinc-500">
              Already have an account?{' '}
              <Link to="/login" className="text-zinc-300 hover:text-white underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="glass-card w-full max-w-sm p-8"
          >
            <button
              onClick={() => { setStep('form'); setError(null) }}
              className="mb-4 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Back
            </button>

            <h1 className="mb-1 text-2xl font-semibold text-zinc-100">Check your email</h1>
            <p className="mb-6 text-sm text-zinc-500">
              We sent a 6-digit code to <span className="text-zinc-300">{email}</span>
            </p>

            {info && (
              <div className="mb-4 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm text-blue-400">
                {info}
              </div>
            )}
            <ErrorBox error={error} />

            <form onSubmit={handleOtpSubmit} className="flex flex-col gap-6">
              <div
                className="flex justify-between gap-2"
                onPaste={handleOtpPaste}
              >
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
                    className="h-12 w-12 rounded-lg border border-white/[0.08] bg-white/[0.03]
                               text-center text-lg font-semibold text-zinc-100
                               focus:border-blue-500/50 focus:outline-none focus:ring-1
                               focus:ring-blue-500/30 transition-all"
                  />
                ))}
              </div>

              <button type="submit" disabled={loading || otp.join('').length !== 6} className="btn-primary">
                {loading ? 'Verifying…' : 'Verify & create account'}
              </button>
            </form>

            <div className="mt-4 text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-zinc-600">Resend code in {resendCooldown}s</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
                >
                  Resend code
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
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
          className="mb-4 overflow-hidden rounded-lg border border-red-500/20
                     bg-red-500/10 px-3 py-2 text-sm text-red-400"
        >
          {error}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
