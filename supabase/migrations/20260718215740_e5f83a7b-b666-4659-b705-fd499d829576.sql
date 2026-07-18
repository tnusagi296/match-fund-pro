
CREATE TABLE public.founder_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  headline text NOT NULL DEFAULT '',
  github text,
  linkedin text,
  site text,
  deck_url text,
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.founder_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.founder_profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  weight int NOT NULL DEFAULT 1,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX founder_signals_profile_id_idx ON public.founder_signals(profile_id);

GRANT SELECT, INSERT, UPDATE ON public.founder_profiles TO anon, authenticated;
GRANT SELECT, INSERT ON public.founder_signals TO anon, authenticated;
GRANT ALL ON public.founder_profiles TO service_role;
GRANT ALL ON public.founder_signals TO service_role;

ALTER TABLE public.founder_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.founder_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Founder profiles are viewable by everyone"
  ON public.founder_profiles FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create founder profiles"
  ON public.founder_profiles FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update founder profiles"
  ON public.founder_profiles FOR UPDATE
  USING (true) WITH CHECK (true);

CREATE POLICY "Founder signals are viewable by everyone"
  ON public.founder_signals FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create founder signals"
  ON public.founder_signals FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_founder_profiles_updated_at
  BEFORE UPDATE ON public.founder_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
