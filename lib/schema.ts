import { pgTable, text, timestamp, uuid, numeric, boolean, date, smallint, integer } from 'drizzle-orm/pg-core';

export const households = pgTable('households', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const householdSettings = pgTable('household_settings', {
  householdId: uuid('household_id').primaryKey().references(() => households.id, { onDelete: 'cascade' }),
  budgetLimit: numeric('budget_limit').default('0'),
  currency: text('currency').default('USD'),
  lowBalanceThreshold: numeric('low_balance_threshold').default('5000').notNull(),
  lowBalanceNotificationEnabled: boolean('low_balance_notification_enabled').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const profiles = pgTable('profiles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const householdInvites = pgTable('household_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  createdBy: text('created_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  code: text('code').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  householdId: uuid('household_id').notNull().references(() => households.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  category: text('category').notNull(),
  description: text('description').notNull(),
  date: date('date').notNull(),
  notes: text('notes'),
  isRecurring: boolean('is_recurring').default(false).notNull(),
  recurringGroupId: uuid('recurring_group_id'),
  isPending: boolean('is_pending').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const pushTokens = pgTable('push_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  token: text('token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const cards = pgTable('cards', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  creditLimit: numeric('credit_limit', { precision: 12, scale: 2 }).default('0').notNull(),
  billingCutoffDay: smallint('billing_cutoff_day').notNull(),
  dueDateDay: smallint('due_date_day').notNull(),
  color: text('color').default('#2563EB').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const installments = pgTable('installments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const lendingRecords = pgTable('lending_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  cardId: uuid('card_id').notNull().references(() => cards.id, { onDelete: 'restrict' }),
  installmentId: uuid('installment_id').notNull().references(() => installments.id, { onDelete: 'restrict' }),
  description: text('description').notNull(),
  totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
  transactionDate: date('transaction_date').notNull(),
  paymentScheme: text('payment_scheme').notNull(),
  installmentMonths: integer('installment_months'),
  monthlyAmount: numeric('monthly_amount', { precision: 12, scale: 2 }),
  startPaymentMonth: integer('start_payment_month').default(0).notNull(),
  expectedCardChargeMonth: text('expected_card_charge_month'),
  status: text('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const payments = pgTable('payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  lendingRecordId: uuid('lending_record_id').notNull().references(() => lendingRecords.id, { onDelete: 'cascade' }),
  monthIndex: integer('month_index').notNull(),
  dueDate: date('due_date').notNull(),
  expectedAmount: numeric('expected_amount', { precision: 12, scale: 2 }).notNull(),
  actualAmount: numeric('actual_amount', { precision: 12, scale: 2 }),
  paidDate: date('paid_date'),
  status: text('status').default('upcoming').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});

export const notificationSettings = pgTable('notification_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  referenceId: uuid('reference_id'),
  leadDays: integer('lead_days'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
});
