// ======================================
// ChatGPT Workspace Joiner — Popup Logic
// ======================================

"use strict";

// ---------- DOM Refs ----------
const $ = (id) => document.getElementById(id);

// Header
const elStatusDot      = $("status-dot");
const elUserBar        = $("user-bar");

// Workspace tab
const elWsInput        = $("ws-input");
const elWsCount        = $("ws-count");
const elBtnSave        = $("btn-save");
const elBtnClearWs     = $("btn-clear-ws");
const elBtnRefreshAT   = $("btn-refresh-session");
const elBtnAccept      = $("btn-accept");
const elBtnRequest     = $("btn-request");
const elRunIndicator   = $("running-indicator");
const elRunningText    = $("running-text");
const elBtnAdvanced    = $("btn-advanced");
const elAdvancedBody   = $("advanced-body");

// Advanced config
const elCfgInterval    = $("cfg-interval");
const elCfgRetries     = $("cfg-retries");
const elCfgBackoff     = $("cfg-backoff");
const elCfgPoll        = $("cfg-poll");

// Log tab
const elLogBody        = $("log-body");
const elLogCount       = $("log-count");
const elLogBadge       = $("log-badge");
const elBtnClearLog    = $("btn-clear-log");

// Gmail tab
const elGmailBase      = $("gmail-base");
const elAliasPrefix    = $("alias-prefix");
const elAliasLength    = $("alias-length");
const elAliasCount     = $("alias-count");
const elAliasLetters   = $("alias-letters");
const elAliasNumbers   = $("alias-numbers");
const elAliasDots      = $("alias-dots");
const elBtnGenAlias    = $("btn-gen-alias");
const elAliasSection   = $("aliases-section");
const elAliasList      = $("alias-list");
const elBtnCopyAll     = $("btn-copy-all");

// Credential tab
const elCredUrl        = $("cred-url");
const elBtnFetchSess   = $("btn-fetch-session");
const elCredPreview    = $("cred-preview");
const elCredMsg        = $("cred-msg");
const elCredStatus     = $("cred-status");
const elCredLines      = $("cred-lines");
const elBtnCredCopy    = $("btn-cred-copy");
const elBtnCredDl      = $("btn-cred-download");
const elBtnCredConvert = $("btn-cred-convert");
const elCredManual     = $("cred-manual");

// ---------- State ----------
let logs = [];
let logBadgeCount = 0;
let activeTab = "workspace";
let isDirty = false;

// Credential state
let credCurrentFmt = "raw";     // "raw" | "cpa" | "sub"
let credRawSession = null;      // raw session JSON object
let credOutputText = "";        // current formatted text
let credOutputMime = "application/json";
let credOutputName = "session.json";

const DEFAULTS = {
  workspaceIds: "",
  intervalMs: 1500,
  maxRetries: 3,
  retryBackoffMs: 5000,
  sessionPollMs: 20000,
};

// ---------- Config ----------
async function loadConfig() {
  const resp = await chrome.runtime.sendMessage({ type: "GET_CONFIG" });
  const cfg = Object.assign({}, DEFAULTS, resp?.config || {});
  elWsInput.value = cfg.workspaceIds;
  elCfgInterval.value = cfg.intervalMs;
  elCfgRetries.value  = cfg.maxRetries;
  elCfgBackoff.value  = cfg.retryBackoffMs;
  elCfgPoll.value     = cfg.sessionPollMs;
  updateWsCount();
}

function getConfig() {
  return {
    workspaceIds: elWsInput.value.trim(),
    intervalMs:   parseInt(elCfgInterval.value) || 1500,
    maxRetries:   parseInt(elCfgRetries.value)  || 3,
    retryBackoffMs: parseInt(elCfgBackoff.value) || 5000,
    sessionPollMs:  parseInt(elCfgPoll.value)   || 20000,
  };
}

