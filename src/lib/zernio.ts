import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Cache layer
// ---------------------------------------------------------------------------

interface CacheEntry {
  data: any;
  expiresAt: number;
}

// In-memory cache (fastest, cleared on page reload)
const memCache = new Map<string, CacheEntry>();

// TTL per route prefix (ms). Mutating routes (POST/PUT/DELETE) bypass cache.
// Note: /config is intentionally NEVER cached so workspace status is always live and immediate.
const TTL_MAP: Array<[string, number]> = [
  ["/v1/profiles", 5 * 60_000],   // 5 min
  ["/v1/accounts", 3 * 60_000],    // 3 min
  ["/v1/posts", 2 * 60_000],   // 2 min
  ["/v1/inbox/conversations", 90_000],        // 1.5 min
  ["/v1/inbox/comments", 90_000],        // 1.5 min
  ["/v1/analytics", 10 * 60_000],  // 10 min
  ["/v1/webhooks", 5 * 60_000],   // 5 min
];

const SESSION_KEY_PREFIX = "zernio_cache::";

function getTtl(path: string): number {
  for (const [prefix, ttl] of TTL_MAP) {
    if (path.startsWith(prefix)) return ttl;
  }
  return 60_000; // default 1 min
}

function readCache(key: string): any | null {
  // 1. Check memory cache first
  const mem = memCache.get(key);
  if (mem && Date.now() < mem.expiresAt) return mem.data;

  // 2. Fallback to sessionStorage
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_PREFIX + key);
    if (raw) {
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() < entry.expiresAt) {
        memCache.set(key, entry); // warm up memory cache
        return entry.data;
      }
      sessionStorage.removeItem(SESSION_KEY_PREFIX + key);
    }
  } catch {
    // sessionStorage unavailable or parse error
  }
  return null;
}

function writeCache(key: string, data: any, ttlMs: number): void {
  const entry: CacheEntry = { data, expiresAt: Date.now() + ttlMs };
  memCache.set(key, entry);
  try {
    sessionStorage.setItem(SESSION_KEY_PREFIX + key, JSON.stringify(entry));
  } catch {
    // quota exceeded or unavailable – silently skip session persistence
  }
}

/** Remove all Zernio cache entries (memory + sessionStorage) */
export function clearZernioCache(): void {
  memCache.clear();
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_KEY_PREFIX)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Invalidate cache entries matching a path prefix */
export function invalidateCacheByPrefix(prefix: string): void {
  for (const key of Array.from(memCache.keys())) {
    if (key.startsWith(prefix)) memCache.delete(key);
  }
  try {
    const full = SESSION_KEY_PREFIX + prefix;
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(full)) keysToRemove.push(k);
    }
    keysToRemove.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/** Returns total number of cached entries currently alive */
export function getCacheStats(): { memory: number; session: number } {
  const now = Date.now();
  let memory = 0;
  for (const entry of memCache.values()) {
    if (now < entry.expiresAt) memory++;
  }
  let session = 0;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(SESSION_KEY_PREFIX)) session++;
    }
  } catch {
    // ignore
  }
  return { memory, session };
}

// ---------------------------------------------------------------------------
// Core API caller
// ---------------------------------------------------------------------------

interface ZernioRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  /** Set to true to bypass cache even for GET requests */
  skipCache?: boolean;
  /** Custom integration ID (API key selection) */
  integrationId?: string;
}

const CURRENT_SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');

export function sanitizeMediaUrls(obj: any): any {
  if (!obj || !CURRENT_SUPABASE_URL) return obj;
  if (typeof obj === 'string') {
    if (obj.includes('.supabase.co/storage/')) {
      return obj.replace(/https:\/\/[a-z0-9]+\.supabase\.co/gi, CURRENT_SUPABASE_URL);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeMediaUrls);
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      newObj[key] = sanitizeMediaUrls(obj[key]);
    }
    return newObj;
  }
  return obj;
}

