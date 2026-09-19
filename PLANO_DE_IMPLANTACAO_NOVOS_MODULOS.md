# Sistema de Controle e Liberação de Funcionalidades por Plano (Starter, Pro e Agência)

Este documento detalha como todas as novas funcionalidades da esteira de automações (Anúncios Pagos Meta Ads, Stories, Moderação e Engajamento com IA, Auto-Pin, TikTok e CRM Avançado) estão distribuídas e liberadas para os clientes estritamente de acordo com o plano contratado.

---

## 📌 Matriz de Recursos por Plano

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

---

## 🛡️ Regras de Acesso e Experiência do Usuário (Upsell)

> **Super Admin Sempre Desbloqueado**:
> A conta do Super Admin (`suporte@platafy.com` ou `isSuperAdmin === true`) possui **acesso irrestrito e total** a todas as ferramentas e módulos em qualquer perfil, independentemente do plano selecionado.

> **Experiência Amigável de Upgrade (Upsell)**:
> Quando um cliente do plano Starter tentar utilizar uma funcionalidade do plano Pro (ex: selecionar "Apenas Anúncios", clicar nos botões de Stories ou tentar ativar moderação por IA), a interface exibe um selo `[ ⭐ Pro ]` com destaque e abre um aviso convidando para fazer upgrade para o plano Pro com 1 clique (redirecionando para `/planos`).

---

## 🛠️ Componentes e Arquitetura Implementada

### 1. Banco de Dados Supabase
- **Migration:** `supabase/migrations/20260725000000_plan_features_entitlements.sql`
- Configuração dos limites (`limits`) em JSONB na tabela `public.plans`:
  - `ai_automations` (IA generativa OpenAI, Gemini, Claude, Groq)
  - `ads_automations` (Meta Ads e Anúncios Patrocinados)
  - `stories_automations` (Menções e Respostas de Stories)
  - `auto_moderation` (Anti-Spam e Moderação com IA)
  - `auto_engagement` (Auto-Like e YouTube Heart)
  - `auto_pin` (Fixação de comentários)
  - `tiktok_channel` (Integração e automações TikTok)
  - `white_label` (Domínio e marca personalizada)

### 2. Contexto de Assinatura no Frontend
- **Arquivo:** `src/contexts/SubscriptionContext.tsx`
- Fornece as flags reativas consumidas por qualquer tela:
  - `canUseAdsAutomations: boolean`
  - `canUseStoriesAutomations: boolean`
  - `canUseAutoEngagement: boolean`
  - `canUseAutoModeration: boolean`
  - `canUseAutoPin: boolean`
  - `canUseTikTok: boolean`

### 3. Gestão no Super Admin
- **Arquivo:** `src/components/admin/SuperAdminPlans.tsx`
- Permite que o Super Admin configure e ative/desative cada um desses módulos individualmente para qualquer plano com 1 clique.

### 4. Interface do Usuário (Gating e Alertas)
- **Arquivo:** `src/pages/Home.tsx`
  - Escopo de postagens/anúncios bloqueado para Starter quando selecionado "Apenas Anúncios".
  - Botões de Stories (*Menção Story* e *Responder Story*) bloqueados com ícone de cadeado e aviso para Starter.
  - Checkboxes de Engajamento e Moderação desabilitados para Starter.
- **Arquivo:** `src/components/channels/ConnectSocialModal.tsx`
  - Canal TikTok bloqueado para contas Starter com convite para o plano Pro.

### 5. Proteção no Backend (Edge Function Webhook)
- **Arquivo:** `supabase/functions/zernio-webhook/index.ts`
  - Validação em tempo real dos limites da assinatura antes de disparar automações de Anúncios, Stories ou Moderação de IA.
