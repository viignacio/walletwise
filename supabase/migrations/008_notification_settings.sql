-- Migration 008: notification_settings table
-- Stores per-user reminder preferences for card due dates and borrower payments.

CREATE TABLE IF NOT EXISTS notification_settings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- 'card_due' | 'borrower_payment' | 'low_balance' | 'transaction_activity'
  type        TEXT        NOT NULL CHECK (type IN ('card_due', 'borrower_payment', 'low_balance', 'transaction_activity')),
  -- null = global setting; a uuid = per-card or per-record override (Phase 6+)
  reference_id UUID,
  -- Days before due date to fire reminder (null for event-driven types)
  lead_days   INTEGER     CHECK (lead_days IS NULL OR lead_days BETWEEN 1 AND 30),
  enabled     BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,

  -- One global row per user per type; per-reference overrides allowed in future phases
  UNIQUE (user_id, type)
);

-- RLS: each user owns only their own settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification settings"
  ON notification_settings
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_notification_settings_user
  ON notification_settings (user_id);
