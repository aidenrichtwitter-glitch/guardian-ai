-- API Registry for external API keys (encrypted storage)
CREATE TABLE public.api_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  base_url TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to api_registry" ON public.api_registry
  FOR ALL USING (true) WITH CHECK (true);

-- Evolution briefings table for ghost instance outputs
CREATE TABLE public.evolution_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_type TEXT NOT NULL DEFAULT 'morning',
  content TEXT NOT NULL,
  evolution_level INTEGER NOT NULL DEFAULT 0,
  capabilities_count INTEGER NOT NULL DEFAULT 0,
  cycle_number INTEGER NOT NULL DEFAULT 0,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.evolution_briefings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to evolution_briefings" ON public.evolution_briefings
  FOR ALL USING (true) WITH CHECK (true);