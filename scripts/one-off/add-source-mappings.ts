import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// external_name → model slug → will be resolved to model_id at runtime
const MAPPINGS: { source_key: string; external_name: string; slug: string }[] = [
  // ── SWE-bench Verified source mappings ──
  // Claude
  { source_key: 'swe_bench', external_name: 'claude-opus-4-5', slug: 'claude-opus-45' },
  { source_key: 'swe_bench', external_name: 'claude-4-5-opus', slug: 'claude-opus-45' },
  { source_key: 'swe_bench', external_name: 'claude-opus-4-6', slug: 'claude-opus-46' },
  { source_key: 'swe_bench', external_name: 'claude-sonnet-4-5', slug: 'claude-sonnet-45' },
  { source_key: 'swe_bench', external_name: 'claude-4-sonnet', slug: 'claude-sonnet-4' },
  { source_key: 'swe_bench', external_name: 'claude-4-opus', slug: 'claude-opus-4' },
  { source_key: 'swe_bench', external_name: 'claude-haiku-4-5', slug: 'claude-haiku-45' },
  // GPT / OpenAI
  { source_key: 'swe_bench', external_name: 'gpt-5-2', slug: 'gpt-52' },
  { source_key: 'swe_bench', external_name: 'gpt-5.1-codex', slug: 'gpt-51-codex' },
  { source_key: 'swe_bench', external_name: 'gpt-oss-120b', slug: 'gpt-oss-120b' },
  // Gemini
  { source_key: 'swe_bench', external_name: 'gemini-3-pro-preview', slug: 'gemini-3-pro' },
  { source_key: 'swe_bench', external_name: 'gemini-3-flash-preview', slug: 'gemini-3-flash' },
  // Chinese models
  { source_key: 'swe_bench', external_name: 'minimax-m2.5', slug: 'minimax-m25' },
  { source_key: 'swe_bench', external_name: 'minimax-m2', slug: 'minimax-m2' },
  { source_key: 'swe_bench', external_name: 'glm-5', slug: 'glm-5' },
  { source_key: 'swe_bench', external_name: 'glm-4.6', slug: 'glm-46' },
  { source_key: 'swe_bench', external_name: 'GLM-4.5', slug: 'glm-45' },
  { source_key: 'swe_bench', external_name: 'kimi-k2.5', slug: 'kimi-k25' },
  { source_key: 'swe_bench', external_name: 'kimi-k2-instruct', slug: 'kimi-k2' },
  { source_key: 'swe_bench', external_name: 'Kimi-K2-Instruct', slug: 'kimi-k2' },
  { source_key: 'swe_bench', external_name: 'Kimi-K2-Thinking', slug: 'kimi-k2-thinking' },
  { source_key: 'swe_bench', external_name: 'kimi-k2-0905-preview', slug: 'kimi-k2-0905' },
  { source_key: 'swe_bench', external_name: 'moonshot/kimi-k2-0711-preview', slug: 'kimi-k2-0711' },
  { source_key: 'swe_bench', external_name: 'deepseek-v3.2', slug: 'deepseek-v32' },
  { source_key: 'swe_bench', external_name: 'deepseek-v3.2-reasoner', slug: 'deepseek-v32-exp' },
  { source_key: 'swe_bench', external_name: 'DeepSeek-V3-0324', slug: 'deepseek-v3-0324' },
  // Qwen
  { source_key: 'swe_bench', external_name: 'Qwen3-Coder-480B-A35B-Instruct', slug: 'qwen3-coder-480b-a35b' },

  // ── BFCL source mappings ──
  // Claude
  { source_key: 'bfcl', external_name: 'Claude-Opus-4-5-20251101', slug: 'claude-opus-45' },
  { source_key: 'bfcl', external_name: 'Claude-Sonnet-4-5-20250929', slug: 'claude-sonnet-45' },
  { source_key: 'bfcl', external_name: 'Claude-Haiku-4-5-20251001', slug: 'claude-haiku-45' },
  // GPT / OpenAI
  { source_key: 'bfcl', external_name: 'GPT-5.2-2025-12-11', slug: 'gpt-52' },
  { source_key: 'bfcl', external_name: 'GPT-5-mini-2025-08-07', slug: 'gpt-5-mini' },
  { source_key: 'bfcl', external_name: 'GPT-4.1-2025-04-14', slug: 'gpt-41' },
  { source_key: 'bfcl', external_name: 'GPT-4.1-mini-2025-04-14', slug: 'gpt-41-mini' },
  // Gemini
  { source_key: 'bfcl', external_name: 'Gemini-3-Pro-Preview', slug: 'gemini-3-pro' },
  { source_key: 'bfcl', external_name: 'Gemini-2.5-Flash', slug: 'gemini-25-flash' },
  // Others
  { source_key: 'bfcl', external_name: 'Grok-4-0709', slug: 'grok-4' },
  { source_key: 'bfcl', external_name: 'Moonshotai-Kimi-K2-Instruct', slug: 'kimi-k2' },
  { source_key: 'bfcl', external_name: 'GLM-4.6', slug: 'glm-46' },
  { source_key: 'bfcl', external_name: 'DeepSeek-V3.2-Exp', slug: 'deepseek-v32' },
]

async function main() {
  console.log(`Inserting ${MAPPINGS.length} model name mappings...`)

  // Load model slug → id lookup
  const { data: models, error: modelsErr } = await supabase
    .from('models')
    .select('id, slug')
  if (modelsErr) throw modelsErr
  const slugToId = new Map((models ?? []).map(m => [m.slug, m.id]))

  // Build rows with model_id
  const rows: { source_key: string; external_name: string; model_id: string }[] = []
  let skipped = 0
  for (const m of MAPPINGS) {
    const modelId = slugToId.get(m.slug)
    if (!modelId) {
      console.warn(`  Skipping ${m.external_name} → ${m.slug}: slug not found in models`)
      skipped++
      continue
    }
    rows.push({ source_key: m.source_key, external_name: m.external_name, model_id: modelId })
  }

  // Upsert
  if (rows.length > 0) {
    const { error } = await supabase
      .from('model_name_mappings')
      .upsert(rows, { onConflict: 'source_key,external_name' })
    if (error) {
      console.error('  Upsert failed:', error.message)
    }
  }

  console.log(`  ${rows.length} mappings upserted, ${skipped} skipped`)
}

main().catch((err) => {
  console.error('Failed to add source mappings:', err.message)
  process.exit(1)
})
