/**
 * Credit Records library (Phase 4).
 *
 * Handles:
 *   - CRUD for lending_records
 *   - Payment schedule generation on record creation
 *   - Cascade logic when logging a payment
 */

import { db } from './db'
import { lendingRecords, payments as paymentsTable, installments } from './schema'
import { eq, inArray, lt, ne, and, asc, desc } from 'drizzle-orm'
import { LendingRecord, Payment, PaymentStatus } from '../types/database'
import { deriveBillingInfo } from './billing'

// ── Map Drizzle rows → snake_case interfaces ──────────────────────────────────

function mapLendingRecord(row: typeof lendingRecords.$inferSelect): LendingRecord {
  return {
    id:                        row.id,
    user_id:                   row.userId,
    card_id:                   row.cardId,
    installment_id:            row.installmentId,
    description:               row.description,
    total_amount:              Number(row.totalAmount),
    transaction_date:          row.transactionDate,
    payment_scheme:            row.paymentScheme as LendingRecord['payment_scheme'],
    installment_months:        row.installmentMonths ?? null,
    monthly_amount:            row.monthlyAmount != null ? Number(row.monthlyAmount) : null,
    start_payment_month:       row.startPaymentMonth,
    expected_card_charge_month: row.expectedCardChargeMonth ?? null,
    status:                    row.status as LendingRecord['status'],
    created_at:                row.createdAt,
    updated_at:                row.updatedAt,
  }
}

function mapPayment(row: typeof paymentsTable.$inferSelect): Payment {
  return {
    id:                row.id,
    user_id:           row.userId,
    lending_record_id: row.lendingRecordId,
    month_index:       row.monthIndex,
    due_date:          row.dueDate,
    expected_amount:   Number(row.expectedAmount),
    actual_amount:     row.actualAmount != null ? Number(row.actualAmount) : null,
    paid_date:         row.paidDate ?? null,
    status:            row.status as PaymentStatus,
    created_at:        row.createdAt,
    updated_at:        row.updatedAt,
  }
}

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
export async function getRecordsByInstallment(userId: string): Promise<RecordsByInstallment[]> {
  if (!userId) throw new Error('Not authenticated')

  const data = await db
    .select({
      record: lendingRecords,
      installmentName: installments.name,
      payment: paymentsTable
    })
    .from(lendingRecords)
    .leftJoin(installments, eq(lendingRecords.installmentId, installments.id))
    .leftJoin(paymentsTable, eq(lendingRecords.id, paymentsTable.lendingRecordId))
    .where(
      and(
        eq(lendingRecords.userId, userId),
        ne(lendingRecords.status, 'settled')
      )
    )
    .orderBy(asc(lendingRecords.createdAt))

  // Group by record to reconstruct the nested payments array
  const recordMap = new Map<string, { record: LendingRecord, installmentName: string, payments: Payment[] }>()
  
  for (const row of data) {
    const recordId = row.record.id
    if (!recordMap.has(recordId)) {
      recordMap.set(recordId, {
        record: mapLendingRecord(row.record),
        installmentName: row.installmentName ?? row.record.installmentId,
        payments: []
      })
    }
    if (row.payment) {
      recordMap.get(recordId)!.payments.push(mapPayment(row.payment))
    }
  }

  const map = new Map<string, RecordsByInstallment>()
  for (const { record, installmentName, payments } of Array.from(recordMap.values())) {
    const iid = record.installment_id
    if (!map.has(iid)) {
      map.set(iid, {
        installment_id: iid,
        installment_name: installmentName,
        total_owed: 0,
        records: [],
      })
    }
    const entry = map.get(iid)!
    entry.total_owed += Number(record.total_amount ?? 0)

    let next_due_date: string | null = null
    let payments_remaining = 0
    
    if (payments && payments.length > 0) {
      const unpaidPayments = payments.filter((p) => p.status && !['paid'].includes(p.status))
      payments_remaining = unpaidPayments.length
      if (unpaidPayments.length > 0) {
        unpaidPayments.sort((a, b) => a.month_index - b.month_index)
        next_due_date = unpaidPayments[0].due_date
      }
    }

    entry.records.push({
      ...record,
      next_due_date,
      payments_remaining,
    })
  }
  return Array.from(map.values())
}

