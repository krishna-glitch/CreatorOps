const CACHE_VERSION = "creatorops-v4";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const TRPC_QUERY_CACHE = `${CACHE_VERSION}-trpc-queries`;
const OFFLINE_URL = "/offline.html";
const QUEUE_DB_NAME = "creatorops-offline-queue";
const QUEUE_STORE = "requests";
const MAX_QUEUE_ITEMS = 100;
const MAX_QUEUE_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_TRPC_QUERY_CACHE_AGE_MS = 5 * 60 * 1000; // 5 minutes

const SHELL_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/offline.html",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheName.startsWith(CACHE_VERSION)) {
            return caches.delete(cacheName);
          }
          return Promise.resolve();
        }),
      );
      await self.clients.claim();
      await replayQueuedRequests();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (event.data?.type === "REPLAY_QUEUE") {
    event.waitUntil(replayQueuedRequests());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "creatorops-sync-queue") {
    event.waitUntil(replayQueuedRequests());
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (shouldQueueMutation(request, url)) {
    event.respondWith(handleApiMutation(request));
    return;
  }

  if (isTrpcQueryRequest(request, url)) {
    event.respondWith(handleTrpcQuery(request));
    return;
  }

  if (request.method === "GET" && isSafeRuntimeCacheRequest(request, url)) {
    event.respondWith(staleWhileRevalidateRuntime(request));
  }
});

// --- PUSH NOTIFICATIONS ---

self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();

    const options = {
      body: data.body,
      icon: data.icon || "/icon-192.png",
      badge: data.badge || "/icon-192.png",
      data: data.data || {},
      actions: data.actions || [],
      tag: data.tag || "default",
      requireInteraction: data.priority === "high",
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(data.title, options));
  } catch (err) {
    console.error("Error parsing push data:", err);
  }
});

self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;
  const data = notification.data || {};
  notification.close();

  const resolveUrl = (raw) => new URL(raw || "/dashboard", self.location.origin);
  const focusOrOpen = (target) =>
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        const clientUrl = new URL(client.url);
        if (clientUrl.origin === target.origin && clientUrl.pathname === target.pathname) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(target.toString());
      }
    });

  if (action === "dismiss") {
    return;
  }

  if (action === "open") {
    event.waitUntil(focusOrOpen(resolveUrl(data.url)));
    return;
  }

  // Handle functional actions
  const functionalActions = ["mark_paid", "mark_posted", "mark_done", "snooze"];
  if (functionalActions.includes(action)) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
        // If app is already open, send message
        if (clientsList.length > 0) {
          clientsList[0].postMessage({
            type: "NOTIFICATION_ACTION",
            action,
            data,
          });
          return clientsList[0].focus();
        } 
        
        // If app is closed, open it with query params to execute action on mount
        const url = resolveUrl(data.url);
        url.searchParams.set("notif_action", action);
        if (data.dealId) url.searchParams.set("dealId", data.dealId);
        if (data.reminderId) url.searchParams.set("reminderId", data.reminderId);
        if (data.paymentId) url.searchParams.set("paymentId", data.paymentId);
        
        return clients.openWindow(url.toString());
      })
    );
  } else {
    // Default click behavior (no action button pressed)
    event.waitUntil(focusOrOpen(resolveUrl(data.url)));
  }
});

// --- HELPERS ---

function shouldQueueMutation(request, url) {
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method,
  );
  if (!isMutatingMethod || !url.pathname.startsWith("/api/")) {
    return false;
  }

  if (url.pathname.startsWith("/api/trpc")) {
    return request.headers.get("x-trpc-mutation-batch") === "1";
  }

  return true;
}

