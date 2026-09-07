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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const url = new URL(req.url)

    // Mercado Pago pode enviar dados via Query Params ou no Body JSON
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // Sem body json
    }

    const type = body?.type || body?.topic || url.searchParams.get('type') || url.searchParams.get('topic')
    const paymentId = body?.data?.id || body?.id || url.searchParams.get('data.id') || url.searchParams.get('id')

    console.log(`[MercadoPago Webhook] Tipo: ${type}, ID: ${paymentId}`)

    // Se não for evento de pagamento, responde 200 imediatamente
    if (!paymentId || (type && type !== 'payment' && type !== 'collection')) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Obter Access Token do Mercado Pago
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
      console.error('[MercadoPago Webhook] Access token não configurado.')
      return new Response(JSON.stringify({ error: 'Token não configurado' }), { status: 200 })
    }

    // 2. Consultar detalhes do pagamento na API oficial do Mercado Pago
    const mpPaymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
      },
    })

    if (!mpPaymentRes.ok) {
      console.error(`[MercadoPago Webhook] Falha ao consultar pagamento ${paymentId}: status ${mpPaymentRes.status}`)
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    const payment = await mpPaymentRes.json()
    const paymentStatus = payment.status // approved, pending, in_process, rejected, cancelled

    console.log(`[MercadoPago Webhook] Pagamento ${paymentId} status: ${paymentStatus}`)

    // 3. Extrair referências de Tenant e Plano
    let tenantId = ''
    let planId = ''

    if (payment.external_reference) {
      try {
        const parsed = JSON.parse(payment.external_reference)
        tenantId = parsed.tenant_id || ''
        planId = parsed.plan_id || ''
      } catch {
        tenantId = payment.external_reference
      }
    }

    if (!tenantId) {
      console.warn(`[MercadoPago Webhook] Pagamento ${paymentId} sem tenant_id identificado.`)
      return new Response(JSON.stringify({ received: true }), { status: 200 })
    }

    // 4. Se o pagamento foi APROVADO: ativar assinatura por 30 dias
    if (paymentStatus === 'approved') {
      const now = new Date()
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 dias

      const { error: subError } = await supabaseAdmin
        .from('subscriptions')
        .upsert(
          {
            tenant_id: tenantId,
            plan_id: planId || undefined,
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            mercadopago_payment_id: String(payment.id),
            updated_at: now.toISOString(),
          },
          { onConflict: 'tenant_id' }
        )

      if (subError) {
        console.error('[MercadoPago Webhook] Erro ao atualizar subscription:', subError)
      } else {
        console.log(`[MercadoPago Webhook] Assinatura do tenant ${tenantId} ativada com sucesso até ${periodEnd.toISOString()}!`)
      }

      // Registrar histórico de pagamento
      await supabaseAdmin.from('payment_history').insert({
        tenant_id: tenantId,
        plan_id: planId || null,
        amount: Number(payment.transaction_amount || 0),
        currency: payment.currency_id || 'BRL',
        payment_method: payment.payment_method_id || 'mercadopago',
        status: 'approved',
        mercadopago_payment_id: String(payment.id),
        receipt_url: payment.transaction_details?.external_resource_url || null,
      })
    } else if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
      // Registrar falha no histórico
      await supabaseAdmin.from('payment_history').insert({
        tenant_id: tenantId,
        plan_id: planId || null,
        amount: Number(payment.transaction_amount || 0),
        currency: payment.currency_id || 'BRL',
        payment_method: payment.payment_method_id || 'mercadopago',
        status: paymentStatus,
        mercadopago_payment_id: String(payment.id),
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error('[MercadoPago Webhook] Erro inesperado:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 200, // Retorna 200 para evitar loops no Mercado Pago
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
