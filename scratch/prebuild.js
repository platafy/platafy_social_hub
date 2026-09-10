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

async function syncOpenGraph() {
  const indexHtmlPath = path.join(projectRoot, 'index.html');
  if (!fs.existsSync(indexHtmlPath)) return;

  try {
    const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*["']?([^"'\r\n]+)["']?/);
    const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY\s*=\s*["']?([^"'\r\n]+)["']?/);

    const supabaseUrl = process.env.VITE_SUPABASE_URL || (urlMatch ? urlMatch[1].trim() : 'https://sabzbazyxfxorrfshhgf.supabase.co');
    const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || (keyMatch && !keyMatch[1].includes('SUA_') ? keyMatch[1].trim() : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYnpiYXp5eGZ4b3JyZnNoaGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTQ5NjAsImV4cCI6MjEwNDI3MDk2MH0.6D3o1VP-PfQ86s-HhlBxyfchQNCoWGTuS7cRo8Zs1z8');

    const res = await fetch(`${supabaseUrl}/rest/v1/platform_branding?id=eq.1&select=branding`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const b = data?.[0]?.branding;
      if (b && b.og_image_url) {
        let html = fs.readFileSync(indexHtmlPath, 'utf8');
        html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/>/g, `<meta property="og:image" content="${b.og_image_url}" />`);
        html = html.replace(/<meta property="og:image:secure_url" content="[^"]*"\s*\/>/g, `<meta property="og:image:secure_url" content="${b.og_image_url}" />`);
        html = html.replace(/<meta name="twitter:image" content="[^"]*"\s*\/>/g, `<meta name="twitter:image" content="${b.og_image_url}" />`);
        if (b.og_title) {
          html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/>/g, `<meta property="og:title" content="${b.og_title}" />`);
          html = html.replace(/<meta name="twitter:title" content="[^"]*"\s*\/>/g, `<meta name="twitter:title" content="${b.og_title}" />`);
        }
        if (b.og_description) {
          html = html.replace(/<meta property="og:description" content="[^"]*"\s*\/>/g, `<meta property="og:description" content="${b.og_description}" />`);
          html = html.replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/g, `<meta name="twitter:description" content="${b.og_description}" />`);
        }
        fs.writeFileSync(indexHtmlPath, html, 'utf8');
        console.log('[Prebuild] Metatags Open Graph de index.html sincronizadas com platform_branding.');
      }
    }
  } catch (err) {
    console.warn('[Prebuild] Aviso ao sincronizar Open Graph no index.html:', err.message);
  }
}

async function main() {
  prebuild();
  await syncOpenGraph();
}

main();