async function saveConfig() {
  const cfg = getConfig();
  await chrome.runtime.sendMessage({ type: "SAVE_CONFIG", config: cfg });
  markClean();
  addLog("workspace 配置已保存", "ok");
  showToast("已保存 ✓", "ok");
}

// ---------- Workspace Count ----------
function updateWsCount() {
  const ids = elWsInput.value.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
  elWsCount.textContent = `${ids.length} 个`;
}

// ---------- Dirty / Clean ----------
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

// ---------- Logging ----------
function addLog(msg, level = "info") {
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  logs.push({ time, msg, level });

  const emptyEl = elLogBody.querySelector(".log-empty");
  if (emptyEl) emptyEl.remove();

  const line = document.createElement("div");
  line.className = `log-line log-${level}`;
  line.innerHTML = `<span class="log-time">${time}</span><span class="log-msg">${escapeHtml(msg)}</span>`;
  elLogBody.appendChild(line);
  elLogBody.scrollTop = elLogBody.scrollHeight;

  elLogCount.textContent = `${logs.length} 条记录`;

  if (activeTab !== "log") {
    logBadgeCount++;
    elLogBadge.textContent = logBadgeCount > 99 ? "99+" : logBadgeCount;
    elLogBadge.style.display = "";
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- User Bar ----------
function fmtExp(exp) {
  if (!exp) return "?";
  const min = Math.round((exp * 1000 - Date.now()) / 60000);
  if (min > 60) return `剩余 ${Math.round(min / 60)} 小时`;
  return `剩余 ${min} 分钟`;
}

function updateUserBar(info, status) {
  elStatusDot.className = "status-dot " + (status || "");

  if (info && info.email) {
    elUserBar.innerHTML =
      `<span class="email">${escapeHtml(info.email)}</span>` +
      `<span class="plan">${escapeHtml(info.plan_type || "?")}</span>` +
      `<span class="exp">${escapeHtml(fmtExp(info.exp))}</span>`;
    elBtnRequest.disabled = false;
    elBtnAccept.disabled  = false;
  } else {
    const msg =
      status === "err"
        ? "session 获取失败，请确认已登录"
        : "未检测到 AT，等待登录...";
    elUserBar.innerHTML = `<span class="user-bar-waiting">● ${msg}</span>`;
    elBtnRequest.disabled = true;
    elBtnAccept.disabled  = true;
  }
}

// ---------- Run Action ----------
async function runAction(route) {
  const cfg = getConfig();
  if (!cfg.workspaceIds.trim()) {
    showToast("请先填写 Workspace ID", "warn");
    return;
  }

  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  if (!tabs.length) {
    showToast("请先打开 chatgpt.com 并登录", "err");
    addLog("未找到 chatgpt.com 标签页，请先打开并登录", "err");
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabs[0].id, {
      type: "RUN_ACTION",
      route,
      config: cfg,
    });
    setRunning(true, `正在执行 ${route}...`);
    addLog(`已发送 ${route} 指令，等待结果...`, "info");
  } catch (e) {
    showToast("通信失败：" + e.message, "err");
    addLog("通信失败：" + e.message, "err");
  }
}

async function refreshSession() {
  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  if (!tabs.length) {
    showToast("请先打开 chatgpt.com", "warn");
    return;
  }
  try {
    await chrome.tabs.sendMessage(tabs[0].id, { type: "REFRESH_SESSION" });
    addLog("正在刷新 session...", "info");
  } catch (e) {
    showToast("刷新失败：" + e.message, "err");
  }
}

// ---------- Running State ----------
function setRunning(running, text) {
  elRunIndicator.style.display = running ? "flex" : "none";
  if (text) elRunningText.textContent = text;
  elBtnRequest.disabled = running;
  elBtnAccept.disabled  = running;
}

// ---------- Chrome Message Listener ----------
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "LOG") {
    addLog(message.msg, message.level || "info");
  } else if (message.type === "SESSION_INFO") {
    updateUserBar(message.info, message.status);
  } else if (message.type === "RUN_START") {
    setRunning(true, "处理中...");
  } else if (message.type === "RUN_DONE") {
    setRunning(false);
    const { ok, total } = message;
    if (total > 0) {
      showToast(`完成：${ok}/${total} 成功`, ok === total ? "ok" : "warn");
    }
  }
});

