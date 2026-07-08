// ============================================
// ChatGPT Workspace Joiner — Side Panel Logic
// v4.1 · Fully Automated
// ============================================
// Flow:
//   1. User fills Workspace ID(s)
//   2. User clicks "申请加入" (request) or "接受邀请" (accept)
//   3. Extension joins workspace(s) automatically
//   4. After success → automatically re-fetches session
//      (which now contains workspace context)
//   5. Automatically converts to selected format (raw/CPA/sub2api)
//   6. User only needs to click "复制凭证"
// ============================================

"use strict";

const $ = (id) => document.getElementById(id);

// ─── DOM Refs ────────────────────────────────
// Header
const elSessionDot  = $("session-dot");
const elSessionBar  = $("session-bar");
// Workspace
const elWsInput     = $("ws-input");
const elWsCount     = $("ws-count");
const elBtnSave     = $("btn-save");
const elBtnClearWs  = $("btn-clear-ws");
const elBtnRefresh  = $("btn-refresh-at");
const elBtnAccept   = $("btn-accept");
const elRunBar      = $("running-bar");
const elRunText     = $("running-text");
// Advanced
const elBtnAdvanced = $("btn-advanced");
const elAdvBody     = $("advanced-body");
const elCfgInterval = $("cfg-interval");
const elCfgRetries  = $("cfg-retries");
const elCfgBackoff  = $("cfg-backoff");
const elCfgPoll     = $("cfg-poll");
// Credential result
const elCredCard    = $("cred-result-card");
const elCredPreview = $("cred-preview");
const elCredMsg     = $("cred-msg");
const elCredLines   = $("cred-lines");
const elCredFmtLbl  = $("cred-fmt-label");
const elBtnCredCopy = $("btn-cred-copy");
const elBtnCredDl   = $("btn-cred-dl");
// Joined workspaces list
const elJoinedWsCard = $("joined-workspaces-card");
const elWsListTbody  = $("workspace-list-tbody");
const elBtnRefreshWs = $("btn-refresh-workspaces");
// Log
const elLogBody     = $("log-body");
const elLogCount    = $("log-count");
const elBtnClearLog = $("btn-clear-log");
// Gmail
const elGmailBase   = $("gmail-base");
const elAliasPrefix = $("alias-prefix");
const elAliasLength = $("alias-length");
const elAliasCount  = $("alias-count");
const elAliasLetter = $("alias-letters");
const elAliasNumber = $("alias-numbers");
const elAliasDots   = $("alias-dots");
const elBtnGenAlias = $("btn-gen-alias");
const elAliasCard   = $("alias-result-card");
const elAliasList   = $("alias-list");
const elBtnCopyAll  = $("btn-copy-all-alias");
// Toast
const elToast       = $("sp-toast");

// ─── State ───────────────────────────────────
let logs         = [];
let isDirty      = false;
let credFmt      = "cpa";      // default: CPA JSON (most common use)
let credSession  = null;       // raw session object
let credText     = "";         // current formatted text for copy/download
let credName     = "session_cpa.json";
let toastTimer   = null;
let pendingRoute = null;       // which route just completed

const FMT_LABELS = { raw: "原始 JSON", cpa: "CPA JSON", sub: "sub2api" };

const DEFAULTS = {
  workspaceIds:   "",
  intervalMs:     1500,
  maxRetries:     3,
  retryBackoffMs: 5000,
  sessionPollMs:  20000,
};

// ════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════
async function loadConfig() {
  const resp = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
  const cfg  = Object.assign({}, DEFAULTS, resp?.config || {});
  elWsInput.value     = cfg.workspaceIds;
  elCfgInterval.value = cfg.intervalMs;
  elCfgRetries.value  = cfg.maxRetries;
  elCfgBackoff.value  = cfg.retryBackoffMs;
  elCfgPoll.value     = cfg.sessionPollMs;
  updateWsCount();
}

