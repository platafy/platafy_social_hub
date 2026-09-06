# Zernio Hub

Painel completo e inteligente para gestão multicanais de redes sociais integrado à API do Zernio e alimentado por Inteligência Artificial.

## 🚀 Funcionalidades Principais

- **Suporte a Múltiplas Contas Zernio (API Keys)**: Conecte e gerencie múltiplas chaves de API do Zernio simultaneamente. Atribua um Nome Identificador personalizado para cada conta, facilitando o gerenciamento multitenant no mesmo Workspace.
- **Filtros e Badges por Conta**: Filtre suas postagens agendadas, conversas e comentários do Inbox por Conta Zernio. Os canais sociais e automações exibem a qual conta pertencem de forma clara.
- **Publicação & Agendamento Multicanal**: Crie, agende ou publique posts de forma síncrona em múltiplas redes sociais (Instagram, Facebook, Twitter/X, YouTube, LinkedIn, Bluesky, Telegram, WhatsApp) com roteamento inteligente de credenciais por canal.
- **Caixa de Entrada Unificada (Inbox)**: Visualize e responda a mensagens privadas (DMs) e conversas centralizadas por canal social e filtradas por conta Zernio.
- **Moderação de Comentários**: Acompanhe e responda a comentários públicos em postagens e anúncios (Meta Ads) diretamente do painel com suporte de automação ativa e manual para **YouTube**, **Facebook** e **Instagram**.
- **Gestão de Contatos (CRM)**:
  - Nova aba dedicada para visualização e gerenciamento de contatos sincronizados.
  - Sincronização robusta via Edge Function (`zernio-contacts-sync`) para persistência local no Supabase com bypass seguro de políticas RLS.
  - Busca rápida e filtragem por tags e canais conectados (Instagram, Facebook, WhatsApp, etc).
  - Abertura de DMs instantânea a partir do perfil do contato com resolução inteligente de ID e fallback de chat no Inbox.
- **Automação Inteligente com IA**:
  - Configure regras de respostas automáticas para comentários e DMs públicos/privados.
  - Suporte a automação de comentários no **YouTube** e respostas a DMs/Comentários no **Facebook** e **Instagram**.
  - Integração nativa com múltiplos provedores de LLM: **Google Gemini**, **OpenAI (GPT)**, **Anthropic (Claude)**, **Mistral AI** e **Groq Cloud (Llama)**.
  - Fallback automático para respostas em texto estático caso a IA falhe.
  - Limitador de escopo: regras gerais para a conta inteira ou limitadas a postagens específicas.
- **Experiência de Uso Aprimorada (UX/UI)**:
  - Telas de Login e Cadastro estilizadas com design moderno e responsivo.
  - Persistência automática do estado da aba ativa utilizando `sessionStorage`.
  - Pré-carregador dinâmico de carregamento com a logo do Zernio e animação fluida.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React, TypeScript, Vite, TailwindCSS, shadcn/ui, Lucide Icons, Sonner (Toasts).
- **Backend & Infraestrutura**: Supabase (Autenticação, Banco de dados PostgreSQL, Storage para mídias e Edge Functions).
- **Integração de APIs**: Zernio API (`https://zernio.com/api/v1`).

---

## ⚙️ Configuração & Webhooks

### 1. Sincronização de Webhook
A automação de respostas depende do recebimento em tempo real dos eventos do Zernio. Nas configurações do painel, clique em **Sincronizar Webhook** para registrar a URL da Edge Function (`zernio-webhook`) na sua conta do Zernio com os eventos necessários:
- `comment.received`
- `message.received`
- `post.published`
- `post.failed`
- `post.partial`

### 2. Compatibilidade de Plataformas para Automação
> [!IMPORTANT]  
> A funcionalidade de responder de forma automática a comentários ou mensagens privadas (DMs) está disponível exclusivamente para contas do **Facebook**, **Instagram** e **YouTube** (comentários). Para outras redes, as opções de automação permanecem desativadas ("Manual").

### 3. Limites de Uso (Rate Limits)
As chamadas à API da Zernio respeitam a volumetria de requisições por minuto com base nos canais conectados por perfil:
- **0–2 contas (Free tier)**: 60 requisições/minuto.
- **3–2.000 contas**: 600 requisições/minuto.
- **2.001+ contas**: 1.200 requisições/minuto.
- **AppSumo legado**: 600 requisições/minuto (fixo).

---

## 💻 Desenvolvimento Local

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
3. Gere o build de produção:
   ```bash
   npm run build
   ```
