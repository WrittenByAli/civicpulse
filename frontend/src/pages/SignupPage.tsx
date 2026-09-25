import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signup as apiSignup } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { ApiError } from '../api/client'
import type { UserRole } from '../types/api'

export function SignupPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('citizen')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { access_token } = await apiSignup({ email, password, role })
      await login(access_token)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-sm p-8"
      >
        <h1 className="mb-6 text-2xl font-semibold text-zinc-100">Create account</h1>

        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {error}
          </motion.div>
        )}

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
            <label className="label-uppercase mb-1.5 block">Role</label>
            <div className="flex gap-3">
              {(['citizen', 'operator'] as UserRole[]).map((r) => (
                <label
                  key={r}
                  className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors
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
          <button
            type="submit"
            disabled={loading}
            className="btn-primary mt-2"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-300 hover:text-white underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
