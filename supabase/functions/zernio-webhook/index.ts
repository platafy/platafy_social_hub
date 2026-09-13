import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Zernio-Signature'
}

function getWebhookMessageText(msg: any): string {
  if (!msg) return "";
  if (typeof msg === "string") return msg;
  if (typeof msg.text === "string" && msg.text) return msg.text;
  if (typeof msg.message === "string" && msg.message) return msg.message;
  if (msg.message && typeof msg.message === "object") {
    if (typeof msg.message.text === "string") return msg.message.text;
    if (typeof msg.message.caption === "string") return msg.message.caption;
  }
  if (typeof msg.content === "string" && msg.content) return msg.content;
  if (typeof msg.body === "string" && msg.body) return msg.body;
  if (typeof msg.comment === "string" && msg.comment) return msg.comment;
  if (typeof msg.caption === "string" && msg.caption) return msg.caption;
  return "";
}

function normalizeText(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

async function processWebhookEvent(supabaseClient: any, payload: any, event: string, isRetry = false, existingLogId?: string) {
  const normEvent = String(event || '').toLowerCase().trim();
  const accountObj = payload.account || {};
  const commentObj = payload.comment || {};
  const msgObj = payload.message || {};

  // 1. Identify event category (comment vs message)
  const isCommentEvent =
    normEvent.startsWith('comment.') ||
    normEvent.includes('comment') ||
    normEvent === 'comment_reply' ||
    normEvent === 'comment_to_dm' ||
    Boolean(payload.comment);

  const isMessageEvent = !isCommentEvent && (
    normEvent.startsWith('message.') ||
    normEvent.includes('message') ||
    normEvent.includes('conversation') ||
    normEvent === 'dm_reply' ||
    Boolean(payload.message)
  );

  // 2. Extract Social Account ID robustly across all Zernio/Meta formats
  let socialAccountId = String(
    payload.accountId ||
    payload.socialAccountId ||
    accountObj._id ||
    accountObj.id ||
    accountObj.accountId ||
    payload.account_id ||
    commentObj.accountId ||
    commentObj.socialAccountId ||
    msgObj.accountId ||
    ''
  ).trim();

  let platform = String(
    accountObj.platform ||
    payload.platform ||
    payload.network ||
    payload.networkType ||
    ''
  ).toLowerCase().trim();

  const rawProfileId = payload.profileId || accountObj.profileId || '';
  const profileId = typeof rawProfileId === 'object'
    ? (rawProfileId?._id || rawProfileId?.id || '')
    : (rawProfileId || '');

  let accountUsername = String(accountObj.username || payload.username || '').toLowerCase().trim();

  // 3. Find tenant and integration
  let tenantId = '';
  let integrationId = '';

  // Step A: Search in zernio_integration_channels by social_account_id
  if (socialAccountId) {
    const { data: mappedChannel } = await supabaseClient
      .from('zernio_integration_channels')
      .select('tenant_id, integration_id, platform, username, account_name, social_account_id')
      .eq('social_account_id', socialAccountId)
      .limit(1)
      .maybeSingle();

    if (mappedChannel) {
      tenantId = mappedChannel.tenant_id;
      integrationId = mappedChannel.integration_id;
      if (!platform) platform = (mappedChannel.platform || '').toLowerCase();
      if (!accountUsername && (mappedChannel.username || mappedChannel.account_name)) {
        accountUsername = (mappedChannel.username || mappedChannel.account_name).toLowerCase().trim();
      }
    }
  }

  // Step B: Fallback search by username in zernio_integration_channels
  if (!tenantId && accountUsername) {
    const { data: channelByUsername } = await supabaseClient
      .from('zernio_integration_channels')
      .select('tenant_id, integration_id, platform, social_account_id')
      .or(`username.ilike.%${accountUsername}%,account_name.ilike.%${accountUsername}%`)
      .limit(1)
      .maybeSingle();

    if (channelByUsername) {
      tenantId = channelByUsername.tenant_id;
      integrationId = channelByUsername.integration_id;
      if (!socialAccountId) socialAccountId = channelByUsername.social_account_id;
      if (!platform) platform = (channelByUsername.platform || '').toLowerCase();
    }
  }

  // Step C: Fallback by profileId in zernio_integrations
  if (!integrationId && profileId) {
    const { data: integration } = await supabaseClient
      .from('zernio_integrations')
      .select('id, tenant_id')
      .eq('zernio_profile_id', profileId)
      .limit(1)
      .maybeSingle();

    if (integration) {
      if (!tenantId) tenantId = integration.tenant_id;
      integrationId = integration.id;
    }
  }

  // Step D: Fallback by automations table
  if (!tenantId && socialAccountId) {
    const { data: automationRow } = await supabaseClient
      .from('zernio_automations')
      .select('tenant_id, platform')
      .eq('social_account_id', socialAccountId)
      .limit(1)
      .maybeSingle();

    if (automationRow?.tenant_id) {
      tenantId = automationRow.tenant_id;
      if (!platform) platform = (automationRow.platform || '').toLowerCase();
    }
  }

  // Step E: Fallback by single active integration in database
  if (!tenantId) {
    const { data: allIntegrations } = await supabaseClient
      .from('zernio_integrations')
      .select('id, tenant_id')
      .limit(1)
      .maybeSingle();

    if (allIntegrations) {
      tenantId = allIntegrations.tenant_id;
      if (!integrationId) integrationId = allIntegrations.id;
    }
  }

  if (!platform) {
    platform = 'instagram';
  }

  if (!tenantId) {
    throw new Error(`Nenhum tenant encontrado para socialAccountId: ${socialAccountId || accountUsername || 'desconhecido'}`);
  }

  // 4. Fetch integration keys
  let finalIntegration: any = null;
  if (integrationId) {
    const { data: integrationRow } = await supabaseClient
      .from('zernio_integrations')
      .select('id, api_key, ai_gemini_key, ai_openai_key, ai_anthropic_key, ai_mistral_key, ai_groq_key, ai_seekai_key')
      .eq('id', integrationId)
      .maybeSingle();
    finalIntegration = integrationRow;
  }

  if (!finalIntegration && tenantId) {
    const { data: allIntegrations } = await supabaseClient
      .from('zernio_integrations')
      .select('id, api_key, ai_gemini_key, ai_openai_key, ai_anthropic_key, ai_mistral_key, ai_groq_key, ai_seekai_key')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (allIntegrations && allIntegrations.length > 0) {
      finalIntegration = allIntegrations[0];
    }
  }

  const zernioApiKey = finalIntegration?.api_key || '';
  const aiProviderKeys: Record<string, string> = {
    gemini: finalIntegration?.ai_gemini_key || Deno.env.get('GEMINI_API_KEY') || '',
    openai: finalIntegration?.ai_openai_key || Deno.env.get('OPENAI_API_KEY') || '',
    anthropic: finalIntegration?.ai_anthropic_key || Deno.env.get('ANTHROPIC_API_KEY') || '',
    mistral: finalIntegration?.ai_mistral_key || Deno.env.get('MISTRAL_API_KEY') || '',
    groq: finalIntegration?.ai_groq_key || Deno.env.get('GROQ_API_KEY') || '',
    seekai: finalIntegration?.ai_seekai_key || Deno.env.get('SEEKAI_API_KEY') || '',
  };

  if (!zernioApiKey) {
    throw new Error('Chave de API do Zernio não está configurada para esta conta.');
  }

  // 5. Extract fields based on event type
  let textContent = '';
  let postId = '';
  let commentId = '';
  let conversationId = '';
  let senderUsername = '';
  let authorId = '';

  if (isCommentEvent) {
    textContent = getWebhookMessageText(commentObj) || getWebhookMessageText(payload) || '';
    postId = String(
      commentObj.postId ||
      commentObj.platformPostId ||
      commentObj.mediaId ||
      commentObj.media_id ||
      commentObj.post_id ||
      commentObj.post?.id ||
      commentObj.post?._id ||
      payload.postId ||
      payload.platformPostId ||
      payload.mediaId ||
      ''
    ).trim();

    commentId = String(
      commentObj.id ||
      commentObj._id ||
      commentObj.commentId ||
      commentObj.comment_id ||
      commentObj.platformCommentId ||
      payload.commentId ||
      payload.comment_id ||
      ''
    ).trim();

    senderUsername = String(
      commentObj.author?.username ||
      commentObj.author?.name ||
      commentObj.from?.username ||
      commentObj.from?.name ||
      commentObj.sender?.username ||
      commentObj.sender?.name ||
      commentObj.username ||
      payload.senderUsername ||
      ''
    ).trim();

    authorId = String(
      commentObj.author?.id ||
      commentObj.author?._id ||
      commentObj.from?.id ||
      commentObj.from?._id ||
      commentObj.sender?.id ||
      ''
    ).trim();
  } else {
    // Message event
    textContent = getWebhookMessageText(msgObj) || getWebhookMessageText(payload) || '';
    conversationId = String(
      msgObj.conversationId ||
      payload.conversationId ||
      payload.conversation?.id ||
      payload.conversation?._id ||
      ''
    ).trim();

    senderUsername = String(
      msgObj.sender?.username ||
      msgObj.sender?.name ||
      msgObj.from?.username ||
      msgObj.from?.name ||
      payload.senderUsername ||
      ''
    ).trim();

    postId = String(
      payload.postId ||
      msgObj.postId ||
      payload.conversation?.postId ||
      ''
    ).trim();
  }

  // Helper to log early exits (loop guards, deduplication, etc.)
  const logEarlyExit = async (status: string, message: string) => {
    try {
      await supabaseClient
        .from('zernio_automation_logs')
        .insert({
          tenant_id: tenantId,
          social_account_id: socialAccountId || 'unknown',
          platform: platform || 'unknown',
          event_type: event,
          external_id: commentId || conversationId || 'unknown',
          sender_username: senderUsername || null,
          content: textContent || null,
          status,
          error_message: message,
          raw_payload: payload
        });
    } catch (e: any) {
      console.warn('Could not save early exit log:', e.message);
    }
  };

  // 6. LOOP GUARDS (Skip on retry)
  if (!isRetry) {
    if (isCommentEvent) {
      // Loop Guard 1: Skip comment replies (only automate top-level comments)
      if (commentObj.isReply === true || commentObj.parentId || commentObj.parent_id) {
        await logEarlyExit('ignored', 'Ignorado: O comentário é uma resposta a outro comentário.');
        return { success: true, message: 'Ignored: reply comment' };
      }

      // Loop Guard 2: Self-comment check
      // When a user tests using their own admin account, Meta forbids private replies to self
      const cleanAccountUser = accountUsername.replace(/^@/, '').toLowerCase();
      const cleanSenderUser = senderUsername.replace(/^@/, '').toLowerCase();

      if (cleanAccountUser && cleanSenderUser && cleanAccountUser === cleanSenderUser) {
        await logEarlyExit(
          'ignored',
          `Ignorado: Auto-comentário da própria conta administradora (@${senderUsername}). No Instagram/Meta, a automação não responde ao próprio perfil para evitar loops infinitos. Para testar o disparo, faça o comentário usando outra conta do Instagram (pessoal ou secundária).`
        );
        return {
          success: true,
          message: 'Ignored: self-comment (test from another Instagram account)'
        };
      }
    } else {
      // Outgoing message check
      const isOutgoing = msgObj.direction === 'outgoing' || payload.direction === 'outgoing' || payload.message?.direction === 'outgoing';
      if (isOutgoing) {
        await logEarlyExit('ignored', 'Ignorado: Mensagem enviada pelo próprio perfil (outgoing).');
        return { success: true, message: 'Ignored: outgoing message' };
      }
    }

    // Loop Guard 3: Deduplication
    const webhookEventId = payload.id || '';
    if (webhookEventId) {
      const { error: dedupInsertError } = await supabaseClient
        .from('zernio_automation_dedup')
        .insert({ tenant_id: tenantId, event_id: webhookEventId, comment_id: commentId || conversationId });

      if (dedupInsertError && dedupInsertError.code === '23505') {
        return { success: true, message: 'Duplicate event skipped' };
      }
    }
  }

  // 7. Initialize primary log entry
  let initialLogId = existingLogId;
  if (!initialLogId) {
    const { data: newLog, error: logErr } = await supabaseClient
      .from('zernio_automation_logs')
      .insert({
        tenant_id: tenantId,
        social_account_id: socialAccountId || 'unknown',
        platform: platform || 'unknown',
        event_type: event,
        external_id: commentId || conversationId || 'unknown',
        sender_username: senderUsername || null,
        content: textContent || null,
        status: 'no_automation',
        raw_payload: payload
      })
      .select('id')
      .single();

    if (logErr) {
      console.error('Failed to create log entry:', logErr.message);
    } else {
      initialLogId = newLog?.id;
    }
  }

  const updateInitialLog = async (status: string, errorMsg?: string, replySent?: string) => {
    if (initialLogId) {
      await supabaseClient
        .from('zernio_automation_logs')
        .update({
          status,
          error_message: errorMsg || null,
          reply_sent: replySent || null
        })
        .eq('id', initialLogId);
    }
  };

  // 8. Fetch active automation rules
  const { data: allTenantRules } = await supabaseClient
    .from('zernio_automations')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_enabled', true);

  // Match rules by social_account_id OR by platform if only 1 account exists
  let automations = (allTenantRules || []).filter((r: any) => {
    if (r.social_account_id === socialAccountId) return true;
    if (platform && r.platform?.toLowerCase() === platform.toLowerCase()) return true;
    return false;
  });

  if (!automations || automations.length === 0) {
    await updateInitialLog('no_automation', `Nenhuma regra ativa encontrada para a conta social ${socialAccountId || platform}.`);
    return { success: true, message: 'No active automations' };
  }

  const isAltCommentMessage = isMessageEvent && (platform === 'youtube' || platform === 'tiktok');
  const targetType = isAltCommentMessage
    ? ['comment_reply']
    : isCommentEvent
      ? ['comment_reply', 'comment_to_dm']
      : ['dm_reply'];

  const matchedRules = automations.filter((rule: any) => targetType.includes(rule.automation_type));

  if (matchedRules.length === 0) {
    await updateInitialLog('no_automation', `Nenhuma regra compatível com o tipo de evento (${isCommentEvent ? 'comentário' : 'mensagem'}).`);
    return { success: true, message: 'No matched rules' };
  }

  const executedResults: any[] = [];
  let isFirstRule = true;

  // 9. Execute all matching rules (e.g. comment_reply AND comment_to_dm)
  for (const rule of matchedRules) {
    const saveRuleLog = async (status: string, errorMsg?: string, replySent?: string) => {
      if (isFirstRule && initialLogId) {
        await supabaseClient
          .from('zernio_automation_logs')
          .update({
            rule_id: rule.id,
            event_type: rule.automation_type,
            status,
            error_message: errorMsg || null,
            reply_sent: replySent || null
          })
          .eq('id', initialLogId);
      } else {
        await supabaseClient
          .from('zernio_automation_logs')
          .insert({
            tenant_id: tenantId,
            social_account_id: socialAccountId || rule.social_account_id,
            rule_id: rule.id,
            platform: platform || 'unknown',
            event_type: rule.automation_type,
            external_id: commentId || conversationId || 'unknown',
            sender_username: senderUsername || null,
            content: textContent || null,
            status,
            error_message: errorMsg || null,
            reply_sent: replySent || null,
            raw_payload: payload
          });
      }
    };

    // A. Validate target post filtering (if restricted to specific posts)
    if ((isCommentEvent || isAltCommentMessage) && rule.target_posts_type === 'specific') {
      const rulePostIds = (rule.target_post_ids || []).map((id: any) => String(id).trim());
      const candidatePostIds = [
        postId,
        commentObj?.postId,
        commentObj?.platformPostId,
        commentObj?.mediaId,
        payload?.postId,
        payload?.platformPostId
      ].filter(Boolean).map(id => String(id).trim());

      let matchesPost = candidatePostIds.some(id => rulePostIds.includes(id));

      if (!matchesPost && candidatePostIds.length > 0) {
        const { data: postRecords } = await supabaseClient
          .from('zernio_posts')
          .select('zernio_post_id, platforms')
          .or(candidatePostIds.map(id => `zernio_post_id.eq.${id}`).join(','))
          .limit(5);

        if (postRecords && postRecords.length > 0) {
          for (const prec of postRecords) {
            if (rulePostIds.includes(prec.zernio_post_id)) {
              matchesPost = true;
              break;
            }
            if (Array.isArray(prec.platforms)) {
              for (const p of prec.platforms) {
                if (p.platformPostId && rulePostIds.includes(String(p.platformPostId).trim())) {
                  matchesPost = true;
                  break;
                }
              }
            }
            if (matchesPost) break;
          }
        }
      }

      if (!matchesPost) {
        await saveRuleLog('ignored', `Ignorado: Post ID [${candidatePostIds.join(', ')}] não está na lista de posts específicos selecionados.`);
        isFirstRule = false;
        continue;
      }
    }

    // B. Validate keywords with accent & case-insensitive matching
    if (rule.trigger_type === 'keyword') {
      const rawKeywords = (rule.keywords || []).map((k: any) => String(k).trim()).filter(Boolean);
      const normContent = normalizeText(textContent);
      const matched = rawKeywords.length === 0 || rawKeywords.some((kw: string) => {
        const normKw = normalizeText(kw);
        return normKw && normContent.includes(normKw);
      });

      if (!matched) {
        await saveRuleLog('ignored', `Ignorado: Palavras-chave [${rawKeywords.join(', ')}] não encontradas no texto: "${textContent}".`);
        isFirstRule = false;
        continue;
      }
    }

    // C. Helper function to generate reply text (Static or AI)
    const generateReplyText = async (
      provider: string,
      promptInstruction: string,
      staticFallback: string,
      interactionContextDesc: string
    ): Promise<string> => {
      const normProvider = provider || 'static';
      if (normProvider === 'static') {
        return (staticFallback || '').trim();
      }

      const apiKey = aiProviderKeys[normProvider] || '';
      const promptContext = `Você é um assistente virtual respondendo a uma interação em redes sociais.
Tipo de interação: ${interactionContextDesc}
Autor: @${senderUsername}
Mensagem original: "${textContent}"
Instrução do prompt: ${promptInstruction || 'Responda educadamente e ajude o usuário.'}
Responda diretamente e de forma concisa.`;

      if (!apiKey) {
        return (staticFallback || '').trim();
      }

      try {
        if (normProvider === 'gemini') {
          const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: promptContext }] }] })
          });
          if (!aiRes.ok) throw new Error(`Gemini status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        } else if (normProvider === 'openai') {
          const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
          });
          if (!aiRes.ok) throw new Error(`OpenAI status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.choices?.[0]?.message?.content || '').trim();
        } else if (normProvider === 'anthropic') {
          const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify({ model: 'claude-3-haiku-20240307', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
          });
          if (!aiRes.ok) throw new Error(`Anthropic status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.content?.[0]?.text || '').trim();
        } else if (normProvider === 'mistral') {
          const aiRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'mistral-small-latest', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
          });
          if (!aiRes.ok) throw new Error(`Mistral status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.choices?.[0]?.message?.content || '').trim();
        } else if (normProvider === 'groq') {
          const aiRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
          });
          if (!aiRes.ok) throw new Error(`Groq status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.choices?.[0]?.message?.content || '').trim();
        } else if (normProvider === 'seekai') {
          const aiRes = await fetch('https://seekai.cc/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: promptContext }], max_tokens: 180 })
          });
          if (!aiRes.ok) throw new Error(`SeekAI status ${aiRes.status}`);
          const aiData = await aiRes.json();
          return (aiData?.choices?.[0]?.message?.content || '').trim();
        }
      } catch (err: any) {
        console.warn(`[AI Generation Error] (${normProvider}):`, err.message);
        return (staticFallback || '').trim();
      }
      return (staticFallback || '').trim();
    };

    // Generate primary response (DM or Comment Reply)
    const isCommentToDm = rule.automation_type === 'comment_to_dm' && isCommentEvent;
    const primaryContextDesc = isCommentToDm
      ? 'Mensagem direta (Direct privado para o usuário que comentou no post)'
      : (isCommentEvent || isAltCommentMessage ? 'Comentário' : 'Mensagem direta');

    let replyText = await generateReplyText(
      rule.ai_provider,
      rule.ai_prompt,
      rule.static_reply,
      primaryContextDesc
    );

    if (!replyText) {
      await saveRuleLog('failed', 'Falha: A resposta estática ou prompt de IA para a resposta principal está vazia.');
      isFirstRule = false;
      continue;
    }

    // Generate public comment reply for comment_to_dm (if enabled)
    let publicCommentReplyText = '';
    if (isCommentToDm && rule.comment_reply_enabled !== false) {
      publicCommentReplyText = await generateReplyText(
        rule.comment_reply_provider || 'static',
        rule.comment_reply_prompt || '',
        rule.comment_reply_text || '',
        'Resposta pública no comentário da postagem avisando que a DM foi enviada'
      );
    }

    // D. Dispatch response via Zernio API
    let endpoint = '';
    let requestBody: any = {};
    const isYoutubeOrTiktok = platform === 'youtube' || platform === 'tiktok';

    const targetCommentId = isCommentEvent ? commentId : (msgObj.id || msgObj._id || '');

    if (isCommentEvent || (isMessageEvent && isYoutubeOrTiktok)) {
      if (isCommentToDm) {
        // 1. Private reply to comment (Instagram DM)
        endpoint = postId
          ? `https://zernio.com/api/v1/inbox/comments/${postId}/${targetCommentId}/private-reply`
          : `https://zernio.com/api/v1/inbox/comments/${targetCommentId}/private-reply`;

        requestBody = {
          accountId: socialAccountId || rule.social_account_id,
          text: replyText,
          message: replyText,
          commentId: targetCommentId
        };

        // 2. Dual action: Also reply publicly on the comment if configured
        if (publicCommentReplyText) {
          const commentReplyEndpoint = postId
            ? `https://zernio.com/api/v1/inbox/comments/${postId}`
            : `https://zernio.com/api/v1/inbox/comments/${targetCommentId}/reply`;

          try {
            await fetch(commentReplyEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${zernioApiKey}`
              },
              body: JSON.stringify({
                accountId: socialAccountId || rule.social_account_id,
                text: publicCommentReplyText,
                message: publicCommentReplyText,
                commentId: targetCommentId,
                replyToId: targetCommentId
              })
            });
          } catch (commErr: any) {
            console.warn('Dual public comment reply failed:', commErr.message);
          }
        }
      } else {
        // Comment reply (public reply under the comment)
        endpoint = postId
          ? `https://zernio.com/api/v1/inbox/comments/${postId}`
          : `https://zernio.com/api/v1/inbox/comments/${targetCommentId}/reply`;

        requestBody = {
          accountId: socialAccountId || rule.social_account_id,
          text: replyText,
          message: replyText,
          commentId: targetCommentId,
          replyToId: targetCommentId
        };
      }
    } else {
      // Standard DM/Conversation endpoint
      endpoint = `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`;
      requestBody = {
        accountId: socialAccountId || rule.social_account_id,
        text: replyText,
        message: replyText
      };
    }

    try {
      const zernioRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${zernioApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!zernioRes.ok) {
        const errText = await zernioRes.text();
        await saveRuleLog('failed', `Erro Zernio ${zernioRes.status} em POST ${endpoint}: ${errText}`);
      } else {
        const logDisplay = (isCommentToDm && publicCommentReplyText)
          ? `[Comentário Respondido]: ${publicCommentReplyText} | [DM Enviada]: ${replyText}`
          : replyText;
        await saveRuleLog('success', undefined, logDisplay);
        executedResults.push({ ruleId: rule.id, type: rule.automation_type, replyText });
      }
    } catch (zernioErr: any) {
      await saveRuleLog('failed', `Erro ao conectar com a API do Zernio: ${zernioErr.message}`);
    }

    isFirstRule = false;
  }

  return { success: true, replied: executedResults.length > 0, results: executedResults };
}

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Handle simple GET ping requests
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ success: true, message: 'Receiver is online' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ success: true, message: 'Handshake/Empty body' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // A. Handle RETRY trigger request from frontend
    if (payload.action === 'retry') {
      const logId = payload.logId;
      if (!logId) {
        return new Response(JSON.stringify({ error: 'Missing logId' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data: logRow, error: fetchErr } = await supabaseClient
        .from('zernio_automation_logs')
        .select('*')
        .eq('id', logId)
        .maybeSingle();

      if (fetchErr || !logRow) {
        return new Response(JSON.stringify({ error: 'Log row not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const isSuperAdmin = (user.email?.toLowerCase().trim() === 'suporte@platafy.com');
      if (!isSuperAdmin) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .maybeSingle();

        if (profile?.tenant_id !== logRow.tenant_id) {
          return new Response(JSON.stringify({ error: 'Forbidden' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      const retryEvent = logRow.raw_payload?.event || logRow.event_type || 'comment.received';
      const retryResult = await processWebhookEvent(supabaseClient, logRow.raw_payload, retryEvent, true, logId);

      return new Response(JSON.stringify({ success: true, result: retryResult }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // B. Handle normal incoming Zernio webhook events
    console.log('Received Zernio webhook:', JSON.stringify(payload));
    const rawEvent = payload.event || payload.type || '';
    const normEvent = String(rawEvent).toLowerCase().trim();

    if (!normEvent) {
      return new Response(JSON.stringify({ success: true, message: 'Ping/Handshake successful' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Handle Post status webhooks
    if (normEvent.startsWith('post.')) {
      const post = payload.post;
      if (!post) {
        return new Response(JSON.stringify({ error: 'Missing post object' }), { status: 400, headers: corsHeaders });
      }
      const zernioPostId = post.id || post._id;
      const status = post.status;
      const profileId = post.profileId;

      if (!profileId) {
        return new Response(JSON.stringify({ error: 'Missing profileId' }), { status: 400, headers: corsHeaders });
      }

      const { data: integration } = await supabaseClient
        .from('zernio_integrations')
        .select('tenant_id, id')
        .eq('zernio_profile_id', profileId)
        .limit(1)
        .maybeSingle();

      if (!integration) {
        return new Response(JSON.stringify({ error: 'No matching tenant integration' }), { status: 200, headers: corsHeaders });
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
        }, { onConflict: 'zernio_post_id' });

      return new Response(JSON.stringify({ success: true, type: 'post_status_updated' }), { status: 200, headers: corsHeaders });
    }

    // Handle Comments and Direct Messages (comment.*, message.*, inbox.*)
    const isComment =
      normEvent.startsWith('comment.') ||
      normEvent.includes('comment') ||
      Boolean(payload.comment);

    const isMessage = !isComment && (
      normEvent.startsWith('message.') ||
      normEvent.includes('message') ||
      Boolean(payload.message)
    );

    if (isComment || isMessage) {
      try {
        const result = await processWebhookEvent(
          supabaseClient,
          payload,
          rawEvent || (isComment ? 'comment.received' : 'message.received')
        );
        return new Response(JSON.stringify({ success: true, result }), { status: 200, headers: corsHeaders });
      } catch (procErr: any) {
        console.error('Error during processWebhookEvent:', procErr.message);

        // Safe fallback log
        try {
          const accountObj = payload.account || {};
          const commentObj = payload.comment || {};
          const msgObj = payload.message || {};
          const textContent = getWebhookMessageText(commentObj) || getWebhookMessageText(msgObj) || '';
          const externalId = commentObj.id || commentObj._id || msgObj.conversationId || payload.conversationId || 'unknown';

          const { data: firstTenant } = await supabaseClient
            .from('tenants')
            .select('id')
            .limit(1)
            .maybeSingle();

          if (firstTenant?.id) {
            await supabaseClient
              .from('zernio_automation_logs')
              .insert({
                tenant_id: firstTenant.id,
                social_account_id: payload.accountId || accountObj._id || accountObj.id || 'unknown',
                platform: accountObj.platform || payload.platform || 'instagram',
                event_type: rawEvent || 'comment.received',
                external_id: externalId,
                sender_username: commentObj.author?.username || msgObj.sender?.username || 'anônimo',
                content: textContent || null,
                status: 'failed',
                error_message: procErr.message,
                raw_payload: payload
              });
          }
        } catch (logWriteErr: any) {
          console.error('Failed to write fallback log:', logWriteErr.message);
        }

        return new Response(JSON.stringify({ error: procErr.message }), { status: 200, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: 'Event not handled', event: rawEvent }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
  }
});