// ---------- Tabs ----------
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    activeTab = tab;

    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

    btn.classList.add("active");
    $(`panel-${tab}`).classList.add("active");

    if (tab === "log") {
      logBadgeCount = 0;
      elLogBadge.style.display = "none";
    }
  });
});

// ---------- Advanced Toggle ----------
elBtnAdvanced.addEventListener("click", () => {
  const isOpen = elAdvancedBody.classList.toggle("open");
  elBtnAdvanced.classList.toggle("open", isOpen);
});

// ---------- Workspace Events ----------
elWsInput.addEventListener("input", () => {
  markDirty();
  updateWsCount();
});

elBtnSave.addEventListener("click", saveConfig);

elBtnClearWs.addEventListener("click", () => {
  elWsInput.value = "";
  updateWsCount();
  markDirty();
});

elBtnRefreshAT.addEventListener("click", refreshSession);
elBtnRequest.addEventListener("click", () => runAction("request"));
elBtnAccept.addEventListener("click",  () => runAction("accept"));

// ---------- Log Events ----------
elBtnClearLog.addEventListener("click", () => {
  logs = [];
  elLogBody.innerHTML = '<div class="log-empty">暂无日志</div>';
  elLogCount.textContent = "0 条记录";
});

// ============================================================
// CREDENTIAL PANEL
// ============================================================

// ---------- Format conversion helpers (mirrors gpt.learnlicen.dpdns.org logic) ----------

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DEFAULT_CLIENT_ID   = "app_EMoamEEZ73f0CkXaXp7hrann";
const DEFAULT_PRIVACY_MODE = "training_off";
const DEFAULT_PLAN_TYPE    = "free";

function firstText(...values) {
  for (const v of values) {
    const t = String(v ?? "").trim();
    if (t) return t;
  }
  return "";
}

function readObj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

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
  const r = n.length % 4;
  if (r) n += "=".repeat(4 - r);
  const b = atob(n);
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

function bytesToB64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeJwtPayload(token) {
  try {
    const parts = String(token ?? "").split(".");
    if (parts.length < 2) return {};
    const p = JSON.parse(decoder.decode(b64UrlToBytes(parts[1])));
    return p && typeof p === "object" && !Array.isArray(p) ? p : {};
  } catch { return {}; }
}

function extractAuth(payload) {
  return readObj(payload?.["https://api.openai.com/auth"]);
}

function extractProfile(payload) {
  return readObj(payload?.["https://api.openai.com/profile"]);
}

function extractAccountIdFromAuth(auth) {
  const id = firstText(auth?.chatgpt_account_id, auth?.account_id);
  if (id) return id;
  const uid = firstText(auth?.chatgpt_account_user_id);
  if (uid.includes("__")) return firstText(uid.split("__").pop());
  return "";
}

function toIsoUtc8(date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " +0800");
}

/** Build CPA JSON from a session object */
function buildCpaFromSession(session) {
  const accessToken = firstText(session?.accessToken, session?.access_token);
  const idToken     = firstText(session?.idToken, session?.id_token);
  const refreshToken = firstText(session?.refreshToken, session?.refresh_token);
  const sessionToken = firstText(session?.sessionToken, session?.session_token);

  const accessPayload = decodeJwtPayload(accessToken);
  const accessAuth    = extractAuth(accessPayload);
  const accessProfile = extractProfile(accessPayload);

  const userObj  = readObj(session?.user);
  const acctObj  = readObj(session?.account);

  const email = firstText(
    session?.email,
    userObj.email,
    accessProfile.email
  );

  const accountId = firstText(
    session?.chatgpt_account_id,
    session?.account_id,
    acctObj.id,
    extractAccountIdFromAuth(accessAuth)
  );

  const expiresAt = coerceTs(
    firstText(
      accessPayload?.exp,
      session?.expires,
      session?.expiresAt,
      session?.expires_at
    )
  );

  const now = new Date();
  return {
    type: "codex",
    email: email || "unknown",
    expired: expiresAt ? toIsoUtc8(new Date(expiresAt * 1000)) : "",
    id_token: idToken,
    account_id: accountId,
    disabled: false,
    access_token: accessToken,
    session_token: sessionToken,
    last_refresh: toIsoUtc8(now),
    refresh_token: refreshToken,
  };
}

