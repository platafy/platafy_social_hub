# Plano de Implementação: Novas Automações para PLATAFY SOCIAL HUB (Instagram, Facebook, YouTube, TikTok e CRM)

Este documento reúne o planejamento técnico detalhado de **todas as automações viáveis que ainda não foram implementadas** no **PLATAFY SOCIAL HUB**, estruturadas de forma modular para que possam ser ativadas progressivamente.

---

## 📌 Resumo Executivo das Novas Funcionalidades

| Módulo | Plataforma | Tipo de Automação | Objetivo de Negócio |
| :--- | :--- | :--- | :--- |
| **Módulo 1** | Instagram / Facebook | **Anúncios Pagos (Meta Ads / Dark Posts)** | Responder dúvidas e enviar DMs para quem comenta em anúncios de tráfego pago, recuperando vendas e reduzindo CPL. |
| **Módulo 2** | Instagram | **Gatilhos de Stories (`story_mention` & `story_reply`)** | Disparar cupom/brinde na DM para quem marcar a marca no Story ou responder enquetes/reações. |
| **Módulo 3** | Instagram / Facebook / YouTube | **Auto-Engajamento & Moderação com IA** | Dar Auto-Like nos comentários, Auto-Coração (Heart) nos comentários do YouTube e Auto-Ocultar ofensas/spam com IA. |
| **Módulo 4** | YouTube / Facebook | **Auto-Pin de Comentário (Fixado no Topo)** | Publicar e fixar automaticamente o primeiro comentário com link de vendas/checkout em vídeos novos e posts. |
| **Módulo 5** | TikTok | **Conexão, Publicação & Resposta a Comentários** | Habilitar conexão do TikTok, agendamento de vídeos e respostas automáticas a comentários via IA no feed. |
| **Módulo 6** | Platafy Social Hub | **Auto-Captura no CRM Kanban & Transbordo** | Inserir novos comentaristas e remetentes de DM diretamente no Kanban ("Novos Leads"), com tags de IA e transbordo WhatsApp. |

---

## User Review Required

> [!IMPORTANT]
> **Priorização de Execução**: 
> Como cada módulo atende a um objetivo comercial diferente (ex: Módulo 1 para quem roda tráfego pago, Módulo 2 para marcas com foco em viralização de Stories, Módulo 5 para criadores no TikTok, Módulo 6 para operadores de CRM), você pode escolher se deseja implementar um módulo por vez ou aprovar a esteira completa.

> [!NOTE]
> **Limitação Oficial de DMs no TikTok**:
> Conforme documentado pela ByteDance e Zernio, a API de DMs privadas do TikTok é restrita a parceiros enterprise certificados. O Módulo 5 contempla **publicação automática, sincronização de comentários públicos e resposta com IA**, além de captura do lead no CRM.

---

## 🛠️ Detalhamento Técnico dos Módulos

### Módulo 1: Automação em Anúncios Pagos (Instagram & Facebook Ads)

Permite que a automação responda comentários e envie DMs instantâneas em postagens patrocinadas (Dark Posts) criadas no Gerenciador de Anúncios.

#### [NEW] Migration: Colunas de Suporte a Anúncios em `zernio_automations`
- Adicionar campos `target_ads_type (TEXT DEFAULT 'all')` ('all', 'specific_ads').
- Adicionar `target_ad_ids (TEXT[] DEFAULT '{}')` para seleção de anúncios específicos.

#### [MODIFY] [zernio.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/lib/zernio.ts)
- Adicionar métodos de listagem de campanhas e anúncios do Zernio:
  - `getAds(profileId: string)`
  - `getAdComments(adId: string, placement: string)`

#### [MODIFY] [zernio-webhook/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-webhook/index.ts)
- Identificar payloads onde `payload.adId || payload.comment?.adId` está presente.
- Executar regra `comment_to_dm` ou `comment_reply` disparando endpoint de resposta específico para anúncios `/v1/ads/{adId}/comments` ou `/v1/inbox/comments/{adId}/{commentId}/private-reply`.

#### [MODIFY] [Home.tsx](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/pages/Home.tsx)
- Na aba "Comentários/DMs", adicionar seletor de escopo: **"Postagens Orgânicas"**, **"Anúncios Patrocinados (Dark Posts)"** ou **"Ambos"**.

---

