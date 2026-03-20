-- ============================================================
-- WalletWise — Initial Schema
-- Apply in Supabase Dashboard → SQL Editor, or via Supabase CLI:
--   supabase db push
-- ============================================================

-- ── 1. Core tables ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.households (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per auth user. household_id is set on sign-up via trigger.
CREATE TABLE IF NOT EXISTS public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL DEFAULT '',
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One row per household; stores wallet-level settings.
CREATE TABLE IF NOT EXISTS public.household_settings (
  household_id                     UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  low_balance_threshold            NUMERIC NOT NULL DEFAULT 5000,
  low_balance_notification_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Short invite codes for adding a second member to a household (Phase 6).
CREATE TABLE IF NOT EXISTS public.household_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID    NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  code         TEXT    NOT NULL UNIQUE,
  created_by   UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ           -- NULL = no expiry
);

-- ── 2. Trigger: auto-create household + profile on sign-up ──

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_household_id UUID;
  display_name     TEXT;
BEGIN
  display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'My');

  -- Create a personal household for this user
  INSERT INTO public.households (name)
  VALUES (display_name || '''s Household')
  RETURNING id INTO new_household_id;

  -- Seed default wallet settings
  INSERT INTO public.household_settings (household_id)
  VALUES (new_household_id);

  -- Create profile with household already assigned
  INSERT INTO public.profiles (id, name, household_id)
  VALUES (NEW.id, display_name, new_household_id)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 3. Row Level Security ────────────────────────────────────

ALTER TABLE public.households         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invites  ENABLE ROW LEVEL SECURITY;

-- households
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (id = (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Trigger can create a household" ON public.households;
CREATE POLICY "Trigger can create a household"
  ON public.households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Household members can view each other" ON public.profiles;
CREATE POLICY "Household members can view each other"
  ON public.profiles FOR SELECT
  USING (
    household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- household_settings
DROP POLICY IF EXISTS "Members can read household settings" ON public.household_settings;
CREATE POLICY "Members can read household settings"
  ON public.household_settings FOR SELECT
  USING (household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Members can update household settings" ON public.household_settings;
CREATE POLICY "Members can update household settings"
  ON public.household_settings FOR UPDATE
  USING (household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Trigger can insert household settings" ON public.household_settings;
CREATE POLICY "Trigger can insert household settings"
  ON public.household_settings FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- household_invites (Phase 6)
DROP POLICY IF EXISTS "Authenticated users can look up invite codes" ON public.household_invites;
CREATE POLICY "Authenticated users can look up invite codes"
  ON public.household_invites FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Members can create invites for their household" ON public.household_invites;
CREATE POLICY "Members can create invites for their household"
  ON public.household_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Members can delete invites for their household" ON public.household_invites;
CREATE POLICY "Members can delete invites for their household"
  ON public.household_invites FOR DELETE
  USING (household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
