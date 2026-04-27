const { Client } = require('pg');
const fs = require('fs');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://neondb_owner:npg_NbaJBdV2XW5Y@ep-weathered-rice-ak4febqu-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require'
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
