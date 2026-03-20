# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npx expo start        # Start Metro bundler (press i for iOS, a for Android)
npx expo start --ios  # Start and open iOS Simulator directly
npx expo start --web  # Start web version
```

No test runner or linter is configured. Production builds use `eas build` (Expo Application Services).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native via Expo SDK 54 (managed workflow) |
| Language | TypeScript (strict mode) |
| Navigation | Expo Router (file-based) |
| Backend/Auth | Supabase (Postgres + Auth + Realtime + RLS) |
| Local Cache | expo-sqlite (Phase 6 — offline read/write) |
| Notifications | Expo Notifications (push + local) |
| Secure Storage | expo-secure-store (auth tokens) |

## Architecture

WalletWise is a household and personal finance app. All monetary amounts are PHP (Philippine Peso).

**Backend**: Supabase client singleton with SecureStore auth adapter lives in [lib/supabase.ts](lib/supabase.ts). Credentials via `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.

**Routing** (Expo Router, file-based):
- [app/_layout.tsx](app/_layout.tsx) — root layout; subscribes to Supabase auth state, redirects between `(auth)` and `(app)` groups
- `app/(auth)/` — login, register, OAuth callback
- `app/(app)/(tabs)/` — four-tab protected shell: **Dashboard, Wallet, Lending, Settings**
  - Note: the Lending tab file is currently named `credit.tsx` — the spec names it "Lending"

**Two independent modules** — data never crosses between them:
1. **Household Wallet** (`wallet` tab) — shared household ledger visible to all household members
2. **Lending / Credit Tracker** (`lending` tab) — strictly private per-user; credit card lending management

**Key files**:
- [types/database.ts](types/database.ts) — all TypeScript entity interfaces
- [constants/colors.ts](constants/colors.ts) — color palette
- [constants/categories.ts](constants/categories.ts) — income/expense categories

## Data Model (summary)

**Household Wallet** (scoped to Household — all members see it):
- `Transaction`: id, household_id, user_id, type (income|expense), amount, category, description, date, notes
- `HouseholdSettings`: household_id, low_balance_threshold, low_balance_notification_enabled

**Credit Tracker** (scoped to User — owner only):
- `Card`: id, user_id, name, credit_limit, billing_cutoff_day, due_date_day, color
- `Borrower`: id, user_id, name, notes
- `CreditRecord`: id, user_id, card_id, borrower_id, description, total_amount, transaction_date, payment_scheme (direct|installment), installment_months, monthly_amount, start_payment_month, expected_card_charge_month, status (active|settled|overdue)
- `Payment`: id, user_id, credit_record_id, month_index, due_date, expected_amount, actual_amount, paid_date, status (upcoming|paid|underpaid|overdue)
- `NotificationSettings`: user_id, type, reference_id, lead_days

## Critical Business Logic

**Wallet balance**: `SUM(all income) − SUM(all expenses)` across all time. Never resets. Monthly/YTD views are filters for display only.

**Monthly View** shows: opening balance (balance carried from prior month), income total, expense total, net movement, closing balance, transaction list, category breakdown.

**YTD View**: one row per month (month name, expenses, balance). Current year shows only months up to current month; next-year navigation is disabled.

**Billing cycle derivation** (Card has `billing_cutoff_day` and `due_date_day`):
- Transaction date ≤ cutoff day → falls on current month's statement → due on `due_date_day` of next month
- Transaction date > cutoff day → falls on next month's statement → due on `due_date_day` of the month after

When adding a CreditRecord, display: _"This charge will first appear on your [Month] statement, due [Date]"_.

**Payment schedule generation**: On CreditRecord creation (installment scheme), auto-generate all Payment rows upfront. Deferred months (before `start_payment_month`) are skipped — no entries generated.

**Cascade logic** (applied when logging a payment):
1. Apply received amount to earliest unpaid month first.
2. If remainder ≥ next month expected → mark paid, continue.
3. If remainder < next month expected → record as underpayment (partial).
4. Stop when remainder = 0.
5. Underpayment rolls over: next month's `expected_amount` = original monthly + outstanding underpayment.
6. Early settlement: cascade runs until balance is consumed; all remaining Payment rows marked settled; CreditRecord status → settled.

## Screens (spec-defined)

| Screen | Tab | Notes |
|---|---|---|
| Dashboard | Dashboard | Unified: household balance, upcoming card due dates, recent activity |
| Wallet — Monthly View | Wallet | Default view, current month on open, prev/next nav |
| Wallet — YTD View | Wallet | Summary table; tap row → Monthly View |
| Add/Edit Transaction | Wallet | |
| Lending Overview | Lending | Per-borrower total owed across all active records |
| Borrower Detail | Lending | All active credit records for a borrower |
| Record Detail | Lending | Full payment timeline for a record |
| Log Payment | Lending | Cascade preview before confirming |
| Add Credit Record | Lending | Card, borrower, scheme, amounts, dates |
| Cards | Lending | CRUD |
| Borrowers | Lending | CRUD |
| Settings — General | Settings | Profile, household, notification preferences |
| Settings — Wallet | Settings | Low balance threshold |
| Settings — Credit | Settings | Card due date and borrower reminder lead times |

## Notifications

**Toast** (same user, in-app only): fires on own transaction create/edit/delete.
**Push** (other household members): fires on others' transaction create/edit/delete, and on low balance.
**Push** (card owner only): card due date reminders (`lead_days` before due date).
**Push** (record owner only): borrower payment reminders (`lead_days` before due date).

Message formats are defined in the spec. Key rule: always include the current balance in wallet notification messages.

## Build Phases

| Phase | Status | Scope |
|---|---|---|
| 1 — Foundation | ✅ Complete | Auth (email + Google OAuth), household creation/invite, app shell, settings |
| 2 — Household Wallet | ✅ Complete | Transaction logging, balance display, monthly view, low balance alerts, push notifications |
| 3 — Cards & Borrowers | Pending | Card CRUD, borrower CRUD, billing cycle logic |
| 4 — Credit Records | Pending | CreditRecord creation, payment schedule generation, cascade logic |
| 5 — Notifications | Pending | Card due date reminders, borrower reminders, configurable lead times |
| 6 — Polish | Pending | Dashboard, auto-categorization, edge cases, SQLite offline cache |

## Constraints

- No data crossover between modules. A credit repayment is **never** household income.
- Installment durations: 3–36 months. Monthly amount = `total / months` (no fees).
- No multi-currency — PHP only.
- No App Store/Play Store publishing required in early phases; EAS sideloading is sufficient.
- CSV bank import, audit trail for edits, and multi-currency are explicitly out of scope.
- Design language and branding are not yet finalized — avoid hardcoding visual identity decisions.
