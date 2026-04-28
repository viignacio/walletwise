require('dotenv').config({ path: '.env' });
const { neon } = require('@neondatabase/serverless');

/**
 * Utility script to map an old Supabase UUID to a new Clerk User ID.
 * Run this if another legacy user logs into the app for the first time via Clerk
 * and you need to link their new empty profile to their old data.
 */

async function mapUser() {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.log("Usage: node scripts/map-clerk-user.js <OLD_SUPABASE_UUID> <NEW_CLERK_ID>");
    console.log("Example: node scripts/map-clerk-user.js 31e06d48-046e-47c3-b684-e26624b2646b user_123xyz...");
    process.exit(1);
  }

  const oldUserId = args[0];
  const newUserId = args[1];

  const sql = neon(process.env.EXPO_PUBLIC_DATABASE_URL);
  
  try {
    console.log(`Starting migration for ${oldUserId} -> ${newUserId}...`);
    
    // Check if new profile exists
    const newProfiles = await sql`SELECT household_id FROM profiles WHERE id = ${newUserId}`;
    if (newProfiles.length === 0) {
      console.error("New profile not found. The user needs to login to the app first so Clerk creates their profile.");
      return;
    }
    
    const newHouseholdId = newProfiles[0].household_id;

    // Get old profile
    const oldProfiles = await sql`SELECT household_id FROM profiles WHERE id = ${oldUserId}`;
    if (oldProfiles.length === 0) {
      console.error("Old profile not found.");
      return;
    }
    const oldHouseholdId = oldProfiles[0].household_id;

    // 1. Point new profile to old household
    await sql`UPDATE profiles SET household_id = ${oldHouseholdId} WHERE id = ${newUserId}`;
    console.log(`Linked ${newUserId} to household ${oldHouseholdId}`);

    // 2. Move data using tagged templates
    const tables = [
      { name: 'transactions', col: 'user_id' },
      { name: 'cards', col: 'user_id' },
      { name: 'installments', col: 'user_id' },
      { name: 'lending_records', col: 'user_id' },
      { name: 'payments', col: 'user_id' },
      { name: 'push_tokens', col: 'user_id' },
      { name: 'household_invites', col: 'created_by' }
    ];

    for (const table of tables) {
      await sql(`UPDATE ${table.name} SET ${table.col} = ${newUserId} WHERE ${table.col} = ${oldUserId}`);
      console.log(`Moved ${table.name}`);
    }

    // Move notification settings
    const oldSettings = await sql`SELECT * FROM notification_settings WHERE user_id = ${oldUserId}`;
    for (const s of oldSettings) {
      const exist = await sql`SELECT 1 FROM notification_settings WHERE user_id = ${newUserId} AND type = ${s.type}`;
      if (exist.length > 0) {
        await sql`DELETE FROM notification_settings WHERE id = ${s.id}`;
      } else {
        await sql`UPDATE notification_settings SET user_id = ${newUserId} WHERE id = ${s.id}`;
      }
    }
    console.log("Moved notification_settings");

    // 3. Delete old profile
    await sql`DELETE FROM profiles WHERE id = ${oldUserId}`;
    console.log(`Deleted old profile ${oldUserId}`);

    // 4. Delete the empty household that was created for the new profile, if it's different
    if (newHouseholdId !== oldHouseholdId) {
      await sql`DELETE FROM households WHERE id = ${newHouseholdId}`;
      console.log(`Deleted empty household ${newHouseholdId}`);
    }

    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

mapUser();