function isSafeRuntimeCacheRequest(request, url) {
  if (request.method !== "GET") {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (url.pathname.startsWith("/api/")) {
    return false;
  }

  if (request.destination === "document") {
    return false;
  }

  return ["style", "script", "image", "font", "manifest"].includes(
    request.destination,
  );
}

function isTrpcQueryRequest(request, url) {
  if (request.method !== "POST") {
    return false;
  }

  if (url.origin !== self.location.origin) {
    return false;
  }

  if (!url.pathname.startsWith("/api/trpc")) {
    return false;
  }

  return request.headers.get("x-trpc-mutation-batch") !== "1";
}

async function sha256(text) {
  if (self.crypto?.subtle) {
    const data = new TextEncoder().encode(text);
    const digest = await self.crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return String(hash >>> 0);
}

async function getTrpcCacheKeyRequest(request) {
  const body = await request.clone().text();
  const url = new URL(request.url);
  const key = await sha256(`${url.pathname}?${url.search}|${body}`);
  return new Request(`${self.location.origin}/__trpc_query_cache__/${key}`, {
    method: "GET",
  });
}

async function stampResponse(response) {
  const headers = new Headers(response.headers);
  headers.set("x-sw-cached-at", String(Date.now()));
  const body = await response.clone().blob();

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isFreshTrpcCache(response) {
  const cachedAtRaw = response.headers.get("x-sw-cached-at");
  if (!cachedAtRaw) {
    return false;
  }

  const cachedAt = Number(cachedAtRaw);
  if (Number.isNaN(cachedAt)) {
    return false;
  }

  return Date.now() - cachedAt <= MAX_TRPC_QUERY_CACHE_AGE_MS;
}

async function handleTrpcQuery(request) {
  const cache = await caches.open(TRPC_QUERY_CACHE);
  const cacheKey = await getTrpcCacheKeyRequest(request);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      await cache.put(cacheKey, await stampResponse(networkResponse));
    }
    return networkResponse;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached && isFreshTrpcCache(cached)) {
      return cached;
    }

    if (cached) {
      await cache.delete(cacheKey);
    }

    return new Response(
      JSON.stringify({
        error: {
          message: "Offline and no cached query result available.",
          code: "SW_OFFLINE_CACHE_MISS",
        },
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return new Response("Offline", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=UTF-8" },
    });
  }
}

async function staleWhileRevalidateRuntime(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);
  const cached = await runtimeCache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      const cacheControl = response.headers.get("cache-control") ?? "";
      const isPrivate = /private|no-store/i.test(cacheControl);

      if (response && response.status === 200 && !isPrivate) {
        runtimeCache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response("Offline", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=UTF-8" },
  });
}

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function withIdempotencyHeaders(request) {
  if (request.headers.get("x-idempotency-key")) {
    return request;
  }

  const headers = new Headers(request.headers);
  headers.set("x-idempotency-key", createIdempotencyKey());

  return new Request(request, { headers });
}

async function handleApiMutation(request) {
  const requestWithKey = withIdempotencyHeaders(request);

  try {
    return await fetch(requestWithKey);
  } catch {
    await queueRequest(requestWithKey);

    try {
      await self.registration.sync.register("creatorops-sync-queue");
    } catch {
      // iOS Safari often does not support one-off background sync.
    }

    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function openQueueDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(QUEUE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function queueRequest(request) {
  const requestClone = request.clone();
  const bodyText = await requestClone.text();

  const serialized = {
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body: bodyText,
    createdAt: Date.now(),
  };

  const db = await openQueueDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    const store = tx.objectStore(QUEUE_STORE);
    store.add(serialized);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  await pruneQueue(db);
}

async function pruneQueue(db) {
  const entries = await getQueuedRequests(db);
  if (entries.length <= MAX_QUEUE_ITEMS) {
    return;
  }

  const overflow = entries.length - MAX_QUEUE_ITEMS;
  const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
  const toDelete = sorted.slice(0, overflow).map((item) => item.id);

  await Promise.all(toDelete.map((id) => deleteQueuedRequest(id, db)));
}

async function getQueuedRequests(dbArg) {
  const db = dbArg ?? (await openQueueDb());

  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readonly");
    const store = tx.objectStore(QUEUE_STORE);
    const readRequest = store.getAll();
    readRequest.onsuccess = () => resolve(readRequest.result);
    readRequest.onerror = () => reject(readRequest.error);
  });
}

async function deleteQueuedRequest(id, dbArg) {
  const db = dbArg ?? (await openQueueDb());
  await new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, "readwrite");
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function replayQueuedRequests() {
  const db = await openQueueDb();
  const queued = await getQueuedRequests(db);
  const now = Date.now();

  for (const item of queued) {
    if (now - item.createdAt > MAX_QUEUE_AGE_MS) {
      await deleteQueuedRequest(item.id, db);
      continue;
    }

    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (response.ok || response.status === 409) {
        await deleteQueuedRequest(item.id, db);
      }
    } catch {
      return;
    }
  }
}
