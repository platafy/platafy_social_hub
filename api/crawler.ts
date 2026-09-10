const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://sabzbazyxfxorrfshhgf.supabase.co";
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhYnpiYXp5eGZ4b3JyZnNoaGdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2OTQ5NjAsImV4cCI6MjEwNDI3MDk2MH0.6D3o1VP-PfQ86s-HhlBxyfchQNCoWGTuS7cRo8Zs1z8";

const DEFAULT_IMAGE = "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/og-default.jpg";
const DEFAULT_TITLE = "PLATAFY Social Hub - Gestão Inteligente de Redes Sociais";
const DEFAULT_DESC = "Automatize comentários, DMs e publicações multicanais com Inteligência Artificial. Centralize o atendimento do seu negócio.";

export default async function handler(req: any, res: any) {
  let ogImage = DEFAULT_IMAGE;
  let ogTitle = DEFAULT_TITLE;
  let ogDesc = DEFAULT_DESC;
  let targetUrl = "https://socialhub.platafy.com/";

  // Detect requested URL/path if any
  const host = req.headers?.host || "socialhub.platafy.com";
  const proto = req.headers?.["x-forwarded-proto"] || "https";
  const urlPath = req.url || "/";
  targetUrl = `${proto}://${host}${urlPath}`;

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/platform_branding?id=eq.1&select=branding`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const b = data?.[0]?.branding;
      if (b) {
        if (b.og_image_url) ogImage = b.og_image_url;
        if (b.og_title) ogTitle = b.og_title;
        else if (b.app_name) ogTitle = `${b.app_name} ${b.app_tagline || ""}`.trim() + " - Gestão Inteligente";
        if (b.og_description) ogDesc = b.og_description;
      }
    }
  } catch (err) {
    console.error("[Crawler Handler] Erro ao consultar platform_branding:", err);
  }

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${ogTitle}</title>
  <meta name="description" content="${ogDesc}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <!-- Open Graph / WhatsApp / Facebook -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${targetUrl}">
  <meta property="og:title" content="${ogTitle}">
  <meta property="og:description" content="${ogDesc}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:secure_url" content="${ogImage}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${ogTitle}">
  <meta property="og:site_name" content="PLATAFY Social Hub">

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${ogTitle}">
  <meta name="twitter:description" content="${ogDesc}">
  <meta name="twitter:image" content="${ogImage}">

  <!-- Redirecionamento se um usuário humano acessar este endpoint -->
  <meta http-equiv="refresh" content="0; url=${targetUrl}">
</head>
<body style="background:#0b141a;color:#fff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:20px;text-align:center;">
  <img src="${ogImage}" alt="${ogTitle}" style="max-width:100%;max-height:400px;border-radius:16px;margin-bottom:20px;box-shadow:0 10px 30px rgba(0,0,0,0.5);">
  <h1>${ogTitle}</h1>
  <p style="color:#aaa;max-width:600px;">${ogDesc}</p>
  <a href="${targetUrl}" style="color:#fca102;text-decoration:none;font-weight:bold;margin-top:15px;">Acessar Plataforma &rarr;</a>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  res.status(200).send(html);
}
