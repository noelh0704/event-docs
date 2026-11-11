/**
 * 活動文件公版平台｜AI 中繼服務（Google Apps Script）
 *
 * 用途：替網站保管 Claude API 金鑰。網站把寫稿需求送到這裡，這裡再轉送給 Claude。
 * 金鑰與存取碼都放在「指令碼屬性」，不會出現在程式碼或網站上。
 *
 * 安裝步驟請見 README.md 的「開啟 AI 代寫」。
 */

// ===== 設定區 =====
const CONFIG = {
  API_URL: 'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',
  DEFAULT_MODEL: 'claude-sonnet-5-5', // 預設模型；網站「設定」可另外指定
  MAX_TOKENS_LIMIT: 8000,             // 單次回覆上限
  MAX_PROMPT_CHARS: 60000,            // 單次輸入字數上限，避免被濫用
  PROP_API_KEY: 'ANTHROPIC_API_KEY',  // 指令碼屬性名稱：Claude API 金鑰
  PROP_ACCESS_CODE: 'ACCESS_CODE',    // 指令碼屬性名稱：同事使用的存取碼
};

function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiKey = props.getProperty(CONFIG.PROP_API_KEY);
    const accessCode = props.getProperty(CONFIG.PROP_ACCESS_CODE);
    if (!apiKey || !accessCode) return out({ error: '中繼服務尚未完成設定（缺少金鑰或存取碼）。' });

    const req = JSON.parse(e.postData.contents);
    if (String(req.code || '') !== accessCode) return out({ error: '存取碼錯誤，請到「設定」確認。' });

    const prompt = String(req.prompt || '');
    if (!prompt) return out({ error: '沒有收到內容。' });
    if (prompt.length > CONFIG.MAX_PROMPT_CHARS) return out({ error: '內容太長，請分段處理。' });

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
      return out({ error: 'AI 服務回應錯誤：' + ((data.error && data.error.message) || res.getResponseCode()) });
    }
    const text = (data.content || []).filter(function (c) { return c.type === 'text'; }).map(function (c) { return c.text; }).join('');
    return out({ text: text });
  } catch (err) {
    return out({ error: '中繼服務發生錯誤：' + err });
  }
}

// 用瀏覽器打開網址時顯示，方便確認部署成功
function doGet() {
  return out({ ok: true, message: '活動文件公版平台 AI 中繼服務運作中' });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
