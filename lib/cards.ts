import { db } from './db'
import { cards, lendingRecords } from './schema'
import { eq, and, ne } from 'drizzle-orm'
import { Card } from '../types/database'

// ── Map Drizzle camelCase row → snake_case Card interface ──────────────────────
function mapCard(row: typeof cards.$inferSelect): Card {
  return {
    id:                  row.id,
    user_id:             row.userId,
    name:                row.name,
    credit_limit:        Number(row.creditLimit ?? 0),
    billing_cutoff_day:  Number(row.billingCutoffDay),
    due_date_day:        Number(row.dueDateDay),
    color:               row.color,
    created_at:          row.createdAt,
  }
}

export async function getCards(userId: string): Promise<Card[]> {
  if (!userId) throw new Error('Not authenticated')
  const data = await db
    .select()
    .from(cards)
    .where(eq(cards.userId, userId))
    .orderBy(cards.createdAt)

  return data.map(mapCard)
}

export async function addCard(
  userId: string,
  card: Omit<Card, 'id' | 'user_id' | 'created_at'>,
): Promise<Card> {
  if (!userId) throw new Error('Not authenticated')
  const [data] = await db
    .insert(cards)
    .values({
      userId,
      name: card.name,
      creditLimit: card.credit_limit.toString(),
      billingCutoffDay: card.billing_cutoff_day,
      dueDateDay: card.due_date_day,
      color: card.color,
    })
    .returning()

  return mapCard(data)
}

export async function updateCard(
  id: string,
  updates: Partial<Omit<Card, 'id' | 'user_id' | 'created_at'>>,
): Promise<Card> {
  const [data] = await db
    .update(cards)
    .set({
      ...(updates.name && { name: updates.name }),
      ...(updates.credit_limit !== undefined && { creditLimit: updates.credit_limit.toString() }),
      ...(updates.billing_cutoff_day !== undefined && { billingCutoffDay: updates.billing_cutoff_day }),
      ...(updates.due_date_day !== undefined && { dueDateDay: updates.due_date_day }),
      ...(updates.color && { color: updates.color }),
    })
    .where(eq(cards.id, id))
    .returning()

  return mapCard(data)
}

export async function deleteCard(id: string): Promise<void> {
  // Check if there are active installment records
  const activeRecords = await db
    .select({ id: lendingRecords.id })
    .from(lendingRecords)
    .where(
      and(
        eq(lendingRecords.cardId, id),
        ne(lendingRecords.status, 'settled')
      )
    )
    .limit(1)

  if (activeRecords.length > 0) {
    throw new Error(
      'This card has active installment records. Settle or delete them before removing the card.',
    )
  }

  await db.delete(cards).where(eq(cards.id, id))
}
