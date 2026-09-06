import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();
const envPath = path.join(projectRoot, '.env');
const cronSqlPath = path.join(projectRoot, 'supabase', 'migrations', '20260713030000_zernio_sync_cron.sql');

function prebuild() {
  try {
    if (!fs.existsSync(envPath)) {
      console.warn('[Prebuild] Arquivo .env não encontrado.');
      return;
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const projectMatch = envContent.match(/VITE_SUPABASE_PROJECT_ID\s*=\s*["']?([^"'\r\n]+)["']?/);
    
    if (!projectMatch || !projectMatch[1]) {
      console.warn('[Prebuild] VITE_SUPABASE_PROJECT_ID não definido no arquivo .env.');
      return;
    }

    const projectId = projectMatch[1].trim();
    console.log(`[Prebuild] ID do projeto Supabase encontrado: ${projectId}`);

    if (fs.existsSync(cronSqlPath)) {
      let sqlContent = fs.readFileSync(cronSqlPath, 'utf8');
      
      // Substitui https://SEU_PROJET_ID.supabase.co e variações com o ID correto
      const updatedSql = sqlContent.replace(
        /https:\/\/[A-Za-z0-9_-]+\.supabase\.co\/functions\/v1\/zernio-sync/g,
        `https://${projectId}.supabase.co/functions/v1/zernio-sync`
      ).replace(
        /https:\/\/SEU_PROJET_ID\.supabase\.co\/functions\/v1\/zernio-sync/g,
        `https://${projectId}.supabase.co/functions/v1/zernio-sync`
      );

      if (sqlContent !== updatedSql) {
        fs.writeFileSync(cronSqlPath, updatedSql, 'utf8');
        console.log('[Prebuild] Arquivo migration SQL do cron atualizado com sucesso.');
      } else {
        console.log('[Prebuild] Arquivo migration SQL do cron já possui o ID correto.');
      }
    } else {
      console.warn('[Prebuild] Arquivo migration SQL do cron não encontrado em:', cronSqlPath);
    }
  } catch (err) {
    console.error('[Prebuild] Erro ao sincronizar o ID do Supabase:', err.message);
  }
}

prebuild();
