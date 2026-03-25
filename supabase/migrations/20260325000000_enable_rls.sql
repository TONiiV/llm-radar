-- Enable RLS on all public schema tables
-- Fix: Supabase security advisory rls_disabled_in_public
-- llm-radar is a public read-only showcase app:
--   - All tables are publicly readable (anon + authenticated)
--   - No write policies needed (data is managed via service_role key)

-- ============================================================
-- 1. Enable RLS on all tables
-- ============================================================

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speed_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_name_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staging_benchmarks ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Public SELECT policies (read-only showcase app)
-- ============================================================

CREATE POLICY "Public read access" ON public.providers
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.models
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.benchmark_definitions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.benchmark_scores
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.speed_metrics
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.data_sources
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.model_name_mappings
  FOR SELECT TO anon, authenticated USING (true);

-- staging tables: only service_role should write; anon can read (or restrict if preferred)
CREATE POLICY "Public read access" ON public.staging_prices
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Public read access" ON public.staging_benchmarks
  FOR SELECT TO anon, authenticated USING (true);
