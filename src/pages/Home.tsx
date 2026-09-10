import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { zernio, clearZernioCache, getCacheStats, sanitizeMediaUrls } from "@/lib/zernio";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBranding } from "@/contexts/BrandingContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  Share2, MessageSquare, BarChart3, Settings,
  Send, Plus, Trash2, CheckCircle2, AlertCircle, Clock,
  RefreshCw, Key, Check, HelpCircle, Upload,
  CornerUpLeft, Mail, X, Search, LayoutGrid, List, Minus, Calendar, Bot, Sparkles,
  DatabaseZap, Trash, Users, Phone, Tag, ChevronLeft, ChevronRight, CreditCard,
  Heart, MessageCircle, Bookmark, ShieldCheck, Lock
} from "lucide-react";
import {
  SiInstagram, SiFacebook, SiYoutube, SiTiktok, SiWhatsapp,
  SiTelegram, SiBluesky, SiThreads,
  SiPinterest, SiDiscord, SiReddit, SiSnapchat, SiGoogle
} from "react-icons/si";
import { FaLinkedin, FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { WhiteLabelSettings } from "@/components/settings/WhiteLabelSettings";
import { MercadoPagoSettings } from "@/components/settings/MercadoPagoSettings";
import { SuperAdminClients } from "@/components/admin/SuperAdminClients";
import { SuperAdminPlans } from "@/components/admin/SuperAdminPlans";
import { LoadingScreen } from "@/components/LoadingScreen";

function getEmbedVideoInfo(url?: string | null) {
  if (!url) return null;
  const trimmed = url.trim();

  // YouTube (watch?v=, youtu.be/, embed/, shorts/)
  const ytMatch = trimmed.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[3]}?autoplay=1`,
      thumbnailUrl: null,
    };
  }

  // Loom
  const loomMatch = trimmed.match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i);
  if (loomMatch && loomMatch[1]) {
    return {
      type: "loom",
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}?autoplay=1`,
      thumbnailUrl: null,
    };
  }

  return null;
}

const formatConvTime = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "agora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  return date.toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
};

const getMessageText = (msg: any): string => {
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
};

const getConversationLastMessage = (conv: any): string => {
  if (!conv) return "Nenhuma mensagem";
  const last = conv.lastMessage || conv.lastMessageText;
  if (typeof last === "string" && last) return last;
  if (last && typeof last === "object") {
    if (typeof last.text === "string") return last.text;
    if (typeof last.caption === "string") return last.caption;
  }
  return "Nenhuma mensagem";
};

type TabType = "dashboard" | "composer" | "channels" | "inbox" | "contacts" | "settings" | "automation" | "guide" | "clients" | "saas_mercadopago" | "saas_whitelabel" | "saas_plans";

