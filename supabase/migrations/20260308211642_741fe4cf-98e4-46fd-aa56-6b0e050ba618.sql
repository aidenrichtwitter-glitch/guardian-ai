
CREATE TABLE public.system_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'requests',
  content TEXT NOT NULL,
  cycle_number INTEGER NOT NULL DEFAULT 0,
  evolution_level INTEGER NOT NULL DEFAULT 0,
  capabilities_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to system_requests" ON public.system_requests
  FOR ALL USING (true) WITH CHECK (true);
