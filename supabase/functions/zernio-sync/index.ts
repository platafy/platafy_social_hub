// supabase/functions/zernio-sync/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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

    // 1. Fetch active YouTube and TikTok automations
    const { data: automations, error: autError } = await supabaseClient
      .from('zernio_automations')
      .select('*')
      .in('platform', ['youtube', 'tiktok'])
      .eq('is_enabled', true)

    if (autError) throw autError
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No active YT/TT automations found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // 2. Fetch corresponding Zernio integrations to get API keys and profile IDs
    const tenantIds = [...new Set(automations.map(a => a.tenant_id))]
    const { data: integrations, error: intError } = await supabaseClient
      .from('zernio_integrations')
      .select('*')
      .in('tenant_id', tenantIds)

    if (intError) throw intError

    let syncCount = 0
    let processedComments = 0
    let repliedComments = 0

    // 3. For each active integration, pull latest posts and their comments
    for (const integration of (integrations || [])) {
      if (!integration.api_key || !integration.zernio_profile_id) continue
      syncCount++

      try {
        const profileId = integration.zernio_profile_id
        const zernioApiKey = integration.api_key

        // Get posts that contain comments from Zernio API
        const zRes = await fetch(`https://zernio.com/api/v1/inbox/comments?profileId=${profileId}&limit=40`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${zernioApiKey}`
          }
        })

        if (!zRes.ok) {
          console.error(`Failed to get posts for integration ${integration.id}:`, await zRes.text())
          continue
        }

        const resData = await zRes.json()
        const postsList = resData.comments || resData.data || []

        for (const post of postsList) {
          const postId = post.id || post._id
          const accountId = post.accountId || post.socialAccountId || ''
          const platform = (post.platform || '').toLowerCase()
          if (platform !== 'youtube' && platform !== 'tiktok') continue

          // Fetch the actual comments for this specific post
          const commentsRes = await fetch(`https://zernio.com/api/v1/inbox/comments/${postId}?accountId=${accountId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${zernioApiKey}`
            }
          })
          if (!commentsRes.ok) {
            console.error(`Failed to fetch comments for post ${postId}:`, await commentsRes.text())
            continue
          }

          const commentsData = await commentsRes.json()
          const commentsList = commentsData.comments || commentsData.data || []

          // Filter comments that are NOT from the channel owner
          const incomingComments = commentsList.filter((c: any) => {
            const commentFrom = c.from || c.sender || c.author || {}
            const isMe = commentFrom.isOwner || commentFrom.is_owner
            return !isMe
          })

          if (incomingComments.length === 0) continue

          // Check which comments have already been automated successfully in logs
          const commentIds = incomingComments.map((c: any) => c.id || c._id)
          const { data: logs } = await supabaseClient
            .from('zernio_automation_logs')
            .select('external_id')
            .in('external_id', commentIds)
            .eq('status', 'success')

          const processedIds = new Set((logs || []).map((l: any) => l.external_id))

          for (const comment of incomingComments) {
            const cId = comment.id || comment._id
            if (processedIds.has(cId)) continue // Already automated
            processedComments++

            // Check if there is a manual/existing reply from owner in the commentsList
            const hasOwnerReply = commentsList.some((c: any) => {
              const cFrom = c.from || c.sender || c.author || {}
              const isOwner = cFrom.isOwner || cFrom.is_owner
              const isReply = c.parentId === cId || c.parent_id === cId
              return isOwner && isReply
            })
            if (hasOwnerReply) continue

            // Find matching automation rule for this account
            const rule = automations.find(a => a.social_account_id === accountId)
            if (!rule) continue

            const textContent = comment.message || comment.text || comment.content || ''
            
            // Execute Rule: Check keywords if trigger type is keyword
            if (rule.trigger_type === 'keyword' && rule.keywords && rule.keywords.length > 0) {
              const matched = rule.keywords.some((kw: string) => 
                textContent.toLowerCase().includes(kw.trim().toLowerCase())
              )
              if (!matched) continue
            }

            // Create initial log entry
            const { data: newLog, error: logErr } = await supabaseClient
              .from('zernio_automation_logs')
              .insert({
                tenant_id: rule.tenant_id,
                social_account_id: accountId,
                platform,
                event_type: 'comment.received',
                external_id: cId,
                sender_username: comment.author?.username || comment.from?.username || 'anônimo',
                content: textContent || null,
                status: 'no_automation',
                raw_payload: comment
              })
              .select('id')
              .single()

            if (logErr) {
              console.error('Failed to create sync log entry:', logErr.message)
              continue
            }

            const logId = newLog.id
            let replyText = rule.static_reply || ''

            // Generate response with AI if needed
            if (rule.ai_provider && rule.ai_provider !== 'static') {
              const provider = rule.ai_provider
              const apiKey = integration[`ai_${provider}_key` as keyof typeof integration] || Deno.env.get(`${provider.toUpperCase()}_API_KEY`) || ''
              const promptContext = `Comentário do Usuário: "${textContent}"\nInstrução: ${rule.ai_prompt}`

              if (apiKey) {
                try {
                  if (provider === 'gemini') {
                    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ contents: [{ parts: [{ text: promptContext }] }] })
                    })
                    const aiData = await aiRes.json()
                    replyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || replyText
                  } else if (provider === 'openai') {
                    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                      body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
                    })
                    const aiData = await aiRes.json()
                    replyText = aiData?.choices?.[0]?.message?.content || replyText
                  } else if (provider === 'anthropic') {
                    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01'
                      },
                      body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 180,
                        messages: [{ role: 'user', content: promptContext }]
                      })
                    })
                    const aiData = await aiRes.json()
                    replyText = aiData?.content?.[0]?.text || replyText
                  } else if (provider === 'mistral') {
                    const aiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                      body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
                    })
                    const aiData = await aiRes.json()
                    replyText = aiData?.choices?.[0]?.message?.content || replyText
                  } else if (provider === 'groq') {
                    const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
                    })
                    const aiData = await aiRes.json()
                    replyText = aiData?.choices?.[0]?.message?.content || replyText
                  }
                } catch (aiErr: any) {
                  console.error('Sync AI generation failed:', aiErr.message)
                }
              }
            }

            replyText = replyText.trim()
            if (!replyText) {
              await supabaseClient
                .from('zernio_automation_logs')
                .update({ status: 'ignored', error_message: 'Empty AI response' })
                .eq('id', logId)
              continue
            }

            // Reply to YouTube/TikTok comment
            const endpoint = `https://zernio.com/api/v1/inbox/comments/${postId}`
            const requestBody = { accountId, text: replyText, message: replyText, commentId: cId }

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
                await supabaseClient
                  .from('zernio_automation_logs')
                  .update({ 
                    status: 'failed', 
                    error_message: `Sync dispatch error ${zernioRes.status}: ${errText}` 
                  })
                  .eq('id', logId)
              } else {
                repliedComments++
                await supabaseClient
                  .from('zernio_automation_logs')
                  .update({ 
                    status: 'success', 
                    reply_sent: replyText 
                  })
                  .eq('id', logId)
              }
            } catch (dispErr: any) {
              await supabaseClient
                .from('zernio_automation_logs')
                .update({ 
                  status: 'failed', 
                  error_message: `Sync dispatch fetch failed: ${dispErr.message}` 
                })
                .eq('id', logId)
            }
          }
        }
      } catch (err: any) {
        console.error(`Sync error on integration ${integration.id}:`, err.message)
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      syncCount, 
      processedComments, 
      repliedComments 
    }), {
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
