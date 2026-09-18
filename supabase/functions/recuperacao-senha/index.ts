import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface RequestBody {
  email?: string;
  redirect_to?: string;
  action?: 'test-resend' | 'recover';
  resend_api_key?: string;
  resend_from_email?: string;
  test_type?: 'connection' | 'recovery_template';
  subject?: string;
  template_html?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json().catch(() => ({}));
    const cleanEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const redirect_to = body.redirect_to || 'https://socialhub.platafy.com/#/redefinir-senha';
    const action = body.action || 'recover';

    if (!cleanEmail) {
      return new Response(JSON.stringify({ error: 'Email é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Obter configurações do Resend (Env Vars ou Database platform_branding)
    let resendApiKey = Deno.env.get('RESEND_API_KEY') || body.resend_api_key;
    let resendFrom = Deno.env.get('RESEND_FROM_EMAIL') || body.resend_from_email || 'PLATAFY Social Hub <onboarding@resend.dev>';
    let customRecoverySubject: string | undefined;
    let customRecoveryHtml: string | undefined;
    let appName = 'PLATAFY SOCIAL HUB';
    let baseName = 'PLATAFY SOCIAL';
    let appTagline = 'HUB';
    let logoUrl = 'https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788896633632.png';

    try {
      const { data: brandingRow } = await supabaseAdmin
        .from('platform_branding')
        .select('branding')
        .eq('id', 1)
        .maybeSingle();

      if (brandingRow?.branding) {
        const b = brandingRow.branding;
        if (!resendApiKey && b.resend_api_key) {
          resendApiKey = b.resend_api_key;
        }
        if ((!resendFrom || resendFrom.includes('onboarding@resend.dev')) && b.resend_from_email) {
          resendFrom = b.resend_from_email;
        }
        if (b.email_recovery_subject) {
          customRecoverySubject = b.email_recovery_subject;
        }
        if (b.email_recovery_html) {
          customRecoveryHtml = b.email_recovery_html;
        }
        if (b.logo_url) {
          logoUrl = b.logo_url;
        }
        const rawTagline = (b.app_tagline || 'Hub').trim();
        const rawBase = (b.app_name || 'PLATAFY Social').trim();
        baseName = rawBase;
        appTagline = rawTagline;
        appName = rawBase.toLowerCase().endsWith(rawTagline.toLowerCase())
          ? rawBase
          : `${rawBase} ${rawTagline}`.trim();
      }
    } catch (e) {
      console.warn('[RecuperacaoSenha] Erro ao ler platform_branding:', e);
    }

    // 2. Ação especial: Testar envio Resend (Super Admin)
    if (action === 'test-resend') {
      if (!resendApiKey) {
        return new Response(JSON.stringify({ error: 'Chave de API do Resend (RESEND_API_KEY) não configurada.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const testType = body.test_type || 'recovery_template';
      let subject = 'Teste de Conexão - PLATAFY SOCIAL HUB (Resend)';
      let html = '';

      if (testType === 'connection') {
        subject = `Teste de Conexão - ${appName.toUpperCase()} (Resend)`;
        html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #070b14; color: #f8fafc; padding: 40px 20px; text-align: center;">
            <div style="max-width: 500px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <div style="display: inline-block; padding: 6px 16px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 999px; color: #f59e0b; font-weight: bold; font-size: 13px; margin-bottom: 20px;">
                ${appName.toUpperCase()}
              </div>
              <h1 style="color: #ffffff; font-size: 22px; margin-bottom: 12px; font-weight: 800;">Conexão com Resend com Sucesso! 🚀</h1>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
                Este é um e-mail de teste confirmando que a sua chave de API e remetente do <strong>Resend</strong> estão configurados corretamente para o envio de e-mails transacionais.
              </p>
              <div style="background: #1e293b; border-radius: 8px; padding: 12px; text-align: left; font-size: 12px; color: #cbd5e1; font-family: monospace;">
                <div><strong>Remetente:</strong> ${resendFrom}</div>
                <div><strong>Destinatário:</strong> ${cleanEmail}</div>
                <div><strong>Status:</strong> Ativo e Operacional</div>
              </div>
            </div>
          </div>
        `;
      } else {
        // Envia o template de recuperação formatado como teste real
        const templateRaw = body.template_html || customRecoveryHtml || '';
        const subjectRaw = body.subject || customRecoverySubject || `Redefinição de Senha - {{app_name}}`;
        const sampleUrl = 'https://socialhub.platafy.com/#/redefinir-senha?token=exemplo-token-teste-validacao';
        const currentYear = new Date().getFullYear().toString();

        subject = subjectRaw
          .replace(/\{\{\s*app_name\s*\}\}/gi, appName.toUpperCase())
          .replace(/\{\{\s*brand_title\s*\}\}/gi, baseName.toUpperCase());

        html = (templateRaw || `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Recuperação de Senha</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden;">
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #f59e0b, #ea580c);"></td>
          </tr>
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin: 0 auto 18px auto;">
                <tr>
                  <td style="vertical-align: middle; padding-right: 10px;">
                    <img src="${logoUrl}" alt="${appName.toUpperCase()}" width="38" height="38" style="display: block; width: 38px; height: 38px; border-radius: 8px; object-fit: contain;" />
                  </td>
                  <td style="vertical-align: middle; padding-right: 8px;">
                    <span style="color: #ffffff; font-size: 20px; font-weight: 900; letter-spacing: -0.3px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; white-space: nowrap; text-transform: uppercase;">
                      ${baseName.toUpperCase()}
                    </span>
                  </td>
                  <td style="vertical-align: middle;">
                    <span style="display: inline-block; background-color: #f59e0b; color: #090d16; font-size: 11px; font-weight: 900; padding: 2px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; vertical-align: middle;">
                      ${appTagline.toUpperCase()}
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="margin: 0 0 8px 0; color: #ffffff; font-size: 24px; font-weight: 800;">Recuperação de Senha</h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Instruções para redefinir o acesso à sua conta</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Olá,</p>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>${appName.toUpperCase()}</strong>. Clique no botão abaixo para cadastrar uma nova senha:
              </p>
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${sampleUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #090d16; font-weight: 800; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px;">
                      Redefinir Minha Senha &rarr;
                    </a>
                  </td>
                </tr>
              </table>
              <div style="background-color: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  🔒 <strong>Dica de Segurança:</strong> Este link é de uso único e expira em breve. Se você não solicitou a redefinição de senha, nenhuma ação é necessária.
                </p>
              </div>
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 20px 0 0 0; word-break: break-all;">
                Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
                <a href="${sampleUrl}" style="color: #f59e0b; text-decoration: underline;">${sampleUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 36px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px;">© ${currentYear} ${appName.toUpperCase()} • Todos os direitos reservados.</p>
              <p style="margin: 0; color: #475569; font-size: 11px;">Este é um e-mail transacional de teste.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `)
          .replace(/\{\{\s*\.ConfirmationURL\s*\}\}|\\{\{\s*reset_url\s*\}\}|\{\{\s*link_recuperacao\s*\}\}/gi, sampleUrl)
          .replace(/\{\{\s*\.Email\s*\}\}|\{\{\s*email\s*\}\}/gi, cleanEmail)
          .replace(/\{\{\s*logo_url\s*\}\}/gi, logoUrl)
          .replace(/\{\{\s*brand_title\s*\}\}/gi, baseName.toUpperCase())
          .replace(/\{\{\s*app_tagline\s*\}\}/gi, appTagline.toUpperCase())
          .replace(/\{\{\s*app_name\s*\}\}/gi, appName.toUpperCase())
          .replace(/\{\{\s*ano\s*\}\}/gi, currentYear);
      }

      const testRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom.trim(),
          to: [cleanEmail],
          subject: subject,
          html: html,
        }),
      });

      const testData = await testRes.json();
      if (!testRes.ok) {
        return new Response(JSON.stringify({ error: testData.message || 'Falha ao enviar e-mail de teste pelo Resend.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ ok: true, message: 'E-mail de teste enviado com sucesso via Resend!', resendId: testData.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Gerar link oficial de recuperação no Supabase Auth Admin
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: cleanEmail,
      options: {
        redirectTo: redirect_to,
      },
    });

    if (linkError) {
      console.warn('[RecuperacaoSenha] generateLink falhou:', linkError.message);
      // Se usuário não existe, retornar mensagem genérica para evitar enumeração de contas
      if (linkError.message.toLowerCase().includes('not found') || linkError.message.toLowerCase().includes('user')) {
        return new Response(JSON.stringify({
          ok: true,
          message: 'Se o e-mail estiver cadastrado em nossa base, você receberá o link de recuperação.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se falhou por outro motivo e não temos Resend, tentar fallback nativo
      if (!resendApiKey) {
        const nativeSupabase = createClient(supabaseUrl, supabaseAnonKey);
        await nativeSupabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirect_to });
        return new Response(JSON.stringify({
          ok: true,
          message: 'Instruções de recuperação enviadas para seu e-mail.',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: linkError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resetUrl = linkData?.properties?.action_link;
    if (!resetUrl) {
      return new Response(JSON.stringify({ error: 'Não foi possível gerar o link de recuperação.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se o Supabase gerou action_link apontando para localhost:3000 por falta de Site URL no Dashboard, sanitiza para a URL de produção
    if (resetUrl.includes('localhost:3000') || resetUrl.includes('localhost%3A3000')) {
      resetUrl = resetUrl
        .replace(/redirect_to=http%3A%2F%2Flocalhost%3A3000%2F%23%2Fredefinir-senha/g, `redirect_to=${encodeURIComponent(redirect_to)}`)
        .replace(/redirect_to=http%3A%2F%2Flocalhost%3A3000%2F%3F/g, `redirect_to=${encodeURIComponent(redirect_to)}`)
        .replace(/redirect_to=http%3A%2F%2Flocalhost%3A3000/g, `redirect_to=${encodeURIComponent(redirect_to)}`)
        .replace(/redirect_to=http:\/\/localhost:3000\/?/g, `redirect_to=${encodeURIComponent(redirect_to)}`);
    }

    // 4. Se tiver Resend configurado, enviar e-mail transacional via Resend API
    if (resendApiKey) {
      console.log(`[RecuperacaoSenha] Enviando e-mail de recuperação via Resend para ${cleanEmail}`);

      const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperação de Senha - PLATAFY SOCIAL HUB</title>
</head>
<body style="margin: 0; padding: 0; background-color: #070b14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #070b14; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Container Principal -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 540px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          
          <!-- Top Accent Line -->
          <tr>
            <td height="4" style="background: linear-gradient(90deg, #f59e0b, #ea580c);"></td>
          </tr>

          <!-- Header / Logo -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <div style="display: inline-block; padding: 6px 16px; background-color: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 999px; margin-bottom: 12px;">
                <span style="color: #f59e0b; font-size: 14px; font-weight: 800; letter-spacing: 0.5px;">PLATAFY <span style="background: #f59e0b; color: #070b14; padding: 2px 6px; border-radius: 6px; font-size: 11px; margin-left: 4px;">HUB</span></span>
              </div>
              <h1 style="margin: 12px 0 6px 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                Recuperação de Senha
              </h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">
                Instruções para redefinir o acesso à sua conta
              </p>
            </td>
          </tr>

          <!-- Conteúdo Principal -->
          <tr>
            <td style="padding: 10px 36px 30px 36px;">
              <p style="color: #e2e8f0; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Olá,
              </p>
              <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0;">
                Recebemos uma solicitação para redefinir a senha da sua conta no <strong>PLATAFY SOCIAL HUB</strong>. Se você realizou essa solicitação, clique no botão abaixo para cadastrar uma nova senha:
              </p>

              <!-- Botão CTA -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #090d16; font-weight: 800; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); text-align: center;">
                      Redefinir Minha Senha &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Aviso de Segurança -->
              <div style="background-color: rgba(30, 41, 59, 0.7); border: 1px solid #334155; border-radius: 12px; padding: 16px; margin: 24px 0;">
                <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.5;">
                  🔒 <strong>Dica de Segurança:</strong> Este link é de uso único e expira em poucas horas. Se você não solicitou a redefinição de senha, nenhuma ação é necessária e você pode ignorar este e-mail com segurança.
                </p>
              </div>

              <!-- Link alternativo se o botão falhar -->
              <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 20px 0 0 0; word-break: break-all;">
                Se o botão acima não funcionar, copie e cole o link a seguir no seu navegador:<br>
                <a href="${resetUrl}" style="color: #f59e0b; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="padding: 24px 36px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0 0 6px 0; color: #64748b; font-size: 12px;">
                © 2026 PLATAFY SOCIAL HUB • Gestão Inteligente de Redes Sociais com IA
              </p>
              <p style="margin: 0; color: #475569; font-size: 11px;">
                Este é um e-mail transacional automático. Por favor, não responda diretamente a esta mensagem.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `;

      const currentYear = new Date().getFullYear().toString();
      const subjectToUse = (customRecoverySubject || 'Redefinição de Senha - {{app_name}}')
        .replace(/\{\{\s*app_name\s*\}\}/gi, appName.toUpperCase())
        .replace(/\{\{\s*brand_title\s*\}\}/gi, baseName.toUpperCase());
      let htmlToUse = customRecoveryHtml || emailHtml;

      htmlToUse = htmlToUse
        .replace(/\{\{\s*\.ConfirmationURL\s*\}\}|\{\{\s*reset_url\s*\}\}|\{\{\s*link_recuperacao\s*\}\}/gi, resetUrl)
        .replace(/\{\{\s*\.Email\s*\}\}|\{\{\s*email\s*\}\}/gi, cleanEmail)
        .replace(/\{\{\s*logo_url\s*\}\}/gi, logoUrl)
        .replace(/\{\{\s*brand_title\s*\}\}/gi, baseName.toUpperCase())
        .replace(/\{\{\s*app_tagline\s*\}\}/gi, appTagline.toUpperCase())
        .replace(/\{\{\s*app_name\s*\}\}/gi, appName.toUpperCase())
        .replace(/\{\{\s*ano\s*\}\}/gi, currentYear);

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: resendFrom.trim(),
          to: [cleanEmail],
          subject: subjectToUse,
          html: htmlToUse,
        }),
      });

      const resendData = await resendRes.json();
      if (!resendRes.ok) {
        console.error('[RecuperacaoSenha] Erro na API do Resend:', resendData);
        // Fallback nativo caso a chave do Resend tenha algum problema de remetente
        const nativeSupabase = createClient(supabaseUrl, supabaseAnonKey);
        await nativeSupabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: redirect_to });
        return new Response(JSON.stringify({
          ok: true,
          message: 'Instruções de recuperação enviadas para o seu e-mail.',
          warning: resendData.message || 'Resend falhou, fallback nativo acionado',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({
        ok: true,
        message: 'Email de recuperação enviado com sucesso via Resend!',
        resendId: resendData.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Se não tiver RESEND_API_KEY, fallback nativo via Supabase Auth
    console.log('[RecuperacaoSenha] RESEND_API_KEY não configurada, enviando via Supabase Auth nativo');
    const nativeSupabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error: nativeError } = await nativeSupabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirect_to,
    });

    if (nativeError) {
      return new Response(JSON.stringify({ error: nativeError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message: 'Email de recuperação enviado com sucesso!',
      note: 'Dica: Configure RESEND_API_KEY para envio transacional customizado pelo Resend.',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[RecuperacaoSenha] Exceção não tratada:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});