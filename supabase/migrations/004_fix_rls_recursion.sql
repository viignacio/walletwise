-- ============================================================
-- WalletWise — Fix infinite recursion in RLS policies
-- Policies that reference public.profiles from within a
-- profiles policy (or transitively) cause infinite recursion.
-- Solution: a SECURITY DEFINER helper that bypasses RLS.
-- Apply in Supabase Dashboard → SQL Editor
-- ============================================================

-- Helper: returns the household_id for the currently authenticated user.
-- SECURITY DEFINER bypasses RLS so this never recurses.
CREATE OR REPLACE FUNCTION public.get_my_household_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM public.profiles WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.get_my_household_id() TO authenticated;

-- ── Re-create all policies that used the inline subquery ─────

-- households
DROP POLICY IF EXISTS "Members can view their household" ON public.households;
CREATE POLICY "Members can view their household"
  ON public.households FOR SELECT
  USING (id = public.get_my_household_id());

-- profiles — self-referential; was the root cause of recursion
DROP POLICY IF EXISTS "Household members can view each other" ON public.profiles;
CREATE POLICY "Household members can view each other"
  ON public.profiles FOR SELECT
  USING (household_id = public.get_my_household_id());

-- household_settings
DROP POLICY IF EXISTS "Members can read household settings" ON public.household_settings;
CREATE POLICY "Members can read household settings"
  ON public.household_settings FOR SELECT
  USING (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "Members can update household settings" ON public.household_settings;
CREATE POLICY "Members can update household settings"
  ON public.household_settings FOR UPDATE
  USING (household_id = public.get_my_household_id());

-- household_invites
DROP POLICY IF EXISTS "Members can create invites for their household" ON public.household_invites;
CREATE POLICY "Members can create invites for their household"
  ON public.household_invites FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    household_id = public.get_my_household_id()
  );

DROP POLICY IF EXISTS "Members can delete invites for their household" ON public.household_invites;
CREATE POLICY "Members can delete invites for their household"
  ON public.household_invites FOR DELETE
  USING (household_id = public.get_my_household_id());

-- transactions
DROP POLICY IF EXISTS "Household members can view transactions" ON public.transactions;
CREATE POLICY "Household members can view transactions"
  ON public.transactions FOR SELECT
  USING (household_id = public.get_my_household_id());

DROP POLICY IF EXISTS "Household members can insert transactions" ON public.transactions;
CREATE POLICY "Household members can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    household_id = public.get_my_household_id()
    AND user_id = auth.uid()
  );

-- push_tokens
DROP POLICY IF EXISTS "Household members can read push tokens" ON public.push_tokens;
CREATE POLICY "Household members can read push tokens"
  ON public.push_tokens FOR SELECT
  USING (
    user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.household_id = public.get_my_household_id()
    )
  );
