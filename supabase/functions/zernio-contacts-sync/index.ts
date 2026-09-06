// supabase/functions/zernio-contacts-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { tenantId, integrationId } = body

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenantId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch integrations for this tenant
    let integrationsQuery = supabaseClient
      .from('zernio_integrations')
      .select('*')
      .eq('tenant_id', tenantId)

    if (integrationId) {
      integrationsQuery = integrationsQuery.eq('id', integrationId)
    }

    const { data: integrations, error: intError } = await integrationsQuery
    if (intError) throw intError
    if (!integrations || integrations.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No integrations found', synced: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let totalSynced = 0

    for (const integration of integrations) {
      if (!integration.api_key || !integration.zernio_profile_id) continue

      const profileId = integration.zernio_profile_id
      let page = 1
      let hasMore = true

      while (hasMore) {
        try {
          const url = `https://zernio.com/api/v1/contacts?profileId=${profileId}&page=${page}&limit=50`
          const contactsRes = await fetch(url, {
            headers: { 'Authorization': `Bearer ${integration.api_key}` }
          })

          if (!contactsRes.ok) {
            console.warn(`Contacts API returned ${contactsRes.status} for integration ${integration.name}`)
            break
          }

          const contactsData = await contactsRes.json()
          const contacts: any[] = contactsData?.contacts || contactsData?.data || []

          if (contacts.length === 0) {
            hasMore = false
            break
          }

          // Build batch upsert payload
          const batch = contacts.map((c: any) => {
            const platforms: string[] = []
            if (c.channels) {
              c.channels.forEach((ch: any) => {
                const p = ch.platform || ch.type
                if (p && !platforms.includes(p)) platforms.push(p)
              })
            }

            return {
              tenant_id: tenantId,
              zernio_contact_id: c._id || c.id,
              profile_id: profileId,
              integration_id: integration.id,
              name: c.name || c.displayName || null,
              email: c.email || null,
              phone: c.phone || c.phoneNumber || null,
              avatar_url: c.avatarUrl || c.picture || null,
              tags: c.tags || [],
              platforms,
              last_interaction_at: c.lastInteractionAt || c.updatedAt || null,
              raw_data: c,
              updated_at: new Date().toISOString()
            }
          })

          const { error: upsertError } = await supabaseClient
            .from('zernio_contacts')
            .upsert(batch, { onConflict: 'tenant_id,zernio_contact_id' })

          if (upsertError) {
            console.error('Upsert error:', upsertError.message)
          } else {
            totalSynced += batch.length
          }

          // Check if there are more pages
          const total = contactsData?.total || contactsData?.meta?.total || 0
          hasMore = contacts.length === 50 && (page * 50) < total
          page++
        } catch (fetchErr: any) {
          console.error(`Error fetching contacts page ${page} for integration ${integration.name}:`, fetchErr.message)
          break
        }
      }
    }

    return new Response(JSON.stringify({ success: true, synced: totalSynced }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