function getConfig() {
  return {
    workspaceIds:   elWsInput.value.trim(),
    intervalMs:     parseInt(elCfgInterval.value) || 1500,
    maxRetries:     parseInt(elCfgRetries.value)  || 3,
    retryBackoffMs: parseInt(elCfgBackoff.value)  || 5000,
    sessionPollMs:  parseInt(elCfgPoll.value)     || 20000,
  };
}

async function saveConfig() {
  const cfg = getConfig();
  await chrome.runtime.sendMessage({ type: "SAVE_CONFIG", config: cfg });
  markClean();
  addLog("配置已保存", "ok");
  showToast("已保存 ✓", "ok");
}

// ════════════════════════════════════════════
// WS COUNT / DIRTY
// ════════════════════════════════════════════
function updateWsCount() {
  const n = elWsInput.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).length;
  elWsCount.textContent = `${n} 个`;
}

function markDirty() {
  isDirty = true;
  elBtnSave.textContent = "保存 *";
  elBtnSave.classList.add("dirty");
  elBtnSave.classList.remove("saved");
}

function markClean() {
  isDirty = false;
  elBtnSave.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> 已保存`;
  elBtnSave.classList.add("saved");
  elBtnSave.classList.remove("dirty");
  setTimeout(() => {
    if (!isDirty) {
      elBtnSave.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> 保存`;
      elBtnSave.classList.remove("saved");
    }
  }, 2000);
}

