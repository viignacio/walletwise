# Installment Next Due Date Implementation Plan

> **For Antigravity:** REQUIRED WORKFLOW: Use `.agent/workflows/execute-plan.md` to execute this plan in single-flow mode.

**Goal:** Modify the credit app's backend helper and UI to surface the precise next unpaid due date for every lending installment record on the Installments screen, AND dynamically update the "months" text to show the number of remaining payments instead of the total months.

**Architecture:** We will update `getRecordsByInstallment()` in `lib/creditRecords.ts` to include `.select('..., payments(status, due_date, month_index)')`. We will parse through these payments for each mapped record to compute `next_due_date` and the total count of unpaid payments (`payments_remaining`). We will extend the return type of `RecordsByInstallment` to include these fields. Finally, we'll implement Vanilla JS date formatting and wire up both changes in `app/(app)/(tabs)/credit.tsx`.

**Tech Stack:** React Native / Expo, Supabase JS, Native JS Date Parsing.

---

### Task 1: Update Data Fetch & Transformation in `lib/creditRecords.ts`

**Files:**
- Modify: `lib/creditRecords.ts`

**Step 1: Update the Types and SQL Select statement**
Locate `export interface RecordsByInstallment` and update the `records` property to: `records: (LendingRecord & { next_due_date?: string | null, payments_remaining?: number })[]`. 

**Step 2: Transform Data**
Locate `export async function getRecordsByInstallment()`.
Update the select query FROM:
```typescript
.select('*, installments(name)')
```
TO:
```typescript
.select('*, installments(name), payments(status, due_date, month_index)')
```

Update the transform logic inside the `for (const row of data ?? [])` loop to also count unpaid payments.

```typescript
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
  
  // Calculate next_due_date and payments_remaining
  let next_due_date: string | null = null
  let payments_remaining = 0
  if (Array.isArray(row.payments)) {
    // We care about payments that aren't paid
    const unpaidPayments = row.payments.filter((p: any) => p.status && !['paid'].includes(p.status))
    payments_remaining = unpaidPayments.length
    if (unpaidPayments.length > 0) {
      // Sort chronologically by month_index to ensure we get the *next* due date
      unpaidPayments.sort((a: any, b: any) => a.month_index - b.month_index)
      next_due_date = unpaidPayments[0].due_date
    }
  }

  // Inject computed stats
  const recordToPush = { 
    ...(row as LendingRecord), 
    next_due_date,
    payments_remaining
  }
  
  entry.records.push(recordToPush)
}
```

**Step 3: Commit**

```bash
git add lib/creditRecords.ts
git commit -m "feat(creditRecords): attach next payment due date and remaining payments count"
```


### Task 2: Inject Date Parsing & UI Updates in `app/(app)/(tabs)/credit.tsx`

**Files:**
- Modify: `app/(app)/(tabs)/credit.tsx`

**Step 1: Helper for formatting dates**
Add this vanilla JS helper at the top, near `// ─── Helpers ───`:
```typescript
function formatNextDue(isoString: string): string {
  const date = new Date(isoString);
  // Example output: "Oct 15"
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
```

**Step 2: Update UI rendering**
Locate the block under `// ─── Installment group item ───` where `recordMeta` is defined.

We are dropping the overall `record.status` (as requested) and converting `record.installment_months` into `record.payments_remaining`.

Change the JSX inside `recordBody` to:
```tsx
<Text style={styles.recordMeta}>
  {record.payment_scheme === 'installment'
    ? `${'payments_remaining' in record ? record.payments_remaining : record.installment_months}×`
    : 'Direct'}
  {('next_due_date' in record && record.next_due_date)
    ? ` · Next due: ${formatNextDue(record.next_due_date as string)}`
    : ''}
</Text>
```

**Step 3: Commit**

```bash
git add "app/(app)/(tabs)/credit.tsx"
git commit -m "feat(credit): surface next_due_date and remaining months on installment UI"
```
