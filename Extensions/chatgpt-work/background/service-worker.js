// Background Service Worker
// Opens side panel on extension icon click + handles messages

// Open side panel when user clicks the extension icon
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onInstalled.addListener(() => {
  console.log('[WJ] ChatGPT Workspace Joiner v4.1 installed.');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'GET_CONFIG') {
      const data = await chrome.storage.local.get('jr_config_v4');
      sendResponse({ config: data.jr_config_v4 || null });
    } else if (message.type === 'SAVE_CONFIG') {
      await chrome.storage.local.set({ jr_config_v4: message.config });
      sendResponse({ ok: true });
    } else if (message.type === 'CLEAR_AND_LOGIN') {
      try {
        const email = message.email;
        // 1. 保存待登录邮箱
        await chrome.storage.local.set({ pendingEmailLogin: email });
        
        // 2. 尝试打开无痕窗口（干净的会话环境，且不会影响主窗口登录）
        await chrome.windows.create({
          url: "https://chatgpt.com/auth/login",
          incognito: true
        });
        sendResponse({ ok: true });
      } catch (e) {
        // 如果无痕模式被禁用或限制，使用清除缓存并在普通窗口打开的备用方案
        try {
          await chrome.browsingData.remove({
            origins: [
              "https://chatgpt.com",
              "https://auth.openai.com"
            ]
          }, {
            cookies: true,
            localStorage: true,
            cache: true,
            indexedDB: true
          });
          await chrome.tabs.create({ url: "https://chatgpt.com/auth/login" });
          sendResponse({ ok: true });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      }
    }
  })();
  return true;
});
