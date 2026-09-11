import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { email, password, full_name, tenant_name } = await req.json();

    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';
    const cleanFullName = typeof full_name === 'string' ? full_name.trim().slice(0, 100) : '';
    const cleanTenantName = typeof tenant_name === 'string' ? tenant_name.trim().slice(0, 100) : '';

    if (!cleanEmail || !cleanPassword) {
      return new Response(JSON.stringify({ error: 'Email e senha são obrigatórios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!EMAIL_REGEX.test(cleanEmail)) {
      return new Response(JSON.stringify({ error: 'Formato de email inválido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (cleanPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Senha deve ter no mínimo 6 caracteres' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPassword,
      email_confirm: true,
      user_metadata: { full_name: cleanFullName, tenant_name: cleanTenantName },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});