"use client"

import { createBrowserClient } from '@supabase/auth-helpers-nextjs'
import { useState, useEffect, useCallback } from 'react'

interface StagingPrice {
  id: string
  model_slug: string
  input_price: number
  output_price: number
  source: string
  fetched_at: string
  status: string
}

interface StagingBenchmark {
  id: string
  model_slug: string
  benchmark_key: string
  raw_score: number
  source: string
  fetched_at: string
  status: string
}

export default function StagingPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const [prices, setPrices] = useState<StagingPrice[]>([])
  const [benchmarks, setBenchmarks] = useState<StagingBenchmark[]>([])
  const [tab, setTab] = useState<'prices' | 'benchmarks'>('prices')
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: b }] = await Promise.all([
      supabase.from('staging_prices').select('*').eq('status', 'pending').order('fetched_at', { ascending: false }),
      supabase.from('staging_benchmarks').select('*').eq('status', 'pending').order('fetched_at', { ascending: false }),
    ])
    setPrices(p ?? [])
    setBenchmarks(b ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAction = async (table: string, id: string, action: 'approved' | 'rejected') => {
    await supabase.from(table).update({ status: action }).eq('id', id)
    fetchData()
  }

  const handleBulkAction = async (table: string, ids: string[], action: 'approved' | 'rejected') => {
    await supabase.from(table).update({ status: action }).in('id', ids)
    fetchData()
  }

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl text-txt-primary">Staging Review</h1>

      {/* Tabs */}
      <div className="flex gap-1 paper-card-flat p-1">
        {(['prices', 'benchmarks'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 px-4 py-2 text-sm font-heading font-medium rounded transition-all ${
              tab === t
                ? 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
                : 'text-txt-muted hover:text-txt-primary hover:bg-bg-card/50'
            }`}
          >
            {t === 'prices' ? `Prices (${prices.length})` : `Benchmarks (${benchmarks.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="paper-card p-12 text-center">
          <p className="text-txt-muted font-body">Loading...</p>
        </div>
      ) : (
        <>
          {/* Prices Tab */}
          {tab === 'prices' && (
            <div className="paper-card p-5">
              {prices.length === 0 ? (
                <p className="text-center text-txt-muted py-8 font-body">No pending prices</p>
              ) : (
                <>
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      onClick={() => handleBulkAction('staging_prices', prices.map(p => p.id), 'approved')}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => handleBulkAction('staging_prices', prices.map(p => p.id), 'rejected')}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg text-txt-muted hover:text-red-500 hover:border-red-500/30 transition-colors"
                    >
                      Reject All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="text-left text-txt-muted border-b border-border">
                          <th className="pb-2 pr-4">Model</th>
                          <th className="pb-2 pr-4">Input $/M</th>
                          <th className="pb-2 pr-4">Output $/M</th>
                          <th className="pb-2 pr-4">Source</th>
                          <th className="pb-2 pr-4">Fetched</th>
                          <th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prices.map((p) => (
                          <tr key={p.id} className="border-b border-border/50">
                            <td className="py-2.5 pr-4 text-txt-primary font-medium">{p.model_slug}</td>
                            <td className="py-2.5 pr-4 text-txt-secondary">${p.input_price}</td>
                            <td className="py-2.5 pr-4 text-txt-secondary">${p.output_price}</td>
                            <td className="py-2.5 pr-4 text-txt-muted">{p.source}</td>
                            <td className="py-2.5 pr-4 text-txt-muted">
                              {new Date(p.fetched_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAction('staging_prices', p.id, 'approved')}
                                  className="text-xs text-green-500 hover:underline"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction('staging_prices', p.id, 'rejected')}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Benchmarks Tab */}
          {tab === 'benchmarks' && (
            <div className="paper-card p-5">
              {benchmarks.length === 0 ? (
                <p className="text-center text-txt-muted py-8 font-body">No pending benchmarks</p>
              ) : (
                <>
                  <div className="flex justify-end gap-2 mb-4">
                    <button
                      onClick={() => handleBulkAction('staging_benchmarks', benchmarks.map(b => b.id), 'approved')}
                      className="btn-primary px-3 py-1.5 text-xs"
                    >
                      Approve All
                    </button>
                    <button
                      onClick={() => handleBulkAction('staging_benchmarks', benchmarks.map(b => b.id), 'rejected')}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg text-txt-muted hover:text-red-500 hover:border-red-500/30 transition-colors"
                    >
                      Reject All
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm font-body">
                      <thead>
                        <tr className="text-left text-txt-muted border-b border-border">
                          <th className="pb-2 pr-4">Model</th>
                          <th className="pb-2 pr-4">Benchmark</th>
                          <th className="pb-2 pr-4">Score</th>
                          <th className="pb-2 pr-4">Source</th>
                          <th className="pb-2 pr-4">Fetched</th>
                          <th className="pb-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarks.map((b) => (
                          <tr key={b.id} className="border-b border-border/50">
                            <td className="py-2.5 pr-4 text-txt-primary font-medium">{b.model_slug}</td>
                            <td className="py-2.5 pr-4 text-txt-secondary">{b.benchmark_key}</td>
                            <td className="py-2.5 pr-4 text-txt-secondary">{b.raw_score}</td>
                            <td className="py-2.5 pr-4 text-txt-muted">{b.source}</td>
                            <td className="py-2.5 pr-4 text-txt-muted">
                              {new Date(b.fetched_at).toLocaleDateString()}
                            </td>
                            <td className="py-2.5">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAction('staging_benchmarks', b.id, 'approved')}
                                  className="text-xs text-green-500 hover:underline"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleAction('staging_benchmarks', b.id, 'rejected')}
                                  className="text-xs text-red-500 hover:underline"
                                >
                                  Reject
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
