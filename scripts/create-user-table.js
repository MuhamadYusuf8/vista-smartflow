const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.takdeldvplugbrgnikqp:@1Y2u3s4u5f@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
  });
  await client.connect();
  
  console.log('Creating User table...');
  
  // Create Role enum type first
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE "Role" AS ENUM ('ADMIN', 'OFFICER', 'VIEWER');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('Role enum created.');
  
  // Create User table
  await client.query(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role "Role" DEFAULT 'OFFICER',
      "createdAt" TIMESTAMPTZ DEFAULT now(),
      "updatedAt" TIMESTAMPTZ DEFAULT now()
    );
  `);
  console.log('User table created.');
  
  // Check if admin user exists
  const existing = await client.query(`SELECT id FROM "User" WHERE email = 'admin@dishub.go.id'`);
  
  if (existing.rows.length === 0) {
    // Create the admin user (password: admin123)
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO "User" (name, email, password, role)
      VALUES ('System Admin', 'admin@dishub.go.id', $1, 'ADMIN')
    `, [hashedPassword]);
    console.log('Admin user created: admin@dishub.go.id / admin123');
    
    // Create officer user
    const officerPassword = await bcrypt.hash('officer123', 10);
    await client.query(`
      INSERT INTO "User" (name, email, password, role)
      VALUES ('Field Officer', 'officer@dishub.go.id', $1, 'OFFICER')
    `, [officerPassword]);
    console.log('Officer user created: officer@dishub.go.id / officer123');
  } else {
    console.log('Admin user already exists.');
  }
  
  // Enable RLS
  await client.query(`ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;`);
  
  // Create policy for service role
  await client.query(`
    DO $$ BEGIN
      CREATE POLICY "Service role full access" ON "User" FOR ALL USING (true) WITH CHECK (true);
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('RLS policies applied.');
  
  // Verify
  const result = await client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' ORDER BY table_name
  `);
  console.log('\nAll tables:', result.rows.map(r => r.table_name));
  
  const users = await client.query(`SELECT id, name, email, role FROM "User"`);
  console.log('Users:', users.rows);
  
  await client.end();
  console.log('\n✅ Database setup complete!');
}

main().catch(console.error);
