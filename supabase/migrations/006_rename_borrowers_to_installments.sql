-- ─── Phase 3 follow-up: Rename borrowers → installments ─────────────────────

ALTER TABLE borrowers RENAME TO installments;

DROP INDEX IF EXISTS idx_borrowers_user_id;
CREATE INDEX IF NOT EXISTS idx_installments_user_id ON installments (user_id);

DROP POLICY IF EXISTS "borrowers: owner full access" ON installments;
CREATE POLICY "installments: owner full access"
  ON installments
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
