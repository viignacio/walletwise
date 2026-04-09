/**
 * Credit Records library (Phase 4).
 *
 * Handles:
 *   - CRUD for lending_records
 *   - Payment schedule generation on record creation
 *   - Cascade logic when logging a payment
 */

import { supabase } from './supabase'
import { LendingRecord, Payment, PaymentStatus } from '../types/database'
import { deriveBillingInfo } from './billing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LendingRecordWithPayments = LendingRecord & { payments: Payment[] }

export interface RecordsByInstallment {
  installment_id: string
  installment_name: string
  total_owed: number
  records: (LendingRecord & { next_due_date?: string | null, payments_remaining?: number })[]
}

export interface CascadePreviewEntry {
  month_index: number
  due_date: string
  expected_amount: number
  applied_amount: number
  resulting_status: PaymentStatus
}

export interface CascadePreview {
  entries: CascadePreviewEntry[]
  remainder: number
  settles_record: boolean
  /** Net deltas to expected_amount for payments affected by rollover changes, keyed by month_index */
  expectedAdjustments: Array<{ month_index: number; delta: number }>
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** All active (non-settled) records for the current user, grouped by installment. */
export async function getRecordsByInstallment(): Promise<RecordsByInstallment[]> {
  const { data, error } = await supabase
    .from('lending_records')
    .select('*, installments(name), payments(status, due_date, month_index)')
    .neq('status', 'settled')
    .order('created_at', { ascending: true })
  if (error) throw error

  const map = new Map<string, RecordsByInstallment>()
  for (const row of data ?? []) {
    const iid: string = row.installment_id
    if (!map.has(iid)) {
      map.set(iid, {
        installment_id: iid,
        installment_name: (row.installments as { name: string } | null)?.name ?? iid,
        total_owed: 0,
        records: [],
      })
    }
    const entry = map.get(iid)!
    entry.total_owed += Number(row.total_amount ?? 0)

    let next_due_date: string | null = null
    let payments_remaining = 0
    
    // @ts-ignore - payments is joined
    const payments = row.payments as any[] | undefined
    if (Array.isArray(payments)) {
      const unpaidPayments = payments.filter((p) => p.status && !['paid'].includes(p.status))
      payments_remaining = unpaidPayments.length
      if (unpaidPayments.length > 0) {
        unpaidPayments.sort((a, b) => a.month_index - b.month_index)
        next_due_date = unpaidPayments[0].due_date
      }
    }

    entry.records.push({
      ...(row as LendingRecord),
      next_due_date,
      payments_remaining,
    })
  }
  return Array.from(map.values())
}

/** Single record with its payments, ordered by month_index. */
export async function getRecordWithPayments(id: string): Promise<LendingRecordWithPayments> {
  const [{ data: record, error: re }, { data: payments, error: pe }] = await Promise.all([
    supabase.from('lending_records').select('*').eq('id', id).single(),
    supabase
      .from('payments')
      .select('*')
      .eq('lending_record_id', id)
      .order('month_index', { ascending: true }),
  ])
  if (re) throw re
  if (pe) throw pe
  return { ...(record as LendingRecord), payments: (payments as Payment[]) ?? [] }
}

/** All records for a specific installment (including settled). */
export async function getRecordsForInstallment(installment_id: string): Promise<LendingRecord[]> {
  const { data, error } = await supabase
    .from('lending_records')
    .select('*')
    .eq('installment_id', installment_id)
    .order('transaction_date', { ascending: false })
  if (error) throw error
  return data as LendingRecord[]
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export interface CreateRecordInput {
  card_id: string
  installment_id: string
  description: string
  total_amount: number
  transaction_date: string        // ISO date YYYY-MM-DD
  payment_scheme: 'direct' | 'installment'
  installment_months?: number     // 3–36, required if scheme = installment
  start_payment_month: number     // 0 = first possible month, 1 = defer one month, etc.
  /** Derived from billing.ts before calling this function */
  billing_cutoff_day: number
  due_date_day: number
}

/**
 * Creates a LendingRecord and auto-generates Payment rows.
 * Returns the created record with its payments.
 */
export async function createRecord(input: CreateRecordInput): Promise<LendingRecordWithPayments> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Derive billing info
  const txDate = new Date(input.transaction_date)
  const billing = deriveBillingInfo(txDate, input.billing_cutoff_day, input.due_date_day)

  const monthly = input.payment_scheme === 'installment' && input.installment_months
    ? roundCurrency(input.total_amount / input.installment_months)
    : input.total_amount

  // Insert record
  const { data: record, error: re } = await supabase
    .from('lending_records')
    .insert({
      user_id: user.id,
      card_id: input.card_id,
      installment_id: input.installment_id,
      description: input.description,
      total_amount: input.total_amount,
      transaction_date: input.transaction_date,
      payment_scheme: input.payment_scheme,
      installment_months: input.payment_scheme === 'installment' ? input.installment_months : null,
      monthly_amount: monthly,
      start_payment_month: input.start_payment_month,
      expected_card_charge_month: billing.statementMonth,
      status: 'active',
    })
    .select()
    .single()
  if (re) throw re

  // Generate payment schedule
  const payments = generatePaymentSchedule({
    userId: user.id,
    recordId: (record as LendingRecord).id,
    paymentScheme: input.payment_scheme,
    totalAmount: input.total_amount,
    monthlyAmount: monthly,
    installmentMonths: input.installment_months,
    startPaymentMonth: input.start_payment_month,
    billingStatementMonth: billing.statementMonth, // YYYY-MM — first charge month
    dueDateDay: input.due_date_day,
  })

  if (payments.length > 0) {
    const { error: pe } = await supabase.from('payments').insert(payments)
    if (pe) throw pe
  }

  const { data: inserted, error: qe } = await supabase
    .from('payments')
    .select('*')
    .eq('lending_record_id', (record as LendingRecord).id)
    .order('month_index', { ascending: true })
  if (qe) throw qe

  return { ...(record as LendingRecord), payments: (inserted as Payment[]) ?? [] }
}

export async function deleteRecord(id: string): Promise<void> {
  const { error } = await supabase.from('lending_records').delete().eq('id', id)
  if (error) throw error
}

// ─── Payment schedule generation ─────────────────────────────────────────────

interface ScheduleInput {
  userId: string
  recordId: string
  paymentScheme: 'direct' | 'installment'
  totalAmount: number
  monthlyAmount: number
  installmentMonths?: number
  startPaymentMonth: number
  billingStatementMonth: string // YYYY-MM — this is the statement month; first due is next month
  dueDateDay: number
}

function generatePaymentSchedule(input: ScheduleInput): Omit<Payment, 'id' | 'created_at' | 'updated_at'>[] {
  // First due date = month after statement month + due_date_day
  const [stmtYear, stmtMonthRaw] = input.billingStatementMonth.split('-').map(Number)
  const stmtMonth = stmtMonthRaw - 1 // 0-indexed

  const rows: Omit<Payment, 'id' | 'created_at' | 'updated_at'>[] = []

  if (input.paymentScheme === 'direct') {
    const dueDate = buildDueDate(stmtYear, stmtMonth, input.dueDateDay)
    rows.push({
      user_id: input.userId,
      lending_record_id: input.recordId,
      month_index: 0,
      due_date: dueDate,
      expected_amount: input.totalAmount,
      actual_amount: null,
      paid_date: null,
      status: 'upcoming',
    })
    return rows
  }

  // Installment: generate months starting from (first due month + startPaymentMonth)
  const totalMonths = input.installmentMonths ?? 1
  for (let i = 0; i < totalMonths; i++) {
    const paymentIndex = input.startPaymentMonth + i
    // paymentIndex 0 = first due month (month after statement), 1 = month after that, ...
    const offsetMonths = 1 + paymentIndex // offset from statement month
    const dueDate = buildDueDate(stmtYear, stmtMonth, input.dueDateDay, offsetMonths)
    rows.push({
      user_id: input.userId,
      lending_record_id: input.recordId,
      month_index: i,
      due_date: dueDate,
      expected_amount: input.monthlyAmount,
      actual_amount: null,
      paid_date: null,
      status: 'upcoming',
    })
  }
  return rows
}

/** Build a due date by advancing (stmtYear, stmtMonth 0-indexed) by offsetMonths, then clamping dueDateDay. */
function buildDueDate(
  stmtYear: number,
  stmtMonth: number, // 0-indexed
  dueDateDay: number,
  offsetMonths = 1,
): string {
  const totalMonths = stmtMonth + offsetMonths
  const year = stmtYear + Math.floor(totalMonths / 12)
  const month = totalMonths % 12 // 0-indexed
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const day = Math.min(dueDateDay, daysInMonth)
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// ─── Cascade logic ────────────────────────────────────────────────────────────

/**
 * Preview what will happen if `receivedAmount` is applied to the record's unpaid payments.
 * Does NOT write to DB.
 */
export async function previewCascade(
  recordId: string,
  receivedAmount: number,
): Promise<CascadePreview> {
  const { payments } = await getRecordWithPayments(recordId)
  return computeCascade(payments, receivedAmount)
}

/**
 * Apply a payment to the record: runs cascade, writes all updated Payment rows,
 * and marks LendingRecord settled if fully paid.
 */
export async function applyPayment(
  recordId: string,
  receivedAmount: number,
  paidDate: string, // ISO date YYYY-MM-DD
): Promise<void> {
  const { payments } = await getRecordWithPayments(recordId)
  const preview = computeCascade(payments, receivedAmount)

  const today = paidDate

  // Build updates
  const updates: Array<{ id: string; patch: Partial<Payment> }> = []

  const adjLookup = new Map(preview.expectedAdjustments.map((a) => [a.month_index, a.delta]))

  for (const entry of preview.entries) {
    const payment = payments.find((p) => p.month_index === entry.month_index)
    if (!payment) continue
    const adj = adjLookup.get(entry.month_index)
    updates.push({
      id: payment.id,
      patch: {
        actual_amount: entry.applied_amount,
        status: entry.resulting_status,
        paid_date: entry.resulting_status === 'paid' ? today : null,
        ...(adj !== undefined ? { expected_amount: payment.expected_amount + adj } : {}),
        updated_at: new Date().toISOString(),
      },
    })
  }

  // If settling, mark remaining upcoming/underpaid payments as settled
  if (preview.settles_record) {
    const touchedIndices = new Set(preview.entries.map((e) => e.month_index))
    for (const p of payments) {
      if (!touchedIndices.has(p.month_index) && (p.status === 'upcoming' || p.status === 'underpaid')) {
        updates.push({
          id: p.id,
          patch: {
            status: 'paid' as PaymentStatus,
            actual_amount: 0,
            paid_date: today,
            updated_at: new Date().toISOString(),
          },
        })
      }
    }
  }

  // Apply expected_amount adjustments for months not touched in entries
  // (e.g. rollover reversal on a future month, or new rollover added to next month)
  for (const { month_index, delta } of preview.expectedAdjustments) {
    const inEntries = preview.entries.some((e) => e.month_index === month_index)
    if (!inEntries) {
      const payment = payments.find((p) => p.month_index === month_index)
      if (payment) {
        updates.push({
          id: payment.id,
          patch: {
            expected_amount: payment.expected_amount + delta,
            updated_at: new Date().toISOString(),
          },
        })
      }
    }
  }

  // Write all updates sequentially
  for (const { id, patch } of updates) {
    const { error } = await supabase.from('payments').update(patch).eq('id', id)
    if (error) throw error
  }

  // Settle the record if needed
  if (preview.settles_record) {
    const { error } = await supabase
      .from('lending_records')
      .update({ status: 'settled', updated_at: new Date().toISOString() })
      .eq('id', recordId)
    if (error) throw error
  }
}

function computeCascade(payments: Payment[], receivedAmount: number): CascadePreview {
  // Include overdue: they have a rollover already written to the next month by markOverduePayments
  const unpaid = payments
    .filter((p) => p.status === 'upcoming' || p.status === 'underpaid' || p.status === 'overdue')
    .sort((a, b) => a.month_index - b.month_index)

  const entries: CascadePreviewEntry[] = []
  let remainder = receivedAmount

  // Effective expected amounts per month — adjusted forward as overdue rollovers are reversed
  const effExp = new Map(unpaid.map((p) => [p.month_index, p.expected_amount]))
  // Net DB deltas to expected_amount (positive = increase, negative = decrease)
  const adjMap = new Map<number, number>()

  const adjust = (idx: number, delta: number) => {
    adjMap.set(idx, (adjMap.get(idx) ?? 0) + delta)
    if (effExp.has(idx)) effExp.set(idx, effExp.get(idx)! + delta)
  }

  for (const p of unpaid) {
    if (remainder <= 0) break

    const exp = effExp.get(p.month_index) ?? p.expected_amount
    const alreadyPaid = p.actual_amount ?? 0
    const stillOwed = exp - alreadyPaid

    if (stillOwed <= 0) continue

    if (remainder >= stillOwed) {
      entries.push({
        month_index: p.month_index,
        due_date: p.due_date,
        expected_amount: exp,
        applied_amount: exp, // cumulative actual_amount
        resulting_status: 'paid',
      })
      remainder -= stillOwed

      // Overdue payments had their shortfall rolled to the next month by markOverduePayments.
      // Now that they're paid, reverse that rollover.
      if (p.status === 'overdue') {
        adjust(p.month_index + 1, -stillOwed)
      }
    } else {
      const newTotal = alreadyPaid + remainder
      entries.push({
        month_index: p.month_index,
        due_date: p.due_date,
        expected_amount: exp,
        applied_amount: newTotal,
        // Keep 'overdue' status for overdue payments; partial payments don't clear the overdue flag
        resulting_status: p.status === 'overdue' ? 'overdue' : 'underpaid',
      })

      // For overdue payments: the rollover in the next month decreases by what we just paid
      // (shortfall was rolled when going overdue; we've now reduced it by `remainder`)
      if (p.status === 'overdue') {
        adjust(p.month_index + 1, -remainder)
      }
      // underpaid/upcoming going partial: no rollover yet — deferred until due date passes

      remainder = 0
    }
  }

  const expectedAdjustments = Array.from(adjMap.entries())
    .filter(([, delta]) => delta !== 0)
    .map(([month_index, delta]) => ({ month_index, delta }))

  // Record settles if all payments are now paid (no remaining unpaid after cascade)
  const touchedPaid = entries.filter((e) => e.resulting_status === 'paid').map((e) => e.month_index)
  const touchedUnresolved = entries.some((e) => e.resulting_status === 'underpaid' || e.resulting_status === 'overdue')
  const remainingUnpaid = unpaid.filter((p) => !touchedPaid.includes(p.month_index) && !touchedUnresolved)
  const settles_record = !touchedUnresolved && remainingUnpaid.length === 0 && remainder === 0

  return { entries, remainder, settles_record, expectedAdjustments }
}

// ─── Overdue transitions ──────────────────────────────────────────────────────

/**
 * Marks any 'upcoming' payments whose due_date is before today as 'overdue',
 * then marks any lending_record as 'overdue' if it has at least one overdue payment.
 * Safe to call on startup — errors are swallowed.
 */
export async function markOverduePayments(): Promise<void> {
  try {
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    // 1. Find all upcoming/underpaid payments past their due date
    //    (overdue ones are already handled — selecting them again would double-apply the rollover)
    const { data: pastDue, error: pe } = await supabase
      .from('payments')
      .select('id, lending_record_id, month_index, expected_amount, actual_amount')
      .in('status', ['upcoming', 'underpaid'])
      .lt('due_date', todayStr)
    if (pe) throw pe

    // 2. For each: mark overdue and roll the remaining shortfall into the next month
    for (const p of pastDue ?? []) {
      await supabase
        .from('payments')
        .update({ status: 'overdue', updated_at: new Date().toISOString() })
        .eq('id', p.id)

      const shortfall = p.expected_amount - (p.actual_amount ?? 0)
      if (shortfall > 0) {
        const { data: next } = await supabase
          .from('payments')
          .select('id, expected_amount')
          .eq('lending_record_id', p.lending_record_id)
          .eq('month_index', p.month_index + 1)
          .maybeSingle()
        if (next) {
          await supabase
            .from('payments')
            .update({
              expected_amount: next.expected_amount + shortfall,
              updated_at: new Date().toISOString(),
            })
            .eq('id', next.id)
        }
      }
    }

    // 3. Mark active lending_records overdue if they have any overdue payment
    const { data: overduePayments, error: qe } = await supabase
      .from('payments')
      .select('lending_record_id')
      .eq('status', 'overdue')
    if (qe) throw qe

    const recordIds = [...new Set((overduePayments ?? []).map((p) => p.lending_record_id))]
    if (recordIds.length === 0) return

    const { error: re } = await supabase
      .from('lending_records')
      .update({ status: 'overdue', updated_at: new Date().toISOString() })
      .in('id', recordIds)
      .eq('status', 'active')
    if (re) throw re
  } catch (e) {
    console.warn('[creditRecords] markOverduePayments failed:', e)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundCurrency(amount: number): number {
  return Math.round(amount * 100) / 100
}

/**
 * Update an existing payment row's actual_amount locally, without cascading.
 * The new amount is capped at the expected_amount.
 */
export async function editPaymentLocal(paymentId: string, newAmount: number): Promise<void> {
  const { data: payment, error: fetchErr } = await supabase
    .from('payments')
    .select('id, expected_amount')
    .eq('id', paymentId)
    .single()
  if (fetchErr) throw fetchErr

  if (newAmount > payment.expected_amount) {
    throw new Error('Amount cannot exceed the expected amount for local edits.')
  }

  let status: PaymentStatus = 'upcoming'
  if (newAmount >= payment.expected_amount) {
    status = 'paid'
  } else if (newAmount > 0) {
    status = 'underpaid'
  }

  const paid_date = status === 'paid' ? new Date().toISOString().split('T')[0] : null

  const { error: updateErr } = await supabase
    .from('payments')
    .update({
      actual_amount: newAmount,
      status,
      paid_date,
      updated_at: new Date().toISOString()
    })
    .eq('id', paymentId)
  
  if (updateErr) throw updateErr
}
