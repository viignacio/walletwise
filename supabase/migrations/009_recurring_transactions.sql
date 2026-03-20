-- ============================================================
-- WalletWise — Recurring Monthly Expenses
-- Apply in Supabase Dashboard → SQL Editor
-- ============================================================

-- ── 1. Add recurring columns to transactions ─────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_recurring     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recurring_group_id UUID,
  ADD COLUMN IF NOT EXISTS is_pending       BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. Partial index for fast pending-transaction lookup ──────
-- Only indexes pending rows so activation queries are O(pending) not O(all transactions)

CREATE INDEX IF NOT EXISTS idx_transactions_pending
  ON public.transactions (user_id, date)
  WHERE is_pending = TRUE;

-- ── 3. Index for group-delete (delete future recurrences) ─────

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_group
  ON public.transactions (recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;