// ════════════════════════════════════════════
// LOGGING
// ════════════════════════════════════════════
function addLog(msg, level = "info") {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  logs.push({ time, msg, level });

  const empty = elLogBody.querySelector(".log-empty");
  if (empty) empty.remove();

  const el = document.createElement("div");
  el.className = `log-line log-${level}`;
  el.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${esc(msg)}</span>`;
  elLogBody.appendChild(el);
  elLogBody.scrollTop = elLogBody.scrollHeight;
  elLogCount.textContent = `${logs.length} 条`;
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ════════════════════════════════════════════
// SESSION BAR
// ════════════════════════════════════════════
function fmtExp(exp) {
  if (!exp) return "?";
  const min = Math.round((exp * 1000 - Date.now()) / 60000);
  if (min > 60) return `剩余 ${Math.round(min / 60)} 小时`;
  return `剩余 ${min} 分钟`;
}

function updateSessionBar(info, status) {
  elSessionDot.className = "sp-session-dot " + (status || "");

  if (info && info.email) {
    elSessionBar.innerHTML =
      `<span class="session-email">${esc(info.email)}</span>` +
      `<span class="session-plan">${esc(info.plan_type || "?")}</span>` +
      `<span class="session-exp">${esc(fmtExp(info.exp))}</span>`;
    elBtnAccept.disabled = false;
  } else {
    const msg = status === "err"
      ? "session 获取失败，请确认已登录"
      : "请先打开 chatgpt.com 并登录";
    elSessionBar.innerHTML = `<span class="session-placeholder">● ${msg}</span>`;
    elBtnAccept.disabled = true;
  }
}

// ════════════════════════════════════════════
// GET CHATGPT TAB + ENSURE CONTENT SCRIPT
// ════════════════════════════════════════════
async function getChatGPTTab() {
  // 1. 优先：最上方（最后聚焦）窗口的活跃 chatgpt.com 标签页
  const [activeTab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
    url: "https://chatgpt.com/*",
  });
  if (activeTab) return activeTab;

  // 2. 次选：任意窗口的活跃 chatgpt.com 标签页
  const activeTabs = await chrome.tabs.query({
    active: true,
    url: "https://chatgpt.com/*",
  });
  if (activeTabs.length > 0) return activeTabs[0];

  // 3. 备选：任意 chatgpt.com 标签页
  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  if (tabs.length > 1) {
    addLog(`⚠ 检测到多个 chatgpt.com 标签页，将使用第一个。请确保浏览器当前活动标签页是你想要操作的账号。`, "warn");
  }
  return tabs[0] || null;
}

/**
 * Ensures content script is alive in the tab.
 * If the tab was opened before the extension loaded/reloaded,
 * the content script won't be there — so we inject it on demand.
 */
async function ensureContentScript(tabId) {
  try {
    // Quick ping to check if content script is alive
    await chrome.tabs.sendMessage(tabId, { type: "PING" });
    return true;
  } catch {
    // Not alive — inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/content.js"],
      });
      // Let the script initialize
      await new Promise(r => setTimeout(r, 600));
      addLog("content script 已自动注入（扩展重载后首次使用）", "info");
      return true;
    } catch (e) {
      addLog("无法注入 content script: " + e.message, "err");
      return false;
    }
  }
}

// ════════════════════════════════════════════
// RUN WORKSPACE ACTION
// ════════════════════════════════════════════
async function runAction(route) {
  const cfg = getConfig();
  if (!cfg.workspaceIds.trim()) {
    showToast("请先填写 Workspace ID", "warn");
    return;
  }
  const tab = await getChatGPTTab();
  if (!tab) {
    showToast("请先打开 chatgpt.com 并登录", "err");
    addLog("未找到 chatgpt.com 标签页", "err");
    return;
  }
  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    showToast("无法连接到 chatgpt.com 页面，请手动刷新该页面", "err");
    return;
  }
  pendingRoute = route;
  try {
    // Log target tab details for visibility
    const title = tab.title ? ` (${tab.title})` : "";
    addLog(`目标标签页: ${tab.url}${title}`, "info");
    
    await chrome.tabs.sendMessage(tab.id, { type: "RUN_ACTION", route, config: cfg });
    setRunning(true, "正在申请加入并上车...");
    addLog("开始执行「开车」...", "info");
  } catch (e) {
    showToast("通信失败：" + e.message, "err");
    addLog("通信失败：" + e.message, "err");
    pendingRoute = null;
  }
}

async function doRefreshSession() {
  const tab = await getChatGPTTab();
  if (!tab) { showToast("请先打开 chatgpt.com", "warn"); return; }
  const ready = await ensureContentScript(tab.id);
  if (!ready) { showToast("无法连接页面，请手动刷新 chatgpt.com", "err"); return; }
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "REFRESH_SESSION" });
    addLog("正在刷新 session...", "info");
  } catch (e) {
    showToast("刷新失败：" + e.message, "err");
  }
}

function setRunning(on, text) {
  elRunBar.style.display = on ? "flex" : "none";
  if (text) elRunText.textContent = text;
  elBtnAccept.disabled = on;
}

// ════════════════════════════════════════════
// AUTO-FETCH SESSION AFTER JOIN
// Called automatically when RUN_DONE fires with ok > 0
// ════════════════════════════════════════════
async function autoFetchCredential(successCount) {
  addLog(`已成功处理 ${successCount} 个 workspace，正在获取工作空间凭证...`, "ok");
  setRunning(true, "切换工作空间并获取凭证...");

  // Small delay to let workspace membership propagate on ChatGPT's side
  await new Promise(r => setTimeout(r, 1500));

  const tab = await getChatGPTTab();
  if (!tab) {
    addLog("找不到 chatgpt.com 标签页，请手动刷新并重新获取", "warn");
    setRunning(false);
    return;
  }

  const ready = await ensureContentScript(tab.id);
  if (!ready) {
    addLog("无法连接页面，请手动刷新 chatgpt.com 后点「刷新 AT」重试", "err");
    setRunning(false);
    return;
  }

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, {
      type: "FETCH_SESSION_DATA",
      url:  "https://chatgpt.com/api/auth/session",
    });

    if (!resp?.ok) throw new Error(resp?.error || "Session 获取失败");

    credSession = resp.data;
    const result = formatCred(credSession, credFmt);
    renderCredResult(result);

    addLog(`✓ 凭证已就绪（${FMT_LABELS[credFmt]}），点击「复制凭证」`, "ok");
    showToast("凭证已就绪，点击复制 ✓", "ok");
  } catch (e) {
    addLog("凭证自动获取失败: " + e.message + " — 请点「刷新 AT」重试", "err");
    showToast("凭证获取失败，请刷新 AT 后重试", "err");
  } finally {
    setRunning(false);
  }
}

// ════════════════════════════════════════════
// CHROME MESSAGE LISTENER
// ════════════════════════════════════════════
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "LOG") {
    addLog(msg.msg, msg.level || "info");
  }
  if (msg.type === "SESSION_INFO") {
    updateSessionBar(msg.info, msg.status);
    if (msg.status === "ok") {
      fetchAndRenderWorkspaces();
    }
  }
  if (msg.type === "RUN_START") {
    setRunning(true, "处理中...");
  }
  if (msg.type === "RUN_DONE") {
    const { ok, total, sessions } = msg;
    setRunning(false);
    if (sessions && sessions.length > 0) {
      credSession = sessions;
      const result = formatCred(sessions, credFmt);
      renderCredResult(result);
      addLog(`✓ 成功获取并生成 ${sessions.length} 个工作空间的凭证！`, "ok");
      sessions.forEach((s, i) => {
        // Decode JWT from access token to find the email
        const token = s?.accessToken || s?.access_token || "";
        let email = "unknown";
        try {
          const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
          email = payload?.["https://api.openai.com/profile"]?.email || s?.user?.email || "unknown";
        } catch (_) {}
        const wsId = s?.account?.id || s?.chatgpt_account_id || "unknown";
        addLog(`  └─ [空间 ${i + 1}] 账号: ${email} (ID: ${wsId.slice(0, 8)}...)`, "ok");
      });
      showToast("凭证已就绪，点击复制 ✓", "ok");
      
      // Auto-refresh workspaces list
      fetchAndRenderWorkspaces();
    } else {
      if (ok > 0) {
        autoFetchCredential(ok);
      } else {
        if (total > 0) {
          addLog(`✗ 开车任务完成，但无成功加入的空间 (0/${total})`, "err");
          showToast(`完成：成功 ${ok}/${total}`, "warn");
        }
      }
    }
  }
});

// ════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════
document.querySelectorAll(".sp-tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".sp-tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".sp-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $(`panel-${btn.dataset.tab}`).classList.add("active");
  });
});

// ════════════════════════════════════════════
// WORKSPACE EVENTS
// ════════════════════════════════════════════
elWsInput.addEventListener("input",    () => { markDirty(); updateWsCount(); });
elBtnSave.addEventListener("click",    saveConfig);
elBtnClearWs.addEventListener("click", () => { elWsInput.value = ""; updateWsCount(); markDirty(); });
elBtnRefresh.addEventListener("click", doRefreshSession);
elBtnAccept.addEventListener("click",  () => runAction("request"));
elBtnRefreshWs.addEventListener("click", () => fetchAndRenderWorkspaces());

elBtnAdvanced.addEventListener("click", () => {
  const open = elAdvBody.classList.toggle("open");
  elBtnAdvanced.classList.toggle("open", open);
});

// Log clear
elBtnClearLog.addEventListener("click", () => {
  logs = [];
  elLogBody.innerHTML = '<div class="log-empty">等待操作...</div>';
  elLogCount.textContent = "0 条";
});

// ════════════════════════════════════════════
// FORMAT BUTTONS
// ════════════════════════════════════════════
document.querySelectorAll(".fmt-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".fmt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    credFmt = btn.dataset.fmt;
    // If we already have a session, re-render immediately
    if (credSession) {
      const result = formatCred(credSession, credFmt);
      renderCredResult(result);
    }
  });
});

// ════════════════════════════════════════════
// CREDENTIAL — Render result
// ════════════════════════════════════════════
function renderCredResult(result) {
  if (!result) return;
  credText = result.text;
  credName = result.name;

  elCredPreview.textContent = result.text;
  elCredPreview.className   = "cred-preview";
  elCredLines.textContent   = `${result.text.split("\n").length} 行`;
  elCredFmtLbl.textContent  = FMT_LABELS[credFmt];
  elCredCard.style.display  = "";

  // Scroll credential card into view
  elCredCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// Copy
elBtnCredCopy.addEventListener("click", async () => {
  if (!credText) return;
  await copyText(credText);
  const prev = elBtnCredCopy.innerHTML;
  elBtnCredCopy.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg> 已复制！`;
  showToast("凭证已复制到剪贴板 ✓", "ok");
  setTimeout(() => { elBtnCredCopy.innerHTML = prev; }, 2000);
});