/** Single record with its payments, ordered by month_index. */
export async function getRecordWithPayments(id: string): Promise<LendingRecordWithPayments> {
  const [[record], payments] = await Promise.all([
    db.select().from(lendingRecords).where(eq(lendingRecords.id, id)),
    db.select().from(paymentsTable).where(eq(paymentsTable.lendingRecordId, id)).orderBy(asc(paymentsTable.monthIndex))
  ])
  
  if (!record) throw new Error('Record not found')
  return { ...mapLendingRecord(record), payments: payments.map(mapPayment) }
}

/** All records for a specific installment (including settled). */
export async function getRecordsForInstallment(installment_id: string): Promise<LendingRecord[]> {
  const data = await db
    .select()
    .from(lendingRecords)
    .where(eq(lendingRecords.installmentId, installment_id))
    .orderBy(desc(lendingRecords.transactionDate))
    
  return data.map(mapLendingRecord)
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
export async function createRecord(userId: string, input: CreateRecordInput): Promise<LendingRecordWithPayments> {
  if (!userId) throw new Error('Not authenticated')

  // Derive billing info
  const billing = deriveBillingInfo(input.transaction_date, input.billing_cutoff_day, input.due_date_day)

  const monthly = input.payment_scheme === 'installment' && input.installment_months
    ? roundCurrency(input.total_amount / input.installment_months)
    : input.total_amount

  // Insert record
  const [record] = await db
    .insert(lendingRecords)
    .values({
      userId,
      cardId: input.card_id,
      installmentId: input.installment_id,
      description: input.description,
      totalAmount: input.total_amount.toString(),
      transactionDate: input.transaction_date,
      paymentScheme: input.payment_scheme,
      installmentMonths: input.payment_scheme === 'installment' ? input.installment_months : null,
      monthlyAmount: monthly.toString(),
      startPaymentMonth: input.start_payment_month,
      expectedCardChargeMonth: billing.statementMonth,
      status: 'active',
    })
    .returning()

  // Generate payment schedule
  const payments = generatePaymentSchedule({
    userId,
    recordId: record.id,
    paymentScheme: input.payment_scheme,
    totalAmount: input.total_amount,
    monthlyAmount: monthly,
    installmentMonths: input.installment_months,
    startPaymentMonth: input.start_payment_month,
    billingStatementMonth: billing.statementMonth, // YYYY-MM — first charge month
    dueDateDay: input.due_date_day,
    billingCutoffDay: input.billing_cutoff_day,
  })

  if (payments.length > 0) {
    const dbPayments = payments.map(p => ({
      userId: p.user_id,
      lendingRecordId: p.lending_record_id,
      monthIndex: p.month_index,
      dueDate: p.due_date,
      expectedAmount: p.expected_amount.toString(),
      status: p.status,
    }))
    await db.insert(paymentsTable).values(dbPayments)
  }

  const inserted = await db
    .select()
    .from(paymentsTable)
    .where(eq(paymentsTable.lendingRecordId, record.id))
    .orderBy(asc(paymentsTable.monthIndex))

  return { ...mapLendingRecord(record), payments: inserted.map(mapPayment) }
}

export async function deleteRecord(id: string): Promise<void> {
  await db.delete(lendingRecords).where(eq(lendingRecords.id, id))
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
  billingStatementMonth: string // YYYY-MM — this is the statement month
  dueDateDay: number
  billingCutoffDay: number
}

function generatePaymentSchedule(input: ScheduleInput): Omit<Payment, 'id' | 'created_at' | 'updated_at'>[] {
  // First due date = month after statement month + due_date_day
  const [stmtYear, stmtMonthRaw] = input.billingStatementMonth.split('-').map(Number)
  const stmtMonth = stmtMonthRaw - 1 // 0-indexed

  const rows: Omit<Payment, 'id' | 'created_at' | 'updated_at'>[] = []

  if (input.paymentScheme === 'direct') {
    const baseOffset = input.dueDateDay > input.billingCutoffDay ? 0 : 1
    const dueDate = buildDueDate(stmtYear, stmtMonth, input.dueDateDay, baseOffset)
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
  const baseOffset = input.dueDateDay > input.billingCutoffDay ? 0 : 1
  for (let i = 0; i < totalMonths; i++) {
    const paymentIndex = input.startPaymentMonth + i
    const offsetMonths = baseOffset + paymentIndex // offset from statement month
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
          },
        })
      }
    }
  }

  // Write all updates sequentially
  for (const { id, patch } of updates) {
    await db
      .update(paymentsTable)
      .set({
        ...(patch.actual_amount !== undefined && patch.actual_amount !== null && { actualAmount: patch.actual_amount.toString() }),
        ...(patch.status && { status: patch.status }),
        ...(patch.paid_date !== undefined && { paidDate: patch.paid_date }),
        ...(patch.expected_amount !== undefined && patch.expected_amount !== null && { expectedAmount: patch.expected_amount.toString() }),
      })
      .where(eq(paymentsTable.id, id))
  }

  // Settle the record if needed
  if (preview.settles_record) {
    await db
      .update(lendingRecords)
      .set({ status: 'settled' })
      .where(eq(lendingRecords.id, recordId))
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
    const pastDue = await db
      .select({
        id: paymentsTable.id,
        lendingRecordId: paymentsTable.lendingRecordId,
        monthIndex: paymentsTable.monthIndex,
        expectedAmount: paymentsTable.expectedAmount,
        actualAmount: paymentsTable.actualAmount
      })
      .from(paymentsTable)
      .where(
        and(
          inArray(paymentsTable.status, ['upcoming', 'underpaid']),
          lt(paymentsTable.dueDate, todayStr)
        )
      )

    // 2. For each: mark overdue and roll the remaining shortfall into the next month
    for (const p of pastDue) {
      await db
        .update(paymentsTable)
        .set({ status: 'overdue' })
        .where(eq(paymentsTable.id, p.id))

      const expectedAmount = Number(p.expectedAmount)
      const actualAmount = p.actualAmount ? Number(p.actualAmount) : 0
      const shortfall = expectedAmount - actualAmount

      if (shortfall > 0) {
        const [next] = await db
          .select({ id: paymentsTable.id, expectedAmount: paymentsTable.expectedAmount })
          .from(paymentsTable)
          .where(
            and(
              eq(paymentsTable.lendingRecordId, p.lendingRecordId),
              eq(paymentsTable.monthIndex, p.monthIndex + 1)
            )
          )
          .limit(1)

        if (next) {
          const nextExpected = Number(next.expectedAmount)
          await db
            .update(paymentsTable)
            .set({ expectedAmount: (nextExpected + shortfall).toString() })
            .where(eq(paymentsTable.id, next.id))
        }
      }
    }

    // 3. Mark active lending_records overdue if they have any overdue payment
    const overduePayments = await db
      .select({ lendingRecordId: paymentsTable.lendingRecordId })
      .from(paymentsTable)
      .where(eq(paymentsTable.status, 'overdue'))

    const recordIds = [...new Set((overduePayments ?? []).map((p) => p.lendingRecordId))]
    if (recordIds.length === 0) return

    await db
      .update(lendingRecords)
      .set({ status: 'overdue' })
      .where(
        and(
          inArray(lendingRecords.id, recordIds),
          eq(lendingRecords.status, 'active')
        )
      )
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
  const [payment] = await db
    .select({ id: paymentsTable.id, expectedAmount: paymentsTable.expectedAmount })
    .from(paymentsTable)
    .where(eq(paymentsTable.id, paymentId))
    
  if (!payment) throw new Error('Payment not found')

  const expectedAmount = Number(payment.expectedAmount)
  if (newAmount > expectedAmount) {
    throw new Error('Amount cannot exceed the expected amount for local edits.')
  }

  let status: PaymentStatus = 'upcoming'
  if (newAmount >= expectedAmount) {
    status = 'paid'
  } else if (newAmount > 0) {
    status = 'underpaid'
  }

  const paid_date = status === 'paid' ? new Date().toISOString().split('T')[0] : null

  await db
    .update(paymentsTable)
    .set({
      actualAmount: newAmount.toString(),
      status,
      paidDate: paid_date,
    })
    .where(eq(paymentsTable.id, paymentId))
}
