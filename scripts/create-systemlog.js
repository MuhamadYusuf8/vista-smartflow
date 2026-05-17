/**
 * Create SystemLog table in Supabase using the Management API (SQL endpoint)
 * Uses fetch to call Supabase's REST SQL endpoint with service role key
 */

const SUPABASE_URL = 'https://takdeldvplugbrgnikqp.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRha2RlbGR2cGx1Z2JyZ25pa3FwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg4MTQ1MiwiZXhwIjoyMDkyNDU3NDUyfQ.ccWyF4nF18_l1DRVrg0JPVM6fYcrB29qZzS85qlEjd4';

const SQL = `
CREATE TABLE IF NOT EXISTS "SystemLog" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_systemlog_created_at ON "SystemLog" (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_systemlog_event ON "SystemLog" (event);

ALTER TABLE "SystemLog" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'SystemLog' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON "SystemLog" FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

async function main() {
  console.log('Creating SystemLog table via Supabase SQL API...');
  
  // Use the pg REST endpoint to run raw SQL
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: SQL }),
  });

  console.log('REST RPC response status:', response.status);
  
  if (response.status === 404) {
    console.log('RPC endpoint not available. Trying direct pg connection...');
    
    // Use pg module to connect directly
    try {
      const { Client } = require('pg');
      const client = new Client({
        connectionString: 'postgresql://postgres.takdeldvplugbrgnikqp:@1Y2u3s4u5f@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres',
      });
      
      await client.connect();
      console.log('Connected to PostgreSQL directly!');
      
      await client.query(SQL);
      console.log('SystemLog table created successfully!');
      
      // Verify
      const result = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`);
      console.log('Tables in database:', result.rows.map(r => r.table_name));
      
      // Insert a test log
      await client.query(`INSERT INTO "SystemLog" (event, details) VALUES ('DATA_SYNC_ETLE', '{"details": "SystemLog table created and verified", "timestamp": "${new Date().toISOString()}"}')`);
      console.log('Test log entry inserted!');
      
      // Verify the test entry
      const logs = await client.query(`SELECT * FROM "SystemLog"`);
      console.log('SystemLog entries:', logs.rows);
      
      await client.end();
    } catch (pgErr) {
      console.error('PG connection error:', pgErr.message);
      console.log('\nPlease install pg: npm install pg');
      console.log('Or create the table manually in Supabase SQL Editor with this SQL:');
      console.log(SQL);
    }
  }
}

main().catch(console.error);
