
-- 1) user_profiles for account_role
CREATE TYPE public.account_role AS ENUM ('investor', 'founder', 'admin');

CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  account_role public.account_role NOT NULL DEFAULT 'investor',
  fund_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile" ON public.user_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.user_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.user_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) founder_profiles: ownership + claim/verification lifecycle
CREATE TYPE public.profile_claim_status AS ENUM (
  'unclaimed',
  'pending',
  'claimed',
  'rejected',
  'self_submitted'
);
CREATE TYPE public.profile_verification_status AS ENUM ('unverified', 'pending', 'verified');
CREATE TYPE public.profile_source_origin AS ENUM (
  'crawler',
  'self_created',
  'public_scan',
  'founder_submission',
  'demo'
);

ALTER TABLE public.founder_profiles
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_origin public.profile_source_origin NOT NULL DEFAULT 'crawler',
  ADD COLUMN IF NOT EXISTS claim_status public.profile_claim_status NOT NULL DEFAULT 'unclaimed',
  ADD COLUMN IF NOT EXISTS verification_status public.profile_verification_status NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS biography text;

ALTER TABLE public.founder_profiles
  DROP CONSTRAINT IF EXISTS founder_profiles_profile_origin_check,
  DROP CONSTRAINT IF EXISTS founder_profiles_claim_status_check;

-- The graph prototype originally stored provenance and claim lifecycle as
-- constrained text. Preserve its values while converging on the enum schema.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'founder_profiles'
      AND column_name = 'profile_origin'
      AND udt_name <> 'profile_source_origin'
  ) THEN
    ALTER TABLE public.founder_profiles ALTER COLUMN profile_origin DROP DEFAULT;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN profile_origin TYPE public.profile_source_origin
      USING profile_origin::text::public.profile_source_origin;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN profile_origin SET DEFAULT 'crawler'::public.profile_source_origin;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'founder_profiles'
      AND column_name = 'claim_status'
      AND udt_name <> 'profile_claim_status'
  ) THEN
    ALTER TABLE public.founder_profiles ALTER COLUMN claim_status DROP DEFAULT;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN claim_status TYPE public.profile_claim_status
      USING claim_status::text::public.profile_claim_status;
    ALTER TABLE public.founder_profiles
      ALTER COLUMN claim_status SET DEFAULT 'unclaimed'::public.profile_claim_status;
  END IF;
END;
$$;

ALTER TABLE public.founder_profiles
  ADD CONSTRAINT founder_profiles_profile_origin_check CHECK (
    profile_origin::text IN (
      'crawler',
      'self_created',
      'public_scan',
      'founder_submission',
      'demo'
    )
  ),
  ADD CONSTRAINT founder_profiles_claim_status_check CHECK (
    claim_status::text IN (
      'unclaimed',
      'pending',
      'self_submitted',
      'claimed',
      'rejected'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS founder_profiles_owner_unique
  ON public.founder_profiles(owner_user_id) WHERE owner_user_id IS NOT NULL;

-- Allow founder owners to update their claimed profile
CREATE POLICY "Owner reads own founder profile" ON public.founder_profiles
  FOR SELECT TO authenticated USING (owner_user_id = auth.uid());
CREATE POLICY "Owner updates own founder profile" ON public.founder_profiles
  FOR UPDATE TO authenticated USING (owner_user_id = auth.uid() AND verification_status = 'verified')
  WITH CHECK (owner_user_id = auth.uid());

-- 3) profile_claims
CREATE TYPE public.claim_request_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.claim_verification_method AS ENUM ('email', 'github', 'website', 'manual');

CREATE TABLE public.profile_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_profile_id uuid NOT NULL REFERENCES public.founder_profiles(id) ON DELETE CASCADE,
  requesting_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_method public.claim_verification_method NOT NULL DEFAULT 'email',
  status public.claim_request_status NOT NULL DEFAULT 'pending',
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.profile_claims TO authenticated;
GRANT ALL ON public.profile_claims TO service_role;
ALTER TABLE public.profile_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requesters read own claims" ON public.profile_claims
  FOR SELECT TO authenticated USING (requesting_user_id = auth.uid());
CREATE POLICY "Requesters create own claims" ON public.profile_claims
  FOR INSERT TO authenticated WITH CHECK (requesting_user_id = auth.uid());

CREATE TRIGGER profile_claims_updated_at
  BEFORE UPDATE ON public.profile_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) investor_founder_actions (Monitoring / Shortlisted / Passed)
CREATE TYPE public.investor_action_status AS ENUM ('monitoring', 'shortlisted', 'passed');

CREATE TABLE public.investor_founder_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  founder_profile_id uuid NOT NULL REFERENCES public.founder_profiles(id) ON DELETE CASCADE,
  status public.investor_action_status NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (investor_user_id, founder_profile_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_founder_actions TO authenticated;
GRANT ALL ON public.investor_founder_actions TO service_role;
ALTER TABLE public.investor_founder_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investor manages own actions" ON public.investor_founder_actions
  FOR ALL TO authenticated
  USING (investor_user_id = auth.uid())
  WITH CHECK (investor_user_id = auth.uid());

CREATE TRIGGER investor_founder_actions_updated_at
  BEFORE UPDATE ON public.investor_founder_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) investor_theses (per-investor thesis storage — client can still keep localStorage cache)
CREATE TABLE public.investor_theses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stages text[] NOT NULL DEFAULT '{}',
  sectors text[] NOT NULL DEFAULT '{}',
  geographies text[] NOT NULL DEFAULT '{}',
  signals text[] NOT NULL DEFAULT '{}',
  check_min integer,
  check_max integer,
  weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_theses TO authenticated;
GRANT ALL ON public.investor_theses TO service_role;
ALTER TABLE public.investor_theses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Investor manages own thesis" ON public.investor_theses
  FOR ALL TO authenticated
  USING (investor_user_id = auth.uid())
  WITH CHECK (investor_user_id = auth.uid());

CREATE TRIGGER investor_theses_updated_at
  BEFORE UPDATE ON public.investor_theses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Auto-create user_profiles row on signup (role captured from raw_user_meta_data.account_role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role public.account_role;
BEGIN
  chosen_role := COALESCE(
    (NEW.raw_user_meta_data ->> 'account_role')::public.account_role,
    'investor'
  );
  INSERT INTO public.user_profiles (user_id, email, full_name, account_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    chosen_role
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
