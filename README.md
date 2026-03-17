# WalletWise

> Household & Credit Finance App — built with React Native (Expo) and Supabase.

WalletWise is a personal finance mobile app with two independent modules:

- **Household Wallet** — a shared running balance tracker for household income and expenses. Both household members see a unified ledger in real time.
- **Credit Tracker** — a private per-user tool for managing credit card-based lending to individuals, including installment schedules, payment tracking, and due date notifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile Framework | React Native via Expo SDK 54 (managed workflow) |
| Language | TypeScript |
| Navigation | Expo Router (file-based) |
| Backend & Auth | Supabase (Postgres + Auth + RLS) |
| Notifications | Expo Notifications |
| Dev IDE | Visual Studio Code + Claude Code |
| Testing | iOS Simulator (primary), Expo Go on Android |
| Production Builds | EAS Build |

---

## Project Structure

```
walletwise/
├── app/
│   ├── _layout.tsx               # Root layout — auth state + routing
│   ├── index.tsx                 # Entry redirect
│   ├── (auth)/
│   │   ├── _layout.tsx           # Auth group layout
│   │   ├── login.tsx             # Login screen (email + Google)
│   │   ├── register.tsx          # Registration screen
│   │   └── callback.tsx          # OAuth callback handler
│   └── (app)/
│       ├── _layout.tsx           # App group layout
│       ├── (tabs)/
│       │   ├── _layout.tsx       # Bottom tab navigator
│       │   ├── dashboard.tsx     # Dashboard (Phase 6)
│       │   ├── wallet.tsx        # Household Wallet tab
│       │   ├── credit.tsx        # Credit Tracker tab
│       │   └── settings.tsx      # Settings + sign out
│       ├── wallet/               # Wallet sub-screens
│       └── credit/               # Credit sub-screens
├── lib/
│   └── supabase.ts               # Supabase client (SecureStore adapter)
├── types/
│   └── database.ts               # TypeScript interfaces for all DB entities
├── constants/
│   ├── colors.ts                 # App color palette
│   └── categories.ts             # Income and expense categories
├── components/
│   ├── ui/                       # Shared UI components
│   ├── wallet/                   # Wallet-specific components
│   └── credit/                   # Credit-specific components
├── hooks/                        # Custom React hooks
└── .env.local                    # Supabase credentials (not committed)
```

---

## Modules

### Household Wallet (shared)

- Single continuous running balance — never resets monthly
- Income and expense transactions logged manually
- Any household member can log either type
- Auto-categorization of expenses by description
- Monthly view with opening balance, income, expenses, net, closing balance
- Year-to-date view: months × expenses × running balance
- Low balance notification (configurable threshold)
- Real-time push notifications to other household members on any transaction change

### Credit Tracker (private per user)

- Manage credit cards (name, limit, billing cutoff day, due date day)
- Manage borrowers
- Create credit records with direct or installment payment schemes
- Deferred start month support (buy now pay later promos)
- Auto-generate full payment schedule on record creation
- Payment logging with cascade logic:
  - Overpayment cascades forward across months
  - Underpayment rolls into next month's expected amount
  - Early full settlement supported
- Every peso traceable to a specific month entry
- Card due date reminders with expected collections breakdown
- Per-borrower payment reminders

---

## Data Model

### Ownership Rules

| Entity | Scoped To | Visible To |
|---|---|---|
| Transaction | Household | All household members |
| HouseholdSettings | Household | All household members |
| Card | User | Owner only |
| Borrower | User | Owner only |
| CreditRecord | User | Owner only |
| Payment | User | Owner only |

### Key Entities

```
Household → HouseholdSettings
User → Household

Transaction (household_id, user_id, type, amount, category, description, date)
Card (user_id, name, credit_limit, billing_cutoff_day, due_date_day, color)
Borrower (user_id, name, notes)
CreditRecord (user_id, card_id, borrower_id, total_amount, payment_scheme,
              installment_months, monthly_amount, start_payment_month, status)
Payment (user_id, credit_record_id, month_index, due_date,
         expected_amount, actual_amount, paid_date, status)
```

### Payment Status Values
`upcoming | paid | underpaid | overdue`

### CreditRecord Status Values
`active | settled | overdue`

---

## Auth

- Email + password login
- Google OAuth login
- Supabase Row Level Security enforces all data visibility rules at the database level
- Auth tokens stored securely via `expo-secure-store`

---

## Notification Messages

### Toast (same user)
```
"You added [description] for +/−[amount]. Balance: [x]"
"You updated [description] from [old] to [new]. Balance: [x]"
"You removed [description] ([amount]). Balance: [x]"
```

### Push (other household members)
```
"[Name] added [description] for +/−[amount]. Balance: [x]"
"[Name] updated [description] from [old] to [new]. Balance: [x]"
"[Name] removed [description] ([amount]). Balance: [x]"
"Household balance is running low. Current balance: [x]"
```

### Push (credit tracker — private)
```
"Card [name] is due in [x] days. Expected collections: [breakdown]"
"[Borrower]'s payment of [amount] for [description] is due in [x] days"
```

---

## Build Progress

| Phase | Name | Status |
|---|---|---|
| 1 | Foundation — Auth, Supabase, App Shell | ✅ Complete |
| 2 | Household Wallet | 🔄 In Progress |
| 3 | Cards & Borrowers | ⏳ Pending |
| 4 | Credit Records & Payment Engine | ⏳ Pending |
| 5 | Notifications | ⏳ Pending |
| 6 | Dashboard & Polish | ⏳ Pending |

---

## Environment Variables

Create `.env.local` in the project root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Running the App

```bash
# Start Metro bundler
npx expo start

# Open iOS Simulator
press i

# Open Android (Expo Go)
press a
```

---

## Important Notes

- All amounts are in Philippine Peso (PHP)
- The two modules are financially independent — credit repayments are never recorded as household income
- Installment durations: 3 to 36 months
- Bank installment charges assumed to be total ÷ months (no additional fees)
- Email confirmation is disabled in development — re-enable for production in Supabase Auth settings