export async function zernioApiCall(path: string, options: ZernioRequestOptions = {}) {
  const method = options.method || 'GET';
  const headers = { ...options.headers };

  if (options.integrationId) {
    headers['x-zernio-integration-id'] = options.integrationId;
  }

  // Format the sub-path correctly
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // Only cache GET requests
  const isCacheable = method === 'GET' && !options.skipCache;
  const cacheKey = options.integrationId ? `${options.integrationId}::${cleanPath}` : cleanPath;

  if (isCacheable) {
    const cached = readCache(cacheKey);
    if (cached !== null) return sanitizeMediaUrls(cached);
  }

  try {
    const { data, error } = await supabase.functions.invoke(`zernio-api${cleanPath}`, {
      method,
      headers,
      body: options.body
    });

    if (error) {
      let detailedMsg = error.message;
      try {
        if ('context' in error && (error as any).context) {
          const res = (error as any).context as Response;
          if (res && typeof res.clone === 'function') {
            const body = await res.clone().json().catch(() => null);
            if (body && (body.error || body.message)) {
              detailedMsg = body.error || body.message;
            } else {
              const text = await res.clone().text().catch(() => '');
              if (text) detailedMsg = text;
            }
          }
        }
      } catch (e) {
        console.warn('Could not extract error details:', e);
      }
      throw new Error(detailedMsg);
    }

    if (data && data.success === false && data.error) {
      let finalErrMsg = data.error;
      try {
        const parsed = JSON.parse(data.error);
        finalErrMsg = parsed.error || parsed.message || data.error;
      } catch {
        // Plain text error
      }
      throw new Error(finalErrMsg);
    }

    const sanitizedData = sanitizeMediaUrls(data);

    if (isCacheable && sanitizedData) {
      writeCache(cacheKey, sanitizedData, getTtl(cleanPath));
    }

    return sanitizedData;
  } catch (err: any) {
    console.error(`Error during Zernio API call to ${cleanPath}:`, err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API surface
// ---------------------------------------------------------------------------

export const zernio = {
  // Config
  getConfig: (skipCache = true) => zernioApiCall('/config', { method: 'GET', skipCache }),
  saveConfig: async (apiKey: string, profileId?: string, id?: string, name?: string) => {
    clearZernioCache();
    return zernioApiCall('/config', { method: 'POST', body: { apiKey, profileId, id, name } });
  },
  deleteConfig: async (id: string) => {
    clearZernioCache();
    return zernioApiCall('/config', { method: 'DELETE', body: { id } });
  },
  getWebhooksSettings: (integrationId?: string) =>
    zernioApiCall('/v1/webhooks/settings', { method: 'GET', integrationId }),
  createWebhook: (body: any, integrationId?: string) =>
    zernioApiCall('/v1/webhooks/settings', { method: 'POST', body, integrationId }),
  updateWebhook: (body: any, integrationId?: string) =>
    zernioApiCall('/v1/webhooks/settings', { method: 'PUT', body, integrationId }),

  // Profiles
  getProfiles: (integrationId?: string) => zernioApiCall('/v1/profiles', { integrationId }),
  createProfile: (name: string, integrationId?: string) => zernioApiCall('/v1/profiles', { method: 'POST', body: { name }, integrationId }),
  deleteProfile: (profileId: string, integrationId?: string) => zernioApiCall(`/v1/profiles/${profileId}`, { method: 'DELETE', integrationId }),

  // Accounts
  getAccounts: (profileId: string, integrationId?: string) => zernioApiCall(`/v1/accounts?profileId=${profileId}`, { integrationId }),
  connectPlatform: (platform: string, profileId: string, integrationId?: string) =>
    zernioApiCall(`/v1/connect/${platform}?profileId=${profileId}`, { integrationId }),

  // Posts
  getPosts: (profileId: string, status?: string, source?: string, platform?: string, sortBy?: string, accountId?: string, integrationId?: string) => {
    let url = `/v1/posts?profileId=${profileId}`;
    if (status && status !== 'all') url += `&status=${status}`;
    if (source && source !== 'all') url += `&source=${source}`;
    if (platform && platform !== 'all') url += `&platform=${platform}`;
    if (sortBy) url += `&sortBy=${sortBy}`;
    if (accountId) url += `&accountId=${accountId}`;
    return zernioApiCall(url, { integrationId });
  },
  getPostsByAccount: (profileId: string, accountId: string, source = 'external', integrationId?: string, skipCache = true) => {
    const url = `/v1/posts?profileId=${profileId}&accountId=${accountId}&source=${source}&sortBy=scheduledAt_desc&limit=50`;
    return zernioApiCall(url, { integrationId, skipCache });
  },
  createPost: (postData: any, integrationId?: string) => zernioApiCall('/v1/posts', { method: 'POST', body: postData, integrationId }),
  deletePost: (postId: string, integrationId?: string) => zernioApiCall(`/v1/posts/${postId}`, { method: 'DELETE', integrationId }),

  // Inbox - Conversations (DMs)
  getConversations: (profileId: string, integrationId?: string) => zernioApiCall(`/v1/inbox/conversations?profileId=${profileId}`, { integrationId }),
  searchConversations: (profileId: string, query: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/conversations/search?profileId=${profileId}&query=${encodeURIComponent(query)}`, { integrationId, skipCache: true }),
  getConversationsByContact: (profileId: string, contactId: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/conversations?profileId=${profileId}&contactId=${contactId}&limit=1`, { integrationId, skipCache: true }),
  getMessages: (conversationId: string, accountId: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/conversations/${conversationId}/messages?accountId=${accountId}`, { integrationId }),
  sendMessage: (conversationId: string, accountId: string, text: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { accountId, message: text },
      integrationId
    }),

  // Inbox - Comments
  getComments: (profileId: string, integrationId?: string) => zernioApiCall(`/v1/inbox/comments?profileId=${profileId}`, { integrationId }),
  getPostComments: (postId: string, accountId: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/comments/${postId}?accountId=${accountId}`, { integrationId }),
  getAdComments: (adId: string, placement: string, integrationId?: string) =>
    zernioApiCall(`/v1/ads/${adId}/comments?placement=${placement}`, { integrationId }),
  replyPostComment: (postId: string, accountId: string, message: string, commentId?: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/comments/${postId}`, {
      method: 'POST',
      body: { accountId, message, commentId },
      integrationId
    }),
  privateReplyComment: (postId: string, commentId: string, accountId: string, message: string, integrationId?: string) =>
    zernioApiCall(`/v1/inbox/comments/${postId}/${commentId}/private-reply`, {
      method: 'POST',
      body: { accountId, message },
      integrationId
    }),

  // Analytics
  getAnalytics: (profileId: string, startDate: string, endDate: string) =>
    zernioApiCall(`/v1/analytics/daily-metrics?profileId=${profileId}&startDate=${startDate}&endDate=${endDate}`),
  getBestTime: (profileId: string) => zernioApiCall(`/v1/analytics/best-time?profileId=${profileId}`),

  // Contacts & CRM
  getContacts: (profileId: string, integrationId?: string, page = 1, search = '', tag = '') => {
    let url = `/v1/contacts?profileId=${profileId}&page=${page}&limit=50`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;
    return zernioApiCall(url, { integrationId });
  },
  getContactChannels: (contactId: string, integrationId?: string) =>
    zernioApiCall(`/v1/contacts/${contactId}/channels`, { integrationId }),
  createContact: (body: any, integrationId?: string) =>
    zernioApiCall('/v1/contacts', { method: 'POST', body, integrationId }),
  deleteContact: (contactId: string, integrationId?: string) =>
    zernioApiCall(`/v1/contacts/${contactId}`, { method: 'DELETE', integrationId }),
  // Upsert via edge function (uses service_role to bypass RLS)
  upsertContacts: (contacts: any[]) =>
    zernioApiCall('/contacts-upsert', { method: 'POST', body: { contacts } }),
};


