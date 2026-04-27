-- Combined Neon Schema for WalletWise (Migration from Supabase)

-- ─── 1. Core Tables (Households, Profiles, Invites) ──────────────────────────

CREATE TABLE households (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE household_settings (
  household_id    UUID        PRIMARY KEY REFERENCES households(id) ON DELETE CASCADE,
  budget_limit    NUMERIC     DEFAULT 0,
  currency        TEXT        DEFAULT 'USD',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profiles (
  id           TEXT        PRIMARY KEY, -- Clerk User ID
  name         TEXT        NOT NULL,
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE household_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  created_by   TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code         TEXT        NOT NULL UNIQUE,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_household_id ON profiles (household_id);

-- ─── 2. Transactions ─────────────────────────────────────────────────────────

CREATE TABLE transactions (
  id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id       UUID          NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id            TEXT          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type               TEXT          NOT NULL CHECK (type IN ('income', 'expense')),
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category           TEXT          NOT NULL,
  description        TEXT          NOT NULL,
  date               DATE          NOT NULL,
  notes              TEXT,
  is_recurring       BOOLEAN       NOT NULL DEFAULT FALSE,
  recurring_group_id UUID,
  is_pending         BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_household_date
  ON transactions (household_id, date DESC);

CREATE INDEX idx_transactions_pending
  ON transactions (user_id, date)
  WHERE is_pending = TRUE;

CREATE INDEX idx_transactions_recurring_group
  ON transactions (recurring_group_id)
  WHERE recurring_group_id IS NOT NULL;

-- ─── 3. Push Tokens ──────────────────────────────────────────────────────────

CREATE TABLE push_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

-- ─── 4. Cards & Installments (Private to user) ───────────────────────────────

CREATE TABLE cards (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              TEXT          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                 TEXT          NOT NULL,
  credit_limit         NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_cutoff_day   SMALLINT      NOT NULL CHECK (billing_cutoff_day BETWEEN 1 AND 31),
  due_date_day         SMALLINT      NOT NULL CHECK (due_date_day BETWEEN 1 AND 31),
  color                TEXT          NOT NULL DEFAULT '#2563EB',
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cards_user_id ON cards (user_id);

CREATE TABLE installments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installments_user_id ON installments (user_id);

-- ─── 5. Lending Records & Payments ───────────────────────────────────────────

CREATE TABLE lending_records (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_id                   UUID NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  installment_id            UUID NOT NULL REFERENCES installments(id) ON DELETE RESTRICT,
  description               TEXT NOT NULL,
  total_amount              NUMERIC(12, 2) NOT NULL CHECK (total_amount > 0),
  transaction_date          DATE NOT NULL,
  payment_scheme            TEXT NOT NULL CHECK (payment_scheme IN ('direct', 'installment')),
  installment_months        INTEGER CHECK (installment_months BETWEEN 3 AND 36),
  monthly_amount            NUMERIC(12, 2),
  start_payment_month       INTEGER NOT NULL DEFAULT 0,
  expected_card_charge_month TEXT,      -- ISO month string YYYY-MM
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'settled', 'overdue')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lending_records_user_id ON lending_records (user_id);
CREATE INDEX idx_lending_records_installment_id ON lending_records (installment_id);
CREATE INDEX idx_lending_records_card_id ON lending_records (card_id);

CREATE TABLE payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lending_record_id   UUID NOT NULL REFERENCES lending_records(id) ON DELETE CASCADE,
  month_index         INTEGER NOT NULL,
  due_date            DATE NOT NULL,
  expected_amount     NUMERIC(12, 2) NOT NULL CHECK (expected_amount > 0),
  actual_amount       NUMERIC(12, 2),
  paid_date           DATE,
  status              TEXT NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming', 'paid', 'underpaid', 'overdue')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lending_record_id, month_index)
);

CREATE INDEX idx_payments_user_id ON payments (user_id);
CREATE INDEX idx_payments_lending_record_id ON payments (lending_record_id);

-- ─── 6. Notification Settings ────────────────────────────────────────────────

CREATE TABLE notification_settings (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL CHECK (type IN ('card_due', 'borrower_payment', 'low_balance', 'transaction_activity')),
  reference_id UUID,
  lead_days   INTEGER     CHECK (lead_days IS NULL OR lead_days BETWEEN 1 AND 30),
  enabled     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

CREATE INDEX idx_notification_settings_user ON notification_settings (user_id);

-- ─── 7. Triggers for updated_at ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_household_settings_updated_at BEFORE UPDATE ON household_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_lending_records_updated_at BEFORE UPDATE ON lending_records FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
