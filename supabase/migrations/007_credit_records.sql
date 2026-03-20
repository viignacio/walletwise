-- Migration 007: Credit Records & Payments
-- Creates lending_records and payments tables (user-scoped, RLS enforced).

-- Drop if a previous partial run left stale tables
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS lending_records CASCADE;

-- ─── lending_records ─────────────────────────────────────────────────────────

CREATE TABLE lending_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id                   uuid NOT NULL REFERENCES cards(id) ON DELETE RESTRICT,
  installment_id            uuid NOT NULL REFERENCES installments(id) ON DELETE RESTRICT,
  description               text NOT NULL,
  total_amount              numeric(12, 2) NOT NULL CHECK (total_amount > 0),
  transaction_date          date NOT NULL,
  payment_scheme            text NOT NULL CHECK (payment_scheme IN ('direct', 'installment')),
  installment_months        integer CHECK (installment_months BETWEEN 3 AND 36),
  monthly_amount            numeric(12, 2),
  start_payment_month       integer NOT NULL DEFAULT 0,
  expected_card_charge_month text,      -- ISO month string YYYY-MM
  status                    text NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'settled', 'overdue')),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE lending_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lending_records: owner full access"
  ON lending_records
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_lending_records_user_id
  ON lending_records (user_id);

CREATE INDEX IF NOT EXISTS idx_lending_records_installment_id
  ON lending_records (installment_id);

CREATE INDEX IF NOT EXISTS idx_lending_records_card_id
  ON lending_records (card_id);

-- ─── payments ────────────────────────────────────────────────────────────────

CREATE TABLE payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lending_record_id   uuid NOT NULL REFERENCES lending_records(id) ON DELETE CASCADE,
  month_index         integer NOT NULL,
  due_date            date NOT NULL,
  expected_amount     numeric(12, 2) NOT NULL CHECK (expected_amount > 0),
  actual_amount       numeric(12, 2),
  paid_date           date,
  status              text NOT NULL DEFAULT 'upcoming'
                        CHECK (status IN ('upcoming', 'paid', 'underpaid', 'overdue')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lending_record_id, month_index)
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments: owner full access"
  ON payments
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_payments_user_id
  ON payments (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_lending_record_id
  ON payments (lending_record_id);

-- ─── updated_at triggers ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lending_records_updated_at ON lending_records;
CREATE TRIGGER trg_lending_records_updated_at
  BEFORE UPDATE ON lending_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
