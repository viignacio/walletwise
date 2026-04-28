import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env' })

// Supabase config
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
if (!supabaseUrl || !supabaseKey) {
  console.error("Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}
const supabase = createClient(supabaseUrl, supabaseKey)

// Neon config
const neonUrl = process.env.EXPO_PUBLIC_DATABASE_URL
if (!neonUrl) {
  console.error("Missing EXPO_PUBLIC_DATABASE_URL")
  process.exit(1)
}
const pool = new Pool({ connectionString: neonUrl })

async function migrateData() {
  console.log("Starting migration from Supabase to Neon...")
  
  // 1. Migrate Households
  console.log("Fetching households...")
  const { data: households, error: hError } = await supabase.from('households').select('*')
  if (hError) throw hError
  for (const h of households) {
    await pool.query(
      `INSERT INTO households (id, name, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [h.id, h.name, h.created_at]
    )
  }
  console.log(`Migrated ${households.length} households.`)

  // 2. Migrate Household Settings
  console.log("Fetching household_settings...")
  const { data: householdSettings, error: hsError } = await supabase.from('household_settings').select('*')
  if (hsError) throw hsError
  for (const hs of householdSettings) {
    await pool.query(
      `INSERT INTO household_settings (household_id, budget_limit, updated_at) VALUES ($1, $2, $3) ON CONFLICT (household_id) DO NOTHING`,
      [hs.household_id, hs.low_balance_threshold, hs.created_at]
    )
  }
  console.log(`Migrated ${householdSettings.length} household_settings.`)

  // 3. Migrate Profiles
  console.log("Fetching profiles...")
  const { data: profiles, error: pError } = await supabase.from('profiles').select('*')
  if (pError) throw pError
  for (const p of profiles) {
    await pool.query(
      `INSERT INTO profiles (id, name, household_id, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.name, p.household_id, p.created_at]
    )
  }
  console.log(`Migrated ${profiles.length} profiles.`)

  // 4. Migrate Cards
  console.log("Fetching cards...")
  const { data: cards, error: cError } = await supabase.from('cards').select('*')
  if (cError) throw cError
  for (const c of cards) {
    await pool.query(
      `INSERT INTO cards (id, user_id, name, credit_limit, billing_cutoff_day, due_date_day, color, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.user_id, c.name, c.credit_limit, c.billing_cutoff_day, c.due_date_day, c.color, c.created_at]
    )
  }
  console.log(`Migrated ${cards.length} cards.`)

  // 5. Migrate Installments
  console.log("Fetching installments...")
  const { data: installments, error: iError } = await supabase.from('installments').select('*')
  if (iError) throw iError
  for (const i of installments) {
    await pool.query(
      `INSERT INTO installments (id, user_id, name, notes, created_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING`,
      [i.id, i.user_id, i.name, i.notes, i.created_at]
    )
  }
  console.log(`Migrated ${installments.length} installments.`)

  // 6. Migrate Transactions
  console.log("Fetching transactions...")
  const { data: transactions, error: tError } = await supabase.from('transactions').select('*')
  if (tError) throw tError
  for (const t of transactions) {
    await pool.query(
      `INSERT INTO transactions (id, household_id, user_id, type, amount, category, description, date, notes, is_recurring, recurring_group_id, is_pending, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.household_id, t.user_id, t.type, t.amount, t.category, t.description, t.date, t.notes, t.is_recurring, t.recurring_group_id, t.is_pending, t.created_at, t.updated_at]
    )
  }
  console.log(`Migrated ${transactions.length} transactions.`)

  // 7. Migrate Lending Records
  console.log("Fetching lending_records...")
  const { data: lendingRecords, error: lrError } = await supabase.from('lending_records').select('*')
  if (lrError) throw lrError
  for (const lr of lendingRecords) {
    await pool.query(
      `INSERT INTO lending_records (id, user_id, card_id, installment_id, description, total_amount, transaction_date, payment_scheme, installment_months, monthly_amount, start_payment_month, expected_card_charge_month, status, created_at, updated_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) ON CONFLICT (id) DO NOTHING`,
      [lr.id, lr.user_id, lr.card_id, lr.installment_id, lr.description, lr.total_amount, lr.transaction_date, lr.payment_scheme, lr.installment_months, lr.monthly_amount, lr.start_payment_month, lr.expected_card_charge_month, lr.status, lr.created_at, lr.updated_at]
    )
  }
  console.log(`Migrated ${lendingRecords.length} lending_records.`)

  // 8. Migrate Payments
  console.log("Fetching payments...")
  let hasMore = true;
  let page = 0;
  let totalPayments = 0;
  
  while (hasMore) {
    const { data: payments, error: pError } = await supabase.from('payments').select('*').range(page * 1000, (page + 1) * 1000 - 1)
    if (pError) throw pError
    if (payments.length === 0) {
      hasMore = false;
      break;
    }
    
    for (const p of payments) {
      await pool.query(
        `INSERT INTO payments (id, user_id, lending_record_id, month_index, due_date, expected_amount, actual_amount, paid_date, status, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING`,
        [p.id, p.user_id, p.lending_record_id, p.month_index, p.due_date, p.expected_amount, p.actual_amount, p.paid_date, p.status, p.created_at, p.updated_at]
      )
    }
    totalPayments += payments.length;
    page++;
  }
  console.log(`Migrated ${totalPayments} payments.`)

  // 9. Migrate Notification Settings
  console.log("Fetching notification_settings...")
  const { data: notificationSettings, error: nsError } = await supabase.from('notification_settings').select('*')
  if (nsError) throw nsError
  for (const ns of notificationSettings) {
    await pool.query(
      `INSERT INTO notification_settings (id, user_id, type, reference_id, lead_days, enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
      [ns.id, ns.user_id, ns.type, ns.reference_id, ns.lead_days, ns.enabled, ns.created_at]
    )
  }
  console.log(`Migrated ${notificationSettings.length} notification_settings.`)

  console.log("Migration completed successfully.")
  process.exit(0)
}

migrateData().catch(e => {
  console.error("Migration failed:", e)
  process.exit(1)
})
