ALTER TABLE public.capabilities ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.capabilities ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.capabilities ADD COLUMN IF NOT EXISTS verification_method text;