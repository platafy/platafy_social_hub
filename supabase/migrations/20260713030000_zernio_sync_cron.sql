-- Enable extensions
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
    url := 'https://sabzbazyxfxorrfsnhqf.supabase.co/functions/v1/zernio-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
