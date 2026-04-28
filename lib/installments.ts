import { db } from './db'
import { installments, lendingRecords } from './schema'
import { eq, asc } from 'drizzle-orm'
import { Installment } from '../types/database'

// ── Map Drizzle camelCase row → snake_case Installment interface ───────────────
function mapInstallment(row: typeof installments.$inferSelect): Installment {
  return {
    id:         row.id,
    user_id:    row.userId,
    name:       row.name,
    notes:      row.notes ?? null,
    created_at: row.createdAt,
  }
}

export async function getInstallments(userId: string): Promise<Installment[]> {
  if (!userId) throw new Error('Not authenticated')
  const data = await db
    .select()
    .from(installments)
    .where(eq(installments.userId, userId))
    .orderBy(asc(installments.name))

  return data.map(mapInstallment)
}

export async function addInstallment(
  userId: string,
  installment: Omit<Installment, 'id' | 'user_id' | 'created_at'>,
): Promise<Installment> {
  if (!userId) throw new Error('Not authenticated')
  const [data] = await db
    .insert(installments)
    .values({
      userId,
      name: installment.name,
      notes: installment.notes,
    })
    .returning()
  return mapInstallment(data)
}

export async function updateInstallment(
  id: string,
  updates: Partial<Omit<Installment, 'id' | 'user_id' | 'created_at'>>,
): Promise<Installment> {
  const [data] = await db
    .update(installments)
    .set({
      ...(updates.name && { name: updates.name }),
      ...(updates.notes !== undefined && { notes: updates.notes }),
    })
    .where(eq(installments.id, id))
    .returning()
  return mapInstallment(data)
}

export async function deleteInstallment(id: string): Promise<void> {
  const activeRecords = await db
    .select({ id: lendingRecords.id })
    .from(lendingRecords)
    .where(eq(lendingRecords.installmentId, id))
    .limit(1)
    
  if (activeRecords.length > 0) {
    throw new Error(
      'This user has existing installment records and cannot be deleted. Settle all records first.',
    )
  }
  
  await db.delete(installments).where(eq(installments.id, id))
}
