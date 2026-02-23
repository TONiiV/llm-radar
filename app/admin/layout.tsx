import { requireAdmin } from '@/lib/admin-auth'
import Link from 'next/link'

export const metadata = {
  title: 'Admin | LLMRadar',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin()

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Admin top bar */}
      <header className="border-b border-border bg-bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="font-heading text-lg tracking-[2px] text-txt-primary">
              LLMRadar <span className="text-xs text-txt-muted font-body ml-1">Admin</span>
            </Link>
            <nav className="flex gap-4 text-sm font-body">
              <Link href="/admin" className="text-txt-secondary hover:text-txt-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/admin/staging" className="text-txt-secondary hover:text-txt-primary transition-colors">
                Staging
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-txt-muted font-body">{session.user.email}</span>
            <Link href="/" className="text-xs text-txt-muted hover:text-txt-secondary font-body">
              &larr; Site
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
