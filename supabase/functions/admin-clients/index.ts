import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPER_ADMIN_EMAIL = 'suporte@platafy.com';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Validar autenticação e se é o Super Admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cabeçalho de autorização ausente' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user || user.email?.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      return new Response(JSON.stringify({ error: 'Acesso negado: apenas o Super Admin (suporte@platafy.com) possui permissão para esta operação.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    // 2. Operação: create-client
    if (action === 'create-client') {
      const {
        email,
        password,
        full_name,
        tenant_name,
        phone,
        plan_id,
        billing_type = 'manual',
        payment_method = 'manual',
        status = 'active',
        start_date,
        end_date,
        notes = '',
      } = body;

      if (!email || !password) {
        return new Response(JSON.stringify({ error: 'E-mail e senha são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Cria o usuário na autenticação do Supabase
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name || '',
          tenant_name: tenant_name || `${email.split('@')[0]}'s workspace`,
          phone: phone || '',
        },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const newUserId = userData.user.id;

      // Buscar o perfil criado pelo trigger handle_new_user
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tenant_id')
        .eq('id', newUserId)
        .maybeSingle();

      const tenantId = profile?.tenant_id;

      if (tenantId) {
        // Obter plano selecionado para buscar dados
        let selectedPlanId = plan_id;
        if (!selectedPlanId) {
          const { data: defaultPlan } = await supabaseAdmin
            .from('plans')
            .select('id')
            .eq('slug', 'pro')
            .maybeSingle();
          selectedPlanId = defaultPlan?.id;
        }

        const now = new Date();
        const periodStart = start_date ? new Date(start_date) : now;
        const periodEnd = end_date ? new Date(end_date) : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Atualizar a assinatura
        await supabaseAdmin
          .from('subscriptions')
          .upsert(
            {
              tenant_id: tenantId,
              plan_id: selectedPlanId,
              status: status,
              billing_type: billing_type,
              payment_method: payment_method,
              notes: notes,
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              last_payment_date: status === 'active' ? now.toISOString() : null,
              updated_at: now.toISOString(),
            },
            { onConflict: 'tenant_id' }
          );

        // Se ativo e manual, registrar no histórico de pagamentos
        if (status === 'active') {
          const { data: planInfo } = await supabaseAdmin
            .from('plans')
            .select('price, currency')
            .eq('id', selectedPlanId)
            .maybeSingle();

          await supabaseAdmin.from('payment_history').insert({
            tenant_id: tenantId,
            plan_id: selectedPlanId,
            amount: planInfo?.price || 0,
            currency: planInfo?.currency || 'BRL',
            payment_method: payment_method,
            status: 'approved',
          });
        }

        // Registrar auditoria
        await supabaseAdmin.from('admin_audit_logs').insert({
          admin_email: SUPER_ADMIN_EMAIL,
          target_tenant_id: tenantId,
          target_user_id: newUserId,
          action: 'client_created',
          details: {
            email,
            full_name,
            tenant_name,
            phone,
            plan_id: selectedPlanId,
            billing_type,
            payment_method,
            status,
            current_period_end: periodEnd.toISOString(),
            notes,
          },
        });
      }

      return new Response(JSON.stringify({ success: true, user: userData.user, tenant_id: tenantId }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Operação: update-plan
    if (action === 'update-plan') {
      const { tenant_id, plan_id, reason = '' } = body;

      if (!tenant_id || !plan_id) {
        return new Response(JSON.stringify({ error: 'tenant_id e plan_id são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_id, status')
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          plan_id,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Registrar auditoria
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_email: SUPER_ADMIN_EMAIL,
        target_tenant_id: tenant_id,
        action: 'plan_changed',
        details: {
          old_plan_id: currentSub?.plan_id,
          new_plan_id: plan_id,
          reason,
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Operação: update-license
    if (action === 'update-license') {
      const {
        tenant_id,
        status,
        current_period_end,
        extend_days,
        billing_type,
        payment_method,
        notes,
        reason = '',
      } = body;

      if (!tenant_id) {
        return new Response(JSON.stringify({ error: 'tenant_id é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: currentSub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('tenant_id', tenant_id)
        .maybeSingle();

      const now = new Date();
      let newPeriodEnd = currentSub?.current_period_end;

      if (current_period_end) {
        newPeriodEnd = new Date(current_period_end).toISOString();
      } else if (extend_days && Number(extend_days) > 0) {
        const baseDate = (currentSub?.current_period_end && new Date(currentSub.current_period_end) > now)
          ? new Date(currentSub.current_period_end)
          : now;
        newPeriodEnd = new Date(baseDate.getTime() + Number(extend_days) * 24 * 60 * 60 * 1000).toISOString();
      }

      const updateData: any = {
        updated_at: now.toISOString(),
      };

      if (status !== undefined) updateData.status = status;
      if (newPeriodEnd !== undefined) updateData.current_period_end = newPeriodEnd;
      if (billing_type !== undefined) updateData.billing_type = billing_type;
      if (payment_method !== undefined) updateData.payment_method = payment_method;
      if (notes !== undefined) updateData.notes = notes;

      // Se foi renovado ou ativado, atualizar last_payment_date
      if (extend_days || (status === 'active' && currentSub?.status !== 'active')) {
        updateData.last_payment_date = now.toISOString();
      }

      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update(updateData)
        .eq('tenant_id', tenant_id);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Se estendeu dias, adicionar registro financeiro opcional
      if (extend_days && currentSub?.plan_id) {
        const { data: planInfo } = await supabaseAdmin
          .from('plans')
          .select('price, currency')
          .eq('id', currentSub.plan_id)
          .maybeSingle();

        await supabaseAdmin.from('payment_history').insert({
          tenant_id: tenant_id,
          plan_id: currentSub.plan_id,
          amount: planInfo?.price || 0,
          currency: planInfo?.currency || 'BRL',
          payment_method: payment_method || currentSub.payment_method || 'manual',
          status: 'approved',
        });
      }

      // Registrar auditoria
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_email: SUPER_ADMIN_EMAIL,
        target_tenant_id: tenant_id,
        action: extend_days ? 'license_renewed' : (status === 'suspended' ? 'license_suspended' : 'license_updated'),
        details: {
          previous_status: currentSub?.status,
          new_status: status || currentSub?.status,
          previous_period_end: currentSub?.current_period_end,
          new_period_end: newPeriodEnd,
          extend_days: extend_days || null,
          billing_type: billing_type || currentSub?.billing_type,
          reason,
        },
      });

      return new Response(JSON.stringify({ success: true, current_period_end: newPeriodEnd }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Operação: delete-client
    if (action === 'delete-client') {
      const { user_id, tenant_id, reason = '', email } = body;

      if (!user_id && !tenant_id) {
        return new Response(JSON.stringify({ error: 'user_id ou tenant_id é necessário' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Proteção de segurança: nunca permitir excluir a conta do Super Admin
      if (
        (user_id && user_id === user.id) ||
        (email && email.toLowerCase().trim() === SUPER_ADMIN_EMAIL.toLowerCase())
      ) {
        return new Response(JSON.stringify({ error: 'A conta principal do Super Admin não pode ser excluída.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Registrar auditoria antes da deleção
      try {
        await supabaseAdmin.from('admin_audit_logs').insert({
          admin_email: SUPER_ADMIN_EMAIL,
          target_tenant_id: tenant_id || null,
          target_user_id: user_id || null,
          action: 'client_deleted',
          details: { reason, email },
        });
      } catch (auditErr) {
        console.warn('Aviso ao registrar auditoria de exclusão:', auditErr);
      }

      // 1. Deletar o tenant (as chaves estrangeiras com CASCADE removem assinaturas, canais, integrações e posts)
      if (tenant_id) {
        const { error: delTenantError } = await supabaseAdmin.from('tenants').delete().eq('id', tenant_id);
        if (delTenantError) {
          console.error('Erro ao deletar tenant:', delTenantError);
        }
      }

      // 2. Deletar o usuário do auth (o perfil vinculado ao auth.users é removido por CASCADE)
      if (user_id) {
        try {
          const { error: delUserError } = await supabaseAdmin.auth.admin.deleteUser(user_id);
          if (delUserError) {
            console.warn('Aviso ao deletar usuário auth:', delUserError);
          }
        } catch (delErr: any) {
          console.warn('Exceção ao deletar auth user:', delErr?.message || delErr);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Operação: save-plan
    if (action === 'save-plan') {
      const { id, name, description, price, features, limits, is_popular, is_active } = body;

      if (!id) {
        return new Response(JSON.stringify({ error: 'ID do plano é obrigatório' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: currentPlan } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const updatePayload: Record<string, any> = {};
      if (price !== undefined) updatePayload.price = Number(price);
      if (name !== undefined) updatePayload.name = name;
      if (description !== undefined) updatePayload.description = description;
      if (features !== undefined) updatePayload.features = features;
      if (limits !== undefined) updatePayload.limits = limits;
      if (is_popular !== undefined) updatePayload.is_popular = Boolean(is_popular);
      if (is_active !== undefined) updatePayload.is_active = Boolean(is_active);

      const { data: updatedPlan, error: updateError } = await supabaseAdmin
        .from('plans')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Registrar auditoria
      await supabaseAdmin.from('admin_audit_logs').insert({
        admin_email: SUPER_ADMIN_EMAIL,
        action: 'plan_pricing_updated',
        details: {
          plan_id: id,
          plan_name: updatedPlan.name,
          old_price: currentPlan?.price,
          new_price: updatedPlan.price,
          updated_fields: Object.keys(updatePayload),
        },
      });

      return new Response(JSON.stringify({ success: true, plan: updatedPlan }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Ação desconhecida: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Erro interno no servidor' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
