export type TransactionType = 'income' | 'expense'
export type PaymentScheme = 'direct' | 'installment'
export type LendingStatus = 'active' | 'settled' | 'overdue'
export type PaymentStatus = 'upcoming' | 'paid' | 'underpaid' | 'overdue'
export type NotificationType =
  | 'card_due'
  | 'installment_payment'
  | 'low_balance'
  | 'transaction_activity'

export interface Household {
  id: string
  name: string
  created_at: string
}

export interface HouseholdSettings {
  id: string
  household_id: string
  low_balance_threshold: number
  low_balance_notification_enabled: boolean
  created_at: string
}

export interface Profile {
  id: string
  name: string
  household_id: string | null
  created_at: string
}

export interface Transaction {
  id: string
  household_id: string
  user_id: string
  type: TransactionType
  amount: number
  category: string
  description: string
  date: string
  notes: string | null
  is_recurring: boolean
  recurring_group_id: string | null
  is_pending: boolean
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  user_id: string
  name: string
  credit_limit: number
  billing_cutoff_day: number
  due_date_day: number
  color: string
  created_at: string
}

export interface Installment {
  id: string
  user_id: string
  name: string
  notes: string | null
  created_at: string
}

export interface LendingRecord {
  id: string
  user_id: string
  card_id: string
  installment_id: string
  description: string
  total_amount: number
  transaction_date: string
  payment_scheme: PaymentScheme
  installment_months: number | null
  monthly_amount: number | null
  start_payment_month: number
  expected_card_charge_month: string | null
  status: LendingStatus
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  user_id: string
  lending_record_id: string
  month_index: number
  due_date: string
  expected_amount: number
  actual_amount: number | null
  paid_date: string | null
  status: PaymentStatus
  created_at: string
  updated_at: string
}

export interface NotificationSetting {
  id: string
  user_id: string
  type: NotificationType
  reference_id: string | null
  lead_days: number | null
  enabled: boolean
  created_at: string
}