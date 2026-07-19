
ALTER TABLE public.user_profiles ALTER COLUMN account_role DROP DEFAULT;
ALTER TABLE public.user_profiles ALTER COLUMN account_role DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role public.account_role;
  raw_role text;
BEGIN
  raw_role := NEW.raw_user_meta_data ->> 'account_role';
  IF raw_role IN ('investor', 'founder', 'admin') THEN
    chosen_role := raw_role::public.account_role;
  ELSE
    chosen_role := NULL;
  END IF;
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

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