/** Build sub2api bundle from a session object */
function buildSubFromSession(session) {
  const accessToken  = firstText(session?.accessToken, session?.access_token);
  const idToken      = firstText(session?.idToken, session?.id_token);
  const refreshToken = firstText(session?.refreshToken, session?.refresh_token);
  const sessionToken = firstText(session?.sessionToken, session?.session_token);

  const accessPayload = decodeJwtPayload(accessToken);
  const accessAuth    = extractAuth(accessPayload);
  const accessProfile = extractProfile(accessPayload);
  const userObj       = readObj(session?.user);
  const acctObj       = readObj(session?.account);

  const email = firstText(session?.email, userObj.email, accessProfile.email);
  const accountId = firstText(
    session?.chatgpt_account_id, session?.account_id,
    acctObj.id, extractAccountIdFromAuth(accessAuth)
  );
  const userId = firstText(
    session?.chatgpt_user_id, userObj.id,
    accessAuth.chatgpt_user_id, accessAuth.user_id
  );
  const orgId = firstText(
    session?.organization_id, accessAuth.organization_id
  );
  const planType = firstText(
    session?.plan_type, acctObj.planType, acctObj.plan_type,
    accessAuth.chatgpt_plan_type, DEFAULT_PLAN_TYPE
  );

  const now = new Date();
  let expiresAt = coerceTs(firstText(accessPayload?.exp, session?.expires));
  if (!expiresAt) expiresAt = Math.trunc(now.getTime() / 1000) + 863999;

  return {
    exported_at: now.toISOString(),
    proxies: [],
    accounts: [
      {
        name: email || accountId || "account",
        platform: "openai",
        type: "oauth",
        credentials: {
          access_token: accessToken,
          chatgpt_account_id: accountId,
          chatgpt_user_id: userId,
          client_id: firstText(session?.client_id, DEFAULT_CLIENT_ID),
          email: email || "unknown",
          expires_at: expiresAt,
          id_token: idToken,
          organization_id: orgId,
          plan_type: planType,
          refresh_token: refreshToken,
          session_token: sessionToken,
        },
        extra: {
          email: email || "unknown",
          auth_provider: firstText(session?.authProvider, session?.auth_provider),
          source: "chatgpt_web_session",
          openai_oauth_responses_websockets_v2_enabled: false,
          openai_oauth_responses_websockets_v2_mode: "off",
          privacy_mode: firstText(session?.privacy_mode, DEFAULT_PRIVACY_MODE),
        },
        concurrency: 10,
        priority: 1,
        rate_multiplier: 1,
        auto_pause_on_expired: true,
      },
    ],
  };
}

/** Convert rawSession object → formatted text based on current format */
function formatSession(sessionObj, fmt) {
  if (!sessionObj) return null;
  switch (fmt) {
    case "raw":
      return { text: JSON.stringify(sessionObj, null, 2), mime: "application/json", name: "session_raw.json" };
    case "cpa": {
      const cpa = buildCpaFromSession(sessionObj);
      return { text: JSON.stringify(cpa, null, 2), mime: "application/json", name: "session_cpa.json" };
    }
    case "sub": {
      const sub = buildSubFromSession(sessionObj);
      return { text: JSON.stringify(sub, null, 2), mime: "application/json", name: "session_sub2api.json" };
    }
    default:
      return null;
  }
}

