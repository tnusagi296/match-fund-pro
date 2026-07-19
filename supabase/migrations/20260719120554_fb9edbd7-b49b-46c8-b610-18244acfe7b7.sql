-- 1) Do not silently assign a default account_role during signup.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  chosen_role public.account_role;
BEGIN
  -- Only accept investor or founder from client-supplied metadata.
  -- Admin must be assigned server-side; NULL means "user must pick via /select-role".
  chosen_role := NULLIF((NEW.raw_user_meta_data ->> 'account_role'), '')::public.account_role;
  IF chosen_role IS NOT NULL AND chosen_role NOT IN ('investor','founder') THEN
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
$function$;

-- Ensure the trigger is attached (idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2) Prevent client-side privilege escalation and role changes after set.
CREATE OR REPLACE FUNCTION public.enforce_account_role_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Never allow clients to assign 'admin' — only service_role can.
  IF NEW.account_role = 'admin' AND OLD.account_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'account_role admin can only be assigned by service_role';
  END IF;
  -- Once account_role is set (investor/founder), it cannot be changed via client.
  IF OLD.account_role IS NOT NULL
     AND NEW.account_role IS DISTINCT FROM OLD.account_role THEN
    RAISE EXCEPTION 'account_role is immutable once set';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_account_role_immutable_trg ON public.user_profiles;
CREATE TRIGGER enforce_account_role_immutable_trg
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
WHEN (
  -- service_role bypasses; the check runs for authenticated user updates.
  current_setting('request.jwt.claims', true)::jsonb ->> 'role' IS DISTINCT FROM 'service_role'
)
EXECUTE FUNCTION public.enforce_account_role_immutable();