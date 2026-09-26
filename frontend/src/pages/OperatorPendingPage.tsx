import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function OperatorPendingPage() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 text-center"
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center
                        rounded-full bg-amber-500/10 border border-amber-500/20">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
               stroke="#f59e0b" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>

        <h1 className="mb-2 text-xl font-semibold text-zinc-100">
          Operator request submitted
        </h1>
        <p className="mb-6 text-sm text-zinc-500 leading-relaxed">
          Your account has been created. The administrator will review your
          operator access request and send you an email once a decision is made.
        </p>

        <div className="mb-6 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 text-left">
          <p className="label-uppercase mb-2">Account details</p>
          <p className="text-sm text-zinc-300">{user?.email}</p>
          <p className="mt-1 text-xs text-zinc-500">
            Current role:{' '}
            <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-blue-400">citizen</span>
            {' '}→ pending operator approval
          </p>
        </div>

        <p className="mb-4 text-xs text-zinc-600">
          In the meantime you can use CivicPulse as a citizen — submit complaints
          and track their status.
        </p>

        <Link to="/" className="btn-primary">
          Continue as citizen
        </Link>
      </motion.div>
    </div>
  )
}
