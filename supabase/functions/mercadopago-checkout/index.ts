import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Identificar usuário autenticado
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Autorização necessária' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Obter dados do Tenant do usuário
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tenant_id, full_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const tenantId = profile?.tenant_id
    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'Tenant não encontrado para este usuário' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Obter payload (plan_id e origin)
    const { plan_id, origin } = await req.json()
    if (!plan_id) {
      return new Response(JSON.stringify({ error: 'ID do plano é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Buscar detalhes do plano
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', plan_id)
      .maybeSingle()

    if (planError || !plan) {
      return new Response(JSON.stringify({ error: 'Plano não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Buscar credenciais do Mercado Pago
    let mpAccessToken = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || ''

    if (!mpAccessToken) {
      const { data: settings } = await supabaseAdmin
        .from('platform_settings')
        .select('mercadopago_access_token')
        .limit(1)
        .maybeSingle()

      mpAccessToken = settings?.mercadopago_access_token || ''
    }

    if (!mpAccessToken) {
      return new Response(
        JSON.stringify({
          error: 'O Mercado Pago ainda não foi configurado pelo administrador. Configure o Access Token em Configurações.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // 6. Criar preferência de pagamento no Mercado Pago
    const clientOrigin = origin || 'https://platafy-social-hub.vercel.app'
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`

    const preferenceData = {
      items: [
        {
          id: plan.id,
          title: `Assinatura ${plan.name} - Platafy Social`,
          description: plan.description || `Plano mensal ${plan.name}`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(plan.price),
        },
      ],
      payer: {
        email: user.email || profile.email,
        name: profile.full_name || 'Cliente',
      },
      external_reference: JSON.stringify({
        tenant_id: tenantId,
        plan_id: plan.id,
        user_id: user.id,
      }),
      back_urls: {
        success: `${clientOrigin}/#/planos?payment=success`,
        pending: `${clientOrigin}/#/planos?payment=pending`,
        failure: `${clientOrigin}/#/planos?payment=failure`,
      },
      auto_return: 'approved',
      notification_url: webhookUrl,
      statement_descriptor: 'PLATAFY SOCIAL',
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(preferenceData),
    })

    if (!mpResponse.ok) {
      const mpErr = await mpResponse.json()
      console.error('Erro Mercado Pago:', mpErr)
      return new Response(
        JSON.stringify({
          error: mpErr.message || 'Erro ao gerar checkout com Mercado Pago',
          details: mpErr,
        }),
        {
          status: mpResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const preference = await mpResponse.json()

    return new Response(
      JSON.stringify({
        preference_id: preference.id,
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err: any) {
    console.error('Erro na função mercadopago-checkout:', err)
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
