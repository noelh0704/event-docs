/**
 * 活動文件公版平台｜AI 中繼服務（Google Apps Script）
 *
 * 用途：替網站保管 Claude API 金鑰。網站把寫稿需求送到這裡，這裡再轉送給 Claude。
 * 金鑰與存取碼都放在「指令碼屬性」，不會出現在程式碼或網站上。
 *
 * 保護機制：
 *   1. 每日使用上限：全公司共用一個總數，到上限後當天停用，隔天 0 點（台灣時間）自動恢復
 *   2. 存取碼錯誤保護：每次輸錯延遲回應；短時間內錯太多次，暫停服務一段時間
 *
 * 安裝與更新步驟請見 README.md 的「開啟 AI 代寫」。
 * 修改這份程式後，要到「部署 → 管理部署作業 → 編輯 → 版本選『新版本』→ 部署」才會生效。
 */

// ===== 設定區 =====
const CONFIG = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',
  DEFAULT_MODEL: 'claude-sonnet-5-5', // 預設模型；網站「設定」可另外指定
  MAX_TOKENS_LIMIT: 8000,             // 單次回覆上限
  MAX_PROMPT_CHARS: 60000,            // 單次輸入字數上限，避免被濫用
  DAILY_LIMIT: 100,                   // 每日 AI 使用次數上限（全公司共用）
  TIMEZONE: 'Asia/Taipei',            // 每日上限依這個時區的日期計算
  FAIL_DELAY_MS: 1500,                // 存取碼錯誤時，延遲多久才回應（毫秒）
  FAIL_MAX: 20,                       // 在 FAIL_WINDOW_SEC 秒內錯誤超過這個次數，就暫停服務
  FAIL_WINDOW_SEC: 600,               // 錯誤次數的計算區間與暫停時間（秒）
  KEEP_USAGE_DAYS: 7,                 // 使用次數紀錄保留天數
  PROP_API_KEY: 'ANTHROPIC_API_KEY',  // 指令碼屬性名稱：Claude API 金鑰
  PROP_ACCESS_CODE: 'ACCESS_CODE',    // 指令碼屬性名稱：同事使用的存取碼
};

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty(CONFIG.PROP_API_KEY);
    const accessCode = props.getProperty(CONFIG.PROP_ACCESS_CODE);
    if (!apiKey || !accessCode) return out({ error: '中繼服務尚未完成設定（缺少金鑰或存取碼）。' });

    // 錯誤太多次時暫停服務
    const cache = CacheService.getScriptCache();
    const fails = Number(cache.get('FAILS') || 0);
    if (fails >= CONFIG.FAIL_MAX) return out({ error: '存取碼錯誤次數過多，服務暫停中，請約 10 分鐘後再試。' });

    const req = JSON.parse(e.postData.contents);
    if (String(req.code || '') !== accessCode) {
      cache.put('FAILS', String(fails + 1), CONFIG.FAIL_WINDOW_SEC);
      Utilities.sleep(CONFIG.FAIL_DELAY_MS);
      return out({ error: '存取碼錯誤，請到「設定」確認。' });
    }

    // 只查詢今日剩餘次數
    if (req.action === 'status') return out({ ok: true, usage: usage(props) });

    // 已達每日上限
    const before = usage(props);
    if (before.remaining <= 0) {
      return out({ error: `今日 AI 使用次數已達上限（${CONFIG.DAILY_LIMIT} 次），明天 0 點後恢復。`, usage: before });
    }

    const prompt = String(req.prompt || '');
    if (!prompt) return out({ error: '沒有收到內容。', usage: before });
    if (prompt.length > CONFIG.MAX_PROMPT_CHARS) return out({ error: '內容太長，請分段處理。', usage: before });

    const payload = {
      model: req.model || CONFIG.DEFAULT_MODEL,
      max_tokens: Math.min(Number(req.maxTokens) || CONFIG.MAX_TOKENS_LIMIT, CONFIG.MAX_TOKENS_LIMIT),
      system: String(req.system || ''),
      messages: [{ role: 'user', content: prompt }],
    };
    const res = UrlFetchApp.fetch(CONFIG.API_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-api-key': apiKey, 'anthropic-version': CONFIG.API_VERSION },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const data = JSON.parse(res.getContentText());
    if (res.getResponseCode() !== 200) {
      // 呼叫失敗不計入次數
      return out({ error: 'AI 服務回應錯誤：' + ((data.error && data.error.message) || res.getResponseCode()), usage: before });
    }
    const text = (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    return out({ text: text, usage: addUsage(props) });
  } catch (err) {
    return out({ error: '中繼服務發生錯誤：' + err });
  }
}

// 用瀏覽器打開網址時顯示，方便確認部署成功（不顯示任何使用資訊）
function doGet() {
  return out({ ok: true, message: '活動文件公版平台 AI 中繼服務運作中' });
}

// ===== 每日使用次數 =====
function todayKey() {
  return 'USAGE_' + Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyyMMdd');
}

function usage(props) {
  const used = Number(props.getProperty(todayKey()) || 0);
  return { used: used, limit: CONFIG.DAILY_LIMIT, remaining: Math.max(0, CONFIG.DAILY_LIMIT - used) };
}

// 成功呼叫後加一次；用鎖避免多人同時使用時計數錯誤
function addUsage(props) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const key = todayKey();
    props.setProperty(key, String(Number(props.getProperty(key) || 0) + 1));
    cleanOldUsage(props);
    return usage(props);
  } finally {
    lock.releaseLock();
  }
}

// 刪除超過保留天數的舊紀錄
function cleanOldUsage(props) {
  const cutoff = Utilities.formatDate(new Date(Date.now() - CONFIG.KEEP_USAGE_DAYS * 864e5), CONFIG.TIMEZONE, 'yyyyMMdd');
  Object.keys(props.getProperties()).forEach(function (k) {
    if (/^USAGE_\d{8}$/.test(k) && k.slice(6) < cutoff) props.deleteProperty(k);
  });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