### Módulo 2: Automações de Stories (Instagram)

Disparo de mensagens diretas quando seguidores interagem com Stories da marca.

#### [MODIFY] [zernio-webhook/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-webhook/index.ts)
- Adicionar listeners para eventos de webhook:
  - `story_mention` / `instagram.story_mention`: Disparado quando alguém marca `@perfil` em um Story.
  - `story_reply` / `instagram.story_reply`: Disparado quando alguém responde ao Story.
- Criar regra `story_mention_dm` e `story_reply_dm` que despacha a mensagem de agradecimento ou cupom usando o endpoint de DM do Zernio.

#### [MODIFY] [Home.tsx](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/pages/Home.tsx)
- Adicionar os novos botões na seleção de Tipo de Interação:
  - `[ Menção nos Stories ]`
  - `[ Resposta a Stories ]`
- Configurar campos de mensagem estática ou prompt de IA para personalização do agradecimento.

---

### Módulo 3: Auto-Engajamento & Moderação com IA

Automações para aumentar o engajamento do algoritmo e manter o feed protegido de spams e golpistas.

#### [MODIFY] [zernio.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/lib/zernio.ts)
- Adicionar métodos de ação em comentários:
  - `likeComment(postId: string, commentId: string, accountId: string)`
  - `hideComment(postId: string, commentId: string, accountId: string, hide: boolean)`
  - `deleteComment(postId: string, commentId: string, accountId: string)`
  - `heartYoutubeComment(videoId: string, commentId: string, accountId: string)`

#### [MODIFY] [zernio-webhook/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-webhook/index.ts)
1. **Auto-Like & Auto-Coração**:
   - Para Instagram/Facebook: disparar `likeComment` logo após responder.
   - Para YouTube: disparar `heartYoutubeComment` e `likeComment`.
2. **Moderação com IA**:
   - Adicionar função `evaluateCommentToxicity(text: string, rules: string)`:
   - Se a IA classificar como spam, golpe, ofensa grave ou link concorrente, chama automaticamente `hideComment` ou `deleteComment` e registra no log com status `moderated`.

#### [MODIFY] [Home.tsx](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/pages/Home.tsx)
- Adicionar checkboxes de ação complementar:
  - `[x] Curtir o comentário automaticamente (Auto-Like)`
  - `[x] Dar Coração oficial no YouTube (Heart)`
  - `[x] Ativar Moderação Inteligente com IA (Ocultar ofensas e spam)`

---

### Módulo 4: Auto-Pin de Comentário Oficial (YouTube & Facebook)

Fixação automática do primeiro comentário com link de conversão logo após uma publicação.

#### [MODIFY] [zernio-webhook/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-webhook/index.ts)
- Escutar evento `post.published`:
  - Se a regra tiver `auto_pin_comment_enabled === true`:
  - Publica o comentário pré-configurado no post recém-criado.
  - Executa a chamada de API de fixação (`pin`) para que o comentário fique no topo permanente.

---

### Módulo 5: Habilitação e Automação do TikTok

Permitir conexão completa da conta do TikTok e gerenciamento unificado.

#### [MODIFY] [ConnectSocialModal.tsx](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/components/channels/ConnectSocialModal.tsx)
- Mover o objeto `tiktok` de `_INACTIVE_PLATFORMS` para `SUPPORTED_PLATFORMS`.
- Configurar scopes adequados no redirect OAuth do Zernio (`video.upload`, `comment.list`, `comment.reply`).

#### [MODIFY] [Home.tsx](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/src/pages/Home.tsx)
- Liberar o TikTok como canal selecionável na aba "Comentários/DMs" para o modo "Responder Comentário".
- Adicionar suporte na tela "Novo Post" para agendamento de vídeos diretamente para o TikTok.

#### [MODIFY] [zernio-sync/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-sync/index.ts)
- Refinar a sincronização periódica de comentários do TikTok via polling para contas que não suportam webhook em tempo real.

---

### Módulo 6: Auto-Captura no CRM Kanban & Transbordo

Transformar todo engajamento social em lead registrado no pipeline de vendas.