export default function Home() {
  const { tenantId, isSuperAdmin } = useAuth();
  const { branding } = useBranding();
  const { maxProfiles } = useSubscription();
  const tutorialVideoUrl = branding.tutorial_video_url || "/criar-conta.mp4";
  const [activeTab, setActiveTab] = useState<TabType>(() => (sessionStorage.getItem("zernio_active_tab") as TabType) || "dashboard");
  const [config, setConfig] = useState<{ connected: boolean; profileId: string | null; hasKey: boolean; integrations?: any[] }>({
    connected: false,
    profileId: null,
    hasKey: false,
    integrations: []
  });
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [profileIdInput, setProfileIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiKeys, setAiKeys] = useState({ gemini: '', openai: '', anthropic: '', mistral: '', groq: '', seekai: '' });

  // Multi-account states
  const [selectedIntegrationIdForAiKeys, setSelectedIntegrationIdForAiKeys] = useState<string>("");
  const [newAccountName, setNewAccountName] = useState("");
  const [editingIntegrationId, setEditingIntegrationId] = useState<string | null>(null);
  const [editingAccountName, setEditingAccountName] = useState("");
  const [editingProfileId, setEditingProfileId] = useState("");
  const [isEditingAccount, setIsEditingAccount] = useState(false);

  // States for general data
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isNewProfileModalOpen, setIsNewProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileIntegrationId, setNewProfileIntegrationId] = useState("");
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);

  // Post history view format toggles
  const [postHistoryView, setPostHistoryView] = useState<"grid" | "list" | "calendar">("grid");
  const [gridColumnsCount, setGridColumnsCount] = useState<number>(2);

  // Filter states
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("scheduled-desc");

  // Composer states
  const [postText, setPostText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [firstComment, setFirstComment] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  const [isYoutubeShort, setIsYoutubeShort] = useState(false);

  // Inbox interactive states
  const [activeChat, setActiveChat] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [uploading, setUploading] = useState(false);

  // Comments interactive states
  const [inboxType, setInboxType] = useState<"dms" | "comments">("dms");
  const [selectedCommentPost, setSelectedCommentPost] = useState<any>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [commentReplyText, setCommentReplyText] = useState("");
  const [replyingToComment, setReplyingToComment] = useState<any>(null);
  const [isDmPrivateReply, setIsDmPrivateReply] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Search & Filter states for Inbox
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [isInboxPlatformDropdownOpen, setIsInboxPlatformDropdownOpen] = useState(false);
  const [inboxAccountFilter, setInboxAccountFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");

  // Automation states
  const [automations, setAutomations] = useState<any[]>([]);
  const [selectedAutomationAccount, setSelectedAutomationAccount] = useState<string>("");
  const [automationType, setAutomationType] = useState<"comment_reply" | "dm_reply" | "comment_to_dm">("comment_reply");
  const [isAutomationEnabled, setIsAutomationEnabled] = useState<boolean>(true);
  const [automationTriggerType, setAutomationTriggerType] = useState<"all" | "keyword">("all");
  const [automationKeywords, setAutomationKeywords] = useState<string>("");
  const [automationAiProvider, setAutomationAiProvider] = useState<"static" | "gemini" | "openai" | "anthropic" | "mistral" | "groq" | "seekai">("static");
  const [automationAiPrompt, setAutomationAiPrompt] = useState<string>("");
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const logsPerPage = 10;
  const [automationStaticReply, setAutomationStaticReply] = useState<string>("");
  const [automationTargetPostsType, setAutomationTargetPostsType] = useState<"all" | "specific">("all");
  const [automationTargetPostIds, setAutomationTargetPostIds] = useState<string[]>([]);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [automationPosts, setAutomationPosts] = useState<any[]>([]);
  const [loadingAutomationPosts, setLoadingAutomationPosts] = useState(false);

  // Cache stats
  const [cacheStats, setCacheStats] = useState<{ memory: number; session: number }>({ memory: 0, session: 0 });
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  // Contacts states
  const [contacts, setContacts] = useState<any[]>([]);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactsSearch, setContactsSearch] = useState('');
  const [contactsTagFilter, setContactsTagFilter] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [contactChannels, setContactChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const CONTACTS_PER_PAGE = 50;

  const refreshCacheStats = useCallback(() => {
    setCacheStats(getCacheStats());
  }, []);

  const handleClearCache = useCallback(() => {
    clearZernioCache();
    refreshCacheStats();
    toast.success("Cache limpo com sucesso!");
  }, [refreshCacheStats]);

  const triggerAutomationsForLoadedComments = async (commentsList: any[], post: any) => {
    const incomingComments = commentsList.filter(c => {
      const commentFrom = c.from || c.sender || c.author || {};
      const isMe = commentFrom.isOwner || commentFrom.is_owner;
      return !isMe;
    });

    if (incomingComments.length === 0) return;

    try {
      const commentIds = incomingComments.map(c => c.id || c._id);
      const { data: processedLogs } = await supabase
        .from('zernio_automation_logs' as any)
        .select('external_id')
        .in('external_id', commentIds)
        .eq('status', 'success') as any;

      const processedIds = new Set((processedLogs || []).map((l: any) => l.external_id));

      for (const comment of incomingComments) {
        const cId = comment.id || comment._id;
        if (processedIds.has(cId)) continue;

        const hasOwnerReply = commentsList.some(c => {
          const cFrom = c.from || c.sender || c.author || {};
          const isOwner = cFrom.isOwner || cFrom.is_owner;
          const isReply = c.parentId === cId || c.parent_id === cId;
          return isOwner && isReply;
        });
        if (hasOwnerReply) continue;

        const payload = {
          event: 'comment.received',
          id: `fall_${cId}`,
          accountId: post.accountId,
          profileId: selectedProfileId,
          platform: post.platform || 'youtube',
          comment: {
            id: cId,
            postId: post._id || post.id,
            message: comment.message || comment.text || comment.content || '',
            author: {
              id: comment.from?.id || comment.author?.id || 'unknown',
              username: comment.from?.username || comment.author?.username || 'anônimo',
              name: comment.from?.name || comment.author?.name || 'anônimo'
            }
          }
        };

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        fetch(`${supabaseUrl}/functions/v1/zernio-webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
          .then(() => fetchAutomationLogs())
          .catch(err => console.warn("Real-time fallback failed:", err));
      }
    } catch (err) {
      console.warn("Could not check real-time webhook fallback:", err);
    }
  };

  const handleSelectCommentPost = async (post: any) => {
    setSelectedCommentPost(post);
    setPostComments([]);
    try {
      let res;
      if (post.isAd) {
        res = await zernio.getAdComments(post.adId, post.placement, post.integrationId);
      } else {
        const pId = post._id || post.id;
        res = await zernio.getPostComments(pId, post.accountId, post.integrationId);
      }
      const commentsList = res.comments || res.data || [];
      setPostComments(commentsList);
      triggerAutomationsForLoadedComments(commentsList, post);

      // If it's an ad, save the reply metadata from response meta
      if (post.isAd && res.meta) {
        setSelectedCommentPost((prev: any) => ({
          ...prev,
          replyPostId: res.meta.effectiveStoryId,
          replyAccountId: res.meta.facebookAccountId || res.meta.instagramUserId || res.meta.accountId || (prev ? prev.accountId : post.accountId)
        }));
      }
    } catch (err: any) {
      console.error("Error fetching comments:", err);
      const isPrivate = err.message?.toLowerCase().includes("private") ||
        err.message?.toLowerCase().includes("failed to fetch") ||
        err.message?.toLowerCase().includes("not found") ||
        err.message?.toLowerCase().includes("unavailable");
      if (isPrivate) {
        toast.info("Não foi possível carregar os comentários. O conteúdo pode estar privado ou indisponível.");
      } else {
        toast.error("Erro ao buscar comentários: " + err.message);
      }
      setPostComments([]);
    }
  };

  const handleSendCommentReply = async () => {
    if (!commentReplyText || !selectedCommentPost) return;
    try {
      const pId = selectedCommentPost.replyPostId || selectedCommentPost._id || selectedCommentPost.id;
      const accId = selectedCommentPost.replyAccountId || selectedCommentPost.accountId;

      if (isDmPrivateReply && replyingToComment) {
        await zernio.privateReplyComment(pId, replyingToComment.id, accId, commentReplyText, selectedCommentPost.integrationId);
        toast.success("Mensagem privada (DM) enviada!");
      } else {
        await zernio.replyPostComment(pId, accId, commentReplyText, replyingToComment?.id, selectedCommentPost.integrationId);
        toast.success("Comentário respondido!");
      }

      setCommentReplyText("");
      setReplyingToComment(null);
      setIsDmPrivateReply(false);
      handleSelectCommentPost(selectedCommentPost);
    } catch (err: any) {
      toast.error("Erro ao enviar resposta: " + err.message);
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error } = await supabase.storage
        .from('zernio-media')
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('zernio-media')
        .getPublicUrl(filePath);

      setMediaUrl(publicUrl);
      toast.success("Mídia enviada com sucesso!");
    } catch (err: any) {
      toast.error("Erro ao enviar mídia: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const [initialLoading, setInitialLoading] = useState(true);

  const fetchMultiAccountData = useCallback(async (integrationsList: any[]) => {
    setLoading(true);
    try {
      const allAccounts: any[] = [];
      const allPosts: any[] = [];
      const allConversations: any[] = [];
      const allComments: any[] = [];
      const allProfiles: any[] = [];

      for (const integration of integrationsList) {
        let profileId = integration.profileId;
        // FIX #1: Single getProfiles call — reuse result for both profileId resolution and allProfiles population
        let cachedProfiles: any[] = [];
        try {
          const pRes = await zernio.getProfiles(integration.id);
          cachedProfiles = pRes?.profiles || [];
        } catch (pErr) {
          console.error(`Failed to fetch profiles for integration ${integration.name}:`, pErr);
        }

        if (!profileId) {
          if (cachedProfiles.length > 0) {
            profileId = cachedProfiles[0]._id || cachedProfiles[0].id;
          } else {
            try {
              const newProfile = await zernio.createProfile("Principal", integration.id);
              profileId = newProfile?._id || newProfile?.id;
              if (profileId) {
                cachedProfiles = [newProfile];
                await zernio.saveConfig("", profileId, integration.id);
                integration.profileId = profileId;
              }
            } catch (createErr) {
              console.error(`Failed to create profile for integration ${integration.name}:`, createErr);
              continue;
            }
          }
          if (profileId) {
            integration.profileId = profileId;
          }
        }

        if (!profileId) continue;

        // Populate allProfiles using already-fetched data (no duplicate call)
        allProfiles.push(...cachedProfiles.map((p: any) => ({
          ...p,
          integrationId: integration.id,
          integrationName: integration.name
        })));

        const [accRes, postsRes, convsRes, commentsRes] = await Promise.allSettled([
          zernio.getAccounts(profileId, integration.id),
          zernio.getPosts(profileId, "all", "all", "all", "scheduled-desc", undefined, integration.id),
          zernio.getConversations(profileId, integration.id),
          zernio.getComments(profileId, integration.id)
        ]);

        let integrationAccounts: any[] = [];
        if (accRes.status === 'fulfilled' && accRes.value) {
          const rawAccs = accRes.value.accounts || [];
          integrationAccounts = rawAccs.map((a: any) => ({
            ...a,
            integrationId: integration.id,
            integrationName: integration.name
          }));
          allAccounts.push(...integrationAccounts);

          // FIX #5: Batch upsert for social accounts (single DB call instead of N+1)
          if (tenantId && rawAccs.length > 0) {
            const batchChannels = rawAccs
              .filter((acc: any) => acc._id || acc.id)
              .map((acc: any) => ({
                tenant_id: tenantId,
                integration_id: integration.id,
                social_account_id: acc._id || acc.id,
                platform: acc.platform || 'instagram',
                name: acc.displayName || acc.name || null,
                username: acc.username || null,
                avatar_url: acc.avatarUrl || null
              }));
            if (batchChannels.length > 0) {
              await supabase
                .from('zernio_integration_channels' as any)
                .upsert(batchChannels, { onConflict: 'tenant_id,social_account_id' });
            }

             // FIX #2: Only call PUT on webhook when not already registered correctly
            try {
              const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zernio-webhook`;
              const webhookRegisteredKey = `zernio_webhook_registered::${integration.id}`;
              const alreadyRegistered = sessionStorage.getItem(webhookRegisteredKey);

              if (!alreadyRegistered) {
                let webhooksList: any[] = [];
                try {
                  const settings = await zernio.getWebhooksSettings(integration.id);
                  webhooksList = settings?.webhooks || [];
                } catch (settErr: any) {
                  const errMsg = (settErr.message || '').toLowerCase();
                  if (errMsg.includes("webhook not found") || settErr.status === 404) {
                    console.log(`[Webhook Auto] No existing webhooks found for ${integration.name}.`);
                    webhooksList = [];
                  } else {
                    throw settErr;
                  }
                }
                const nonDuplicateWebhooks = webhooksList.filter((w: any) => w.url !== webhookUrl);
                const existing = webhooksList.find((w: any) => w.url === webhookUrl);

                const needsUpdate = !existing ||
                  !existing.isActive ||
                  !['comment.received', 'message.received'].every((ev: string) => existing.events?.includes(ev));

                if (needsUpdate) {
                  const generateMongoId = () => {
                    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
                    const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
                    return timestamp + random;
                  };
                  const targetWebhook = {
                    _id: existing?._id || existing?.id || generateMongoId(),
                    name: "Zernio Hub Webhook",
                    url: webhookUrl,
                    events: ["post.published", "post.failed", "post.partial", "post.platform.published", "post.platform.failed", "comment.received", "message.received"],
                    isActive: true
                  };
                  await zernio.updateWebhook({ webhooks: [...nonDuplicateWebhooks, targetWebhook] }, integration.id);
                }
                // Mark as registered in sessionStorage so we skip the GET+PUT on subsequent loads
                sessionStorage.setItem(webhookRegisteredKey, '1');
              }
            } catch (wErr) {
              console.warn("Failed to auto-register webhook in Zernio:", wErr);
            }
          }
        }

        if (postsRes.status === 'fulfilled' && postsRes.value) {
          const rawPosts = postsRes.value.posts || [];
          allPosts.push(...rawPosts.map((p: any) => ({
            ...p,
            integrationId: integration.id,
            integrationName: integration.name
          })));
        }

        if (convsRes.status === 'fulfilled' && convsRes.value) {
          const rawConvs = convsRes.value.data || convsRes.value.conversations || [];
          allConversations.push(...rawConvs.map((c: any) => ({
            ...c,
            integrationId: integration.id,
            integrationName: integration.name
          })));
        }

        if (commentsRes.status === 'fulfilled' && commentsRes.value) {
          const rawComments = commentsRes.value.data || commentsRes.value.comments || [];
          allComments.push(...rawComments.map((c: any) => {
            const accId = c.accountId || c.socialAccountId || c.account_id;
            const matchedAcc = integrationAccounts.find(
              (a: any) => (a._id || a.id) === accId
            );
            return {
              ...c,
              platform: c.platform || c.networkType || c.network || matchedAcc?.platform,
              integrationId: integration.id,
              integrationName: integration.name
            };
          }));
        }
      }

      setProfiles(allProfiles);
      if (allProfiles.length > 0 && !selectedProfileId) {
        setSelectedProfileId(allProfiles[0]._id || allProfiles[0].id);
      }

      setAccounts(allAccounts);
      setPosts(allPosts);
      setConversations(allConversations);
      setComments(allComments);
      // FIX #4: Only fetch automations (rules), NOT logs — logs are fetched on demand by the user tab
      fetchAutomations(false);
    } catch (err: any) {
      console.error("Error loading multi-account data:", err);
    } finally {
      setLoading(false);
    }
  }, [tenantId, selectedProfileId]);

  const fetchProfileData = useCallback(async (_profileId?: string) => {
    if (config.integrations && config.integrations.length > 0) {
      await fetchMultiAccountData(config.integrations);
    } else {
      await fetchConfig(false);
    }
  }, [config.integrations]);

  const handleRefresh = useCallback(async () => {
    clearZernioCache();
    refreshCacheStats();
    await fetchConfig(false);
    toast.success("Dados atualizados!");
  }, [refreshCacheStats]);

  // ──────────────────────────────────────────────
  // Contacts
  // ──────────────────────────────────────────────
  const fetchContacts = useCallback(async (page = 1, search = '', tag = '', forceSync = false) => {
    if (!selectedProfileId || !config.integrations || config.integrations.length === 0) {
      toast.error('Sem integração configurada para buscar contatos.');
      return;
    }
    setLoadingContacts(true);
    try {
      const integration = config.integrations[0];

      // ── 1. Tenta buscar do banco de dados local primeiro se não for forceSync ──
      if (!forceSync) {
        let dbQuery = supabase
          .from('zernio_contacts' as any)
          .select('*', { count: 'exact' })
          .eq('profile_id', selectedProfileId)
          .order('name', { ascending: true })
          .range((page - 1) * CONTACTS_PER_PAGE, page * CONTACTS_PER_PAGE - 1);

        if (search) {
          dbQuery = dbQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }

        const { data: dbData, count: dbCount, error: dbError } = await dbQuery;

        if (!dbError && dbData && dbData.length > 0) {
          console.log('[Contacts] Loaded from local database:', dbData.length);
          const mapped = dbData.map((d: any) => ({
            id: d.zernio_contact_id,
            _id: d.zernio_contact_id,
            name: d.name,
            email: d.email,
            phone: d.phone,
            avatarUrl: d.avatar_url,
            tags: d.tags || [],
            platforms: d.platforms || [],
            lastInteractionAt: d.last_interaction_at,
            channels: (d.platforms || []).map((p: string) => ({ platform: p })),
            raw_data: d.raw_data
          }));
          setContacts(mapped);
          setContactsTotal(dbCount || mapped.length);
          setContactsPage(page);
          setLoadingContacts(false);
          return;
        }
      }

      // ── 2. Tenta Zernio contacts API se forceSync ou banco vazio ──
      let list: any[] = [];
      let total = 0;
      try {
        const res = await zernio.getContacts(selectedProfileId, integration.id, page, search, tag);
        console.log('[Contacts] API raw response:', JSON.stringify(res)?.slice(0, 300));

        if (Array.isArray(res)) {
          list = res;
        } else if (res?.contacts && Array.isArray(res.contacts)) {
          list = res.contacts;
        } else if (res?.data && Array.isArray(res.data)) {
          list = res.data;
        } else if (res?.items && Array.isArray(res.items)) {
          list = res.items;
        } else if (res?.results && Array.isArray(res.results)) {
          list = res.results;
        }
        total = res?.total ?? res?.meta?.total ?? res?.count ?? list.length;
      } catch (apiErr: any) {
        console.warn('[Contacts] Contacts API failed:', apiErr.message);
      }

      // ── 3. Fallback: extrai das conversas locais ──
      if (list.length === 0 && conversations.length > 0) {
        console.log('[Contacts] Falling back to conversations as contact source');
        const seenIds = new Set<string>();
        list = conversations
          .map((conv: any) => {
            const participant = conv.participant || conv.sender || conv.from || conv.contact || {};
            const id = participant._id || participant.id || conv.participantId || conv.contactId || conv._id || conv.id;
            if (!id || seenIds.has(id)) return null;
            seenIds.add(id);
            return {
              _id: id,
              id,
              name: participant.name || participant.displayName || conv.participantName || conv.contactName || 'Contato',
              username: participant.username || conv.participantUsername || null,
              email: participant.email || null,
              phone: participant.phone || null,
              avatarUrl: participant.avatarUrl || participant.avatar || conv.participantAvatar || null,
              tags: [],
              channels: conv.platform || conv.networkType ? [{ platform: conv.platform || conv.networkType }] : [],
              _source: 'conversation',
              integrationId: conv.integrationId,
              accountId: conv.accountId,
              _conv: conv,
            };
          })
          .filter(Boolean);

        if (search) {
          const q = search.toLowerCase();
          list = list.filter((c: any) =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.username || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
          );
        }
        total = list.length;
      }

      setContacts(list);
      setContactsTotal(total);
      setContactsPage(page);

      if (list.length === 0) {
        if (forceSync) {
          toast.info('Nenhum contato retornado do servidor.');
        }
        return;
      }

      // ── 4. Persiste no Supabase ──
      if (!tenantId) {
        console.warn('[Contacts] tenantId is null — skipping upsert');
        return;
      }

      const batch = list
        .map((c: any) => {
          const cId = c._id || c.id;
          if (!cId) return null;
          return {
            tenant_id: tenantId,
            zernio_contact_id: String(cId),
            profile_id: selectedProfileId,
            integration_id: integration.id,
            name: c.name || c.displayName || null,
            email: c.email || null,
            phone: c.phone || c.phoneNumber || null,
            avatar_url: c.avatarUrl || c.picture || c.avatar || null,
            tags: Array.isArray(c.tags) ? c.tags : [],
            platforms: (c.channels || []).map((ch: any) => ch.platform || ch.type).filter(Boolean),
            last_interaction_at: c.lastInteractionAt || c.updatedAt || null,
            raw_data: c._source === 'conversation' ? undefined : c,
            updated_at: new Date().toISOString()
          };
        })
        .filter(Boolean);

      if (batch.length > 0) {
        const upsertRes = await zernio.upsertContacts(batch as any[]);
        if (upsertRes?.error) {
          console.error('[Contacts] Upsert error:', upsertRes.error);
          if (forceSync) toast.error('Erro ao salvar no banco local: ' + upsertRes.error);
        } else {
          if (forceSync) {
            toast.success(`${upsertRes?.upserted ?? batch.length} contatos sincronizados com sucesso!`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Contacts] fetchContacts error:', err);
      toast.error('Erro ao carregar contatos: ' + err.message);
    } finally {
      setLoadingContacts(false);
    }
  }, [selectedProfileId, config.integrations, tenantId, conversations]);

  // Carrega contatos automaticamente ao abrir a aba
  useEffect(() => {
    if (activeTab === 'contacts' && selectedProfileId) {
      fetchContacts(1, contactsSearch, contactsTagFilter, false);
    }
  }, [activeTab, selectedProfileId]);

  const handleOpenContactChannels = async (contact: any) => {
    setSelectedContact(contact);
    setLoadingChannels(true);
    setContactChannels([]);
    try {
      if (!config.integrations || config.integrations.length === 0) return;
      const integration = config.integrations[0];
      const contactId = contact._id || contact.id;
      const res = await zernio.getContactChannels(contactId, integration.id);
      setContactChannels(res?.channels || []);
    } catch {
      // Channels may not be available — fall back to raw_data.channels
      setContactChannels(contact.channels || []);
    } finally {
      setLoadingChannels(false);
    }
  };

  const handleOpenConversationFromContact = async (contact: any) => {
    const contactId = contact._id || contact.id;
    const name = (contact.name || contact.displayName || '').toLowerCase();
    const username = (contact.username || '').toLowerCase();

    setSelectedContact(null);
    setInboxType('dms');
    setActiveTab('inbox');

    // 1. Match local robusto
    const localMatch = conversations.find((conv: any) => {
      // IDs
      const convContactId = conv.contactId || conv.contact_id || conv.participantId || conv.participant_id;
      const nestedId = conv.participant?._id || conv.participant?.id || conv.sender?._id || conv.sender?.id;

      if (contactId && (convContactId === contactId || nestedId === contactId)) {
        return true;
      }

      // Nomes
      const pName = (conv.participantName || conv.contactName || conv.participant?.name || conv.participant?.displayName || conv.sender?.name || '').toLowerCase();
      const pUsername = (conv.participantUsername || conv.participant?.username || conv.sender?.username || '').toLowerCase();

      if (name && pName.includes(name)) return true;
      if (username && pUsername === username) return true;

      return false;
    });

    if (localMatch) {
      setTimeout(() => handleSelectChat(localMatch), 80);
      return;
    }

    // 2. Fetch directly using contactId or search query
    if (!selectedProfileId || !config.integrations?.length) return;
    const toastId = toast.loading("Carregando conversa...");
    try {
      const integration = config.integrations[0];
      let results: any[] = [];

      if (contactId) {
        const resById = await zernio.getConversationsByContact(selectedProfileId, contactId, integration.id);
        results = resById?.data || resById?.conversations || (Array.isArray(resById) ? resById : []);
      }

      if (results.length === 0 && name) {
        const resSearch = await zernio.searchConversations(selectedProfileId, name, integration.id);
        results = resSearch?.data || resSearch?.conversations || (Array.isArray(resSearch) ? resSearch : []);
      }

      toast.dismiss(toastId);

      if (results.length > 0) {
        const conv = results[0];
        const convId = conv._id || conv.id || conv.conversationId || conv.conversation_id || conv.threadId || contactId;
        const finalConv = { ...conv, _id: convId, id: convId };

        setConversations(prev => {
          const exists = prev.find(c => (c._id || c.id) === convId);
          return exists ? prev : [finalConv, ...prev];
        });
        setTimeout(() => handleSelectChat(finalConv), 80);
      } else {
        toast.error(`Não foi possível encontrar a conversa no Zernio para "${contact.name || 'este contato'}".`);
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error('Erro ao abrir conversa: ' + err.message);
    }
  };




  // Fetch automations from local supabase integrations
  const fetchAutomationLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from("zernio_automation_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setAutomationLogs(data || []);
      setLogsPage(1);
    } catch (err: any) {
      console.warn("Could not fetch automation logs:", err.message);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const handleClearAutomationLogs = () => {
    setConfirmModal({
      open: true,
      title: "Limpar Logs",
      message: "Deseja realmente limpar todos os logs de automação? Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setConfirmModal(null);
        setLoadingLogs(true);
        try {
          const { error } = await supabase
            .from("zernio_automation_logs" as any)
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");
          if (error) throw error;
          toast.success("Logs limpos com sucesso!");
          setAutomationLogs([]);
          setLogsPage(1);
        } catch (err: any) {
          toast.error("Erro ao limpar logs: " + err.message);
        } finally {
          setLoadingLogs(false);
        }
      }
    });
  };

  const handleRetryAutomation = async (logId: string) => {
    try {
      toast.loading("Disparando retentativa...", { id: "retry-log" });
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/zernio-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ action: "retry", logId })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Status ${res.status}`);
      }

      toast.success("Retentativa executada com sucesso!", { id: "retry-log" });
      fetchAutomationLogs();
    } catch (err: any) {
      console.error("Retry failed:", err);
      toast.error("Erro ao retentar automação: " + err.message, { id: "retry-log" });
    }
  };

  // FIX #4: fetchAutomations now decoupled from fetchAutomationLogs
  // Pass fetchLogs=true only when caller explicitly needs to refresh logs
  const fetchAutomations = async (fetchLogs = true) => {
    try {
      const { data, error } = await supabase
        .from("zernio_automations" as any)
        .select("*");
      if (error) throw error;
      setAutomations(data || []);
      if (fetchLogs) fetchAutomationLogs();
    } catch (err: any) {
      console.warn("Could not fetch automations:", err.message);
    }
  };

  const saveAutomationRule = async () => {
    if (!selectedAutomationAccount) {
      toast.error("Por favor, selecione uma conta social.");
      return;
    }
    setLoading(true);
    try {
      let activeTenantId = tenantId;
      if (!activeTenantId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", user.id)
            .maybeSingle();
          activeTenantId = profile?.tenant_id || null;
        }
      }

      if (!activeTenantId) {
        throw new Error("ID do locatário (tenant_id) não encontrado.");
      }

      const acc = accounts.find(a => (a._id || a.id) === selectedAutomationAccount);
      const platform = acc?.platform || "instagram";

      const payload = {
        tenant_id: activeTenantId,
        social_account_id: selectedAutomationAccount,
        platform,
        is_enabled: isAutomationEnabled,
        trigger_type: automationTriggerType,
        keywords: automationKeywords ? automationKeywords.split(",").map(k => k.trim()) : [],
        automation_type: automationType,
        ai_provider: automationAiProvider,
        ai_prompt: automationAiPrompt,
        static_reply: automationStaticReply,
        target_posts_type: automationTargetPostsType,
        target_post_ids: automationTargetPostIds
      };

      let res;
      if (editingAutomationId) {
        res = await supabase
          .from("zernio_automations" as any)
          .update(payload)
          .eq("id", editingAutomationId);
      } else {
        // Fallback to check if a rule of this type already exists to prevent duplicate key constraint
        const existingRule = automations.find(a => a.social_account_id === selectedAutomationAccount && a.automation_type === automationType);
        if (existingRule) {
          res = await supabase
            .from("zernio_automations" as any)
            .update(payload)
            .eq("id", existingRule.id);
        } else {
          res = await supabase
            .from("zernio_automations" as any)
            .insert([payload]);
        }
      }

      if (res.error) throw res.error;
      toast.success("Configuração de automação salva com sucesso!");
      setEditingAutomationId(null);
      await fetchAutomations();
    } catch (err: any) {
      toast.error("Erro ao salvar automação: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [confirmModal, setConfirmModal] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null);

  const deleteAutomationRule = async (ruleId: string) => {
    setConfirmModal({
      open: true,
      title: "Excluir Automação",
      message: "Deseja realmente excluir esta regra de automação? Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          const { error } = await supabase
            .from("zernio_automations" as any)
            .delete()
            .eq("id", ruleId);
          if (error) throw error;
          toast.success("Automação excluída com sucesso!");
          await fetchAutomations();
        } catch (err: any) {
          toast.error("Erro ao excluir: " + err.message);
        } finally {
          setLoading(false);
        }
      },
    });
  };


  const loadSelectedAutomationConfig = useCallback(() => {
    if (!selectedAutomationAccount) return;
    const rule = automations.find(
      a => a.social_account_id === selectedAutomationAccount && a.automation_type === automationType
    );
    if (rule) {
      setEditingAutomationId(rule.id);
      setIsAutomationEnabled(rule.is_enabled ?? true);
      setAutomationTriggerType(rule.trigger_type || "all");
      setAutomationKeywords(rule.keywords ? rule.keywords.join(", ") : "");
      setAutomationAiProvider(rule.ai_provider || "static");
      setAutomationAiPrompt(rule.ai_prompt || "");
      setAutomationStaticReply(rule.static_reply || "");
      setAutomationTargetPostsType(rule.target_posts_type || "all");
      setAutomationTargetPostIds(rule.target_post_ids || []);
    } else {
      setEditingAutomationId(null);
      setIsAutomationEnabled(true);
      setAutomationTriggerType("all");
      setAutomationKeywords("");
      setAutomationAiProvider("static");
      setAutomationAiPrompt("");
      setAutomationStaticReply("");
      setAutomationTargetPostsType("all");
      setAutomationTargetPostIds([]);
    }
  }, [selectedAutomationAccount, automationType, automations]);

  useEffect(() => {
    loadSelectedAutomationConfig();
  }, [selectedAutomationAccount, automationType, loadSelectedAutomationConfig]);

  // Load posts for the selected automation account
  useEffect(() => {
    if (!selectedAutomationAccount || !selectedProfileId) {
      setAutomationPosts([]);
      return;
    }
    setLoadingAutomationPosts(true);
    const matchedAccount = accounts.find(a => (a._id || a.id) === selectedAutomationAccount);
    const integrationId = matchedAccount?.integrationId;
    // Fetch both external (historical) and zernio-authored posts for this account
    Promise.allSettled([
      zernio.getPostsByAccount(selectedProfileId, selectedAutomationAccount, 'external', integrationId),
      zernio.getPostsByAccount(selectedProfileId, selectedAutomationAccount, 'zernio', integrationId),
    ]).then(([extRes, zernioRes]) => {
      const extPosts = extRes.status === 'fulfilled' ? (extRes.value?.posts || []) : [];
      const zernioPosts = zernioRes.status === 'fulfilled' ? (zernioRes.value?.posts || []) : [];
      // Merge and deduplicate by id
      const seen = new Set<string>();
      const merged = [...extPosts, ...zernioPosts].filter(p => {
        const id = p._id || p.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      setAutomationPosts(merged);
    }).finally(() => setLoadingAutomationPosts(false));
  }, [selectedAutomationAccount, selectedProfileId, accounts]);

  // Save active tab to sessionStorage
  useEffect(() => {
    sessionStorage.setItem("zernio_active_tab", activeTab);
  }, [activeTab]);

  // Fetch config on mount
  useEffect(() => {
    fetchConfig(false);
    refreshCacheStats();
  }, []);

  // Keep cache stats fresh whenever profile data reloads
  useEffect(() => {
    refreshCacheStats();
  }, [accounts, posts, conversations, comments]);

  // FIX #3: Only re-fetch when profile changes explicitly (not on first mount — fetchConfig already covers that)
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (selectedProfileId) {
      fetchProfileData(selectedProfileId);
    }
  }, [selectedProfileId, fetchProfileData]);

  const fetchConfig = async (showToast = false) => {
    try {
      const res = await zernio.getConfig(true);
      setConfig(res);
      if (res.connected && res.integrations && res.integrations.length > 0) {
        if (showToast) {
          toast.success("Integração Zernio conectada!");
        }

        let targetId = selectedIntegrationIdForAiKeys;
        if (!targetId || !res.integrations.some((i: any) => i.id === targetId)) {
          targetId = res.integrations[0].id;
          setSelectedIntegrationIdForAiKeys(targetId);
        }
        await loadAiKeys(targetId);
        await fetchMultiAccountData(res.integrations);
      } else {
        setAccounts([]);
        setPosts([]);
        setConversations([]);
        setComments([]);
      }
    } catch (err: any) {
      console.warn("Zernio config not loaded:", err);
    } finally {
      setInitialLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!apiKeyInput) {
      toast.error("Informe a chave de API.");
      return;
    }
    setLoading(true);
    try {
      await zernio.saveConfig(apiKeyInput, profileIdInput || undefined, undefined, newAccountName || undefined);
      toast.success("Conta Zernio conectada com sucesso!");
      setApiKeyInput("");
      setProfileIdInput("");
      setNewAccountName("");
      await fetchConfig(true);
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadAiKeys = async (integrationId?: string) => {
    const targetId = integrationId || selectedIntegrationIdForAiKeys;
    if (!targetId) return;
    try {
      const { data } = await supabase
        .from('zernio_integrations' as any)
        .select('ai_gemini_key, ai_openai_key, ai_anthropic_key, ai_mistral_key, ai_groq_key, ai_seekai_key')
        .eq('id', targetId)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setAiKeys({
          gemini: d.ai_gemini_key ? '••••••••' : '',
          openai: d.ai_openai_key ? '••••••••' : '',
          anthropic: d.ai_anthropic_key ? '••••••••' : '',
          mistral: d.ai_mistral_key ? '••••••••' : '',
          groq: d.ai_groq_key ? '••••••••' : '',
          seekai: d.ai_seekai_key ? '••••••••' : '',
        });
      } else {
        setAiKeys({ gemini: '', openai: '', anthropic: '', mistral: '', groq: '', seekai: '' });
      }
    } catch (err) {
      console.warn('Could not load AI keys:', err);
    }
  };

  const saveAiKey = async (provider: string, key: string) => {
    if (!key || key === '••••••••' || !selectedIntegrationIdForAiKeys) return;
    setLoading(true);
    try {
      const colMap: Record<string, string> = {
        gemini: 'ai_gemini_key',
        openai: 'ai_openai_key',
        anthropic: 'ai_anthropic_key',
        mistral: 'ai_mistral_key',
        groq: 'ai_groq_key',
        seekai: 'ai_seekai_key',
      };
      const col = colMap[provider];
      if (!col) return;
      const { error } = await supabase
        .from('zernio_integrations' as any)
        .update({ [col]: key } as any)
        .eq('id', selectedIntegrationIdForAiKeys);
      if (error) throw error;
      toast.success(`Chave ${provider} salva!`);
      setAiKeys(prev => ({ ...prev, [provider]: '••••••••' }));
    } catch (err: any) {
      toast.error('Erro ao salvar chave: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const removeAiKey = async (provider: string) => {
    if (!selectedIntegrationIdForAiKeys) return;
    setLoading(true);
    try {
      const colMap: Record<string, string> = {
        gemini: 'ai_gemini_key',
        openai: 'ai_openai_key',
        anthropic: 'ai_anthropic_key',
        mistral: 'ai_mistral_key',
        groq: 'ai_groq_key',
        seekai: 'ai_seekai_key',
      };
      const col = colMap[provider];
      if (!col) return;
      const { error } = await supabase
        .from('zernio_integrations' as any)
        .update({ [col]: null } as any)
        .eq('id', selectedIntegrationIdForAiKeys);
      if (error) throw error;
      toast.success(`Chave ${provider} removida.`);
      setAiKeys(prev => ({ ...prev, [provider]: '' }));
    } catch (err: any) {
      toast.error('Erro ao remover chave: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const syncWebhook = async () => {
    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const webhookUrl = `${supabaseUrl}/functions/v1/zernio-webhook`;

      for (const integration of config.integrations || []) {
        let existingWebhooks: any[] = [];
        try {
          const res = await zernio.getWebhooksSettings(integration.id);
          existingWebhooks = res?.webhooks || res || [];
        } catch (err: any) {
          const errMsg = (err?.message || '').toLowerCase();
          if (errMsg.includes("webhook not found") || err?.status === 404) {
            console.log(`[Webhook] No existing webhook settings for integration ${integration.name}.`);
            existingWebhooks = [];
          } else {
            console.warn(`Could not get webhooks for integration ${integration.name}:`, err);
            throw err;
          }
        }

        const payload = {
          name: "Zernio Automations Webhook",
          url: webhookUrl,
          secret: "zernio_secret_key_987654321",
          events: [
            "comment.received",
            "message.received",
            "post.published",
            "post.failed",
            "post.partial"
          ],
          isActive: true
        };

        const matchedWebhook = existingWebhooks.find((w: any) => w.url === webhookUrl || w.name === "Zernio Automations Webhook");

        if (matchedWebhook) {
          const updatePayload = {
            ...payload,
            _id: matchedWebhook._id || matchedWebhook.id
          };
          await zernio.updateWebhook(updatePayload, integration.id);
        } else {
          await zernio.createWebhook(payload, integration.id);
        }
      }
      toast.success("Webhook sincronizado em todas as contas Zernio!");
    } catch (err: any) {
      toast.error("Erro ao sincronizar webhook: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfig = async (id: string) => {
    setConfirmModal({
      open: true,
      title: "Excluir Conta Zernio",
      message: "Deseja realmente remover esta chave de API do Zernio? Todos os canais e automações vinculados a ela serão afetados.",
      onConfirm: async () => {
        setConfirmModal(null);
        setLoading(true);
        try {
          await zernio.deleteConfig(id);
          toast.success("Conta Zernio removida!");
          await fetchConfig(false);
        } catch (err: any) {
          toast.error("Erro ao remover conta: " + err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const handleUpdateAccount = async () => {
    if (!editingIntegrationId) return;
    setLoading(true);
    try {
      await zernio.saveConfig("", editingProfileId || undefined, editingIntegrationId, editingAccountName);
      toast.success("Conta atualizada com sucesso!");
      setEditingAccountName("");
      setEditingProfileId("");
      setEditingIntegrationId(null);
      setIsEditingAccount(false);
      await fetchConfig(false);
    } catch (err: any) {
      toast.error("Erro ao atualizar conta: " + err.message);
    } finally {
      setLoading(false);
    }
  };



  const handleCreatePost = async () => {
    if (!postText) {
      toast.error("O texto do post é obrigatório.");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast.error("Selecione ao menos uma conta social.");
      return;
    }

    const hasYoutubeSelected = selectedAccounts.some(accId => accounts.find(a => (a._id || a.id) === accId)?.platform === 'youtube');
    if (hasYoutubeSelected) {
      if (!youtubeTitle) {
        toast.error("O título do vídeo é obrigatório para o YouTube.");
        return;
      }
      if (!mediaUrl) {
        toast.error("Um vídeo é obrigatório para publicar no YouTube.");
        return;
      }
    }

    setLoading(true);
    try {
      // Group selected accounts by integrationId
      const accountsByIntegration: Record<string, string[]> = {};
      selectedAccounts.forEach(accId => {
        const acc = accounts.find(a => (a._id || a.id) === accId);
        if (acc?.integrationId) {
          if (!accountsByIntegration[acc.integrationId]) {
            accountsByIntegration[acc.integrationId] = [];
          }
          accountsByIntegration[acc.integrationId].push(accId);
        }
      });

      for (const [integrationId, accIds] of Object.entries(accountsByIntegration)) {
        const integrationObj = config.integrations?.find(i => i.id === integrationId);
        const profileId = integrationObj?.profileId;
        if (!profileId) {
          console.warn("Could not find profileId for integration", integrationId);
          continue;
        }

        const integrationYoutubeSelected = accIds.some(accId => accounts.find(a => (a._id || a.id) === accId)?.platform === 'youtube');

        const targetPlatforms = accIds.map(accountId => {
          const account = accounts.find(acc => (acc._id || acc.id) === accountId);
          const platformObj: any = {
            platform: account?.platform || "twitter",
            accountId: accountId
          };
          if (account?.platform === 'youtube') {
            platformObj.title = youtubeTitle;
            platformObj.description = postText;
            platformObj.isShort = isYoutubeShort;
          }
          return platformObj;
        });

        const payload: any = {
          profileId,
          content: postText,
          platforms: targetPlatforms,
        };

        if (integrationYoutubeSelected) {
          payload.platformOverrides = {
            youtube: {
              title: youtubeTitle,
              description: postText,
              isShort: isYoutubeShort
            }
          };
          payload.overrides = {
            youtube: {
              title: youtubeTitle,
              description: postText,
              isShort: isYoutubeShort
            }
          };
        }

        if (mediaUrl) {
          payload.mediaItems = [
            {
              type: mediaUrl.toLowerCase().endsWith('.mp4') ? 'video' : 'image',
              url: mediaUrl
            }
          ];
        }

        if (scheduleDate) {
          payload.scheduledFor = new Date(scheduleDate).toISOString();
          payload.publishNow = false;
        } else {
          payload.publishNow = true;
        }

        if (firstComment) {
          payload.firstComment = firstComment;
        }

        await zernio.createPost(payload, integrationId);
      }

      toast.success(scheduleDate ? "Post agendado com sucesso!" : "Post publicado com sucesso!");

      // Reset composer fields
      setPostText("");
      setMediaUrl("");
      setSelectedAccounts([]);
      setScheduleDate("");
      setFirstComment("");
      setYoutubeTitle("");
      setIsYoutubeShort(false);

      // Refresh posts list
      await fetchConfig(false);
      setActiveTab("dashboard");
    } catch (err: any) {
      toast.error("Erro ao criar post: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    setConfirmModal({
      open: true,
      title: "Excluir Agendamento",
      message: "Deseja realmente excluir este agendamento? Esta ação não pode ser desfeita.",
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const post = posts.find(p => (p._id || p.id) === postId);
          await zernio.deletePost(postId, post?.integrationId);
          toast.success("Post excluído com sucesso.");
          fetchProfileData(selectedProfileId);
        } catch (err: any) {
          toast.error("Erro ao excluir: " + err.message);
        }
      },
    });
  };

  const handleSelectChat = async (conv: any) => {
    const convId = conv._id || conv.id;
    if (!convId) {
      console.warn('handleSelectChat: conversation has no id', conv);
      return;
    }

    // Garantir accountId fallback
    const resolvedAccountId = conv.accountId || conv.account_id || (accounts.length > 0 ? accounts[0]._id || accounts[0].id : '');
    const integrationId = conv.integrationId || conv.integration_id || (config.integrations?.length ? config.integrations[0].id : undefined);

    const enrichedConv = {
      ...conv,
      accountId: resolvedAccountId,
      integrationId
    };

    setActiveChat(enrichedConv);
    try {
      if (resolvedAccountId) {
        const messages = await zernio.getMessages(convId, resolvedAccountId, integrationId);
        setChatMessages(messages.messages || []);
      } else {
        setChatMessages([]);
      }
    } catch (err: any) {
      console.warn("Erro ao buscar mensagens, iniciando chat vazio:", err.message);
      setChatMessages([]);
    }
  };

  const handleSendMessage = async () => {
    if (!replyText || !activeChat) return;
    const convId = activeChat._id || activeChat.id;
    try {
      await zernio.sendMessage(convId, activeChat.accountId, replyText, activeChat.integrationId);
      toast.success("Mensagem enviada!");
      setReplyText("");
      // Refresh chat
      handleSelectChat(activeChat);
    } catch (err: any) {
      toast.error("Erro ao enviar mensagem: " + err.message);
    }
  };

  const getPlatformIcon = (platform: string | undefined | null, isSelected = false) => {
    const sz = 16;
    const sel = isSelected ? "#fff" : undefined;
    switch ((platform || "").toLowerCase()) {
      case "instagram": return <SiInstagram size={sz} color={sel ?? "#E1306C"} />;
      case "facebook": return <SiFacebook size={sz} color={sel ?? "#1877F2"} />;
      case "youtube": return <SiYoutube size={sz} color={sel ?? "#FF0000"} />;
      case "tiktok": return <SiTiktok size={sz} color={sel ?? "#000000"} />;
      case "whatsapp": return <SiWhatsapp size={sz} color={sel ?? "#25D366"} />;
      case "telegram": return <SiTelegram size={sz} color={sel ?? "#26A5E4"} />;
      case "linkedin": return <FaLinkedin size={sz} color={sel ?? "#0A66C2"} />;
      case "twitter":
      case "x": return <FaXTwitter size={sz} color={sel ?? "#000000"} />;
      case "bluesky": return <SiBluesky size={sz} color={sel ?? "#0085ff"} />;
      case "threads": return <SiThreads size={sz} color={sel ?? "#000000"} />;
      case "pinterest": return <SiPinterest size={sz} color={sel ?? "#E60023"} />;
      case "discord": return <SiDiscord size={sz} color={sel ?? "#5865F2"} />;
      case "reddit": return <SiReddit size={sz} color={sel ?? "#FF4500"} />;
      case "snapchat": return <SiSnapchat size={sz} color={sel ?? "#FFFC00"} />;
      case "googlebusiness":
      case "google": return <SiGoogle size={sz} color={sel ?? "#4285F4"} />;
      default: return <HelpCircle size={sz} className={isSelected ? "text-white" : "text-gray-400"} />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3" /> Publicado
          </span>
        );
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" /> Agendado
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="h-3 w-3" /> Falhou
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground border border-border/50">
            <Clock className="h-3 w-3" /> {status}
          </span>
        );
    }
  };

  const filteredPosts = posts.filter(post => {
    // 1. Status Filter
    if (filterStatus !== 'all' && post.status !== filterStatus) return false;

    // 2. Source Filter
    if (filterSource !== 'all') {
      const isZernio = post.source === 'zernio' || post.isZernio || post.isZernioPost;
      if (filterSource === 'zernio' && !isZernio) return false;
      if (filterSource === 'external' && isZernio) return false;
    }

    // 3. Platform Filter
    if (filterPlatform !== 'all') {
      const hasPlatform = post.platforms?.some((p: any) => p.platform?.toLowerCase() === filterPlatform.toLowerCase());
      if (!hasPlatform) return false;
    }

    // 4. Account Filter
    if (filterAccount !== 'all' && post.integrationId !== filterAccount) return false;

    return true;
  }).sort((a, b) => {
    const getScheduledTime = (p: any) => new Date(p.scheduledFor || p.scheduledAt || p.publishedAt || p.createdAt || 0).getTime();
    const getCreatedTime = (p: any) => new Date(p.createdAt || p.publishedAt || 0).getTime();

    if (sortBy === 'scheduled-desc') return getScheduledTime(b) - getScheduledTime(a);
    if (sortBy === 'scheduled-asc') return getScheduledTime(a) - getScheduledTime(b);
    if (sortBy === 'created-desc') return getCreatedTime(b) - getCreatedTime(a);
    if (sortBy === 'created-asc') return getCreatedTime(a) - getCreatedTime(b);
    return 0;
  });

  if (initialLoading) {
    return <LoadingScreen fullScreen={false} message="Carregando painel..." />;
  }

  return (
    <div className="flex flex-col md:grid md:grid-cols-4 gap-6 min-h-[75vh] w-full max-w-7xl mx-auto">
      {/* Mobile Navigation Tabs (Horizontal Scrollable Strip) */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 mb-1 no-scrollbar w-full">
        <button
          type="button"
          onClick={() => setActiveTab("dashboard")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === "dashboard"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" /> Painel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("composer")}
          disabled={!config.connected}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
            activeTab === "composer"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <Plus className="h-3.5 w-3.5" /> Novo Post
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("channels")}
          disabled={!config.connected}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
            activeTab === "channels"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <Share2 className="h-3.5 w-3.5" /> Canais
          {accounts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-secondary/80 font-bold">{accounts.length}</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("inbox")}
          disabled={!config.connected}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
            activeTab === "inbox"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" /> Inbox
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("contacts")}
          disabled={!config.connected}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
            activeTab === "contacts"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Contatos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("automation")}
          disabled={!config.connected}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40 ${
            activeTab === "automation"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <Bot className="h-3.5 w-3.5" /> IA
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === "settings"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <Settings className="h-3.5 w-3.5" /> Ajustes
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("guide")}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
            activeTab === "guide"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border border-border/70"
          }`}
        >
          <HelpCircle className="h-3.5 w-3.5" /> Guia
        </button>
        {isSuperAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveTab("clients")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "clients"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-primary font-semibold hover:text-primary/90 border border-primary/30"
              }`}
            >
              <Users className="h-3.5 w-3.5" /> Clientes
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("saas_plans")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "saas_plans"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-primary font-semibold hover:text-primary/90 border border-primary/30"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" /> Planos (SaaS)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("saas_whitelabel")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "saas_whitelabel"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-primary font-semibold hover:text-primary/90 border border-primary/30"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> White Label
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("saas_mercadopago")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === "saas_mercadopago"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-card text-primary font-semibold hover:text-primary/90 border border-primary/30"
              }`}
            >
              <CreditCard className="h-3.5 w-3.5" /> Mercado Pago
            </button>
          </>
        )}
        <Link to="/planos" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
          <CreditCard className="h-3.5 w-3.5" /> Planos
        </Link>
      </div>

      {/* Desktop Sidebar Navigation */}
      <div className="hidden md:flex md:col-span-1 md:sticky md:top-28 md:self-start md:max-h-[calc(100vh-8rem)] md:overflow-y-auto flex-col space-y-5 border-r border-border/50 pr-4">
        {/* Navigation Group: Principal */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Visão Geral</p>
          <Button
            variant={activeTab === "dashboard" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "dashboard" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <BarChart3 className="h-4 w-4 text-primary" /> Painel Geral
          </Button>
          <Button
            variant={activeTab === "composer" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "composer" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("composer")}
            disabled={!config.connected}
          >
            <Plus className="h-4 w-4 text-primary" /> Novo Post
          </Button>
          <Button
            variant={activeTab === "channels" ? "secondary" : "ghost"}
            className={`justify-between w-full font-medium transition-all ${activeTab === "channels" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("channels")}
            disabled={!config.connected}
          >
            <span className="flex items-center gap-3">
              <Share2 className="h-4 w-4 text-primary" /> Canais
            </span>
            {accounts.length > 0 && (
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-secondary/80 text-foreground font-semibold">
                {accounts.length}
              </span>
            )}
          </Button>
        </div>

        {/* Navigation Group: Comunicação */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Comunicação</p>
          <Button
            variant={activeTab === "inbox" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "inbox" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("inbox")}
            disabled={!config.connected}
          >
            <MessageSquare className="h-4 w-4 text-primary" /> Inbox & DMs
          </Button>
          <Button
            variant={activeTab === "contacts" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "contacts" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("contacts")}
            disabled={!config.connected}
          >
            <Users className="h-4 w-4 text-primary" /> Contatos
          </Button>
        </div>

        {/* Navigation Group: Inteligência & Ajustes */}
        <div className="space-y-1">
          <p className="px-3 text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Automação & Sistema</p>
          <Button
            variant={activeTab === "automation" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "automation" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("automation")}
            disabled={!config.connected}
          >
            <Bot className="h-4 w-4 text-primary" /> Automação IA
          </Button>
          <Button
            variant={activeTab === "settings" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "settings" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("settings")}
          >
            <Settings className="h-4 w-4 text-muted-foreground" /> Configurações
          </Button>
          <Button
            variant={activeTab === "guide" ? "secondary" : "ghost"}
            className={`justify-start gap-3 w-full font-medium transition-all ${activeTab === "guide" ? "font-semibold shadow-2xs" : ""}`}
            onClick={() => setActiveTab("guide")}
          >
            <HelpCircle className="h-4 w-4 text-muted-foreground" /> Guia de Uso
          </Button>
        </div>

        {/* Navigation Group: Super Admin Gestão SaaS */}
        {isSuperAdmin && (
          <div className="space-y-1 pt-1 border-t border-border/40 mt-3">
            <p className="px-3 text-[11px] font-bold text-primary uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Super Admin</span>
              <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-mono font-bold border border-primary/20">SAAS</span>
            </p>
            <Button
              variant={activeTab === "clients" ? "secondary" : "ghost"}
              className={`justify-start gap-3 w-full font-medium transition-all ${
                activeTab === "clients"
                  ? "font-semibold shadow-2xs text-primary bg-primary/10 border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("clients")}
            >
              <Users className="h-4 w-4 text-primary" /> Clientes & Licenças
            </Button>
            <Button
              variant={activeTab === "saas_plans" ? "secondary" : "ghost"}
              className={`justify-start gap-3 w-full font-medium transition-all ${
                activeTab === "saas_plans"
                  ? "font-semibold shadow-2xs text-primary bg-primary/10 border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("saas_plans")}
            >
              <CreditCard className="h-4 w-4 text-primary" /> Planos & Preços
            </Button>
            <Button
              variant={activeTab === "saas_whitelabel" ? "secondary" : "ghost"}
              className={`justify-start gap-3 w-full font-medium transition-all ${
                activeTab === "saas_whitelabel"
                  ? "font-semibold shadow-2xs text-primary bg-primary/10 border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("saas_whitelabel")}
            >
              <Sparkles className="h-4 w-4 text-primary" /> White Label
            </Button>
            <Button
              variant={activeTab === "saas_mercadopago" ? "secondary" : "ghost"}
              className={`justify-start gap-3 w-full font-medium transition-all ${
                activeTab === "saas_mercadopago"
                  ? "font-semibold shadow-2xs text-primary bg-primary/10 border border-primary/20"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("saas_mercadopago")}
            >
              <CreditCard className="h-4 w-4 text-primary" /> Mercado Pago
            </Button>
          </div>
        )}

        {/* Planos CTA Card */}
        <div className="pt-2">
          <Link to="/planos" className="block w-full">
            <div className="p-3.5 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/8 via-primary/4 to-transparent hover:border-primary/45 transition-all group shadow-2xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/15 text-primary group-hover:scale-105 transition-transform">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground">Plano & Limites</p>
                  <p className="text-[11px] text-muted-foreground">Gerencie sua assinatura</p>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* Perfil Ativo Selector Card */}
        {config.connected && profiles.length > 0 && (
          <div className="pt-2 border-t border-border/50">
            <div className="p-3 rounded-2xl border border-border/60 bg-card/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" /> Perfil Ativo
                </Label>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  maxProfiles !== -1 && profiles.length >= maxProfiles
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                    : "bg-primary/10 text-primary border border-primary/20"
                }`}>
                  {profiles.length}/{maxProfiles === -1 ? '∞' : maxProfiles}
                </span>
              </div>

              <select
                value={selectedProfileId}
                onChange={async (e) => {
                  const val = e.target.value;
                  const selectedProf = profiles.find(p => (p._id || p.id) === val);
                  setSelectedProfileId(val);
                  if (selectedProf?.integrationId) {
                    try {
                      await zernio.saveConfig("", val, selectedProf.integrationId);
                      toast.success("Perfil ativo atualizado.");
                      await fetchConfig(false);
                    } catch (err: any) {
                      console.error("Failed to save profile selection:", err);
                    }
                  }
                }}
                className="w-full text-xs font-medium bg-background border border-border/80 rounded-xl p-2 focus:ring-2 focus:ring-primary/20 outline-none cursor-pointer"
              >
                {profiles.map((p, index) => {
                  const pId = p._id || p.id;
                  const pAccounts = accounts.filter(a => a.profileId === pId);
                  const countLabel = pAccounts.length > 0 ? ` (${pAccounts.length}/2 contas)` : '';
                  return (
                    <option key={pId || `profile-${index}`} value={pId || index}>
                      {p.integrationName || p.name}{countLabel}
                    </option>
                  );
                })}
              </select>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted-foreground">
                  Até 2 contas por perfil
                </span>
                <button
                  type="button"
                  onClick={() => setIsNewProfileModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> Novo Perfil
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cache Controls Card */}
        {config.connected && (
          <div className="pt-2 border-t border-border/50 space-y-2">
            <div className="p-3 rounded-2xl border border-border/60 bg-card/60 space-y-2.5">
              <Label className="text-[11px] font-bold text-muted-foreground block uppercase tracking-wider">
                CACHE
              </Label>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <DatabaseZap className="h-3.5 w-3.5 text-primary" /> {cacheStats.memory} em memória
                </span>
                <span>{cacheStats.session} em sessão</span>
              </div>
              <Button
                id="btn-refresh-data"
                variant="outline"
                size="sm"
                className="w-full justify-center gap-1.5 text-xs h-8 rounded-xl"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar Dados
              </Button>
              <button
                id="btn-clear-cache"
                type="button"
                className="w-full text-xs text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5 pt-0.5 transition-colors cursor-pointer"
                onClick={handleClearCache}
              >
                <Trash className="h-3.5 w-3.5" />
                Limpar Cache
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="md:col-span-3 flex flex-col w-full min-w-0">

        {/* Settings Tab (Configurações do Workspace do Cliente) */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* List of Connected Accounts */}
            {config.integrations && config.integrations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DatabaseZap className="h-5 w-5 text-primary" /> Contas Zernio Conectadas
                  </CardTitle>
                  <CardDescription>
                    Gerencie suas múltiplas credenciais da Zernio conectadas a este workspace.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="divide-y divide-border/40">
                    {config.integrations.map((integration) => (
                      <div key={integration.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            {integration.name}
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-medium">Ativo</span>
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            ID do Perfil: {integration.profileId || "Não definido"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingIntegrationId(integration.id);
                              setEditingAccountName(integration.name);
                              setEditingProfileId(integration.profileId || "");
                              setIsEditingAccount(true);
                            }}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteConfig(integration.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit Account Modal / Inline form */}
            {isEditingAccount && editingIntegrationId && (
              <Card className="border-primary/30 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-sm font-bold">Editar Identificação da Conta Zernio</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="editName" className="text-xs">Nome da Conta / Identificador</Label>
                      <Input
                        id="editName"
                        value={editingAccountName}
                        onChange={(e) => setEditingAccountName(e.target.value)}
                        placeholder="ex: Conta Principal, Cliente X"
                        className="bg-card"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="editProfile" className="text-xs">Profile ID (Opcional)</Label>
                      <Input
                        id="editProfile"
                        value={editingProfileId}
                        onChange={(e) => setEditingProfileId(e.target.value)}
                        placeholder="ex: profile-xxxxxxxx"
                        className="bg-card"
                      />
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setIsEditingAccount(false); setEditingIntegrationId(null); }}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleUpdateAccount} disabled={loading}>
                    Salvar Alterações
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Add New Account Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" /> Conectar Nova Conta Zernio
                </CardTitle>
                <CardDescription>
                  Adicione uma nova credencial e chave de API para publicar em canais de outras contas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="newAccountName">Nome Identificador</Label>
                  <Input
                    type="text"
                    id="newAccountName"
                    placeholder="ex: Conta Agência, Cliente Secundário"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="apiKey">Zernio API Key</Label>
                  <Input
                    type="password"
                    id="apiKey"
                    placeholder="Cole sua Zernio API Key aqui"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Obtenha sua chave de API em{" "}
                    <a href="https://zernio.com/dashboard/api-keys" target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      zernio.com/dashboard/api-keys
                    </a>.
                  </p>
                </div>
                <div className="grid w-full items-center gap-1.5">
                  <Label htmlFor="profileId">Zernio Profile ID (Opcional)</Label>
                  <Input
                    type="text"
                    id="profileId"
                    placeholder="ex: profile-xxxxxxxx"
                    value={profileIdInput}
                    onChange={(e) => setProfileIdInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    O ID do perfil padrão de redes sociais configurado nesta conta do Zernio.
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  {config.connected ? (
                    <span className="flex items-center gap-1.5 text-emerald-500 font-medium">
                      <Check className="h-4 w-4" /> {config.integrations?.length} Conta(s) Conectada(s)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                      <AlertCircle className="h-4 w-4" /> Desconectado
                    </span>
                  )}
                </div>
                <Button onClick={saveConfig} disabled={loading}>
                  {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  Conectar Conta
                </Button>
              </CardFooter>
            </Card>

            {config.connected && (
              <Card className="mt-6">
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-amber-500" /> Provedores de IA
                    </CardTitle>
                    <CardDescription>
                      Configure as chaves de API de IA para as automações deste workspace.
                    </CardDescription>
                  </div>
                  {config.integrations && config.integrations.length > 1 && (
                    <div className="flex items-center gap-2 bg-secondary/15 p-1 rounded border">
                      <Label htmlFor="aiIntegrationSelector" className="text-xs shrink-0 pl-1.5 font-medium">Conta Zernio:</Label>
                      <select
                        id="aiIntegrationSelector"
                        value={selectedIntegrationIdForAiKeys}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedIntegrationIdForAiKeys(val);
                          loadAiKeys(val);
                        }}
                        className="text-xs bg-background border rounded px-2 py-1 outline-none font-semibold focus:ring-1 focus:ring-primary"
                      >
                        {config.integrations.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { id: 'gemini', label: 'Google Gemini', hint: 'AIza...', link: 'https://aistudio.google.com/app/apikey', model: 'Gemini 2.0 Flash' },
                    { id: 'openai', label: 'OpenAI', hint: 'sk-...', link: 'https://platform.openai.com/api-keys', model: 'GPT-4o Mini' },
                    { id: 'anthropic', label: 'Anthropic (Claude)', hint: 'sk-ant-...', link: 'https://console.anthropic.com/settings/keys', model: 'Claude 3 Haiku' },
                    { id: 'seekai', label: 'SeekAI', hint: 'sk-...', link: 'https://platafy.com/seekai', model: 'Gateway Multi-modelo (OpenAI Compatible)', referral: true },
                    { id: 'mistral', label: 'Mistral AI', hint: '32+ chars', link: 'https://console.mistral.ai/api-keys/', model: 'Mistral Small' },
                    { id: 'groq', label: 'Groq Cloud', hint: 'gsk_...', link: 'https://console.groq.com/keys', model: 'Llama 3.1 8B' },
                  ].map(({ id, label, hint, link, model, referral }: any) => {
                    const saved = aiKeys[id as keyof typeof aiKeys] === '••••••••';
                    const val = aiKeys[id as keyof typeof aiKeys];
                    return (
                      <div key={id} className="flex items-center gap-3 p-3 border border-border/50 rounded-lg bg-card">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold">{label}</p>
                            {saved && <span className="text-[10px] bg-emerald-500/15 text-emerald-600 px-1.5 py-0.5 rounded font-medium">✓ Conectado</span>}
                          </div>
                          <p className="text-[10px] text-muted-foreground">{model} · Chave começa com {hint}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {!saved ? (
                            <>
                              <Input
                                type="password"
                                placeholder={`Cole sua chave ${label}`}
                                value={val}
                                onChange={(e) => setAiKeys(prev => ({ ...prev, [id]: e.target.value }))}
                                className="text-xs font-mono w-56"
                              />
                              <Button size="sm" onClick={() => saveAiKey(id, val)} disabled={loading || !val}>
                                Salvar
                              </Button>
                              <a href={link} target="_blank" rel="noreferrer" className="text-[10px] text-primary underline whitespace-nowrap">{referral ? 'Criar conta grátis' : 'Obter chave'}</a>
                            </>
                          ) : (
                            <>
                              <Input type="password" value="••••••••" readOnly className="text-xs w-32 opacity-60" />
                              <Button size="sm" variant="outline" onClick={() => setAiKeys(prev => ({ ...prev, [id]: '' }))}>Substituir</Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => removeAiKey(id)} disabled={loading}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
            {config.connected && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-primary">
                    <Bot className="h-5 w-5" /> Configuração de Webhook Automático
                  </CardTitle>
                  <CardDescription>
                    Cadastre a URL receptora deste projeto diretamente no painel do Zernio para receber eventos de novos comentários e mensagens em tempo real.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-secondary/40 border border-primary/10 rounded-md p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">URL Receptora:</p>
                    <code className="block bg-card p-1.5 rounded border text-[10px] break-all select-all">
                      {`${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/zernio-webhook`}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ao clicar no botão abaixo, o sistema fará a requisição para salvar e ativar as configurações de recebimento de webhook no Zernio de forma automática.
                  </p>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={syncWebhook} disabled={loading} className="gap-2">
                    {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                    Sincronizar Webhook
                  </Button>
                </CardFooter>
              </Card>
            )}
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {!config.connected ? (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-center">Primeiros Passos</CardTitle>
                  <CardDescription className="text-center">Você precisa configurar sua chave de API do Zernio para começar.</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-6">
                  <Button onClick={() => setActiveTab("settings")}>Configurar API Key</Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Stats Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Perfis Ativos */}
                  <div className="card-hover p-5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Perfis Ativos</p>
                        <h3 className="text-3xl font-extrabold tracking-tight mt-1">
                          {profiles.length}
                          <span className="text-lg font-normal text-muted-foreground ml-1.5">
                            / {maxProfiles === -1 ? '∞' : maxProfiles}
                          </span>
                        </h3>
                      </div>
                      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20">
                        <Users className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        <span>{accounts.length} {accounts.length === 1 ? 'conta conectada' : 'contas conectadas'}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewProfileModalOpen(true)}
                        className="text-[11px] text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Adicionar
                      </button>
                    </div>
                  </div>

                  {/* Agendados */}
                  <div className="card-hover p-5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agendados</p>
                        <h3 className="text-3xl font-extrabold tracking-tight mt-1">
                          {posts.filter(p => p.status === 'scheduled').length}
                        </h3>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Calendar className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-amber-500" />
                      Postagens na fila de publicação
                    </p>
                  </div>

                  {/* Publicados */}
                  <div className="card-hover p-5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Publicados</p>
                        <h3 className="text-3xl font-extrabold tracking-tight mt-1">
                          {posts.filter(p => p.status === 'published').length}
                        </h3>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                      Disparados com sucesso
                    </p>
                  </div>

                  {/* Comentários */}
                  <div className="card-hover p-5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs shadow-xs flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comentários</p>
                        <h3 className="text-3xl font-extrabold tracking-tight mt-1">{comments.length}</h3>
                      </div>
                      <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-sky-500" />
                      Interações e respostas registradas
                    </p>
                  </div>
                </div>

                {/* Posts List */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Histórico de Postagens</CardTitle>
                      <CardDescription>Acompanhe e gerencie as postagens do seu perfil.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Toggle Format Buttons Group */}
                      <div className="flex items-center border border-border/80 rounded-md p-0.5 bg-secondary/10">
                        <button
                          onClick={() => setPostHistoryView("grid")}
                          className={`p-1.5 rounded-sm transition-all ${postHistoryView === "grid" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                          title="Visualização em Grade"
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPostHistoryView("list")}
                          className={`p-1.5 rounded-sm transition-all ${postHistoryView === "list" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                          title="Visualização em Lista"
                        >
                          <List className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setPostHistoryView("calendar")}
                          className={`p-1.5 rounded-sm transition-all ${postHistoryView === "calendar" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                          title="Visualização em Agenda (Calendário)"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Grid Columns Counter */}
                      {postHistoryView === "grid" && (
                        <div className="flex items-center border border-border/80 rounded-md p-0.5 bg-secondary/10 text-xs">
                          <button
                            onClick={() => setGridColumnsCount(prev => Math.max(1, prev - 1))}
                            disabled={gridColumnsCount <= 1}
                            className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2.5 font-semibold text-stone-600">{gridColumnsCount}</span>
                          <button
                            onClick={() => setGridColumnsCount(prev => Math.min(6, prev + 1))}
                            disabled={gridColumnsCount >= 6}
                            className="p-1.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <Button variant="outline" size="sm" onClick={() => fetchProfileData(selectedProfileId)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Filters Bar */}
                    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between pb-2 border-b border-border/40">
                      {/* Left: Filter dropdowns */}
                      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {/* Source Filter */}
                        <select
                          value={filterSource}
                          onChange={(e) => setFilterSource(e.target.value)}
                          className="text-xs bg-card border border-border/60 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="zernio">Posts do Zernio</option>
                          <option value="external">Posts Externos</option>
                          <option value="all">Todos os posts</option>
                        </select>

                        {/* Status Filter */}
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className="text-xs bg-card border border-border/60 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="all">Todos os status</option>
                          <option value="published">Publicados</option>
                          <option value="scheduled">Agendados</option>
                          <option value="failed">Falhos</option>
                          <option value="draft">Rascunhos</option>
                        </select>

                        {/* Platform Filter */}
                        <select
                          value={filterPlatform}
                          onChange={(e) => setFilterPlatform(e.target.value)}
                          className="text-xs bg-card border border-border/60 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="all">Todas as plataformas</option>
                          <option value="instagram">Instagram</option>
                          <option value="twitter">Twitter/X</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="facebook">Facebook</option>
                          <option value="youtube">YouTube</option>
                          <option value="tiktok">TikTok</option>
                          <option value="whatsapp">WhatsApp</option>
                          <option value="telegram">Telegram</option>
                          <option value="discord">Discord</option>
                          <option value="bluesky">Bluesky</option>
                          <option value="threads">Threads</option>
                          <option value="pinterest">Pinterest</option>
                          <option value="reddit">Reddit</option>
                          <option value="googlebusiness">Google Business</option>
                        </select>

                        {/* Account Filter */}
                        {config.integrations && config.integrations.length > 1 && (
                          <select
                            value={filterAccount}
                            onChange={(e) => setFilterAccount(e.target.value)}
                            className="text-xs bg-card border border-border/60 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none font-semibold text-primary"
                          >
                            <option value="all">Todas as contas Zernio</option>
                            {config.integrations.map((integration) => (
                              <option key={integration.id} value={integration.id}>
                                {integration.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Right: Sort By selection */}
                      <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value)}
                          className="text-xs bg-card border border-border/60 rounded px-2.5 py-1.5 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="scheduled-desc">Agendamento (Mais recente)</option>
                          <option value="scheduled-asc">Agendamento (Mais antigo)</option>
                          <option value="created-desc">Criação (Mais recente)</option>
                          <option value="created-asc">Criação (Mais antigo)</option>
                        </select>
                      </div>
                    </div>

                    {filteredPosts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed rounded-lg bg-secondary/10 border-border/40">
                        <Calendar className="h-10 w-10 text-muted-foreground/60 mb-3 animate-pulse" />
                        <h3 className="font-semibold text-sm text-foreground mb-1">Nenhuma postagem encontrada</h3>
                        <p className="text-xs text-muted-foreground max-w-sm">
                          Não encontramos nenhuma postagem com os filtros aplicados neste perfil. Tente alterar os filtros ou crie um novo agendamento no botão "Novo Post".
                        </p>
                      </div>
                    ) : (
                      postHistoryView === "list" ? (
                        <div className="space-y-3">
                          {filteredPosts.map((post, index) => {
                            const pId = post._id || post.id || `post-${index}`;
                            const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                            const mediaUrl = post.mediaItems?.[0]?.url;
                            const isVideo = mediaUrl && (mediaUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/) || post.mediaItems?.[0]?.type === 'video');
                            const usernameText = post.platforms?.[0]?.accountId?.username || "default";

                            return (
                              <div key={pId} className="border border-border/60 rounded-lg bg-card text-card-foreground shadow-sm flex items-center justify-between p-4 gap-4">
                                {mediaUrl && (
                                  isVideo ? (
                                    <video src={mediaUrl} className="h-12 w-12 object-cover rounded border border-border/50 shrink-0" muted />
                                  ) : (
                                    <img src={mediaUrl} alt="Thumbnail" className="h-12 w-12 object-cover rounded border border-border/50 shrink-0" />
                                  )
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate">{post.content || post.text || "Sem conteúdo"}</p>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                    {post.platforms?.map((p: any, idx: number) => (
                                      <span key={idx} className="inline-flex items-center justify-center p-0.5 rounded bg-secondary/30 border border-border/20">
                                        {getPlatformIcon(p.platform)}
                                      </span>
                                    ))}
                                    <span className="text-[10px] text-muted-foreground">• @{usernameText} • {new Date(postDate).toLocaleString("pt-BR")}{post.integrationName && ` • Conta: ${post.integrationName}`}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  {getStatusBadge(post.status)}
                                  {post.status === 'scheduled' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeletePost(pId)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : postHistoryView === "calendar" ? (
                        (() => {
                          const daysInMonth = 31;
                          const startDayOfWeek = 3;
                          const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
                          const blanks = Array.from({ length: startDayOfWeek }, (_, i) => i);

                          const postsByDay: Record<number, any[]> = {};
                          filteredPosts.forEach(post => {
                            const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                            if (postDate) {
                              const dateObj = new Date(postDate);
                              if (dateObj.getFullYear() === 2026 && dateObj.getMonth() === 6) {
                                const dayNum = dateObj.getDate();
                                if (!postsByDay[dayNum]) postsByDay[dayNum] = [];
                                postsByDay[dayNum].push(post);
                              }
                            }
                          });

                          return (
                            <div className="space-y-4">
                              <div className="text-center py-1 bg-secondary/20 rounded">
                                <h4 className="font-bold text-sm text-foreground">Julho de 2026</h4>
                              </div>

                              <div className="grid grid-cols-7 gap-1.5 text-center text-xs">
                                {["D", "S", "T", "Q", "Q", "S", "S"].map(d => (
                                  <div key={d} className="font-bold text-muted-foreground py-1">{d}</div>
                                ))}

                                {blanks.map(b => (
                                  <div key={`blank-${b}`} className="aspect-square bg-secondary/5 rounded border border-dashed border-border/10"></div>
                                ))}

                                {days.map(day => {
                                  const dayPosts = postsByDay[day] || [];
                                  const hasPosts = dayPosts.length > 0;
                                  return (
                                    <div
                                      key={`day-${day}`}
                                      className={`aspect-square p-1.5 border rounded-lg flex flex-col justify-between items-start cursor-pointer hover:bg-secondary/40 transition-colors ${hasPosts ? 'bg-secondary/15 border-primary/25' : 'border-border/30 bg-card'}`}
                                    >
                                      <span className={`text-[10px] font-semibold ${hasPosts ? 'text-primary font-bold' : 'text-muted-foreground'}`}>{day}</span>
                                      <div className="flex gap-0.5 flex-wrap w-full overflow-hidden max-h-[14px]">
                                        {dayPosts.map((p, idx) => (
                                          <span key={idx} className="scale-[0.7] -m-0.5 origin-center">
                                            {getPlatformIcon(p.platforms?.[0]?.platform || p.platform)}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              <div className="pt-2">
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Postagens deste mês (Julho 2026)</p>
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                                  {filteredPosts.filter(post => {
                                    const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                                    if (!postDate) return false;
                                    const dateObj = new Date(postDate);
                                    return dateObj.getFullYear() === 2026 && dateObj.getMonth() === 6;
                                  }).map((post, idx) => {
                                    const pId = post._id || post.id || `post-${idx}`;
                                    const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                                    return (
                                      <div key={pId} className="p-2 border rounded bg-secondary/5 flex items-center justify-between text-xs">
                                        <div className="min-w-0 flex-1 flex items-center gap-2">
                                          <span className="font-bold text-primary">{new Date(postDate).getDate()} de jul</span>
                                          <p className="truncate font-medium text-foreground/80">{post.content || post.text || "Sem conteúdo"}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {post.platforms?.map((p: any, idx2: number) => (
                                            <span key={idx2} className="scale-[0.8]">{getPlatformIcon(p.platform)}</span>
                                          ))}
                                          {getStatusBadge(post.status)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div
                          className="grid gap-4"
                          style={{
                            gridTemplateColumns: `repeat(${gridColumnsCount}, minmax(0, 1fr))`
                          }}
                        >
                          {filteredPosts.map((post, index) => {
                            const pId = post._id || post.id || `post-${index}`;
                            const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                            const mediaUrl = sanitizeMediaUrls(post.mediaItems?.[0]?.url);
                            const isVideo = mediaUrl && (mediaUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)/) || post.mediaItems?.[0]?.type === 'video');
                            const usernameText = post.platforms?.[0]?.accountId?.username || "default";

                            return (
                              <div key={pId} className="border border-border/60 rounded-lg bg-card text-card-foreground shadow-sm flex flex-col overflow-hidden">
                                <div className="p-4 flex gap-4 items-start justify-between flex-1">
                                  <div className="space-y-3 min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground break-words line-clamp-3">
                                      {post.content || post.text || "Sem conteúdo"}
                                    </p>

                                    <div className="flex flex-wrap gap-1.5">
                                      {post.platforms?.map((p: any, idx: number) => (
                                        <span key={idx} className="inline-flex items-center justify-center p-1 rounded bg-secondary/50 border border-border/40">
                                          {getPlatformIcon(p.platform)}
                                        </span>
                                      ))}
                                    </div>

                                    {postDate && (
                                      <p className="text-xs text-muted-foreground text-capitalize">
                                        {new Date(postDate).toLocaleString("pt-BR", {
                                          day: "2-digit",
                                          month: "short",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          timeZoneName: "short"
                                        })}
                                      </p>
                                    )}

                                    <p className="text-[10px] text-muted-foreground/75 truncate">
                                      @{usernameText} • {post.integrationName || 'Conta Principal'} • {pId.substring(0, 8)}...
                                    </p>
                                  </div>

                                  {mediaUrl && (
                                    isVideo ? (
                                      <video
                                        src={mediaUrl}
                                        className="h-16 w-16 object-cover rounded border border-border/50 shrink-0"
                                        muted
                                      />
                                    ) : (
                                      <img
                                        src={mediaUrl}
                                        alt="Thumbnail"
                                        className="h-16 w-16 object-cover rounded border border-border/50 shrink-0"
                                      />
                                    )
                                  )}
                                </div>

                                <div className="border-t border-border/40 px-4 py-2.5 bg-secondary/15 flex items-center justify-between">
                                  {getStatusBadge(post.status)}

                                  {post.status === 'scheduled' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeletePost(pId)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Composer Tab */}
        {activeTab === "composer" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Criar Nova Postagem</CardTitle>
                <CardDescription>Envie conteúdos de forma cruzada para múltiplas redes simultaneamente.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Select Channels */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold text-xs text-foreground uppercase tracking-wider">Selecionar Canais de Destino</Label>
                    <span className="text-[11px] text-muted-foreground">
                      {selectedAccounts.length} de {accounts.length} selecionado(s)
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {accounts.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Nenhum canal conectado. Conecte um canal nas configurações.</p>
                    ) : (
                      accounts.map((acc, index) => {
                        const accId = acc._id || acc.id || `account-${index}`;
                        const isSelected = selectedAccounts.includes(accId);
                        return (
                          <button
                            key={accId}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setSelectedAccounts(selectedAccounts.filter(id => id !== accId));
                              } else {
                                setSelectedAccounts([...selectedAccounts, accId]);
                              }
                            }}
                            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                              isSelected
                                ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]"
                                : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-secondary/40"
                            }`}
                          >
                            <span className="shrink-0">{getPlatformIcon(acc.platform, isSelected)}</span>
                            <span>{acc.username || acc.displayName}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 ml-0.5 shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {selectedAccounts.some(accId => accounts.find(a => (a._id || a.id) === accId)?.platform === "youtube") && (
                  <div className="p-4 border rounded-lg bg-red-500/5 border-red-500/20 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-600">
                      {getPlatformIcon("youtube")} Configurações do YouTube
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="youtubeTitle">Título do Vídeo *</Label>
                      <Input
                        id="youtubeTitle"
                        placeholder="Digite o título do vídeo para o YouTube"
                        value={youtubeTitle}
                        onChange={(e) => setYoutubeTitle(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="isYoutubeShort"
                        checked={isYoutubeShort}
                        onChange={(e) => setIsYoutubeShort(e.target.checked)}
                        className="rounded border bg-card shrink-0 accent-red-600 cursor-pointer"
                      />
                      <Label htmlFor="isYoutubeShort" className="text-xs cursor-pointer select-none">Publicar como YouTube Short?</Label>
                    </div>
                    {!mediaUrl && (
                      <p className="text-xs text-amber-600 font-medium">⚠️ O YouTube requer um arquivo de vídeo para publicação.</p>
                    )}
                  </div>
                )}

                {/* Text */}
                <div className="space-y-1.5">
                  <Label htmlFor="postText">Legenda / Texto</Label>
                  <textarea
                    id="postText"
                    rows={4}
                    className="w-full rounded border bg-card p-3 text-sm outline-none focus:ring-1 focus:ring-primary"
                    placeholder="O que você quer compartilhar hoje?"
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                  />
                </div>

                {/* Media URL and File Upload */}
                <div className="space-y-3 p-4 border rounded-lg bg-secondary/10">
                  <Label>Mídia do Post (Imagem ou Vídeo)</Label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="mediaUrl" className="text-xs text-muted-foreground">URL Direta</Label>
                      <Input
                        id="mediaUrl"
                        type="url"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5 flex flex-col justify-end">
                      <Label className="text-xs text-muted-foreground mb-1.5">Ou fazer upload no Storage</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*,video/*"
                          className="hidden"
                          id="media-upload-input"
                          onChange={handleUploadFile}
                          disabled={uploading}
                        />
                        <Label
                          htmlFor="media-upload-input"
                          className="flex items-center justify-center gap-2 px-4 py-2 border rounded-md cursor-pointer hover:bg-secondary/45 transition-colors text-sm w-full text-center"
                        >
                          <Upload className="h-4 w-4" />
                          {uploading ? "Enviando..." : "Escolher arquivo"}
                        </Label>
                      </div>
                    </div>
                  </div>

                  {mediaUrl && (
                    <div className="mt-2 text-xs flex items-center justify-between p-2 rounded bg-muted/65">
                      <span className="truncate text-muted-foreground">Mídia selecionada: <a href={mediaUrl} target="_blank" rel="noreferrer" className="underline text-foreground">{mediaUrl}</a></span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive" onClick={() => setMediaUrl("")}>Remover</Button>
                    </div>
                  )}
                </div>

                {/* Schedule */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="schedule">Agendar para (Opcional)</Label>
                    <Input
                      id="schedule"
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="firstComment">Primeiro Comentário Automatizado</Label>
                    <Input
                      id="firstComment"
                      type="text"
                      placeholder="Adicionar hashtags ou primeiro comentário"
                      value={firstComment}
                      onChange={(e) => setFirstComment(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-3 border-t pt-4">
                <Button variant="ghost" onClick={() => setActiveTab("dashboard")}>Cancelar</Button>
                <Button onClick={handleCreatePost} disabled={loading}>
                  {loading && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                  {scheduleDate ? "Agendar Post" : "Publicar Agora"}
                </Button>
              </CardFooter>
            </Card>

            {/* Live Preview Mockup Card */}
            <div className="lg:col-span-1 border border-border/70 rounded-2xl bg-card/80 backdrop-blur-xs shadow-xs overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/15">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pré-visualização</h4>
                </div>
                <span className="text-[10px] text-muted-foreground bg-card border border-border/60 rounded-md px-2 py-0.5">Feed Mockup</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="border border-border/70 rounded-2xl bg-card shadow-sm p-4 space-y-3.5">
                  {/* Header Mockup */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs text-primary">
                        {selectedAccounts.length > 0 && accounts.find(a => (a._id || a.id) === selectedAccounts[0])
                          ? (accounts.find(a => (a._id || a.id) === selectedAccounts[0])?.username?.[0]?.toUpperCase() || "P")
                          : "P"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">
                          {selectedAccounts.length > 0 && accounts.find(a => (a._id || a.id) === selectedAccounts[0])
                            ? accounts.find(a => (a._id || a.id) === selectedAccounts[0])?.username
                            : "seu_perfil"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Agora mesmo • Público</p>
                      </div>
                    </div>
                    <span className="text-muted-foreground/60 text-xs font-bold">•••</span>
                  </div>

                  {/* Caption */}
                  <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap break-words min-h-[36px]">
                    {postText || <span className="text-muted-foreground/50 italic text-xs">Digite a legenda para ver uma prévia realista aqui...</span>}
                  </p>

                  {/* Image/Video Preview */}
                  {mediaUrl ? (
                    <div className="rounded-xl border border-border/50 overflow-hidden bg-black/5 aspect-video flex items-center justify-center shadow-inner">
                      {mediaUrl.toLowerCase().endsWith('.mp4') ? (
                        <video src={mediaUrl} className="w-full h-full object-cover" controls />
                      ) : (
                        <img src={mediaUrl} alt="Preview" className="w-full h-full object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border-2 border-dashed border-border/60 aspect-video flex flex-col items-center justify-center bg-secondary/15 text-muted-foreground/50 text-[11px] gap-1">
                      <Upload className="h-5 w-5 opacity-40" />
                      <span>Nenhuma mídia anexada</span>
                    </div>
                  )}

                  {/* Social Feed Actions Bar */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <button type="button" className="hover:text-red-500 transition-colors">
                        <Heart className="h-4 w-4" />
                      </button>
                      <button type="button" className="hover:text-primary transition-colors">
                        <MessageCircle className="h-4 w-4" />
                      </button>
                      <button type="button" className="hover:text-primary transition-colors">
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>
                    <button type="button" className="hover:text-primary transition-colors">
                      <Bookmark className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Simulated platform targets */}
                  <div className="pt-2.5 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="font-semibold">Redes Destino:</span>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {selectedAccounts.length > 0 ? (
                        selectedAccounts.map((accId, i) => {
                          const acc = accounts.find(a => (a._id || a.id) === accId);
                          return acc ? (
                            <span key={i} className="p-1 border border-border/70 rounded-md bg-secondary/40" title={acc.username}>
                              {getPlatformIcon(acc.platform)}
                            </span>
                          ) : null;
                        })
                      ) : (
                        <span className="italic text-muted-foreground/60">Nenhum canal ativo</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Channels Tab */}
        {activeTab === "channels" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-primary" />
                      Canais Sociais Conectados
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Visualizando contas do perfil selecionado. Cada Perfil Ativo permite conectar até <strong>2 contas gratuitas</strong> pelo Zernio.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Franquia: {profiles.length} / {maxProfiles === -1 ? '∞' : maxProfiles} Perfis Ativos
                    </span>
                    <Button
                      size="sm"
                      onClick={() => setIsNewProfileModalOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Novo Perfil
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-border/60 bg-secondary/10">
                    <Share2 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                    <h4 className="font-semibold text-sm">Nenhum canal conectado</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Conecte suas contas sociais na plataforma Zernio para começar a publicar e monitorar mensagens.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {accounts.map((acc, index) => (
                      <div key={acc._id || acc.id || `account-${index}`} className="card-hover p-4.5 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-xs flex items-center gap-3.5 shadow-2xs">
                        <div className="p-2.5 border border-border/60 rounded-xl bg-secondary/35 shrink-0">
                          {getPlatformIcon(acc.platform)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate text-foreground">{acc.displayName || acc.username}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-xs text-muted-foreground truncate">@{acc.username}</p>
                            {acc.integrationName && (
                              <span className="text-[10px] text-primary font-semibold bg-primary/10 border border-primary/15 rounded px-1.5 py-0.2 shrink-0">
                                {acc.integrationName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Ativo
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Inbox Tab */}
        {activeTab === "inbox" && (
          <div className="grid grid-cols-1 md:grid-cols-3 h-[calc(100vh-13rem)] min-h-[600px] max-h-[860px] border border-border/60 rounded-2xl overflow-hidden bg-card shadow-xs">
            {/* List */}
            <div className="md:col-span-1 border-r border-border/50 flex flex-col h-full min-h-0 bg-card">
              <div className="p-4 border-b border-border/40 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg tracking-tight text-foreground">Mensagens</h3>
                  <button className="text-muted-foreground hover:text-foreground">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Search & Filters */}
                <div className="space-y-2">
                  <div className="flex gap-1.5 flex-wrap">
                    <div className="relative">
                      <button
                        onClick={() => setIsInboxPlatformDropdownOpen(!isInboxPlatformDropdownOpen)}
                        className="flex items-center gap-1.5 border border-border/60 rounded px-2.5 py-1 text-[10px] text-muted-foreground bg-secondary/15 outline-none cursor-pointer hover:bg-secondary/30 transition-all h-[24px]"
                      >
                        <span className="flex-shrink-0 flex items-center">
                          {platformFilter === "all" ? <LayoutGrid size={11} className="text-muted-foreground" /> : getPlatformIcon(platformFilter)}
                        </span>
                        <span className="font-medium text-foreground">
                          {platformFilter === "all" ? "Plataformas" : (platformFilter === "twitter" ? "Twitter / X" : platformFilter === "googlebusiness" ? "Google Business" : platformFilter.charAt(0).toUpperCase() + platformFilter.slice(1))}
                        </span>
                        <span className="text-[7px] text-muted-foreground ml-0.5">▼</span>
                      </button>

                      {isInboxPlatformDropdownOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsInboxPlatformDropdownOpen(false)}
                          />
                          <div className="absolute left-0 mt-1 w-[145px] bg-card border border-border/60 rounded-md shadow-md z-50 py-1 overflow-hidden">
                            {[
                              { val: "all", label: "Plataformas", icon: <LayoutGrid size={11} className="text-muted-foreground" /> },
                              { val: "instagram", label: "Instagram", icon: getPlatformIcon("instagram") },
                              { val: "facebook", label: "Facebook", icon: getPlatformIcon("facebook") },
                              { val: "twitter", label: "Twitter / X", icon: getPlatformIcon("twitter") },
                              { val: "bluesky", label: "Bluesky", icon: getPlatformIcon("bluesky") },
                              { val: "whatsapp", label: "WhatsApp", icon: getPlatformIcon("whatsapp") },
                              { val: "telegram", label: "Telegram", icon: getPlatformIcon("telegram") },
                              { val: "linkedin", label: "LinkedIn", icon: getPlatformIcon("linkedin") },
                              { val: "youtube", label: "YouTube", icon: getPlatformIcon("youtube") }
                            ].map((opt) => (
                              <button
                                key={opt.val}
                                onClick={() => {
                                  setPlatformFilter(opt.val);
                                  setAccountFilter("all");
                                  setIsInboxPlatformDropdownOpen(false);
                                }}
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-[10px] text-left hover:bg-secondary/40 transition-colors ${platformFilter === opt.val ? "bg-primary/10 font-bold text-primary" : "text-muted-foreground"}`}
                              >
                                <span className="flex-shrink-0 flex items-center">{opt.icon}</span>
                                <span>{opt.label}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    <select
                      value={readFilter}
                      onChange={(e) => setReadFilter(e.target.value as "all" | "read" | "unread")}
                      className="border border-border/60 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground bg-secondary/15 outline-none cursor-pointer focus:border-primary/50"
                    >
                      <option value="all">Status</option>
                      <option value="unread">Não lidas</option>
                      <option value="read">Lidas</option>
                    </select>

                    <select
                      value={selectedProfileId || ""}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setSelectedProfileId(val);
                        try {
                          await zernio.saveConfig("", val);
                          toast.success("Perfil ativo atualizado.");
                        } catch (err: any) {
                          console.error("Failed to save profile selection:", err);
                        }
                      }}
                      className="border border-border/60 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground bg-secondary/15 outline-none cursor-pointer font-medium focus:border-primary/50"
                    >
                      <option value="">Perfis</option>
                      {profiles.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>{p.name}</option>
                      ))}
                    </select>

                    {config.integrations && config.integrations.length > 1 && (
                      <select
                        value={inboxAccountFilter}
                        onChange={(e) => {
                          setInboxAccountFilter(e.target.value);
                          setAccountFilter("all");
                        }}
                        className="border border-border/60 rounded px-1.5 py-0.5 text-[10px] text-primary bg-secondary/15 outline-none cursor-pointer font-bold focus:border-primary/50"
                      >
                        <option value="all">Todas as Contas</option>
                        {config.integrations.map((i) => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    )}

                    <select
                      value={accountFilter}
                      onChange={(e) => setAccountFilter(e.target.value)}
                      className="border border-border/60 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground bg-secondary/15 outline-none cursor-pointer focus:border-primary/50"
                    >
                      <option value="all">Canais</option>
                      {accounts
                        .filter(acc => (platformFilter === "all" || acc.platform === platformFilter) && (inboxAccountFilter === "all" || acc.integrationId === inboxAccountFilter))
                        .map(acc => (
                          <option key={acc._id || acc.id} value={acc._id || acc.id}>@{acc.username || acc.displayName}</option>
                        ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                      placeholder="Pesquisar mensagens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 h-8.5 text-xs bg-secondary/10 border-border/50 focus-visible:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="flex gap-1.5 p-1 bg-secondary/50 rounded-md border border-border/20">
                  <button
                    onClick={() => setInboxType("dms")}
                    className={`flex-1 text-[11px] font-medium py-1 px-2 rounded-sm transition-all ${inboxType === "dms" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Mensagens / DMs
                  </button>
                  <button
                    onClick={() => setInboxType("comments")}
                    className={`flex-1 text-[11px] font-medium py-1 px-2 rounded-sm transition-all ${inboxType === "comments" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    Comentários
                  </button>
                </div>

                {/* Sub-header: Conversations + Newest first */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-foreground/80">Conversas</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as any)}
                    className="border border-border/60 rounded px-1.5 py-0.5 text-[9px] text-muted-foreground bg-secondary/15 outline-none cursor-pointer focus:border-primary/50"
                  >
                    <option value="newest">Mais recentes</option>
                    <option value="oldest">Mais antigos</option>
                  </select>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-border/40">
                {inboxType === "dms" ? (
                  conversations
                    .filter(conv => {
                      // Platform filter
                      if (platformFilter !== "all" && conv.platform !== platformFilter) return false;
                      // Account filter
                      if (accountFilter !== "all" && (conv.accountId !== accountFilter && conv.socialAccountId !== accountFilter)) return false;
                      // Integration filter
                      if (inboxAccountFilter !== "all" && conv.integrationId !== inboxAccountFilter) return false;
                      // Read filter
                      if (readFilter === "unread" && !conv.unread && !conv.hasUnread && conv.unreadCount === 0) return false;
                      if (readFilter === "read" && (conv.unread || conv.hasUnread || conv.unreadCount > 0)) return false;
                      // Search query filter
                      if (searchQuery) {
                        const term = searchQuery.toLowerCase();
                        const pName = (conv.participantName || conv.contactName || "").toLowerCase();
                        const lMsg = (conv.lastMessage || conv.lastMessageText || "").toLowerCase();
                        return pName.includes(term) || lMsg.includes(term);
                      }
                      return true;
                    })
                    .sort((a, b) => {
                      const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
                      const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
                      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
                    })
                    .length === 0 ? (
                    <p className="text-center py-8 text-xs text-muted-foreground">Nenhuma conversa recente.</p>
                  ) : (
                    conversations
                      .filter(conv => {
                        if (platformFilter !== "all" && conv.platform !== platformFilter) return false;
                        if (accountFilter !== "all" && (conv.accountId !== accountFilter && conv.socialAccountId !== accountFilter)) return false;
                        if (inboxAccountFilter !== "all" && conv.integrationId !== inboxAccountFilter) return false;
                        if (readFilter === "unread" && !conv.unread && !conv.hasUnread && conv.unreadCount === 0) return false;
                        if (readFilter === "read" && (conv.unread || conv.hasUnread || conv.unreadCount > 0)) return false;
                        if (searchQuery) {
                          const term = searchQuery.toLowerCase();
                          const pName = (conv.participantName || conv.contactName || "").toLowerCase();
                          const lMsg = (conv.lastMessage || conv.lastMessageText || "").toLowerCase();
                          return pName.includes(term) || lMsg.includes(term);
                        }
                        return true;
                      })
                      .sort((a, b) => {
                        const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
                        const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
                        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
                      })
                      .map((conv, index) => {
                        const cId = conv._id || conv.id || conv.conversationId || conv.conversation_id || conv.threadId || `conv-${index}`;
                        const activeId = activeChat?._id || activeChat?.id || activeChat?.conversationId || activeChat?.conversation_id || activeChat?.threadId;
                        const isActive = activeId === cId;
                        const initial = (conv.participantName || conv.contactName || (conv.participant?.name) || "C").charAt(0).toUpperCase();
                        const platform = conv.platform || "instagram";
                        const timeStr = formatConvTime(conv.updatedAt || conv.updated_at || conv.createdAt || conv.created_at);

                        return (
                          <button
                            key={cId}
                            onClick={() => handleSelectChat(conv)}
                            className={`w-full p-3.5 text-left flex items-start gap-3 transition-colors hover:bg-secondary/40 border-b border-border/30 ${isActive ? "bg-secondary border-l-2 border-primary" : ""}`}
                          >
                            <div className="relative flex-shrink-0">
                              <div className="h-10 w-10 rounded-full bg-stone-100 border border-stone-200/60 flex items-center justify-center font-semibold text-stone-500 text-sm shadow-sm">
                                {initial}
                              </div>
                              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-stone-100">
                                {getPlatformIcon(platform)}
                              </div>
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-baseline justify-between">
                                <p className="text-xs font-bold text-foreground/95 truncate">
                                  {conv.participantName || conv.contactName || "Contato"}
                                  {conv.accountUsername && (
                                    <span className="text-[9px] font-normal text-muted-foreground ml-1.5">
                                      via @{conv.accountUsername}
                                    </span>
                                  )}
                                  {conv.integrationName && (
                                    <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded ml-1.5">
                                      {conv.integrationName}
                                    </span>
                                  )}
                                </p>
                                {timeStr && (
                                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">{timeStr}</span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground truncate leading-tight">
                                {getConversationLastMessage(conv)}
                              </p>
                            </div>
                          </button>
                        );
                      })
                  )
                ) : (
                  comments
                    .filter(post => {
                      if (platformFilter !== "all" && post.platform !== platformFilter) return false;
                      if (accountFilter !== "all" && post.accountId !== accountFilter) return false;
                      if (inboxAccountFilter !== "all" && post.integrationId !== inboxAccountFilter) return false;
                      if (searchQuery) {
                        const term = searchQuery.toLowerCase();
                        const caption = (post.content || post.text || post.caption || "").toLowerCase();
                        const handle = (post.accountUsername || "").toLowerCase();
                        return caption.includes(term) || handle.includes(term);
                      }
                      const count = post.commentCount ?? post.comment_count ?? post.commentsCount ?? post.comments_count ?? 0;
                      return count > 0 || post.platform === 'youtube';
                    })
                    .sort((a, b) => {
                      const dateA = new Date(a.createdTime || a.created_time || a.createdAt || a.created_at || 0).getTime();
                      const dateB = new Date(b.createdTime || b.created_time || b.createdAt || b.created_at || 0).getTime();
                      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
                    })
                    .length === 0 ? (
                    <p className="text-center py-8 text-xs text-muted-foreground">Nenhum comentário recente.</p>
                  ) : (
                    comments
                      .filter(post => {
                        if (platformFilter !== "all" && post.platform !== platformFilter) return false;
                        if (accountFilter !== "all" && post.accountId !== accountFilter) return false;
                        if (inboxAccountFilter !== "all" && post.integrationId !== inboxAccountFilter) return false;
                        if (searchQuery) {
                          const term = searchQuery.toLowerCase();
                          const caption = (post.content || post.text || post.caption || "").toLowerCase();
                          const handle = (post.accountUsername || "").toLowerCase();
                          return caption.includes(term) || handle.includes(term);
                        }
                        const count = post.commentCount ?? post.comment_count ?? post.commentsCount ?? post.comments_count ?? 0;
                        return count > 0 || post.platform === 'youtube';
                      })
                      .sort((a, b) => {
                        const dateA = new Date(a.createdTime || a.created_time || a.createdAt || a.created_at || 0).getTime();
                        const dateB = new Date(b.createdTime || b.created_time || b.createdAt || b.created_at || 0).getTime();
                        return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
                      })
                      .map((post, index) => {
                        const pId = post._id || post.id || `post-${index}`;
                        const isActive = (selectedCommentPost?._id || selectedCommentPost?.id) === pId;
                        const commentCount = post.commentCount ?? post.comment_count ?? post.commentsCount ?? post.comments_count ?? 0;
                        const postCaption = post.content || post.text || post.caption || post.message || "Sem legenda";
                        const postDate = post.createdTime || post.created_time || post.createdAt || post.created_at;
                        const postPicture = post.picture || post.thumbnail;

                        return (
                          <button
                            key={pId}
                            onClick={() => handleSelectCommentPost(post)}
                            className={`w-full p-4 text-left flex items-start gap-3 transition-colors hover:bg-secondary/40 ${isActive ? "bg-secondary border-l-2 border-primary" : ""}`}
                          >
                            {postPicture ? (
                              <div className="h-12 w-12 rounded overflow-hidden bg-secondary/50 flex-shrink-0">
                                <img src={postPicture} alt="Preview" className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded bg-secondary/30 flex items-center justify-center flex-shrink-0 text-muted-foreground text-[10px] font-bold">
                                Z
                              </div>
                            )}

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="flex-shrink-0 flex items-center">
                                  {getPlatformIcon(post.platform)}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-semibold truncate">@{post.accountUsername || post.username}</span>
                                {post.integrationName && (
                                  <span className="text-[8px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded flex-shrink-0">
                                    {post.integrationName}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-foreground font-medium truncate">{postCaption}</p>
                              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                <span>{commentCount} {commentCount === 1 ? 'comentário' : 'comentários'}</span>
                                {postDate && (
                                  <span>{new Date(postDate).toLocaleDateString("pt-BR")}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                  )
                )}
              </div>
            </div>

            {/* Content Window */}
            <div className="md:col-span-2 flex flex-col h-full min-h-0 bg-card/40">
              {inboxType === "dms" ? (
                activeChat ? (
                  <>
                    {/* Active Header */}
                    <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-card/80">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                          {(activeChat.participantName || activeChat.contactName || "C").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{activeChat.participantName || activeChat.contactName || "Contato"}</h4>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Conversa Ativa
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {chatMessages.map((msg, i) => {
                        const isMe = msg.direction === 'outgoing';
                        return (
                          <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`px-4 py-2.5 text-sm max-w-[75%] leading-relaxed ${isMe ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-xs shadow-xs' : 'bg-secondary/60 text-foreground border border-border/50 rounded-2xl rounded-bl-xs shadow-2xs'}`}>
                              <div className="break-words">{getMessageText(msg)}</div>
                              {msg.createdAt && (
                                <div className={`text-[10px] mt-1 text-right leading-none ${isMe ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                                  {new Date(msg.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Send Input */}
                    <div className="p-4 border-t border-border/40 flex gap-2">
                      <Input
                        placeholder="Escreva sua resposta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <Button onClick={handleSendMessage} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 mb-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="font-semibold text-sm">Nenhuma conversa selecionada</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">Selecione uma conversa ao lado para visualizar e enviar respostas diretas.</p>
                  </div>
                )
              ) : (
                selectedCommentPost ? (
                  <>
                    {/* Active Header */}
                    <div className="p-3.5 border-b border-border/50 flex items-center justify-between bg-card/80">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-primary" />
                          <h4 className="font-bold text-xs text-foreground">Postagem de @{selectedCommentPost.accountUsername}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[420px]">{selectedCommentPost.content || "Sem legenda"}</p>
                      </div>
                    </div>

                    {/* Comments Area */}
                    <div className="flex-1 p-4 overflow-y-auto space-y-4">
                      {postComments.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Nenhum comentário neste post.</p>
                      ) : (
                        postComments.map((comment, i) => {
                          const commentFrom = comment.from || comment.sender || comment.author || {};
                          const isMe = commentFrom.isOwner || commentFrom.is_owner;
                          const authorName = commentFrom.name || commentFrom.username || "Autor";
                          const commentText = comment.message || comment.text || comment.content;
                          const commentDate = comment.createdTime || comment.created_time || comment.createdAt || comment.created_at;
                          return (
                            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                              <div className={`px-4 py-2.5 text-sm max-w-[75%] leading-relaxed ${isMe ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-xs shadow-xs' : 'bg-secondary/60 text-foreground border border-border/50 rounded-2xl rounded-bl-xs shadow-2xs'}`}>
                                <div className="text-[10px] font-semibold mb-0.5 text-muted-foreground">
                                  {authorName}
                                </div>
                                <div className="break-words text-xs">{commentText}</div>

                                {!isMe && (
                                  <div className="flex gap-2.5 mt-1.5 pt-1 border-t border-border/10 text-[9px] text-muted-foreground">
                                    <button
                                      onClick={() => {
                                        console.log("Clicked Responder button for comment:", comment);
                                        setReplyingToComment(comment);
                                        setIsDmPrivateReply(false);
                                        setTimeout(() => commentInputRef.current?.focus(), 50);
                                      }}
                                      className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                                    >
                                      <CornerUpLeft className="h-2.5 w-2.5" /> Responder
                                    </button>
                                    <button
                                      onClick={() => {
                                        console.log("Clicked DM button for comment:", comment);
                                        setReplyingToComment(comment);
                                        setIsDmPrivateReply(true);
                                        setTimeout(() => commentInputRef.current?.focus(), 50);
                                      }}
                                      className="flex items-center gap-0.5 hover:text-foreground transition-colors"
                                    >
                                      <Mail className="h-2.5 w-2.5" /> DM
                                    </button>
                                  </div>
                                )}

                                {commentDate && (
                                  <div className={`text-[10px] mt-1 text-right leading-none ${isMe ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
                                    {new Date(commentDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Replying context banner */}
                    {replyingToComment && (
                      <div className="flex items-center justify-between px-4 py-2 bg-secondary/50 border-t border-border/40 text-xs">
                        <span className="text-muted-foreground">
                          {isDmPrivateReply ? "Enviando DM privada para" : "Respondendo a"} <span className="font-semibold text-foreground">@{replyingToComment.from?.username || replyingToComment.from?.name || "Autor"}</span>
                        </span>
                        <button
                          onClick={() => {
                            setReplyingToComment(null);
                            setIsDmPrivateReply(false);
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    {/* Send Input */}
                    <div className="p-4 border-t border-border/40 flex gap-2">
                      <Input
                        ref={commentInputRef}
                        placeholder={replyingToComment ? (isDmPrivateReply ? "Enviar DM privada..." : "Escreva uma resposta ao comentário...") : "Responder ao post..."}
                        value={commentReplyText}
                        onChange={(e) => setCommentReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendCommentReply()}
                      />
                      <Button onClick={handleSendCommentReply} size="icon">
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="p-4 rounded-2xl bg-secondary/30 border border-border/50 mb-3">
                      <MessageSquare className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h4 className="font-semibold text-sm">Nenhuma postagem selecionada</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs">Selecione uma postagem ao lado para gerenciar comentários e respostas.</p>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* Contacts Tab */}
        {activeTab === "contacts" && (
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-primary mb-1">
                      <Users className="h-6 w-6" />
                      <CardTitle className="text-xl">Contatos</CardTitle>
                    </div>
                    <CardDescription>
                      Gerencie todos os contatos das suas redes sociais. Clique em um contato para ver detalhes ou abrir uma conversa no inbox.
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchContacts(1, contactsSearch, contactsTagFilter, true)}
                    disabled={loadingContacts}
                    className="gap-2 h-8 text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingContacts ? 'animate-spin' : ''}`} />
                    {loadingContacts ? 'Sincronizando...' : 'Sincronizar'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters bar */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      id="contacts-search"
                      placeholder="Buscar por nome, email ou username..."
                      value={contactsSearch}
                      onChange={e => setContactsSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') fetchContacts(1, contactsSearch, contactsTagFilter, false); }}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Input
                    id="contacts-tag-filter"
                    placeholder="Filtrar por tag..."
                    value={contactsTagFilter}
                    onChange={e => setContactsTagFilter(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') fetchContacts(1, contactsSearch, contactsTagFilter, false); }}
                    className="h-9 text-sm sm:w-44"
                  />
                  <Button size="sm" onClick={() => fetchContacts(1, contactsSearch, contactsTagFilter, false)} className="h-9 text-xs gap-1.5">
                    <Search className="h-3.5 w-3.5" /> Buscar
                  </Button>
                </div>

                {/* Loading state */}
                {loadingContacts && contacts.length === 0 && (
                  <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Carregando contatos...
                  </div>
                )}

                {/* Empty state */}
                {!loadingContacts && contacts.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-8 w-8 text-primary/60" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Nenhum contato encontrado</p>
                      <p className="text-xs text-muted-foreground mt-1">Clique em "Sincronizar" para buscar seus contatos da API Zernio.</p>
                    </div>
                    <Button onClick={() => fetchContacts(1, '', '', true)} variant="outline" size="sm" className="gap-2">
                      <RefreshCw className="h-3.5 w-3.5" /> Sincronizar agora
                    </Button>
                  </div>
                )}

                {/* Contacts grid */}
                {contacts.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {contacts.map((contact: any, idx: number) => {
                      const contactId = contact._id || contact.id;
                      const platforms: string[] = contact.platforms || (contact.channels || []).map((ch: any) => ch.platform || ch.type).filter(Boolean);
                      const initials = (contact.name || contact.displayName || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                      const tags: string[] = contact.tags || [];
                      return (
                        <button
                          key={contactId || idx}
                          id={`contact-card-${contactId || idx}`}
                          onClick={() => handleOpenContactChannels(contact)}
                          className="flex items-start gap-3 p-3.5 rounded-lg border border-border/60 bg-card hover:bg-secondary/30 hover:border-primary/40 text-left transition-all group w-full"
                        >
                          {/* Avatar */}
                          <div className="shrink-0">
                            {contact.avatarUrl || contact.picture ? (
                              <img
                                src={contact.avatarUrl || contact.picture}
                                alt={contact.name || 'avatar'}
                                className="w-10 h-10 rounded-full object-cover border border-border/40"
                                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center text-primary text-sm font-bold border border-primary/20">
                                {initials}
                              </div>
                            )}
                          </div>
                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {contact.name || contact.displayName || 'Sem nome'}
                            </p>
                            {contact.email && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <Mail className="h-3 w-3 shrink-0" />{contact.email}
                              </p>
                            )}
                            {contact.phone && (
                              <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3 shrink-0" />{contact.phone}
                              </p>
                            )}
                            {/* Platform chips */}
                            {platforms.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {platforms.slice(0, 3).map((p: string) => (
                                  <span key={p} className="inline-flex items-center text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground uppercase font-medium tracking-wider">
                                    {p}
                                  </span>
                                ))}
                                {platforms.length > 3 && (
                                  <span className="text-[9px] text-muted-foreground">+{platforms.length - 3}</span>
                                )}
                              </div>
                            )}
                            {/* Tags */}
                            {tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tags.slice(0, 2).map((t: string) => (
                                  <span key={t} className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    <Tag className="h-2 w-2" />{t}
                                  </span>
                                ))}
                                {tags.length > 2 && <span className="text-[9px] text-muted-foreground">+{tags.length - 2}</span>}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Pagination */}
                {contactsTotal > CONTACTS_PER_PAGE && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contactsPage <= 1 || loadingContacts}
                      onClick={() => fetchContacts(contactsPage - 1, contactsSearch, contactsTagFilter)}
                      className="gap-1.5 h-8 text-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {contactsPage} de {Math.ceil(contactsTotal / CONTACTS_PER_PAGE)} · {contactsTotal} contatos
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={contactsPage >= Math.ceil(contactsTotal / CONTACTS_PER_PAGE) || loadingContacts}
                      onClick={() => fetchContacts(contactsPage + 1, contactsSearch, contactsTagFilter)}
                      className="gap-1.5 h-8 text-xs"
                    >
                      Próxima <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Contact Detail Drawer/Modal */}
        {selectedContact && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-center bg-black/50 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setSelectedContact(null); }}
          >
            <div className="bg-card border border-border/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in duration-300">
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-border/40 sticky top-0 bg-card z-10">
                <h3 className="font-bold text-base">Detalhes do Contato</h3>
                <button
                  onClick={() => setSelectedContact(null)}
                  className="p-1.5 rounded-full hover:bg-secondary/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-5">
                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                  {selectedContact.avatarUrl || selectedContact.picture ? (
                    <img
                      src={selectedContact.avatarUrl || selectedContact.picture}
                      alt={selectedContact.name}
                      className="w-16 h-16 rounded-full object-cover border-2 border-primary/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary/20 flex items-center justify-center text-primary text-xl font-bold">
                      {(selectedContact.name || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-bold text-foreground">{selectedContact.name || selectedContact.displayName || 'Sem nome'}</p>
                    {selectedContact.username && (
                      <p className="text-sm text-muted-foreground">@{selectedContact.username}</p>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2">
                  {selectedContact.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>{selectedContact.email}</span>
                    </div>
                  )}
                  {selectedContact.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 shrink-0 text-primary/60" />
                      <span>{selectedContact.phone}</span>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {(selectedContact.tags || []).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5" /> Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedContact.tags || []).map((t: string) => (
                        <span key={t} className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Channels */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Canais Vinculados
                  </p>
                  {loadingChannels ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Carregando canais...
                    </div>
                  ) : contactChannels.length > 0 ? (
                    <div className="space-y-1.5">
                      {contactChannels.map((ch: any, i: number) => (
                        <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                          <div className="shrink-0">{getPlatformIcon(ch.platform || ch.type)}</div>
                          <div>
                            <p className="text-xs font-semibold capitalize">{ch.platform || ch.type}</p>
                            {ch.username && <p className="text-[10px] text-muted-foreground">@{ch.username}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-1">Nenhum canal vinculado encontrado.</p>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 border-t border-border/40 flex gap-2 sticky bottom-0 bg-card">
                <Button
                  id="contact-open-dm-btn"
                  className="flex-1 gap-2"
                  onClick={() => handleOpenConversationFromContact(selectedContact)}
                >
                  <MessageSquare className="h-4 w-4" /> Abrir DM / Conversa
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedContact(null)}
                  className="shrink-0"
                >
                  Fechar
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Automation Tab */}
        {activeTab === "automation" && (

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 text-primary">
                  <Bot className="h-6 w-6" />
                  <CardTitle className="text-xl">Automação Inteligente com IA</CardTitle>
                </div>
                <CardDescription>
                  Configure respostas automáticas alimentadas por modelos de linguagem (Gemini, OpenAI, Claude) ou respostas estáticas para comentários e DMs recebidos em seus canais sociais.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Account / Channel selector */}
                <div className="space-y-2">
                  <Label className="font-semibold text-sm">Selecione o Canal Social</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {accounts.map((acc, index) => {
                      const accId = acc._id || acc.id;
                      const isSelected = selectedAutomationAccount === accId;
                      const platformLower = (acc.platform || "").toLowerCase();
                      const isSupported = platformLower === "instagram" || platformLower === "facebook" || platformLower === "youtube";
                      const isTiktok = platformLower === "tiktok";

                      return (
                        <button
                          key={accId || index}
                          onClick={() => {
                            if (isSupported) {
                              setSelectedAutomationAccount(accId);
                              if (platformLower === "youtube") {
                                setAutomationType("comment_reply");
                              }
                            }
                          }}
                          disabled={!isSupported}
                          title={isTiktok ? "TikTok não suportado: a API do Zernio não possui endpoint de resposta para comentários TikTok" : undefined}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${!isSupported
                            ? "opacity-45 cursor-not-allowed border-border/40 bg-secondary/5 text-muted-foreground/60"
                            : isSelected
                              ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary"
                              : "border-border/60 bg-card hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                            }`}
                        >
                          <div className="shrink-0 scale-110">
                            {getPlatformIcon(acc.platform)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-semibold truncate capitalize text-foreground">
                                {acc.platform}
                              </p>
                              {(!isSupported || isTiktok) && (
                                <span className="text-[8px] px-1 py-0.5 bg-muted text-muted-foreground/80 rounded uppercase font-semibold scale-90 origin-right">
                                  {isTiktok ? "Indisponível" : "Manual"}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              @{acc.username || acc.displayName || "sem-nome"}{acc.integrationName && ` (${acc.integrationName})`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>


                {selectedAutomationAccount ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

                    {/* Left Column: Created Automations list */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="border border-border/40 rounded-lg p-4 bg-card space-y-3">
                        <h4 className="font-bold text-xs text-muted-foreground uppercase tracking-wider">Automações Criadas</h4>
                        {automations.filter(a => a.social_account_id === selectedAutomationAccount).length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-6">Nenhuma automação criada neste canal.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {automations.filter(a => a.social_account_id === selectedAutomationAccount).map((rule, idx) => {
                              const typeLabels: Record<string, string> = {
                                comment_reply: "Responder Comentário",
                                dm_reply: "Responder DM/Mensagem",
                                comment_to_dm: "Comentário → DM"
                              };
                              const accountObj = accounts.find(a => (a._id || a.id) === rule.social_account_id);
                              return (
                                <div
                                  key={rule.id || idx}
                                  onClick={() => {
                                    setAutomationType(rule.automation_type);
                                    setIsAutomationEnabled(rule.is_enabled);
                                    setAutomationTriggerType(rule.trigger_type);
                                    setAutomationKeywords(rule.keywords ? rule.keywords.join(", ") : "");
                                    setAutomationAiProvider(rule.ai_provider);
                                    setAutomationAiPrompt(rule.ai_prompt || "");
                                    setAutomationStaticReply(rule.static_reply || "");
                                    setAutomationTargetPostsType(rule.target_posts_type || "all");
                                    setAutomationTargetPostIds(rule.target_post_ids || []);
                                  }}
                                  className={`p-3 border rounded-lg cursor-pointer hover:bg-secondary/40 transition-all text-left flex items-start justify-between gap-2.5 ${automationType === rule.automation_type ? 'bg-secondary/30 border-primary' : 'border-border/30 bg-secondary/5'}`}
                                >
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[10px] font-bold text-foreground">
                                        {typeLabels[rule.automation_type] || rule.automation_type}
                                      </span>
                                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${rule.is_enabled ? 'bg-emerald-500/10 text-emerald-500' : 'bg-stone-500/10 text-stone-500'}`}>
                                        {rule.is_enabled ? 'Ativo' : 'Pausado'}
                                      </span>
                                    </div>
                                    <p className="text-[9px] text-muted-foreground truncate">
                                      Gatilho: {rule.trigger_type === 'all' ? 'Todos' : `Palavras [${rule.keywords?.join(', ')}]`}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground truncate">
                                      Provedor: <span className="font-semibold text-primary/80 uppercase text-[8px]">{rule.ai_provider}</span>
                                    </p>
                                    {accountObj?.integrationName && (
                                      <p className="text-[9px] text-primary/95 font-semibold truncate mt-0.5">
                                        Conta: {accountObj.integrationName}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAutomationRule(rule.id);
                                    }}
                                    className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0 mt-0.5"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Column: Form builder */}
                    <div className="lg:col-span-2 border border-border/40 rounded-lg p-5 bg-secondary/15 space-y-6">

                      <div className="flex items-center justify-between border-b border-border/40 pb-3">
                        <h3 className="font-bold text-sm text-foreground">
                          {editingAutomationId ? "Editar Automação" : "Nova Automação"}
                        </h3>
                        {editingAutomationId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAutomationId(null);
                              setIsAutomationEnabled(true);
                              setAutomationTriggerType("all");
                              setAutomationKeywords("");
                              setAutomationAiProvider("static");
                              setAutomationAiPrompt("");
                              setAutomationStaticReply("");
                              setAutomationTargetPostsType("all");
                              setAutomationTargetPostIds([]);
                            }}
                            className="text-xs text-primary hover:underline font-semibold"
                          >
                            + Criar Nova Automação
                          </button>
                        )}
                      </div>

                      {/* Automation Type Select tab buttons */}
                      <div className="space-y-2">
                        <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">Tipo de Interação</Label>
                        {(() => {
                          const selectedAcc = accounts.find(a => (a._id || a.id) === selectedAutomationAccount);
                          const selectedPlatform = (selectedAcc?.platform || "").toLowerCase();
                          const isCommentsOnly = selectedPlatform === "youtube" || selectedPlatform === "tiktok";

                          return (
                            <div className="flex gap-2 p-1 bg-secondary/50 rounded-md border border-border/20 max-w-md">
                              <button
                                type="button"
                                onClick={() => setAutomationType("comment_reply")}
                                className={`flex-1 text-[11px] font-medium py-1.5 px-3 rounded transition-all ${automationType === "comment_reply" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                              >
                                Responder Comentário
                              </button>
                              <button
                                type="button"
                                disabled={isCommentsOnly}
                                onClick={() => setAutomationType("dm_reply")}
                                className={`flex-1 text-[11px] font-medium py-1.5 px-3 rounded transition-all ${isCommentsOnly ? "opacity-35 cursor-not-allowed text-muted-foreground/60" : automationType === "dm_reply" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                                title={isCommentsOnly ? "Não suportado para YouTube/TikTok" : ""}
                              >
                                Responder DM
                              </button>
                              <button
                                type="button"
                                disabled={isCommentsOnly}
                                onClick={() => setAutomationType("comment_to_dm")}
                                className={`flex-1 text-[11px] font-medium py-1.5 px-3 rounded transition-all ${isCommentsOnly ? "opacity-35 cursor-not-allowed text-muted-foreground/60" : automationType === "comment_to_dm" ? "bg-card text-foreground shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                                title={isCommentsOnly ? "Não suportado para YouTube/TikTok" : ""}
                              >
                                Comentário → DM
                              </button>
                            </div>
                          );
                        })()}
                        <p className="text-[10px] text-muted-foreground">
                          {automationType === "comment_reply" && "Quando um usuário comentar, a IA ou resposta estática responderá no mesmo comentário."}
                          {automationType === "dm_reply" && "Quando um usuário enviar uma DM privada, a automação responderá na conversa direta."}
                          {automationType === "comment_to_dm" && "Quando um usuário comentar, a automação enviará uma DM privada diretamente ao usuário."}
                        </p>
                      </div>

                      {/* Enable Toggle */}
                      <div className="flex items-center justify-between border-b border-border/40 pb-4">
                        <div>
                          <Label htmlFor="autoEnabled" className="font-semibold text-sm block">Status da Automação</Label>
                          <span className="text-xs text-muted-foreground">Ative ou pause esta regra a qualquer momento.</span>
                        </div>
                        <select
                          id="autoEnabled"
                          value={isAutomationEnabled ? "true" : "false"}
                          onChange={(e) => setIsAutomationEnabled(e.target.value === "true")}
                          className="text-xs bg-card border rounded p-1.5 focus:ring-1 focus:ring-primary outline-none"
                        >
                          <option value="true">Habilitado (Ativo)</option>
                          <option value="false">Desativado (Pausado)</option>
                        </select>
                      </div>

                      {/* Trigger Mode */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-border/40">
                        <div className="space-y-1.5">
                          <Label htmlFor="autoTrigger" className="font-semibold text-sm">Gatilho de Disparo</Label>
                          <select
                            id="autoTrigger"
                            value={automationTriggerType}
                            onChange={(e) => setAutomationTriggerType(e.target.value as any)}
                            className="w-full text-sm bg-card border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                          >
                            <option value="all">Todas as mensagens/comentários</option>
                            <option value="keyword">Por palavra-chave específica</option>
                          </select>
                        </div>

                        {automationTriggerType === "keyword" && (
                          <div className="space-y-1.5">
                            <Label htmlFor="autoKeywords" className="font-semibold text-sm">Palavras-chave Gatilho</Label>
                            <Input
                              id="autoKeywords"
                              placeholder="ex: quero, preco, valor, link"
                              value={automationKeywords}
                              onChange={(e) => setAutomationKeywords(e.target.value)}
                              className="bg-card text-sm"
                            />
                            <span className="text-[10px] text-muted-foreground block">Separe por vírgulas. A automação disparará se o texto contiver qualquer termo.</span>
                          </div>
                        )}
                      </div>

                      {/* AI Provider Config */}
                      <div className="space-y-4 pb-4 border-b border-border/40">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="autoProvider" className="font-semibold text-sm">Provedor de Resposta (IA)</Label>
                            <select
                              id="autoProvider"
                              value={automationAiProvider}
                              onChange={(e) => setAutomationAiProvider(e.target.value as any)}
                              className="w-full text-sm bg-card border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                            >
                              <option value="static">Texto Estático (Personalizado)</option>
                              <option value="gemini">Google Gemini AI</option>
                              <option value="openai">OpenAI (GPT-4o)</option>
                              <option value="anthropic">Anthropic (Claude)</option>
                              <option value="seekai">SeekAI (Multi-modelo)</option>
                              <option value="mistral">Mistral AI</option>
                              <option value="groq">Groq Cloud (Llama)</option>
                            </select>
                          </div>
                        </div>

                        {automationAiProvider === "static" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="staticReply" className="font-semibold text-sm">Mensagem Estática</Label>
                            <textarea
                              id="staticReply"
                              rows={3}
                              placeholder="Escreva a resposta padrão que será enviada..."
                              value={automationStaticReply}
                              onChange={(e) => setAutomationStaticReply(e.target.value)}
                              className="w-full text-sm bg-card border rounded p-2.5 outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="bg-secondary/40 border border-primary/10 rounded-md p-3 text-xs text-muted-foreground flex gap-2 items-start">
                              <Sparkles className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                              <span>
                                As chaves de API de IA são configuradas uma única vez na aba{" "}
                                <button onClick={() => setActiveTab("settings")} className="underline font-semibold text-foreground hover:text-primary">Configurações → Provedores de IA</button>.
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="aiPrompt" className="font-semibold text-sm">Prompt / Instrução para a IA</Label>
                              <textarea
                                id="aiPrompt"
                                rows={4}
                                placeholder="ex: Aja como suporte da marca X. Seja amigável, responda de forma muito curta e forneça o link www.exemplo.com."
                                value={automationAiPrompt}
                                onChange={(e) => setAutomationAiPrompt(e.target.value)}
                                className="w-full text-sm bg-card border rounded p-2.5 outline-none focus:ring-1 focus:ring-primary"
                              />
                              <span className="text-[10px] text-muted-foreground block">Guie o comportamento da IA ao criar a resposta.</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Target Posts selection */}
                      {automationType !== "dm_reply" && (
                        <div className="space-y-3">
                          <Label className="font-semibold text-sm block">Filtrar por Postagens</Label>
                          <select
                            value={automationTargetPostsType}
                            onChange={(e) => setAutomationTargetPostsType(e.target.value as any)}
                            className="text-xs bg-card border rounded p-2 focus:ring-1 focus:ring-primary outline-none"
                          >
                            <option value="all">Todas as postagens da conta</option>
                            <option value="specific">Apenas em postagens específicas selecionadas</option>
                          </select>

                          {automationTargetPostsType === "specific" && (
                            <div className="border border-border/40 rounded-md bg-card p-3 max-h-[220px] overflow-y-auto space-y-2">
                              {loadingAutomationPosts ? (
                                <p className="text-xs text-muted-foreground text-center py-4 flex items-center justify-center gap-2">
                                  <RefreshCw className="h-3 w-3 animate-spin" /> Carregando postagens...
                                </p>
                              ) : automationPosts.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma postagem no histórico.</p>
                              ) : (
                                automationPosts.map((post, idx) => {
                                  const pId = post._id || post.id || `post-${idx}`;
                                  const isChecked = automationTargetPostIds.includes(pId);
                                  const thumbUrl = post.mediaItems?.[0]?.url || post.mediaItems?.[0]?.thumbnailUrl || post.thumbnailUrl || '';
                                  const postDate = post.scheduledFor || post.scheduledAt || post.publishedAt || post.createdAt;
                                  const postText = post.content || post.text || '';
                                  return (
                                    <label key={pId} className={`flex items-center gap-2.5 text-xs text-foreground cursor-pointer p-2 rounded-lg transition-all border ${isChecked ? 'border-primary/50 bg-primary/5' : 'border-transparent hover:bg-secondary/40'}`}>
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setAutomationTargetPostIds(prev => prev.filter(id => id !== pId));
                                          } else {
                                            setAutomationTargetPostIds(prev => [...prev, pId]);
                                          }
                                        }}
                                        className="shrink-0 accent-primary"
                                      />
                                      {/* Thumbnail */}
                                      <div className="shrink-0 h-12 w-12 rounded overflow-hidden border border-border/40 bg-secondary/20 flex items-center justify-center">
                                        {thumbUrl ? (
                                          <img src={thumbUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                        ) : (
                                          <span className="text-lg select-none">🖼️</span>
                                        )}
                                      </div>
                                      {/* Info */}
                                      <div className="min-w-0 flex-1">
                                        <p className="font-semibold truncate leading-snug">{postText || 'Sem legenda'}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {post.platforms?.slice(0, 3).map((p: any, i: number) => (
                                            <span key={i} className="inline-flex items-center justify-center p-0.5 rounded bg-secondary/40 border border-border/20">
                                              {getPlatformIcon(p.platform)}
                                            </span>
                                          ))}
                                          {postDate && (
                                            <span className="text-[9px] text-muted-foreground">
                                              {new Date(postDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })}
                                            </span>
                                          )}
                                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${post.status === 'published' ? 'bg-emerald-500/15 text-emerald-600' : post.status === 'scheduled' ? 'bg-blue-500/15 text-blue-600' : 'bg-secondary/40 text-muted-foreground'}`}>
                                            {post.status || 'externo'}
                                          </span>
                                        </div>
                                      </div>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions bar */}
                      <div className="flex justify-end pt-2">
                        <Button onClick={saveAutomationRule} disabled={loading} className="gap-2">
                          {loading && <RefreshCw className="h-4 w-4 animate-spin" />}
                          Salvar Automação
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-lg bg-secondary/5">
                    Selecione um canal social acima para configurar ou editar as automações de IA.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Automation Logs History */}
            <Card className="mt-6 border border-border/40 bg-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border/30">
                <div className="space-y-1">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Clock className="h-4 w-4 text-primary" /> Histórico de Disparos de Automação
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Monitore em tempo real as respostas geradas para comentários e DMs nas redes sociais.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAutomationLogs}
                    disabled={loadingLogs || automationLogs.length === 0}
                    className="gap-2 h-7 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash className="h-3 w-3" />
                    Limpar Logs
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAutomationLogs}
                    disabled={loadingLogs}
                    className="gap-2 h-7 text-xs border-border/60 hover:bg-secondary/40"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                    Atualizar Logs
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4 px-0 pb-0">
                {loadingLogs && automationLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8 flex items-center justify-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Carregando histórico de automação...
                  </p>
                ) : automationLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma execução de automação registrada ainda.
                  </p>
                ) : (() => {
                  const totalPages = Math.ceil(automationLogs.length / logsPerPage) || 1;
                  const paginatedLogs = automationLogs.slice((logsPage - 1) * logsPerPage, logsPage * logsPerPage);
                  return (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-border/30 bg-secondary/20 text-muted-foreground font-semibold">
                              <th className="p-3">Data</th>
                              <th className="p-3">Rede</th>
                              <th className="p-3">Entrada (Comentário/DM)</th>
                              <th className="p-3">Saída (Resposta IA/Estática)</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Ação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedLogs.map((log) => {
                              const dateStr = new Date(log.created_at).toLocaleString('pt-BR');
                              const textIn = log.content || '—';
                              const textOut = log.reply_sent || '—';

                              let statusBadge = null;
                              if (log.status === 'success') {
                                statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-500">Sucesso</span>;
                              } else if (log.status === 'failed') {
                                statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-destructive/10 text-destructive" title={log.error_message || ''}>Falhou</span>;
                              } else if (log.status === 'ignored') {
                                statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-stone-500/10 text-stone-500" title={log.error_message || ''}>Ignorado</span>;
                              } else {
                                statusBadge = <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-500" title={log.error_message || ''}>Sem Regra</span>;
                              }

                              return (
                                <tr key={log.id} className="border-b border-border/20 hover:bg-secondary/15 transition-colors">
                                  <td className="p-3 whitespace-nowrap text-muted-foreground">{dateStr}</td>
                                  <td className="p-3 whitespace-nowrap align-middle">
                                    <span className="inline-flex items-center gap-1.5 font-medium capitalize">
                                      {getPlatformIcon(log.platform)} {log.platform}
                                    </span>
                                  </td>
                                  <td className="p-3 max-w-[200px] truncate" title={textIn}>{textIn}</td>
                                  <td className="p-3 max-w-[250px] truncate text-primary font-medium" title={textOut}>{textOut}</td>
                                  <td className="p-3 whitespace-nowrap">{statusBadge}</td>
                                  <td className="p-3 text-right">
                                    {(log.status === 'failed' || log.status === 'no_automation') && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRetryAutomation(log.id)}
                                        className="h-6 text-[10px] border-primary/40 hover:bg-primary/5 hover:text-primary transition-all font-semibold"
                                      >
                                        Retentar
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between p-4 border-t border-border/20 text-xs bg-secondary/5 rounded-b-lg">
                        <div className="text-muted-foreground">
                          Mostrando {Math.min((logsPage - 1) * logsPerPage + 1, automationLogs.length)} a {Math.min(logsPage * logsPerPage, automationLogs.length)} de {automationLogs.length} logs
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            disabled={logsPage === 1}
                            onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                          >
                            Anterior
                          </Button>
                          <span className="font-medium">Página {logsPage} de {totalPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2"
                            disabled={logsPage === totalPages}
                            onClick={() => setLogsPage(prev => Math.min(prev + 1, totalPages))}
                          >
                            Próxima
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Guia de Uso Tab */}
        {activeTab === "guide" && (
          <div className="space-y-6">
            <div className="flex flex-col space-y-2">
              <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                <HelpCircle className="h-8 w-8 text-primary" /> Guia de Uso & Configuração
              </h2>
              <p className="text-muted-foreground">
                Aprenda a integrar e extrair o máximo poder do Zernio Hub para automatizar e gerenciar suas redes sociais.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Quick Start Card */}
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" /> Fluxo de Configuração Rápida
                  </CardTitle>
                  <CardDescription>Siga estes passos para configurar sua conta e começar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="relative border-l-2 border-primary/20 pl-6 space-y-6 ml-2">
                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">1</span>
                      <h4 className="font-semibold text-sm">Crie sua Conta no Zernio</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Acesse <a href="https://zernio.com/signup" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">zernio.com/signup</a> e crie a sua conta para começar.
                      </p>
                      {/* Vídeo Tutorial Dinâmico (White Label) */}
                      {(() => {
                        const embedInfo = getEmbedVideoInfo(tutorialVideoUrl);
                        return (
                          <div
                            onClick={() => setVideoModalOpen(true)}
                            className="mt-3 max-w-md rounded-lg overflow-hidden border border-border bg-secondary/20 relative group cursor-pointer aspect-video flex items-center justify-center shadow-xs"
                          >
                            {embedInfo?.thumbnailUrl ? (
                              <img
                                src={embedInfo.thumbnailUrl}
                                alt="Tutorial thumbnail"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : embedInfo ? (
                              <div className="w-full h-full bg-stone-900 flex flex-col items-center justify-center text-center p-4">
                                <span className="text-xs font-semibold text-white/90">Vídeo Tutorial</span>
                                <span className="text-[10px] text-white/60 mt-1 uppercase tracking-wider">{embedInfo.type}</span>
                              </div>
                            ) : (
                              <video className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-300">
                                <source src={`${tutorialVideoUrl}#t=1`} type="video/mp4" />
                              </video>
                            )}

                            <div className="absolute inset-0 bg-black/25 group-hover:bg-black/45 transition-colors flex items-center justify-center">
                              <div className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                                <span className="text-white text-base ml-1">▶</span>
                              </div>
                            </div>
                            <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[9px] text-white px-2 py-0.5 rounded font-semibold">
                              Assistir tutorial {tutorialVideoUrl === "/criar-conta.mp4" ? "(0:30)" : ""}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">2</span>
                      <h4 className="font-semibold text-sm">Configure as Chaves no Painel</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Acesse a aba <strong>Configurações &gt; Conectar Nova Conta Zernio</strong> no menu lateral, cole sua chave de API e dê um Nome Identificador para a conta. Você pode adicionar <strong>múltiplas contas/API Keys</strong> para gerenciar canais de diferentes clientes ou workspaces.
                      </p>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">3</span>
                      <h4 className="font-semibold text-sm">Conecte seus Canais Sociais</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Cada canal adicionado será automaticamente mapeado à respectiva conta Zernio. Nas abas de postagem, mensagens e automações, o sistema utilizará de forma totalmente transparente e segura a chave de API correspondente a cada canal.
                      </p>
                    </div>

                    <div className="relative">
                      <span className="absolute -left-[31px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">4</span>
                      <h4 className="font-semibold text-sm">Ative Webhooks & Automações</h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Para habilitar as respostas automáticas usando Inteligência Artificial, configure suas chaves do OpenAI, Gemini ou Claude nas <strong>Configurações</strong> e crie regras personalizadas na aba <strong>Automação IA</strong>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* API Capabilities Card */}
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DatabaseZap className="h-5 w-5 text-primary" /> Recursos Suportados
                  </CardTitle>
                  <CardDescription>O que você pode fazer com o Zernio API.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold">Publicação Multicanal</h5>
                      <p className="text-muted-foreground mt-0.5">Agende ou publique posts simultaneamente em várias redes sociais.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold">Caixa de Entrada Unificada</h5>
                      <p className="text-muted-foreground mt-0.5">Receba e responda DMs do Instagram, Facebook e WhatsApp em tempo real.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold">Moderação de Comentários</h5>
                      <p className="text-muted-foreground mt-0.5">Gerencie e responda a comentários de posts orgânicos e anúncios (Meta Ads).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2 rounded-lg bg-secondary/30">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold">Automação IA Híbrida</h5>
                      <p className="text-muted-foreground mt-0.5">Combine respostas estáticas ou dinâmicas processadas por LLMs.</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Developer Guide / Webhook configuration info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-indigo-500" /> Detalhes Técnicos de Integração
                </CardTitle>
                <CardDescription>Informações avançadas sobre Webhooks e fluxos da API.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Gatilho de Webhooks</h4>
                  <p className="text-xs text-muted-foreground">
                    Os webhooks enviam payloads estruturados em JSON para sua URL configurada sempre que ocorre um evento. Certifique-se de validar os eventos correspondentes:
                  </p>
                  <div className="bg-muted p-3 rounded-lg border font-mono text-[11px] overflow-x-auto space-y-1">
                    <div><span className="text-primary font-bold">comment.received</span>: Disparado ao receber novos comentários em posts/anúncios.</div>
                    <div><span className="text-primary font-bold">message.received</span>: Disparado ao receber novas DMs/mensagens.</div>
                    <div><span className="text-primary font-bold">post.published</span>: Confirmação de publicação com sucesso nas redes.</div>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="font-semibold text-sm">Estrutura das Automações</h4>
                  <p className="text-xs text-muted-foreground">
                    As automações de IA funcionam respondendo aos eventos acima recebidos via webhook, processando o contexto com o provedor de IA cadastrado (Gemini, GPT, etc.) e chamando os endpoints da API da Zernio para enviar a resposta privada ou pública.
                  </p>
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 text-xs text-amber-600 dark:text-amber-500 flex gap-2 items-start mt-3">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Importante:</strong> A funcionalidade de responder a DMs de forma automática funciona para canais do <strong>Facebook</strong> e <strong>Instagram</strong>. A resposta automática a comentários suporta <strong>Facebook</strong>, <strong>Instagram</strong> e <strong>YouTube</strong>.
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t border-border/40 mt-4 space-y-2">
                  <h4 className="font-semibold text-sm">Limites de Uso (Rate Limits)</h4>
                  <p className="text-xs text-muted-foreground">
                    Os limites de requisições da API da Zernio variam conforme o número total de contas sociais integradas ao perfil:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-2.5 rounded bg-secondary/20 border border-border/20">
                      <span className="font-semibold block text-foreground">0–2 contas (Free tier)</span>
                      <span className="text-muted-foreground">60 requisições/minuto</span>
                    </div>
                    <div className="p-2.5 rounded bg-secondary/20 border border-border/20">
                      <span className="font-semibold block text-foreground">3–2.000 contas</span>
                      <span className="text-muted-foreground">600 requisições/minuto</span>
                    </div>
                    <div className="p-2.5 rounded bg-secondary/20 border border-border/20">
                      <span className="font-semibold block text-foreground">2.001+ contas</span>
                      <span className="text-muted-foreground">1.200 requisições/minuto</span>
                    </div>
                    <div className="p-2.5 rounded bg-secondary/20 border border-border/20">
                      <span className="font-semibold block text-foreground">AppSumo legado</span>
                      <span className="text-muted-foreground">600 requisições/minuto (fixo)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Super Admin Clientes Tab */}
        {activeTab === "clients" && isSuperAdmin && (
          <SuperAdminClients />
        )}

        {/* Super Admin White Label Tab */}
        {activeTab === "saas_whitelabel" && isSuperAdmin && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-primary" />
                    Personalização White Label
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                    <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Personalize a marca, logotipo, favicon e cores padrão da plataforma exibidas para todos os seus clientes.
                </p>
              </div>

              {/* Botões de Navegação Rápida entre Abas do Super Admin */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("clients")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Clientes & Licenças
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("saas_plans")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Planos & Preços
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("saas_mercadopago")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Mercado Pago
                </Button>
              </div>
            </div>

            <WhiteLabelSettings />
          </div>
        )}

        {/* Super Admin Mercado Pago SaaS Tab */}
        {activeTab === "saas_mercadopago" && isSuperAdmin && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <CreditCard className="w-6 h-6 text-primary" />
                    Configuração do Mercado Pago
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/25">
                    <ShieldCheck className="w-3.5 h-3.5" /> Super Admin
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configuração global das credenciais de pagamento e webhook para cobrança das assinaturas dos clientes na plataforma.
                </p>
              </div>

              {/* Botões de Navegação Rápida entre Abas do Super Admin */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("clients")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <Users className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Clientes & Licenças
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("saas_plans")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <CreditCard className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  Planos & Preços
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("saas_whitelabel")}
                  className="text-xs border-border hover:bg-muted text-foreground"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                  White Label
                </Button>
              </div>
            </div>

            <MercadoPagoSettings />
          </div>
        )}

        {/* Super Admin Planos & Preços Tab */}
        {activeTab === "saas_plans" && isSuperAdmin && (
          <div className="space-y-6 animate-fade-in">
            <SuperAdminPlans />
          </div>
        )}
      </div>

      {/* Modal Adicionar Novo Perfil / Bloqueio de Limite */}
      {isNewProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            {maxProfiles !== -1 && profiles.length >= maxProfiles ? (
              /* Estado: Limite Atingido */
              <div className="space-y-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30">
                  <Lock className="w-7 h-7" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-foreground">Limite de Perfis Atingido</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Seu plano atual permite até <strong>{maxProfiles} {maxProfiles === 1 ? 'Perfil Ativo' : 'Perfis Ativos'}</strong> ({maxProfiles * 2} contas sociais no total). Você já atingiu a franquia contratada de <strong>{profiles.length}/{maxProfiles}</strong> perfis.
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-xs text-muted-foreground text-left space-y-1.5">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> Quer expandir seu alcance?
                  </p>
                  <p>
                    Faça upgrade para um plano superior (como o Plano <strong>Pro</strong> com até 5 perfis ou <strong>Agência</strong> com perfis ilimitados) para criar novos perfis e conectar mais contas.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsNewProfileModalOpen(false)}
                    className="flex-1 rounded-xl"
                  >
                    Fechar
                  </Button>
                  <Link to="/planos" className="flex-1" onClick={() => setIsNewProfileModalOpen(false)}>
                    <Button className="w-full rounded-xl bg-primary font-bold shadow-xs">
                      <Sparkles className="w-4 h-4 mr-1.5" /> Fazer Upgrade
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              /* Estado: Formulário de Criação */
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (!newProfileName.trim()) {
                  toast.error("Informe o nome do perfil.");
                  return;
                }
                if (maxProfiles !== -1 && profiles.length >= maxProfiles) {
                  toast.error(`Limite de Perfis Ativos atingido (${profiles.length}/${maxProfiles}). Faça upgrade do plano.`);
                  return;
                }
                setCreatingProfile(true);
                try {
                  const integrationToUse = newProfileIntegrationId || config.integrations?.[0]?.id;
                  const created = await zernio.createProfile(newProfileName.trim(), integrationToUse);
                  const newId = created?._id || created?.id;
                  toast.success("Perfil Ativo criado com sucesso!");
                  setNewProfileName("");
                  setIsNewProfileModalOpen(false);
                  clearZernioCache();
                  if (newId) {
                    setSelectedProfileId(newId);
                  }
                  if (config.integrations && config.integrations.length > 0) {
                    await fetchMultiAccountData(config.integrations);
                  }
                } catch (err: any) {
                  console.error("Erro ao criar perfil:", err);
                  toast.error(err.message || "Erro ao criar perfil no Zernio.");
                } finally {
                  setCreatingProfile(false);
                }
              }} className="space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Adicionar Novo Perfil</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {profiles.length} de {maxProfiles === -1 ? '∞' : maxProfiles} perfis utilizados
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewProfileModalOpen(false)}
                    className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-2xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-800 dark:text-violet-300 space-y-1">
                  <p className="font-semibold">💡 Regra do Plano</p>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Cada Perfil Ativo permite conectar até <strong>2 contas gratuitas</strong> de redes sociais através do Zernio.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-foreground">Nome do Perfil</Label>
                  <Input
                    type="text"
                    required
                    autoFocus
                    placeholder="Ex: Marca Principal, Cliente XPTO..."
                    value={newProfileName}
                    onChange={(e) => setNewProfileName(e.target.value)}
                    className="rounded-xl h-10 text-sm"
                  />
                </div>

                {config.integrations && config.integrations.length > 1 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">Conta Zernio</Label>
                    <select
                      value={newProfileIntegrationId}
                      onChange={(e) => setNewProfileIntegrationId(e.target.value)}
                      className="w-full text-xs rounded-xl border border-border bg-background p-2.5 outline-none"
                    >
                      {config.integrations.map((integ) => (
                        <option key={integ.id} value={integ.id}>
                          {integ.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsNewProfileModalOpen(false)}
                    className="rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creatingProfile || !newProfileName.trim()}
                    className="rounded-xl bg-primary font-bold shadow-xs cursor-pointer"
                  >
                    {creatingProfile ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-1.5" />
                        Criar Perfil
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {confirmModal && (
        <ConfirmModal
          open={confirmModal.open}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel="Excluir"
          variant="danger"
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}

      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-250">
          <button
            onClick={() => setVideoModalOpen(false)}
            className="absolute top-4 right-4 text-white hover:text-stone-300 p-2.5 rounded-full bg-stone-900/40 hover:bg-stone-900/60 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-black">
            {(() => {
              const embedInfo = getEmbedVideoInfo(tutorialVideoUrl);
              if (embedInfo) {
                return (
                  <iframe
                    src={embedInfo.embedUrl}
                    title="Vídeo Tutorial"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                );
              }
              return (
                <video controls autoPlay className="w-full h-full object-contain bg-black">
                  <source src={tutorialVideoUrl} type="video/mp4" />
                  Seu navegador não suporta a exibição de vídeos.
                </video>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}