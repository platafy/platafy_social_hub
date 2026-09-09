import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zernio-profile-id, x-zernio-integration-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Authenticate user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get tenant ID
    const { data: profile, error: pError } = await supabaseClient
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    if (pError || !profile?.tenant_id) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantId = profile.tenant_id
    const url = new URL(req.url)
    const pathIndex = url.pathname.indexOf('/zernio-api')
    const subPath = pathIndex !== -1 ? url.pathname.substring(pathIndex + '/zernio-api'.length) : ''

    // Configuration endpoint
    if (subPath === '/config') {
      if (req.method === 'POST') {
        const body = await req.json()
        const { id, name, apiKey, profileId } = body
        let finalApiKey = apiKey

        if (id) {
          // Update existing config
          if (!finalApiKey) {
            const { data: existing } = await supabaseClient
              .from('zernio_integrations')
              .select('api_key')
              .eq('id', id)
              .eq('tenant_id', tenantId)
              .maybeSingle()

            if (existing?.api_key) {
              finalApiKey = existing.api_key
            }
          }

          const updateObj: any = {
            zernio_profile_id: profileId !== undefined ? profileId : null,
            updated_at: new Date().toISOString()
          }
          if (name) {
            updateObj.name = name
            updateObj.account_name = name
          }
          if (finalApiKey) updateObj.api_key = finalApiKey

          const { error: updateError } = await supabaseClient
            .from('zernio_integrations')
            .update(updateObj)
            .eq('id', id)
            .eq('tenant_id', tenantId)

          if (updateError) {
            return new Response(JSON.stringify({ error: 'Failed to update configuration: ' + updateError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        } else {
          // Insert new config
          if (!finalApiKey) {
            return new Response(JSON.stringify({ error: 'apiKey is required for setup' }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }

          let resolvedProfileId = profileId || null

          // Pre-validate key with Zernio API and resolve default profile
          try {
            const valRes = await fetch('https://zernio.com/api/v1/profiles', {
              headers: { Authorization: `Bearer ${finalApiKey}` }
            })
            if (valRes.status === 401) {
              return new Response(JSON.stringify({ error: 'Chave de API inválida ou não autorizada pela Zernio. Verifique se a chave foi copiada corretamente de https://zernio.com/dashboard/api-keys' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
            if (valRes.ok) {
              const pData = await valRes.json().catch(() => null)
              if (pData?.profiles && pData.profiles.length > 0) {
                if (!resolvedProfileId) {
                  resolvedProfileId = pData.profiles[0]._id || pData.profiles[0].id || null
                }
              }
            }
          } catch (vErr) {
            console.warn('Could not pre-validate key with Zernio:', vErr)
          }

          const accountLabel = name || body.account_name || 'Conta Principal'

          // Check if an integration already exists for this tenant
          const { data: existingList } = await supabaseClient
            .from('zernio_integrations')
            .select('id, name, account_name, api_key')
            .eq('tenant_id', tenantId)

          const match = existingList?.find((e: any) => 
            e.api_key === finalApiKey || e.name === accountLabel || e.account_name === accountLabel
          )

          let insertError = null
          if (match) {
            const { error } = await supabaseClient
              .from('zernio_integrations')
              .update({
                api_key: finalApiKey,
                zernio_profile_id: resolvedProfileId,
                name: accountLabel,
                account_name: accountLabel,
                updated_at: new Date().toISOString()
              })
              .eq('id', match.id)
            insertError = error
          } else {
            const { error } = await supabaseClient
              .from('zernio_integrations')
              .insert({
                tenant_id: tenantId,
                api_key: finalApiKey,
                zernio_profile_id: resolvedProfileId,
                name: accountLabel,
                account_name: accountLabel
              })
            insertError = error
          }

          if (insertError) {
            return new Response(JSON.stringify({ error: 'Failed to save configuration: ' + insertError.message }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } else if (req.method === 'GET') {
        const { data: integrations, error: fetchError } = await supabaseClient
          .from('zernio_integrations')
          .select('id, name, account_name, zernio_profile_id, api_key')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: true })

        if (fetchError) {
          return new Response(JSON.stringify({ error: fetchError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const list = integrations || []
        const noCacheHeaders = {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
        return new Response(JSON.stringify({
          connected: list.length > 0,
          profileId: list[0]?.zernio_profile_id || null,
          hasKey: !!list[0]?.api_key,
          integrations: list.map((i: any) => ({
            id: i.id,
            name: i.name || i.account_name || 'Conta Principal',
            profileId: i.zernio_profile_id,
            hasKey: !!i.api_key
          }))
        }), {
          status: 200,
          headers: noCacheHeaders,
        })
      } else if (req.method === 'DELETE') {
        const body = await req.json().catch(() => ({}))
        const { id } = body
        if (!id) {
          return new Response(JSON.stringify({ error: 'id is required to delete configuration' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const { error: deleteError } = await supabaseClient
          .from('zernio_integrations')
          .delete()
          .eq('id', id)
          .eq('tenant_id', tenantId)

        if (deleteError) {
          return new Response(JSON.stringify({ error: deleteError.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Contacts upsert — frontend cannot write directly due to RLS; use service_role here
    if (subPath === '/contacts-upsert' && req.method === 'POST') {
      const { contacts } = await req.json().catch(() => ({ contacts: [] }))
      if (!Array.isArray(contacts) || contacts.length === 0) {
        return new Response(JSON.stringify({ success: true, upserted: 0 }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const batch = contacts
        .filter((c: any) => c?.zernio_contact_id)
        .map((c: any) => ({ ...c, tenant_id: tenantId }))

      const { error: upsertError } = await supabaseClient
        .from('zernio_contacts')
        .upsert(batch, { onConflict: 'tenant_id,zernio_contact_id' })

      if (upsertError) {
        return new Response(JSON.stringify({ error: upsertError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({ success: true, upserted: batch.length }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // For other endpoints, proxy to Zernio API using tenant's API key
    const integrationHeader = req.headers.get('x-zernio-integration-id')
    let integrationQuery = supabaseClient
      .from('zernio_integrations')
      .select('api_key')
      .eq('tenant_id', tenantId)

    if (integrationHeader) {
      integrationQuery = integrationQuery.eq('id', integrationHeader)
    }

    const { data: integrationRow, error: iError } = await integrationQuery.maybeSingle()

    let integration = integrationRow
    if (!integration) {
      // Fallback: use first configured integration
      const { data: firstIntegration } = await supabaseClient
        .from('zernio_integrations')
        .select('api_key')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      integration = firstIntegration
    }

    if (iError || !integration?.api_key) {
      return new Response(JSON.stringify({ error: 'Zernio API key not configured for this workspace.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validação de limite comercial de Perfis Ativos
    if (subPath === '/v1/profiles' && req.method === 'POST') {
      try {
        const { data: sub } = await supabaseClient
          .from('subscriptions')
          .select('status, plan_id, plans(slug, limits)')
          .eq('tenant_id', tenantId)
          .maybeSingle();

        const planLimits = (sub?.plans as any)?.limits || {};
        let maxProfiles = 1;
        if (typeof planLimits.max_profiles === 'number') {
          maxProfiles = planLimits.max_profiles;
        } else if (typeof planLimits.max_channels === 'number') {
          maxProfiles = planLimits.max_channels === -1 ? -1 : Math.max(1, Math.ceil(planLimits.max_channels / 2));
        }

        if (maxProfiles !== -1) {
          const { data: tenantIntegrations } = await supabaseClient
            .from('zernio_integrations')
            .select('id, api_key')
            .eq('tenant_id', tenantId);

          let totalActiveProfiles = 0;
          if (tenantIntegrations && tenantIntegrations.length > 0) {
            for (const integ of tenantIntegrations) {
              if (!integ.api_key) continue;
              try {
                const checkRes = await fetch('https://zernio.com/api/v1/profiles', {
                  headers: { Authorization: `Bearer ${integ.api_key}` }
                });
                if (checkRes.ok) {
                  const pData = await checkRes.json().catch(() => null);
                  if (Array.isArray(pData?.profiles)) {
                    totalActiveProfiles += pData.profiles.length;
                  }
                }
              } catch (err) {
                console.warn('Error checking profiles for quota:', err);
              }
            }
          }

          if (totalActiveProfiles >= maxProfiles) {
            return new Response(JSON.stringify({
              success: false,
              error: `Limite de Perfis Ativos atingido (${totalActiveProfiles}/${maxProfiles}). Cada Perfil Ativo permite conectar até 2 contas no Zernio. Faça upgrade do seu plano para criar novos perfis.`
            }), {
              status: 403,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (limitErr) {
        console.warn('Erro ao validar limite de perfis:', limitErr);
      }
    }

    // Build target Zernio API URL
    const zernioUrl = `https://zernio.com/api${subPath}${url.search}`

    // Prepare headers for Zernio
    const zernioHeaders = new Headers()
    zernioHeaders.set('Authorization', `Bearer ${integration.api_key}`)

    const contentType = req.headers.get('content-type')
    if (contentType) {
      zernioHeaders.set('content-type', contentType)
    }

    const requestOptions: RequestInit = {
      method: req.method,
      headers: zernioHeaders,
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const bodyBytes = await req.arrayBuffer()
      requestOptions.body = bodyBytes
    }

    const zernioResponse = await fetch(zernioUrl, requestOptions)
    const responseData = await zernioResponse.text()

    if (!zernioResponse.ok) {
      console.error(`Zernio API Error on ${req.method} ${zernioUrl} (status: ${zernioResponse.status}):`, responseData)
      return new Response(JSON.stringify({ success: false, error: responseData }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Pass response back to client
    return new Response(responseData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': zernioResponse.headers.get('content-type') || 'application/json',
      }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
