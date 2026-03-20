-- ============================================================
-- WalletWise — Profile recovery for pre-existing auth users
-- Handles the case where handle_new_user trigger didn't fire
-- (e.g. user signed up before migrations were applied).
-- Apply in Supabase Dashboard → SQL Editor
-- ============================================================

-- RPC: idempotent profile + household creation for the calling user.
-- SECURITY DEFINER so it can bypass RLS to insert profiles/households.
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
  p_display_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  household_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        UUID := auth.uid();
  v_household_id   UUID;
  v_display_name   TEXT;
BEGIN
  -- Return early if profile already exists
  IF EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = v_user_id) THEN
    RETURN QUERY
      SELECT profiles.id, profiles.name, profiles.household_id
      FROM   public.profiles
      WHERE  profiles.id = v_user_id;
    RETURN;
  END IF;

  v_display_name := COALESCE(
    NULLIF(TRIM(p_display_name), ''),
    (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE auth.users.id = v_user_id),
    'My'
  );

  -- Create household
  INSERT INTO public.households (name)
  VALUES (v_display_name || '''s Household')
  RETURNING households.id INTO v_household_id;

  -- Seed default wallet settings
  INSERT INTO public.household_settings (household_id)
  VALUES (v_household_id)
  ON CONFLICT ON CONSTRAINT household_settings_pkey DO NOTHING;

  -- Create profile
  INSERT INTO public.profiles (id, name, household_id)
  VALUES (v_user_id, v_display_name, v_household_id)
  ON CONFLICT ON CONSTRAINT profiles_pkey DO NOTHING;

  RETURN QUERY
    SELECT profiles.id, profiles.name, profiles.household_id
    FROM   public.profiles
    WHERE  profiles.id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_user_profile(TEXT) TO authenticated;
