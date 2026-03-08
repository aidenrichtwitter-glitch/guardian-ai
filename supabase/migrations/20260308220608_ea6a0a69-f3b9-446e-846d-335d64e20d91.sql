
CREATE TABLE public.lambda_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_type text NOT NULL DEFAULT 'evolution',
  description text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  result jsonb DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz DEFAULT NULL
);

ALTER TABLE public.lambda_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public access to lambda_tasks" ON public.lambda_tasks
  FOR ALL USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.lambda_tasks;