// Download
elBtnCredDl.addEventListener("click", () => {
  if (!credText) return;
  const blob = new Blob([credText], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href: url, download: credName });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(`已下载 ${credName}`, "ok");
});

// ════════════════════════════════════════════
// CREDENTIAL — Converter helpers
// (logic mirrored from gpt.learnlicen.dpdns.org)
// ════════════════════════════════════════════
const _dec = new TextDecoder();
const DEF_CLIENT  = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEF_PRIVACY = "training_off";
const DEF_PLAN    = "free";

function firstText(...vals) {
  for (const v of vals) { const t = String(v ?? "").trim(); if (t) return t; }
  return "";
}
function readObj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
function coerceTs(v) {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, Math.trunc(v));
  const t = String(v ?? "").trim();
  if (!t) return 0;
  if (/^-?\d+$/.test(t)) return Math.max(0, parseInt(t, 10));
  const p = Date.parse(t);
  return isNaN(p) ? 0 : Math.max(0, Math.trunc(p / 1000));
}
function b64UrlToBytes(v) {
  let n = String(v ?? "").replace(/-/g, "+").replace(/_/g, "/");
  const r = n.length % 4; if (r) n += "=".repeat(4 - r);
  return Uint8Array.from(atob(n), c => c.charCodeAt(0));
}
function decodeJwtPayload(token) {
  try {
    const parts = String(token ?? "").split(".");
    if (parts.length < 2) return {};
    const p = JSON.parse(_dec.decode(b64UrlToBytes(parts[1])));
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch { return {}; }
}
function extractAuth(payload)    { return readObj(payload?.["https://api.openai.com/auth"]); }
function extractProfile(payload) { return readObj(payload?.["https://api.openai.com/profile"]); }
function extractAccountId(auth) {
  const id = firstText(auth?.chatgpt_account_id, auth?.account_id);
  if (id) return id;
  const uid = firstText(auth?.chatgpt_account_user_id);
  return uid.includes("__") ? firstText(uid.split("__").pop()) : "";
}
function toIsoUtc8(date) {
  return new Date(date.getTime() + 8 * 3600000)
    .toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " +0800");
}

