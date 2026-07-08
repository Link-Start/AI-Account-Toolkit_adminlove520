// Content Script — injected into chatgpt.com
// Handles actual API calls using the page's auth session

(function () {
  "use strict";

  const DEFAULTS = {
    workspaceIds: "",
    intervalMs: 1500,
    maxRetries: 3,
    retryBackoffMs: 5000,
    sessionPollMs: 20000,
  };

  const STATE = {
    at: "",
    session: null,
    deviceId: crypto.randomUUID(),
    running: false,
  };

  // ---------- Session ----------
  async function fetchSession() {
    const res = await fetch("/api/auth/session", {
      headers: { accept: "*/*" },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`session HTTP ${res.status}`);
    return res.json();
  }

  function decodeJwt(at) {
    try {
      const p = at.split(".")[1];
      const j = JSON.parse(atob(p.replace(/-/g, "+").replace(/_/g, "/")));
      const auth = j["https://api.openai.com/auth"] || {};
      const prof = j["https://api.openai.com/profile"] || {};
      return {
        account_id: auth.chatgpt_account_id || "",
        email: prof.email || "",
        plan_type: auth.chatgpt_plan_type || "",
        exp: j.exp || 0,
      };
    } catch (_) { return {}; }
  }

  async function refreshSession() {
    try {
      const s = await fetchSession();
      const at = s.accessToken || "";
      if (at && at !== STATE.at) {
        STATE.at = at;
        STATE.session = s;
        const info = decodeJwt(at);
        postLog(`子号 AT 已更新: ${info.email || "?"}`, "ok");
        postSessionInfo(info, "ok");
      } else if (!at) {
        postSessionInfo(null, "warn");
      }
    } catch (e) {
      postLog(`session 获取失败: ${e.message}`, "warn");
      postSessionInfo(null, "err");
    }
  }

  function postLog(msg, level) {
    chrome.runtime.sendMessage({ type: 'LOG', msg, level }).catch(() => {});
  }

  function postSessionInfo(info, status) {
    chrome.runtime.sendMessage({ type: 'SESSION_INFO', info, status }).catch(() => {});
  }

  // ---------- API Request ----------
  async function sendOne(wsId, route, config, attempt) {
    attempt = attempt || 0;
    const url = `/backend-api/accounts/${wsId}/invites/${route}`;
    const headers = {
      accept: "*/*",
      authorization: "Bearer " + STATE.at,
      "content-type": "application/json",
      "oai-device-id": STATE.deviceId,
      "oai-language": navigator.language || "en-US",
    };
    postLog(`→ POST /accounts/${wsId.slice(0, 8)}/invites/${route} (第 ${attempt + 1} 次)`);
    try {
      const res = await fetch(url, {
        method: "POST", headers, body: "", mode: "cors", credentials: "include",
      });
      const text = await res.text();
      if (res.ok) {
        postLog(`✓ ${wsId.slice(0, 8)} HTTP ${res.status}: ${text}`, "ok");
        return true;
      }
      postLog(`✗ ${wsId.slice(0, 8)} HTTP ${res.status}: ${text.slice(0, 180)}`, "warn");
      if (res.status === 401 || res.status === 403) {
        postLog("子号 AT 失效，刷新 session...", "warn");
        STATE.at = "";
        await refreshSession();
        if (attempt < config.maxRetries) {
          await sleep(2000);
          return sendOne(wsId, route, config, attempt + 1);
        }
        return false;
      }
      if (attempt < config.maxRetries) {
        await sleep(config.retryBackoffMs * (attempt + 1));
        return sendOne(wsId, route, config, attempt + 1);
      }
      return false;
    } catch (e) {
      postLog(`网络错误: ${e.message}`, "err");
      if (attempt < config.maxRetries) {
        await sleep(config.retryBackoffMs);
        return sendOne(wsId, route, config, attempt + 1);
      }
      return false;
    }
  }

  async function exchangeToken(wsId) {
    const url = `/api/auth/session?exchange_workspace_token=true&workspace_id=${wsId}&reason=setCurrentAccount`;
    postLog(`[切换空间] 发起请求: workspace_id=${wsId.slice(0, 8)}...`);
    const res = await fetch(url, {
      headers: { accept: "*/*" },
      credentials: "include",
    });
    postLog(`[切换空间] 响应状态 HTTP ${res.status}`);
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} - ${errText.slice(0, 100)}`);
    }
    const data = await res.json();
    const info = decodeJwt(data.accessToken || "");
    postLog(`[切换空间] 成功取得新 Session, 账号: ${info.email || "unknown"}`, "ok");
    return data;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function runAll(route, config) {
    if (STATE.running) {
      postLog("正在运行中，请稍候", "warn");
      chrome.runtime.sendMessage({ type: 'RUN_DONE', ok: 0, total: 0 }).catch(() => {});
      return;
    }
    if (!STATE.at) {
      postLog("无可用 AT，刷新 session...", "warn");
      await refreshSession();
      if (!STATE.at) {
        postLog("仍未取到 AT，请先登录 chatgpt.com", "err");
        chrome.runtime.sendMessage({ type: 'RUN_DONE', ok: 0, total: 0 }).catch(() => {});
        return;
      }
    }
    const ids = config.workspaceIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) {
      postLog("未配置 workspace ID", "err");
      chrome.runtime.sendMessage({ type: 'RUN_DONE', ok: 0, total: 0 }).catch(() => {});
      return;
    }

    STATE.running = true;
    chrome.runtime.sendMessage({ type: 'RUN_START' }).catch(() => {});
    postLog(`开始处理 ${ids.length} 个 workspace（${route}）`, "info");
    let ok = 0;
    const sessions = [];
    for (const ws of ids) {
      const r = await sendOne(ws, route, config);
      if (r) {
        ok++;
        try {
          const wsSession = await exchangeToken(ws);
          sessions.push(wsSession);
          postLog(`✓ 工作空间 ${ws.slice(0, 8)} 切换成功`, "ok");
        } catch (e) {
          postLog(`✗ 工作空间 ${ws.slice(0, 8)} 切换失败: ${e.message}`, "warn");
        }
      }
      if (ids.length > 1) await sleep(config.intervalMs);
    }
    postLog(`完成：成功 ${ok}/${ids.length}`, ok === ids.length ? "ok" : "warn");
    STATE.running = false;
    chrome.runtime.sendMessage({ type: 'RUN_DONE', ok, total: ids.length, sessions }).catch(() => {});
  }

  // ---------- Message Listener ----------
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
    } else if (message.type === 'RUN_ACTION') {
      runAll(message.route, Object.assign({}, DEFAULTS, message.config));
      sendResponse({ ok: true });
    } else if (message.type === 'REFRESH_SESSION') {
      refreshSession().then(() => sendResponse({ ok: true }));
      return true;
    } else if (message.type === 'GET_SESSION') {
      refreshSession().then(() => {
        if (STATE.at) {
          const info = decodeJwt(STATE.at);
          postSessionInfo(info, "ok");
        } else {
          postSessionInfo(null, "warn");
        }
        sendResponse({ ok: true });
      });
      return true;
    } else if (message.type === 'FETCH_SESSION_DATA') {
      // Fetch raw session JSON and return it to popup
      const url = message.url || '/api/auth/session';
      fetch(url, { headers: { accept: '*/*' }, credentials: 'include' })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          // Also update local state
          if (data.accessToken && data.accessToken !== STATE.at) {
            STATE.at = data.accessToken;
            STATE.session = data;
            const info = decodeJwt(data.accessToken);
            postLog(`Session 已刷新: ${info.email || '?'}`, 'ok');
            postSessionInfo(info, 'ok');
          }
          sendResponse({ ok: true, data });
        })
        .catch(e => sendResponse({ ok: false, error: e.message }));
      return true; // keep channel open for async
    } else if (message.type === 'FETCH_WORKSPACES') {
      (async () => {
        try {
          const checkRes = await fetch('/backend-api/accounts/check/v4-2023-04-27?timezone_offset_min=-480', {
            headers: {
              accept: '*/*',
              authorization: 'Bearer ' + STATE.at,
            },
            credentials: 'include',
          });
          if (!checkRes.ok) throw new Error(`HTTP ${checkRes.status}`);
          const data = await checkRes.json();
          
          const accountsMap = data?.accounts || {};
          const ordering = data?.account_ordering || Object.keys(accountsMap);
          
          // Get workspaces to fetch member counts
          const workspaceIds = ordering.filter(id => accountsMap[id]?.account?.structure === "workspace");
          
          // Fetch counts sequentially to prevent cookie race conditions
          for (const wsId of workspaceIds) {
            try {
              const exUrl = `/api/auth/session?exchange_workspace_token=true&workspace_id=${wsId}&reason=setCurrentAccount`;
              const exRes = await fetch(exUrl, { credentials: 'include' });
              if (!exRes.ok) continue;
              const exData = await exRes.json();
              const token = exData.accessToken;
              if (!token) continue;
              
              const usersUrl = `/backend-api/accounts/${wsId}/users?offset=0&limit=1&query=`;
              const usersRes = await fetch(usersUrl, {
                headers: {
                  accept: '*/*',
                  authorization: 'Bearer ' + token,
                  'chatgpt-account-id': wsId
                },
                credentials: 'include'
              });
              if (!usersRes.ok) continue;
              const usersData = await usersRes.json();
              if (accountsMap[wsId]?.account) {
                accountsMap[wsId].account.member_count = usersData.total ?? "?";
              }
            } catch (_) {}
          }
          
          sendResponse({ ok: true, data });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    } else if (message.type === 'LEAVE_WORKSPACE') {
      const wsId = message.workspaceId;
      (async () => {
        try {
          postLog(`[开始下车] 空间 ID: ${wsId}...`);
          // 1. Exchange token first to get target workspace session
          const exUrl = `/api/auth/session?exchange_workspace_token=true&workspace_id=${wsId}&reason=setCurrentAccount`;
          const exRes = await fetch(exUrl, { credentials: 'include' });
          if (!exRes.ok) throw new Error(`Token交换失败 HTTP ${exRes.status}`);
          const exData = await exRes.json();
          
          const token = exData.accessToken;
          const accountId = exData?.account?.id || wsId;
          const userId = exData?.user?.id;
          if (!token || !userId) throw new Error("未能获取有效的 Token 或 用户ID");
          
          // 2. Delete user from workspace
          const delUrl = `/backend-api/accounts/${accountId}/users/${userId}`;
          const delRes = await fetch(delUrl, {
            method: 'DELETE',
            headers: {
              'authorization': `Bearer ${token}`,
              'content-type': 'application/json',
            },
            credentials: 'include',
          });
          
          const delText = await delRes.text();
          let success = false;
          try {
            const delData = JSON.parse(delText);
            success = !!delData.success;
          } catch (_) {}
          
          if (delRes.ok || success) {
            postLog(`✓ 成功下车空间: ${wsId.slice(0, 8)}`, "ok");
            sendResponse({ ok: true });
          } else {
            throw new Error(`HTTP ${delRes.status}: ${delText}`);
          }
        } catch (e) {
          postLog(`✗ 下车失败: ${e.message}`, "err");
          sendResponse({ ok: false, error: e.message });
        }
      })();
      return true;
    }
    return false;
  });

  // ---------- Auto-fill Login Email ----------
  function checkAndAutofill() {
    try {
      chrome.storage.local.get("pendingEmailLogin", (res) => {
        const email = res?.pendingEmailLogin;
        if (!email) return;

        let attempts = 0;
        const timer = setInterval(() => {
          attempts++;
          const input = document.querySelector('input[type="email"], input[name="username"], input#username, input#email');
          if (input) {
            clearInterval(timer);
            input.focus();
            input.value = email;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            
            // 填完后即时清空，避免下次加载再次自动填入
            chrome.storage.local.remove("pendingEmailLogin");
            console.log(`[WJ] 自动填入邮箱成功: ${email}`);
          }
          if (attempts > 30) { // 9 秒超时
            clearInterval(timer);
          }
        }, 300);
      });
    } catch (_) {}
  }

  // ---------- Boot ----------
  const isChatGPT = window.location.hostname.endsWith("chatgpt.com");

  if (isChatGPT) {
    refreshSession();
    setInterval(refreshSession, DEFAULTS.sessionPollMs);
    window.addEventListener("focus", () => { if (!STATE.running) refreshSession(); });
    console.log("[WJ] Content script active (chatgpt.com)");
  } else {
    console.log("[WJ] Content script active (auth.openai.com)");
  }

  // 两个域名均检查并尝试自动填充
  checkAndAutofill();
})();
