import { createServerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import Link from 'next/link'

async function getStats() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const [
    { count: modelCount },
    { count: providerCount },
    { count: scoreCount },
    { count: priceCount },
    { count: stagingPriceCount },
    { count: stagingBenchmarkCount },
    { data: sources },
  ] = await Promise.all([
    supabase.from('models').select('*', { count: 'exact', head: true }),
    supabase.from('providers').select('*', { count: 'exact', head: true }),
    supabase.from('benchmark_scores').select('*', { count: 'exact', head: true }),
    supabase.from('prices').select('*', { count: 'exact', head: true }),
    supabase.from('staging_prices').select('*', { count: 'exact', head: true }),
    supabase.from('staging_benchmarks').select('*', { count: 'exact', head: true }),
    supabase.from('data_sources').select('*').order('last_fetched_at', { ascending: false }),
  ])

  return {
    modelCount: modelCount ?? 0,
    providerCount: providerCount ?? 0,
    scoreCount: scoreCount ?? 0,
    priceCount: priceCount ?? 0,
    stagingPriceCount: stagingPriceCount ?? 0,
    stagingBenchmarkCount: stagingBenchmarkCount ?? 0,
    sources: sources ?? [],
  }
}

export default async function AdminDashboard() {
  const stats = await getStats()

  const statCards = [
    { label: 'Models', value: stats.modelCount, href: '/admin' },
    { label: 'Providers', value: stats.providerCount, href: '/admin' },
    { label: 'Scores', value: stats.scoreCount, href: '/admin' },
    { label: 'Prices', value: stats.priceCount, href: '/admin' },
  ]

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-txt-primary">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="paper-card p-4">
            <p className="text-sm text-txt-muted font-body">{card.label}</p>
            <p className="text-3xl font-heading text-txt-primary mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Staging Queue */}
      <div className="paper-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg text-txt-primary">Staging Queue</h2>
          <Link href="/admin/staging" className="text-sm text-accent-blue hover:underline font-body">
            View All &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-bg-primary border border-border">
            <p className="text-sm text-txt-muted font-body">Pending Prices</p>
            <p className="text-2xl font-heading text-txt-primary mt-1">{stats.stagingPriceCount}</p>
          </div>
          <div className="p-4 rounded-lg bg-bg-primary border border-border">
            <p className="text-sm text-txt-muted font-body">Pending Benchmarks</p>
            <p className="text-2xl font-heading text-txt-primary mt-1">{stats.stagingBenchmarkCount}</p>
          </div>
        </div>
      </div>

      {/* Data Source Health */}
      <div className="paper-card p-5">
        <h2 className="font-heading text-lg text-txt-primary mb-4">Data Source Health</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-body">
            <thead>
              <tr className="text-left text-txt-muted border-b border-border">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Last Fetched</th>
                <th className="pb-2">Records</th>
              </tr>
            </thead>
            <tbody>
              {stats.sources.map((src: Record<string, unknown>) => {
                const lastFetched = src.last_fetched_at
                  ? new Date(src.last_fetched_at as string)
                  : null
                const hoursAgo = lastFetched
                  ? Math.round((Date.now() - lastFetched.getTime()) / 3600000)
                  : null
                const isStale = hoursAgo !== null && hoursAgo > 48
                const statusColor = !lastFetched
                  ? 'text-txt-muted'
                  : isStale
                    ? 'text-red-500'
                    : 'text-green-500'

                return (
                  <tr key={src.id as string} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 text-txt-primary font-medium">{src.name as string}</td>
                    <td className="py-2.5 pr-4 text-txt-muted">{src.source_type as string}</td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center gap-1.5 ${statusColor}`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {!lastFetched ? 'Never' : isStale ? 'Stale' : 'OK'}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-txt-muted">
                      {lastFetched
                        ? `${hoursAgo}h ago`
                        : '—'}
                    </td>
                    <td className="py-2.5 text-txt-muted">{(src.record_count as number) ?? '—'}</td>
                  </tr>
                )
              })}
              {stats.sources.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-txt-muted">
                    No data sources configured
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
