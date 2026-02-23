import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean)

function getSupabaseServer() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — can't set cookies
          }
        },
      },
    }
  )
}

export async function requireAdmin() {
  const supabase = getSupabaseServer()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) redirect('/admin/login')

  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(session.user.email!)) {
    redirect('/admin/unauthorized')
  }

  return session
}

export async function getSession() {
  const supabase = getSupabaseServer()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
