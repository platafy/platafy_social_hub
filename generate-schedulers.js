import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'supabase', 'config.toml');

if (!fs.existsSync(configPath)) {
  console.error(`Config file not found: ${configPath}`);
  process.exit(1);
}

const config = fs.readFileSync(configPath, 'utf-8');
const match = config.match(/project_id\s*=\s*"([^"]+)"/);

if (!match || !match[1]) {
  console.error('Could not extract project_id from supabase/config.toml');
  process.exit(1);
}

const projectId = match[1];
console.log(`Detected Supabase Project ID: ${projectId}`);

const sql = `-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedules existing job if any to avoid duplicates
select cron.unschedule(jobid) from cron.job where jobname = 'zernio-sync-job';

-- Schedule the zernio-sync Edge Function to run every 2 minutes
select cron.schedule(
  'zernio-sync-job',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://${projectId}.supabase.co/functions/v1/zernio-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
`;

const outputPath = path.join(__dirname, 'supabase', 'migrations', '20260713030000_zernio_sync_cron.sql');
fs.writeFileSync(outputPath, sql, 'utf-8');
console.log(`Successfully generated migration file: ${outputPath}`);
