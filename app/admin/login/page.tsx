"use client"

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useState } from 'react'
import Link from 'next/link'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/admin` },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="paper-card p-8 w-full max-w-sm">
        <div className="text-center mb-6">
          <Link href="/" className="font-heading text-2xl tracking-[3px] text-txt-primary">
            LLMRadar
          </Link>
          <p className="text-sm text-txt-muted mt-2 font-body">Admin Panel</p>
        </div>

        {sent ? (
          <div className="text-center">
            <div className="text-4xl mb-4">&#9993;</div>
            <h2 className="font-heading text-xl text-txt-primary mb-2">Check your email</h2>
            <p className="text-sm text-txt-muted font-body">
              We sent a magic link to <strong>{email}</strong>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-sm text-accent-blue hover:underline font-body"
            >
              Try a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <label className="block text-sm text-txt-secondary font-body mb-1">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              className="w-full px-4 py-2.5 bg-bg-card border border-border rounded-lg font-body text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue transition-colors mb-4"
            />
            {error && (
              <p className="text-sm text-red-500 mb-3 font-body">{error}</p>
            )}
            <button type="submit" className="btn-primary w-full py-2.5">
              Send Magic Link
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-border text-center">
          <Link href="/" className="text-xs text-txt-muted hover:text-txt-secondary font-body">
            &larr; Back to LLMRadar
          </Link>
        </div>
      </div>
    </div>
  )
}