function buildCpa(session) {
  const at   = firstText(session?.accessToken, session?.access_token);
  const idt  = firstText(session?.idToken, session?.id_token);
  const rt   = firstText(session?.refreshToken, session?.refresh_token);
  const st   = firstText(session?.sessionToken, session?.session_token);
  const ap   = decodeJwtPayload(at);
  const auth = extractAuth(ap);
  const prof = extractProfile(ap);
  const user = readObj(session?.user);
  const acct = readObj(session?.account);
  const email     = firstText(session?.email, user.email, prof.email);
  const accountId = firstText(session?.chatgpt_account_id, session?.account_id, acct.id, extractAccountId(auth));
  const expiresAt = coerceTs(firstText(ap?.exp, session?.expires, session?.expiresAt, session?.expires_at));
  const now = new Date();
  return {
    type:          "codex",
    email:         email || "unknown",
    expired:       expiresAt ? toIsoUtc8(new Date(expiresAt * 1000)) : "",
    id_token:      idt,
    account_id:    accountId,
    disabled:      false,
    access_token:  at,
    session_token: st,
    last_refresh:  toIsoUtc8(now),
    refresh_token: rt,
  };
}

function buildSub(session) {
  const at   = firstText(session?.accessToken, session?.access_token);
  const idt  = firstText(session?.idToken, session?.id_token);
  const rt   = firstText(session?.refreshToken, session?.refresh_token);
  const st   = firstText(session?.sessionToken, session?.session_token);
  const ap   = decodeJwtPayload(at);
  const auth = extractAuth(ap);
  const prof = extractProfile(ap);
  const user = readObj(session?.user);
  const acct = readObj(session?.account);
  const email     = firstText(session?.email, user.email, prof.email);
  const accountId = firstText(session?.chatgpt_account_id, session?.account_id, acct.id, extractAccountId(auth));
  const userId    = firstText(session?.chatgpt_user_id, user.id, auth.chatgpt_user_id, auth.user_id);
  const orgId     = firstText(session?.organization_id, auth.organization_id);
  const planType  = firstText(session?.plan_type, acct.planType, acct.plan_type, auth.chatgpt_plan_type, DEF_PLAN);
  const now = new Date();
  let expiresAt = coerceTs(firstText(ap?.exp, session?.expires));
  if (!expiresAt) expiresAt = Math.trunc(now.getTime() / 1000) + 863999;
  return {
    exported_at: now.toISOString(),
    proxies: [],
    accounts: [{
      name:     email || accountId || "account",
      platform: "openai",
      type:     "oauth",
      credentials: {
        access_token:       at,
        chatgpt_account_id: accountId,
        chatgpt_user_id:    userId,
        client_id:          firstText(session?.client_id, DEF_CLIENT),
        email:              email || "unknown",
        expires_at:         expiresAt,
        id_token:           idt,
        organization_id:    orgId,
        plan_type:          planType,
        refresh_token:      rt,
        session_token:      st,
      },
      extra: {
        email:            email || "unknown",
        auth_provider:    firstText(session?.authProvider, session?.auth_provider),
        source:           "chatgpt_web_session",
        openai_oauth_responses_websockets_v2_enabled: false,
        openai_oauth_responses_websockets_v2_mode:    "off",
        privacy_mode:     firstText(session?.privacy_mode, DEF_PRIVACY),
      },
      concurrency:          10,
      priority:             1,
      rate_multiplier:      1,
      auto_pause_on_expired: true,
    }],
  };
}

