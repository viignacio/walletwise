-- ─── Phase 3: Cards & Borrowers ──────────────────────────────────────────────
-- Both tables are scoped to the individual user (NOT household).
-- Credit Tracker data is strictly private — never visible to household members.

-- ─── Cards ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cards (
  id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text          NOT NULL,
  credit_limit         numeric(12,2) NOT NULL DEFAULT 0,
  billing_cutoff_day   smallint      NOT NULL CHECK (billing_cutoff_day BETWEEN 1 AND 31),
  due_date_day         smallint      NOT NULL CHECK (due_date_day BETWEEN 1 AND 31),
  color                text          NOT NULL DEFAULT '#2563EB',
  created_at           timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards: owner full access" ON cards;
CREATE POLICY "cards: owner full access"
  ON cards
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Borrowers ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS borrowers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE borrowers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "borrowers: owner full access" ON borrowers;
CREATE POLICY "borrowers: owner full access"
  ON borrowers
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cards_user_id     ON cards     (user_id);
CREATE INDEX IF NOT EXISTS idx_borrowers_user_id ON borrowers (user_id);
