
-- Lock down founder_profiles and founder_signals.
-- Writes go through server functions using the service_role key, which
-- bypasses RLS, so no public write policies are needed.

DROP POLICY IF EXISTS "Anyone can create founder profiles" ON public.founder_profiles;
DROP POLICY IF EXISTS "Anyone can update founder profiles" ON public.founder_profiles;
DROP POLICY IF EXISTS "Founder profiles are viewable by everyone" ON public.founder_profiles;

CREATE POLICY "Published founder profiles are viewable by everyone"
  ON public.founder_profiles
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS "Anyone can create founder signals" ON public.founder_signals;
DROP POLICY IF EXISTS "Founder signals are viewable by everyone" ON public.founder_signals;

CREATE POLICY "Founder signals for published profiles are viewable by everyone"
  ON public.founder_signals
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.founder_profiles p
    WHERE p.id = founder_signals.profile_id AND p.published = true
  ));