function formatCred(sessions, fmt) {
  const isArray = Array.isArray(sessions);
  const sessionList = isArray ? sessions : [sessions];
  if (sessionList.length === 0) return null;

  switch (fmt) {
    case "raw": {
      if (sessionList.length === 1) {
        return { text: JSON.stringify(sessionList[0], null, 2), name: "session_raw.json" };
      } else {
        const text = sessionList.map(s => JSON.stringify(s)).join("\n");
        return { text, name: "sessions_raw.jsonl" };
      }
    }
    case "cpa": {
      const cpaList = sessionList.map(s => buildCpa(s));
      if (cpaList.length === 1) {
        return { text: JSON.stringify(cpaList[0], null, 2), name: "session_cpa.json" };
      } else {
        const text = cpaList.map(c => JSON.stringify(c)).join("\n");
        return { text, name: "sessions_cpa.jsonl" };
      }
    }
    case "sub": {
      const allAccounts = [];
      const now = new Date();
      for (const s of sessionList) {
        const subResult = buildSub(s);
        if (subResult && subResult.accounts) {
          allAccounts.push(...subResult.accounts);
        }
      }
      const bundle = {
        exported_at: now.toISOString(),
        proxies: [],
        accounts: allAccounts,
      };
      return { text: JSON.stringify(bundle, null, 2), name: "session_sub2api.json" };
    }
    default:
      return null;
  }
}

// ════════════════════════════════════════════
// GMAIL ALIAS GENERATOR
// ════════════════════════════════════════════
function randomChar(chars) { return chars[Math.floor(Math.random() * chars.length)]; }

