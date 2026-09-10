import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Zernio-Signature'
}

function getWebhookMessageText(msg: any): string {
  if (!msg) return "";
  if (typeof msg.text === "string" && msg.text) return msg.text;
  if (typeof msg.message === "string" && msg.message) return msg.message;
  if (msg.message && typeof msg.message === "object") {
    if (typeof msg.message.text === "string") return msg.message.text;
    if (typeof msg.message.caption === "string") return msg.message.caption;
  }
  if (typeof msg.content === "string" && msg.content) return msg.content;
  if (typeof msg.body === "string" && msg.body) return msg.body;
  return "";
}

async function processWebhookEvent(supabaseClient: any, payload: any, event: string, isRetry = false, existingLogId?: string) {
  // Extract social account ID from the correct location
  const accountObj = payload.account || {}
  const socialAccountId = payload.accountId || payload.socialAccountId || accountObj.id || accountObj.accountId || payload.account_id || ''
  let platform = accountObj.platform || payload.platform || payload.network || payload.networkType || ''
  const profileId = payload.profileId || accountObj.profileId || ''

  if (!socialAccountId) {
    throw new Error('Missing social account ID.')
  }

  // Find tenant and integration via zernio_integration_channels first
  let tenantId = ''
  let integrationId = ''

  if (socialAccountId) {
    const { data: mappedChannel } = await supabaseClient
      .from('zernio_integration_channels')
      .select('tenant_id, integration_id, platform')
      .eq('social_account_id', socialAccountId)
      .limit(1)
      .maybeSingle()
    if (mappedChannel) {
      tenantId = mappedChannel.tenant_id
      integrationId = mappedChannel.integration_id
      if (!platform) {
        platform = mappedChannel.platform || ''
      }
    }
  }

  // Fallback 1: Find by profileId from zernio_integrations
  if (!tenantId && profileId) {
    const { data: integration } = await supabaseClient
      .from('zernio_integrations')
      .select('id, tenant_id')
      .eq('zernio_profile_id', profileId)
      .limit(1)
      .maybeSingle()
    if (integration) {
      tenantId = integration.tenant_id
      integrationId = integration.id
    }
  }

  // Fallback 2: Find tenant via automations table
  if (!tenantId) {
    const { data: automationRow } = await supabaseClient
      .from('zernio_automations')
      .select('tenant_id')
      .eq('social_account_id', socialAccountId)
      .limit(1)
      .maybeSingle()
    if (automationRow?.tenant_id) {
      tenantId = automationRow.tenant_id
    }
  }

  if (!tenantId) {
    throw new Error(`No tenant found for socialAccountId: ${socialAccountId}`)
  }

  // Fetch integration keys
  let integrationQuery = supabaseClient
    .from('zernio_integrations')
    .select('id, api_key, ai_gemini_key, ai_openai_key, ai_anthropic_key, ai_mistral_key, ai_groq_key, ai_seekai_key')
    .eq('tenant_id', tenantId)

  if (integrationId) {
    integrationQuery = integrationQuery.eq('id', integrationId)
  }

  const { data: integrationRow } = await integrationQuery.maybeSingle()
  let finalIntegration = integrationRow

  if (!finalIntegration) {
    const { data: firstIntegration } = await supabaseClient
      .from('zernio_integrations')
      .select('id, api_key, ai_gemini_key, ai_openai_key, ai_anthropic_key, ai_mistral_key, ai_groq_key, ai_seekai_key')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    finalIntegration = firstIntegration
  }

  const zernioApiKey = finalIntegration?.api_key || ''
  const aiProviderKeys: Record<string, string> = {
    gemini: finalIntegration?.ai_gemini_key || Deno.env.get('GEMINI_API_KEY') || '',
    openai: finalIntegration?.ai_openai_key || Deno.env.get('OPENAI_API_KEY') || '',
    anthropic: finalIntegration?.ai_anthropic_key || Deno.env.get('ANTHROPIC_API_KEY') || '',
    mistral: finalIntegration?.ai_mistral_key || Deno.env.get('MISTRAL_API_KEY') || '',
    groq: finalIntegration?.ai_groq_key || Deno.env.get('GROQ_API_KEY') || '',
    seekai: finalIntegration?.ai_seekai_key || Deno.env.get('SEEKAI_API_KEY') || '',
  }

  if (!zernioApiKey) {
    throw new Error('Zernio API Key is not configured for this account.')
  }

  // Extract fields
  let textContent = ''
  let postId = ''
  let commentId = ''
  let conversationId = ''
  let senderUsername = ''
  let authorId = ''

  if (event === 'comment.received') {
    const commentObj = payload.comment || {}
    textContent = getWebhookMessageText(commentObj)
    postId = commentObj.postId || commentObj.platformPostId || ''
    commentId = commentObj.id || ''
    senderUsername = commentObj.author?.username || commentObj.author?.name || ''
    authorId = commentObj.author?.id || ''
  } else {
    // message.received
    const msgObj = payload.message || {}
    textContent = getWebhookMessageText(msgObj)
    conversationId = msgObj.conversationId || payload.conversationId || payload.conversation?.id || ''
    senderUsername = msgObj.sender?.username || msgObj.sender?.name || ''
    postId = payload.postId || msgObj.postId || payload.conversation?.postId || ''
  }

  // LOOP GUARD 1: Skip comment replies (Skip on explicit retry)
  if (!isRetry) {
    if (event === 'comment.received') {
      const commentObj = payload.comment || {}
      if (commentObj.isReply === true || commentObj.parentId || commentObj.parent_id) {
        return { success: true, message: 'Ignored: reply comment' }
      }

      // LOOP GUARD 2: Skip self-comment
      const accountUsername = (accountObj.username || '').toLowerCase()
      if (accountUsername && senderUsername && senderUsername.toLowerCase() === accountUsername) {
        return { success: true, message: 'Ignored: self-comment' }
      }
    } else {
      // message.received
      const msgObj = payload.message || {}
      const isOutgoing = msgObj.direction === 'outgoing' || payload.direction === 'outgoing' || payload.message?.direction === 'outgoing'
      if (isOutgoing) {
        return { success: true, message: 'Ignored: outgoing message' }
      }
    }

    // LOOP GUARD 3: Deduplication
    const webhookEventId = payload.id || ''
    if (webhookEventId) {
      const { error: dedupInsertError } = await supabaseClient
        .from('zernio_automation_dedup')
        .insert({ tenant_id: tenantId, event_id: webhookEventId, comment_id: commentId || conversationId })

      if (dedupInsertError && dedupInsertError.code === '23505') {
        return { success: true, message: 'Duplicate event skipped' }
      }
    }
  }

  // Initialize or update Log entry
  let logId = existingLogId
  if (!logId) {
    const { data: newLog, error: logErr } = await supabaseClient
      .from('zernio_automation_logs')
      .insert({
        tenant_id: tenantId,
        social_account_id: socialAccountId,
        platform: platform || 'unknown',
        event_type: event,
        external_id: commentId || conversationId || 'unknown',
        sender_username: senderUsername || null,
        content: textContent || null,
        status: 'no_automation',
        raw_payload: payload
      })
      .select('id')
      .single()
    
    if (logErr) {
      console.error('Failed to create log entry:', logErr.message)
    } else {
      logId = newLog?.id
    }
  }

  const updateLogStatus = async (status: string, errorMsg?: string, replySent?: string) => {
    if (logId) {
      await supabaseClient
        .from('zernio_automation_logs')
        .update({
          status,
          error_message: errorMsg || null,
          reply_sent: replySent || null
        })
        .eq('id', logId)
    }
  }

  // Fetch active automation rules
  const { data: automations } = await supabaseClient
    .from('zernio_automations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('social_account_id', socialAccountId)
    .eq('is_enabled', true)

  if (!automations || automations.length === 0) {
    await updateLogStatus('no_automation', 'No active automations found')
    return { success: true, message: 'No active automations' }
  }

  const isAltCommentMessage = event === 'message.received' && (platform.toLowerCase() === 'youtube' || platform.toLowerCase() === 'tiktok')
  const targetType = isAltCommentMessage
    ? ['comment_reply']
    : event === 'comment.received'
      ? ['comment_reply', 'comment_to_dm']
      : ['dm_reply']
  const matchedRules = automations.filter(rule => targetType.includes(rule.automation_type))

  if (matchedRules.length === 0) {
    await updateLogStatus('no_automation', 'No matching automation type rules')
    return { success: true, message: 'No matched rules' }
  }

  for (const rule of matchedRules) {
    // A. Validate target post filtering
    if ((event === 'comment.received' || isAltCommentMessage) && rule.target_posts_type === 'specific') {
      const rulePostIds = rule.target_post_ids || []
      const commentObj = payload.comment || {}
      const matchesPost = rulePostIds.includes(postId) ||
        (commentObj?.platformPostId && rulePostIds.includes(commentObj.platformPostId)) ||
        (commentObj?.postId && rulePostIds.includes(commentObj.postId)) ||
        (payload?.postId && rulePostIds.includes(payload.postId)) ||
        (payload?.platformPostId && rulePostIds.includes(payload.platformPostId))

      if (!matchesPost) {
        await updateLogStatus('ignored', `Ignored: post ID ${postId} is not in targeted specific list`)
        continue
      }
    }

    // B. Validate keywords
    if (rule.trigger_type === 'keyword') {
      const keywords = rule.keywords || []
      const lowercaseText = textContent.toLowerCase()
      const matched = keywords.some((kw: string) => lowercaseText.includes(kw.toLowerCase()))
      if (!matched) {
        await updateLogStatus('ignored', `Ignored: keywords [${keywords.join(', ')}] not matched`)
        continue
      }
    }

    // C. Reply content generation
    let replyText = ''
    const provider = rule.ai_provider || 'static'

    if (provider === 'static') {
      replyText = rule.static_reply || ''
    } else {
      const apiKey = aiProviderKeys[provider] || ''
      const promptContext = `Você é um assistente virtual respondendo a uma interação em redes sociais.
Tipo de interação: ${event === 'comment.received' || isAltCommentMessage ? 'Comentário' : 'Mensagem direta'}
Autor: @${senderUsername}
Mensagem original: "${textContent}"
Instrução do prompt: ${rule.ai_prompt || 'Responda educadamente e ajude o usuário.'}
Responda diretamente e de forma concisa.`

      if (!apiKey) {
        if (rule.static_reply) {
          replyText = rule.static_reply
        } else {
          await updateLogStatus('failed', `Failed: AI provider ${provider} key missing`)
          continue
        }
      } else {
        try {
          if (provider === 'gemini') {
            const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: promptContext }] }] })
            })
            if (!aiRes.ok) throw new Error(`Gemini status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          } else if (provider === 'openai') {
            const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
            })
            if (!aiRes.ok) throw new Error(`OpenAI status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.choices?.[0]?.message?.content || ''
          } else if (provider === 'anthropic') {
            const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
              body: JSON.stringify({ model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
            })
            if (!aiRes.ok) throw new Error(`Anthropic status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.content?.[0]?.text || ''
          } else if (provider === 'mistral') {
            const aiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
            })
            if (!aiRes.ok) throw new Error(`Mistral status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.choices?.[0]?.message?.content || ''
          } else if (provider === 'groq') {
            const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
            })
            if (!aiRes.ok) throw new Error(`Groq status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.choices?.[0]?.message?.content || ''
          } else if (provider === 'seekai') {
            const aiRes = await fetch('https://seekai.cc/v1/chat/completions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
              body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
            })
            if (!aiRes.ok) throw new Error(`SeekAI status ${aiRes.status}`)
            const aiData = await aiRes.json()
            replyText = aiData?.choices?.[0]?.message?.content || ''
          }
        } catch (aiErr: any) {
          if (rule.static_reply) {
            replyText = rule.static_reply
          } else {
            await updateLogStatus('failed', `AI generation error: ${aiErr.message}`)
            continue
          }
        }
      }
    }

    replyText = replyText.trim()
    if (!replyText) continue

    // D. Dispatch response via Zernio API
    let endpoint = ''
    let requestBody: any = {}

    const isYoutubeOrTiktok = platform.toLowerCase() === 'youtube' || platform.toLowerCase() === 'tiktok'

    if (event === 'comment.received' || (event === 'message.received' && isYoutubeOrTiktok)) {
      const targetCommentId = event === 'comment.received' ? commentId : (payload.message?.id || '')
      
      if (rule.automation_type === 'comment_to_dm' && event === 'comment.received') {
        endpoint = `https://zernio.com/api/v1/inbox/comments/${postId}/${targetCommentId}/private-reply`
        requestBody = { accountId: socialAccountId, text: replyText, message: replyText }
      } else {
        // Reply as comment (or comment reply)
        endpoint = `https://zernio.com/api/v1/inbox/comments/${postId}`
        requestBody = { accountId: socialAccountId, text: replyText, message: replyText, commentId: targetCommentId }
      }
    } else {
      // Standard DM/Conversation endpoint (Instagram/Facebook/WhatsApp/etc.)
      endpoint = `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`
      requestBody = { accountId: socialAccountId, text: replyText, message: replyText }
    }

    try {
      const zernioRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zernioApiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!zernioRes.ok) {
        const errText = await zernioRes.text()
        await updateLogStatus('failed', `Zernio dispatch error ${zernioRes.status} on POST ${endpoint} with ${JSON.stringify(requestBody)}: ${errText}`)
      } else {
        await updateLogStatus('success', undefined, replyText)
        return { success: true, replied: true, replyText }
      }
    } catch (zernioErr: any) {
      await updateLogStatus('failed', `Zernio fetch call error: ${zernioErr.message}`)
    }
  }

  return { success: true }
}

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Handle simple GET ping requests
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ success: true, message: 'Receiver is online' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let payload: any = {}
    try {
      payload = await req.json()
    } catch {
      return new Response(JSON.stringify({ success: true, message: 'Handshake/Empty body' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // A. Check if this is a RETRY trigger request from frontend
    if (payload.action === 'retry') {
      const logId = payload.logId
      if (!logId) {
        return new Response(JSON.stringify({ error: 'Missing logId' }), { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // Fetch the log row
      const { data: logRow, error: fetchErr } = await supabaseClient
        .from('zernio_automation_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle()

      if (fetchErr || !logRow) {
        return new Response(JSON.stringify({ error: 'Log row not found' }), { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const retryResult = await processWebhookEvent(supabaseClient, logRow.raw_payload, logRow.event_type, true, logId)
      return new Response(JSON.stringify({ success: true, result: retryResult }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // B. Otherwise handle normal incoming Zernio webhook events
    console.log('Received Zernio webhook:', JSON.stringify(payload))
    const event = payload.event
    if (!event) {
      return new Response(JSON.stringify({ success: true, message: 'Ping/Handshake successful' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Handle Post status webhooks
    if (event.startsWith('post.')) {
      const post = payload.post
      if (!post) {
        return new Response(JSON.stringify({ error: 'Missing post object' }), { status: 400, headers: corsHeaders })
      }
      const zernioPostId = post.id
      const status = post.status
      const profileId = post.profileId

      if (!profileId) {
        return new Response(JSON.stringify({ error: 'Missing profileId' }), { status: 400, headers: corsHeaders })
      }

      const { data: integration } = await supabaseClient
        .from('zernio_integrations')
        .select('tenant_id, id')
        .eq('zernio_profile_id', profileId)
        .limit(1)
        .maybeSingle()

      if (!integration) {
        return new Response(JSON.stringify({ error: 'No matching tenant integration' }), { status: 200, headers: corsHeaders })
      }

      await supabaseClient
        .from('zernio_posts')
        .upsert({
          tenant_id: integration.tenant_id,
          zernio_integration_id: integration.id,
          zernio_post_id: zernioPostId,
          text: post.text || '',
          status: status || 'draft',
          scheduled_at: post.scheduledAt || null,
          platforms: post.platforms || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'zernio_post_id' })

      return new Response(JSON.stringify({ success: true, type: 'post_status_updated' }), { status: 200, headers: corsHeaders })
    }

    // Handle Inbox Comment & Message webhooks
    if (event === 'comment.received' || event === 'message.received') {
      try {
        const result = await processWebhookEvent(supabaseClient, payload, event)
        return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: corsHeaders })
      } catch (procErr: any) {
        console.error('Error during processWebhookEvent:', procErr.message);
        
        // Safe fallback to save log entry on critical crash/failure
        try {
          const accountObj = payload.account || {};
          const socialAccountId = payload.accountId || payload.socialAccountId || accountObj.id || accountObj.accountId || payload.account_id || '';
          let platform = accountObj.platform || payload.platform || payload.network || payload.networkType || 'unknown';
          const commentObj = payload.comment || {};
          const msgObj = payload.message || {};
          const textContent = getWebhookMessageText(commentObj) || getWebhookMessageText(msgObj) || '';
          const externalId = commentObj.id || msgObj.conversationId || payload.conversationId || 'unknown';

          // Retrieve tenant_id to persist the log correctly
          let tenantId = '';
          const profileId = payload.profileId || accountObj.profileId || '';

          if (socialAccountId) {
            const { data: mappedChannel } = await supabaseClient
              .from('zernio_integration_channels')
              .select('tenant_id')
              .eq('social_account_id', socialAccountId)
              .limit(1)
              .maybeSingle();
            if (mappedChannel) {
              tenantId = mappedChannel.tenant_id;
            }
          }

          if (!tenantId && profileId) {
            const { data: integration } = await supabaseClient
              .from('zernio_integrations')
              .select('tenant_id')
              .eq('zernio_profile_id', profileId)
              .limit(1)
              .maybeSingle();
            if (integration) {
              tenantId = integration.tenant_id;
            }
          }

          // Fallback: pick the first available tenant in the workspace for debugging
          if (!tenantId) {
            const { data: firstTenant } = await supabaseClient
              .from('tenants')
              .select('id')
              .limit(1)
              .maybeSingle();
            if (firstTenant) {
              tenantId = firstTenant.id;
            }
          }

          if (tenantId) {
            await supabaseClient
              .from('zernio_automation_logs')
              .insert({
                tenant_id: tenantId,
                social_account_id: socialAccountId || 'unknown',
                platform,
                event_type: event,
                external_id: externalId,
                sender_username: commentObj.author?.username || msgObj.sender?.username || 'anônimo',
                content: textContent || null,
                status: 'failed',
                error_message: procErr.message,
                raw_payload: payload
              });
          }
        } catch (logWriteErr: any) {
          console.error('Critical: Failed to write error log to db:', logWriteErr.message);
        }

        return new Response(JSON.stringify({ error: procErr.message }), { status: 200, headers: corsHeaders })
      }
    }

    return new Response(JSON.stringify({ error: 'Event not handled' }), { status: 200, headers: corsHeaders })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders })
  }
})
