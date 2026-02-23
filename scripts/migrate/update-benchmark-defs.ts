import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

/**
 * DB migration script for benchmark pipeline refactor:
 * 1. Add norm_method column to benchmark_definitions
 * 2. Add Speed benchmarks (output_tps, ttft_ms)
 * 3. Delete deprecated benchmarks (critpt, scicode, gsm8k, alpaca_eval, aa_lcr)
 * 4. Update model_name_mappings table structure
 */
async function main() {
  console.log('Running benchmark definitions migration...')

  // 1. Add norm_method column (idempotent — Supabase ignores if exists via RPC)
  // We use raw SQL via Supabase's rpc or direct query
  console.log('  Step 1: Adding norm_method column...')
  const { error: alterErr } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE benchmark_definitions ADD COLUMN IF NOT EXISTS norm_method text DEFAULT NULL;
    `
  })
  if (alterErr) {
    // If rpc doesn't exist, try direct approach
    console.warn('  Note: exec_sql RPC not available, norm_method column may need manual addition')
    console.warn('  SQL: ALTER TABLE benchmark_definitions ADD COLUMN IF NOT EXISTS norm_method text DEFAULT NULL;')
  } else {
    console.log('  norm_method column added/verified')
  }

  // 2. Insert Speed benchmarks
  console.log('  Step 2: Adding Speed benchmarks...')
  const speedBenchmarks = [
    {
      key: 'output_tps',
      label: 'Output TPS',
      category: 'speed',
      unit: 'tok/s',
      higher_is_better: true,
      max_possible_score: null,
      weight: 1.0,
      display_order: 60,
      source: 'artificial_analysis',
      norm_method: 'percentile_rank',
    },
    {
      key: 'ttft_ms',
      label: 'TTFT',
      category: 'speed',
      unit: 'ms',
      higher_is_better: false,
      max_possible_score: null,
      weight: 0.8,
      display_order: 61,
      source: 'artificial_analysis',
      norm_method: 'percentile_rank',
    },
  ]

  for (const bm of speedBenchmarks) {
    const { error } = await supabase
      .from('benchmark_definitions')
      .upsert(bm, { onConflict: 'key' })
    if (error) {
      console.error(`  Failed to upsert ${bm.key}:`, error.message)
    } else {
      console.log(`  Upserted ${bm.key}`)
    }
  }

  // 3. Delete deprecated benchmarks
  console.log('  Step 3: Removing deprecated benchmarks...')
  const deprecated = ['critpt', 'scicode', 'gsm8k', 'alpaca_eval', 'aa_lcr']

  // First remove scores referencing these benchmarks
  for (const key of deprecated) {
    const { error: scoreErr } = await supabase
      .from('benchmark_scores')
      .delete()
      .eq('benchmark_key', key)
    if (scoreErr) {
      console.warn(`  Warning: Could not delete scores for ${key}: ${scoreErr.message}`)
    }

    const { error: stagingErr } = await supabase
      .from('staging_benchmarks')
      .delete()
      .eq('benchmark_key', key)
    if (stagingErr) {
      console.warn(`  Warning: Could not delete staging for ${key}: ${stagingErr.message}`)
    }
  }

  const { error: delErr } = await supabase
    .from('benchmark_definitions')
    .delete()
    .in('key', deprecated)
  if (delErr) {
    console.error('  Failed to delete deprecated benchmarks:', delErr.message)
  } else {
    console.log(`  Deleted deprecated benchmarks: ${deprecated.join(', ')}`)
  }

  // 4. Update model_name_mappings table structure
  console.log('  Step 4: Updating model_name_mappings table...')
  const { error: mnmErr } = await supabase.rpc('exec_sql', {
    query: `
      ALTER TABLE model_name_mappings ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'exact';
      ALTER TABLE model_name_mappings ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_mnm_source_name ON model_name_mappings(source_key, source_name);
    `
  })
  if (mnmErr) {
    console.warn('  Note: model_name_mappings schema update may need manual execution')
    console.warn('  SQL: ALTER TABLE model_name_mappings ADD COLUMN IF NOT EXISTS confidence text DEFAULT \'exact\';')
    console.warn('  SQL: ALTER TABLE model_name_mappings ADD COLUMN IF NOT EXISTS auto_generated boolean DEFAULT false;')
    console.warn('  SQL: CREATE UNIQUE INDEX IF NOT EXISTS idx_mnm_source_name ON model_name_mappings(source_key, source_name);')
  } else {
    console.log('  model_name_mappings table updated')
  }

  console.log('Migration complete.')
}

main().catch((err) => {
  console.error('Migration failed:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