/** Render formatted output into preview */
function renderCredOutput(result) {
  if (!result) return;
  credOutputText = result.text;
  credOutputMime = result.mime;
  credOutputName = result.name;

  elCredPreview.textContent = result.text;
  elCredPreview.className   = "cred-preview has-data";
  const lines = result.text.split("\n").length;
  elCredLines.textContent   = `${lines} 行`;
  elBtnCredCopy.disabled    = false;
  elBtnCredDl.disabled      = false;
}

function setCredMsg(msg, type = "") {
  elCredMsg.textContent  = msg;
  elCredMsg.className    = "cred-msg " + type;
}

function setCredStatus(msg, type = "") {
  elCredStatus.textContent = msg;
  elCredStatus.className   = "cred-status " + type;
}

/** Apply current format to existing session */
function applyCredFmt() {
  if (!credRawSession) {
    setCredMsg("暂无 session 数据，请先获取或手动输入", "warn");
    return;
  }
  const result = formatSession(credRawSession, credCurrentFmt);
  if (result) {
    renderCredOutput(result);
    const fmtLabel = { raw: "原始 JSON", cpa: "CPA JSON", sub: "sub2api bundle" }[credCurrentFmt];
    setCredMsg(`已转换为 ${fmtLabel}`, "ok");
  }
}

// ---------- Format button toggle ----------
document.querySelectorAll(".cred-fmt-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".cred-fmt-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    credCurrentFmt = btn.dataset.fmt;
    applyCredFmt();
  });
});

// ---------- Fetch session via content script ----------
elBtnFetchSess.addEventListener("click", async () => {
  elBtnFetchSess.disabled = true;
  setCredStatus("获取中...", "warn");
  setCredMsg("");

  try {
    const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
    if (!tabs.length) {
      throw new Error("未找到 chatgpt.com 标签页，请先打开并登录");
    }

    // Ask content script to fetch session and return it
    const resp = await chrome.tabs.sendMessage(tabs[0].id, {
      type: "FETCH_SESSION_DATA",
      url: elCredUrl.value.trim() || "https://chatgpt.com/api/auth/session",
    });

    if (!resp || !resp.ok) {
      throw new Error(resp?.error || "获取失败");
    }

    credRawSession = resp.data;
    addLog("Session 数据已获取", "ok");
    setCredStatus("✓ 已获取", "ok");
    applyCredFmt();
  } catch (e) {
    setCredStatus("✗ 失败", "err");
    setCredMsg(e.message, "err");
    elCredPreview.textContent = e.message;
    elCredPreview.className   = "cred-preview error-state";
    addLog("Session 获取失败: " + e.message, "err");
  } finally {
    elBtnFetchSess.disabled = false;
  }
});

// ---------- Manual JSON convert ----------
elBtnCredConvert.addEventListener("click", () => {
  const text = elCredManual.value.trim();
  if (!text) {
    setCredMsg("请粘贴 JSON 数据", "warn");
    return;
  }
  try {
    credRawSession = JSON.parse(text);
    setCredStatus("✓ 已解析", "ok");
    applyCredFmt();
    setCredMsg("手动 JSON 解析成功", "ok");
  } catch (e) {
    setCredMsg("JSON 解析失败: " + e.message, "err");
    elCredPreview.textContent = "JSON 解析失败: " + e.message;
    elCredPreview.className   = "cred-preview error-state";
  }
});

