-- ============================================================
-- WalletWise — Phase 2: Household Wallet
-- Apply in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Transactions ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transactions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID          NOT NULL REFERENCES public.households(id)  ON DELETE CASCADE,
  user_id      UUID          NOT NULL REFERENCES auth.users(id)          ON DELETE CASCADE,
  type         TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category     TEXT          NOT NULL,
  description  TEXT          NOT NULL,
  date         DATE          NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_household_date
  ON public.transactions (household_id, date DESC);

-- ── 2. Push Tokens ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ── 3. updated_at trigger ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_set_updated_at ON public.transactions;
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Row Level Security ───────────────────────────────────

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens  ENABLE ROW LEVEL SECURITY;

-- Transactions: all household members can view
DROP POLICY IF EXISTS "Household members can view transactions" ON public.transactions;
CREATE POLICY "Household members can view transactions"
  ON public.transactions FOR SELECT
  USING (household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

-- Transactions: any household member can insert (must use their own user_id + household)
DROP POLICY IF EXISTS "Household members can insert transactions" ON public.transactions;
CREATE POLICY "Household members can insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (
    household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
    AND user_id = auth.uid()
  );

-- Transactions: users can only update their own
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Users can update own transactions"
  ON public.transactions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Transactions: users can only delete their own
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
CREATE POLICY "Users can delete own transactions"
  ON public.transactions FOR DELETE
  USING (user_id = auth.uid());

-- Push tokens: users manage their own
DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users can manage own push tokens"
  ON public.push_tokens FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Push tokens: household members can read each other's tokens for notification delivery
DROP POLICY IF EXISTS "Household members can read push tokens" ON public.push_tokens;
CREATE POLICY "Household members can read push tokens"
  ON public.push_tokens FOR SELECT
  USING (
    user_id IN (
      SELECT p.id FROM public.profiles p
      WHERE p.household_id = (SELECT household_id FROM public.profiles WHERE id = auth.uid())
    )
  );
