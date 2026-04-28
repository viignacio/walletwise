require('dotenv').config({ path: '.env' });
const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    connectionString: process.env.EXPO_PUBLIC_DATABASE_URL
  });
  await client.connect();
  const schema = fs.readFileSync('neon/schema.sql', 'utf8');
  try {
    await client.query(schema);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Error applying schema:", err);
  } finally {
    await client.end();
  }
}
main();
