-- Memory Palace table for long-term state kernels
CREATE TABLE public.lambda_evolution_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  evolution_level INTEGER NOT NULL DEFAULT 0,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  merkle_root TEXT,
  state_blob JSONB NOT NULL DEFAULT '{}'::jsonb,
  cycle_number INTEGER NOT NULL DEFAULT 0,
  label TEXT
);

ALTER TABLE public.lambda_evolution_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to lambda_evolution_state" ON public.lambda_evolution_state
  FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for artifacts
INSERT INTO storage.buckets (id, name, public) VALUES ('lambda-artifacts', 'lambda-artifacts', true);

CREATE POLICY "Public read lambda-artifacts" ON storage.objects
  FOR SELECT USING (bucket_id = 'lambda-artifacts');

CREATE POLICY "Public insert lambda-artifacts" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'lambda-artifacts');

CREATE POLICY "Public delete lambda-artifacts" ON storage.objects
  FOR DELETE USING (bucket_id = 'lambda-artifacts');