#### [MODIFY] [zernio-webhook/index.ts](file:///c:/Users/andbf/Documents/GitHub/platafy_social_hub/supabase/functions/zernio-webhook/index.ts)
- Ao receber qualquer comentário ou DM de um novo usuário:
  - Verificar se o contato já existe na tabela `zernio_contacts` daquele tenant.
  - Se não existir, executar **auto-upsert** inserindo:
    - `name`: Nome ou username do usuário.
    - `username`: `@usuario`.
    - `profile_picture_url`: Foto de perfil recebida no payload do webhook.
    - `channel_source`: Plataforma de origem (Instagram, Facebook, YouTube, TikTok).
    - `crm_column_id`: ID da primeira coluna ativa (normalmente *"Novos Leads"*).
    - `is_automation_enabled`: `true`.
- **Tagging Automático com IA**:
  - Solicitar à IA uma classificação rápida de tag (`#duvida_preco`, `#lead_quente`, `#reclamacao`) e salvar no array de tags do contato no banco.

---

## 🧪 Plano de Verificação

### 1. Testes Automatizados e Compilação
- Executar `npm run build` para garantir TypeScript limpo, sem quebras de contrato ou dependências órfãs.
- Validar as migrations do Supabase localmente.

### 2. Validação Funcional
- **Instagram/Facebook Ads**: Testar recebimento de webhook simulado com `adId` e verificar disparo de private reply.
- **Stories**: Testar simulação de evento `story_mention` e conferir criação de DM e log de sucesso.
- **YouTube Heart**: Testar publicação de comentário em vídeo de teste e checar recebimento do coração do canal.
- **TikTok**: Conectar conta de teste do TikTok, postar vídeo agendado e validar sincronização de comentários.
- **CRM Auto-Upsert**: Fazer comentário com usuário novo e verificar se o card aparece automaticamente na primeira coluna do Kanban sem necessidade de clicar em "Sincronizar".

---

## 💎 Sistema de Controle e Liberação por Plano (Starter, Pro e Agência)

Todas as funcionalidades acima são disponibilizadas aos clientes rigorosamente de acordo com o plano contratado.

### Matriz de Recursos por Plano

| Funcionalidade / Módulo | Starter (R$ 37/mês) | Pro (R$ 97/mês) | Agência (R$ 197/mês) |
| :--- | :---: | :---: | :---: |
| **Perfis Ativos (Zernio)** | 1 Perfil (até 2 contas) | 5 Perfis (até 10 contas) | Ilimitados (-1) |
| **Agendamento de Posts** | 50 posts/mês | Ilimitado | Ilimitado |
| **Inbox & DMs Unificadas** | ✅ Incluso | ✅ Incluso | ✅ Incluso |
| **Automação de Comentários e DMs Orgânicas** | ✅ Incluso (Respostas estáticas) | ✅ Incluso | ✅ Incluso |
| **Automação com IA (ChatGPT, Claude, Gemini)** | 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 1: Meta Ads & Dark Posts (Anúncios)** | 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 2: Gatilhos de Stories (Menção e Resposta)**| 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 3: Auto-Like, YouTube Heart & Moderação IA**| 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 4: Fixação no Topo (Auto-Pin)** | 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 5: Canal TikTok (Upload e Comentários)** | 🔒 Bloqueado | ✅ Incluso | ✅ Incluso |
| **Módulo 6: CRM Kanban & Enriquecimento de Leads**| 100 contatos (Básico) | 1.000 contatos (Completo) | Ilimitado |
| **White Label (Marca Própria, Logo, Domínio)** | 🔒 Bloqueado | 🔒 Bloqueado | ✅ Incluso |

### Regras de Acesso e Experiência do Usuário (Upsell)

- **Super Admin Sempre Desbloqueado**: A conta do Super Admin (`suporte@platafy.com` ou `isSuperAdmin === true`) possui **acesso irrestrito e total** a todas as ferramentas e módulos em qualquer perfil, independentemente do plano selecionado.
- **Experiência Amigável de Upgrade (Upsell)**: Quando um cliente do plano Starter tentar utilizar uma funcionalidade do plano Pro (ex: selecionar "Apenas Anúncios", clicar nos botões de Stories ou tentar ativar moderação por IA), a interface exibe um selo `[ ⭐ Pro ]` com destaque e abre um aviso convidando para fazer upgrade para o plano Pro com 1 clique (redirecionando para `/planos`).
- **Proteção nas Edge Functions**: O webhook do Supabase valida em tempo real se o plano do tenant possui a flag correspondente habilitada antes de despachar automações restritas.