function genAlias(base, prefix, len, letters, numbers, dots) {
  const [local, domain] = base.split("@");
  if (!domain) return null;
  let charset = (letters ? "abcdefghijklmnopqrstuvwxyz" : "") + (numbers ? "0123456789" : "");
  if (!charset) charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  let alias;
  if (prefix.trim()) {
    alias = prefix.trim();
  } else {
    let r = letters ? randomChar("abcdefghijklmnopqrstuvwxyz") : randomChar(charset);
    for (let i = 1; i < len; i++) {
      if (dots && !r.endsWith(".") && Math.random() < 0.15) r += ".";
      else r += randomChar(charset);
    }
    alias = r.replace(/\.$/, "");
  }
  return `${local}+${alias}@${domain}`;
}

elBtnGenAlias.addEventListener("click", () => {
  let baseUsername = elGmailBase.value.trim();
  if (!baseUsername) {
    showToast("请输入 Gmail 账号", "warn");
    elGmailBase.focus();
    return;
  }
  // 如果用户习惯性输入或粘贴了完整的 @gmail.com，先进行剔除，确保只拿账号名
  baseUsername = baseUsername.replace(/@gmail\.com$/i, "").trim();

  const fullBaseEmail = `${baseUsername}@gmail.com`;

  const prefix  = elAliasPrefix.value;
  const len     = parseInt(elAliasLength.value) || 8;
  const count   = Math.min(parseInt(elAliasCount.value) || 5, 50);
  const letters = elAliasLetter.checked;
  const numbers = elAliasNumber.checked;
  const dots    = elAliasDots.checked;

  const seen = new Set();
  const list = [];
  for (let i = 0; i < count; i++) {
    let email, tries = 0;
    do { email = genAlias(fullBaseEmail, prefix, len, letters, numbers, dots); tries++; }
    while (seen.has(email) && tries < 20);
    if (email && !seen.has(email)) { seen.add(email); list.push(email); }
  }

  renderAliasList(list);
  elAliasCard.style.display = "";
  addLog(`生成了 ${list.length} 个 Gmail 别名`, "ok");
});

function renderAliasList(emails) {
  elAliasList.innerHTML = "";
  emails.forEach(email => {
    const item = document.createElement("div");
    item.className = "alias-item";
    item.innerHTML = `
      <span class="alias-email" title="${esc(email)}">${esc(email)}</span>
      <button class="alias-copy-btn" data-email="${esc(email)}" title="复制">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
      <button class="alias-login-btn" data-email="${esc(email)}" title="打开并快捷登录">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="13" height="13">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13.8 12H3"/>
        </svg>
      </button>`;
    elAliasList.appendChild(item);
  });

  elAliasList.querySelectorAll(".alias-copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      await copyText(btn.dataset.email);
      btn.classList.add("copied");
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 1800);
    });
  });

  elAliasList.querySelectorAll(".alias-login-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const email = btn.dataset.email;
      btn.disabled = true;
      const orig = btn.innerHTML;
      btn.innerHTML = `<div class="sp-spinner" style="width:10px;height:10px;border-width:1.5px"></div>`;
      try {
        const resp = await chrome.runtime.sendMessage({ type: "CLEAR_AND_LOGIN", email });
        if (!resp?.ok) throw new Error(resp?.error || "执行失败");
        showToast("正在无痕窗口中打开登录页...", "ok");
      } catch (e) {
        showToast("快捷登录失败: " + e.message, "err");
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    });
  });
}

elBtnCopyAll.addEventListener("click", async () => {
  const all = [...elAliasList.querySelectorAll(".alias-email")].map(e => e.textContent).join("\n");
  await copyText(all);
  const n = elAliasList.querySelectorAll(".alias-item").length;
  showToast(`已复制 ${n} 个邮箱 ✓`, "ok");
});

