# Installment Next Payment Due Date Design

## Objective
Display the next unpaid payment due date for each individual lending record on the Installments screen (Credit Screen), allowing users to immediately know when each item is next due.

## Approach: Inline Data Fetch & Transformation

### 1. Data Modification (`lib/creditRecords.ts`)
*   Update `getRecordsByInstallment()` to fetch associated payments alongside the records using Supabase joins: `.select('*, installments(name), payments(status, due_date, month_index)')`.
*   Extend the `LendingRecord` type (locally, e.g. `LendingRecordWithNextDue`) to include an optional field `next_due_date?: string | null`.
*   During mapping, for each record, iterate through its `payments` to find the first chronological payment (by `month_index`) that has an active/unpaid status (`['upcoming', 'underpaid', 'overdue'].includes(payment.status)`). Assign its `due_date` to `next_due_date`.

### 2. UI Updates (`app/(app)/(tabs)/credit.tsx`)
*   In the individual record row (`recordMeta` text block in the UI), we will replace the `status` display with the newly parsed `next_due_date`.
*   We will format the date into a friendly string (e.g. `Oct 15`) using pure JS or `date-fns` if available.
*   The status will be dropped since the existence of the unpaid next due date inherently infers that the record is active.
*   The final metadata string display format will be:
    *   `3x · Next due: Oct 15`
    *   `Direct · Next due: Oct 15`
*   If for some reason there is no unpaid payment (e.g. it was somehow cached), we can fallback to displaying nothing or the record's overall status.

## Why this approach?
*   **Performance:** Uses a single Supabase query under-the-hood so that UI renders quickly and synchronously, preventing N+1 query waterfall loading.
*   **Simplicity:** Leverages existing database join capabilities without needing any schema or backend procedure migration.

## Verification
*   Create a lending record with several installments. Pay off the first installment and verify that the next unpaid due date shifts correctly on the UI.
*   Ensure that the overall record query successfully handles both `installment` and `direct` schemes.