// ---------- Copy ----------
elBtnCredCopy.addEventListener("click", async () => {
  if (!credOutputText) return;
  await copyText(credOutputText);
  const orig = elBtnCredCopy.innerHTML;
  elBtnCredCopy.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg> 已复制`;
  setCredMsg("已复制到剪贴板 ✓", "ok");
  showToast("已复制 ✓", "ok");
  setTimeout(() => { elBtnCredCopy.innerHTML = orig; }, 2000);
});

// ---------- Download ----------
elBtnCredDl.addEventListener("click", () => {
  if (!credOutputText) return;
  const blob = new Blob([credOutputText], { type: credOutputMime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = credOutputName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setCredMsg(`已下载 ${credOutputName}`, "ok");
});

// ============================================================
// GMAIL ALIAS GENERATOR
// ============================================================

function randomChar(chars) {
  return chars[Math.floor(Math.random() * chars.length)];
}

function generateAlias(baseEmail, prefix, length, useLetters, useNumbers, useDots) {
  const [localPart, domain] = baseEmail.split("@");
  if (!domain) return null;

  let charset = "";
  if (useLetters) charset += "abcdefghijklmnopqrstuvwxyz";
  if (useNumbers) charset += "0123456789";
  if (!charset) charset = "abcdefghijklmnopqrstuvwxyz0123456789";

  let alias;
  if (prefix.trim()) {
    alias = prefix.trim();
  } else {
    let rand = "";
    if (useLetters) {
      rand += randomChar("abcdefghijklmnopqrstuvwxyz");
    } else {
      rand += randomChar(charset);
    }

    for (let i = 1; i < length; i++) {
      if (useDots && rand.length > 0 && !rand.endsWith(".") && Math.random() < 0.15) {
        rand += ".";
      } else {
        rand += randomChar(charset);
      }
    }
    alias = rand.replace(/\.$/, "");
  }

  return `${localPart}+${alias}@${domain}`;
}

elBtnGenAlias.addEventListener("click", () => {
  const base = elGmailBase.value.trim();
  if (!base || !base.includes("@")) {
    showToast("请输入有效的 Gmail 账号", "warn");
    elGmailBase.focus();
    return;
  }

  const prefix     = elAliasPrefix.value;
  const length     = parseInt(elAliasLength.value) || 8;
  const count      = parseInt(elAliasCount.value)  || 5;
  const useLetters = elAliasLetters.checked;
  const useNumbers = elAliasNumbers.checked;
  const useDots    = elAliasDots.checked;

  const generated = [];
  const seen = new Set();

  for (let i = 0; i < Math.min(count, 50); i++) {
    let email;
    let attempts = 0;
    do {
      email = generateAlias(base, prefix, length, useLetters, useNumbers, useDots);
      attempts++;
    } while (seen.has(email) && attempts < 20);

    if (email && !seen.has(email)) {
      seen.add(email);
      generated.push(email);
    }
  }

  renderAliasList(generated);
  elAliasSection.style.display = "";
  addLog(`已生成 ${generated.length} 个 Gmail 别名`, "ok");
});

function renderAliasList(emails) {
  elAliasList.innerHTML = "";
  emails.forEach((email) => {
    const item = document.createElement("div");
    item.className = "alias-item";
    item.innerHTML = `
      <span class="alias-email" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
      <button class="alias-copy-btn" title="复制邮箱" data-email="${escapeHtml(email)}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>`;
    elAliasList.appendChild(item);
  });

  elAliasList.querySelectorAll(".alias-copy-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await copyText(btn.dataset.email);
      btn.classList.add("copied");
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>`;
      }, 1800);
    });
  });
}

elBtnCopyAll.addEventListener("click", async () => {
  const all = [...elAliasList.querySelectorAll(".alias-email")]
    .map(el => el.textContent)
    .join("\n");
  await copyText(all);
  showToast(`已复制 ${elAliasList.querySelectorAll(".alias-item").length} 个邮箱`, "ok");
});

// ---------- Copy Utility ----------
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

// ---------- Toast ----------
let toastTimer = null;

function showToast(msg, type = "") {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = "toast show " + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ---------- Init ----------
async function init() {
  await loadConfig();

  const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
  if (tabs.length) {
    try {
      await chrome.tabs.sendMessage(tabs[0].id, { type: "GET_SESSION" });
    } catch (_) {}
  }

  addLog("插件已加载，等待 ChatGPT 会话...", "info");
}

init();