// ════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = Object.assign(document.createElement("textarea"), {
      value: text, style: "position:fixed;opacity:0",
    });
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
}

function showToast(msg, type = "") {
  elToast.textContent = msg;
  elToast.className   = "sp-toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { elToast.classList.remove("show"); }, 2500);
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// WORKSPACES LIST RENDER
// ════════════════════════════════════════════
async function fetchAndRenderWorkspaces() {
  const tab = await getChatGPTTab();
  if (!tab) return;
  const ready = await ensureContentScript(tab.id);
  if (!ready) return;

  try {
    const resp = await chrome.tabs.sendMessage(tab.id, { type: "FETCH_WORKSPACES" });
    if (!resp?.ok) throw new Error(resp?.error || "查询失败");

    const data = resp.data;
    const accountsMap = data?.accounts || {};
    const ordering = data?.account_ordering || Object.keys(accountsMap);

    const workspaces = [];
    ordering.forEach(id => {
      const acc = accountsMap[id]?.account;
      if (acc && acc.structure === "workspace") {
        workspaces.push(acc);
      }
    });

    elWsListTbody.innerHTML = "";
    if (workspaces.length === 0) {
      elWsListTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-4);padding:14px">暂无已上车空间</td></tr>`;
      elJoinedWsCard.style.display = "";
      return;
    }

    workspaces.forEach((ws, idx) => {
      const tr = document.createElement("tr");

      const tdIdx = document.createElement("td");
      tdIdx.textContent = idx + 1;

      const tdId = document.createElement("td");
      tdId.textContent = ws.account_id;
      tdId.title = ws.account_id;

      const tdName = document.createElement("td");
      tdName.textContent = ws.name || "未命名空间";
      tdName.title = ws.name || "";
      tdName.style.fontFamily = "sans-serif";
      tdName.style.fontWeight = "600";

      const tdCount = document.createElement("td");
      tdCount.textContent = ws.member_count !== undefined ? ws.member_count : "获取中…";
      tdCount.style.textAlign = "center";

      const tdAction = document.createElement("td");
      tdAction.style.textAlign = "center";

      const btnLeave = document.createElement("button");
      btnLeave.className = "btn-leave-ws";
      btnLeave.textContent = "下车";
      btnLeave.dataset.id = ws.account_id;

      btnLeave.addEventListener("click", async () => {
        if (!confirm(`确定要从空间「${ws.name || ws.account_id}」下车吗？`)) return;
        btnLeave.disabled = true;
        btnLeave.textContent = "下车中…";
        try {
          const leaveResp = await chrome.tabs.sendMessage(tab.id, {
            type: "LEAVE_WORKSPACE",
            workspaceId: ws.account_id,
          });
          if (!leaveResp?.ok) throw new Error(leaveResp?.error || "下车请求失败");
          showToast(`已成功从「${ws.name || ws.account_id}」下车！`, "ok");
          fetchAndRenderWorkspaces();
        } catch (e) {
          showToast(`下车失败: ${e.message}`, "err");
          btnLeave.disabled = false;
          btnLeave.textContent = "下车";
        }
      });

      tdAction.appendChild(btnLeave);
      tr.appendChild(tdIdx);
      tr.appendChild(tdName);
      tr.appendChild(tdCount);
      tr.appendChild(tdId);
      tr.appendChild(tdAction);

      elWsListTbody.appendChild(tr);
    });

    elJoinedWsCard.style.display = "";
  } catch (e) {
    addLog(`获取上车车队列表失败: ${e.message}`, "warn");
  }
}

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
async function init() {
  await loadConfig();

  const tab = await getChatGPTTab();
  if (tab) {
    const ready = await ensureContentScript(tab.id);
    if (ready) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "GET_SESSION" });
      } catch (_) {}
      // Fetch workspaces list on start
      fetchAndRenderWorkspaces();
    }
  }

  addLog("插件已就绪。填写 Workspace ID 后点「开车」，成功后将自动获取凭证。", "info");
}

init();
