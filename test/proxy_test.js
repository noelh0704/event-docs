// 中繼服務測試：用假的 Google 服務執行 proxy/Code.gs
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(__dirname + '/../proxy/Code.gs', 'utf8');
function makeEnv(opts) {
  const props = Object.assign({ ANTHROPIC_API_KEY: 'k', ACCESS_CODE: 'secret-code' }, opts.props || {});
  const cache = {}; let fetches = 0, slept = 0;
  const ctx = {
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = v; },
      getProperties: () => Object.assign({}, props), deleteProperty: (k) => { delete props[k]; } }) },
    CacheService: { getScriptCache: () => ({ get: (k) => cache[k] || null, put: (k, v) => { cache[k] = v; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: { sleep: (ms) => { slept += ms; }, formatDate: (d, tz, f) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).replace(/-/g, '') },
    UrlFetchApp: { fetch: () => { fetches++; return opts.apiFail ? { getResponseCode: () => 500, getContentText: () => '{"error":{"message":"boom"}}' } : { getResponseCode: () => 200, getContentText: () => '{"content":[{"type":"text","text":"ok"}]}' }; } },
    ContentService: { createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }), MimeType: { JSON: 'json' } },
    Date, Math, Number, String, JSON, Object,
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const post = (body) => ctx.doPost({ postData: { contents: JSON.stringify(body) } });
  return { post, props, info: () => ({ fetches, slept }) };
}
const assert = (c, m) => { if (!c) { console.error('FAIL:', m); process.exit(1); } else console.log('ok -', m); };
const tz = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d).replace(/-/g, '');
const today = 'USAGE_' + tz(new Date());

let E = makeEnv({});
let r = E.post({ code: 'secret-code', action: 'status' });
assert(r.usage.used === 0 && r.usage.remaining === 100 && E.info().fetches === 0, '查詢次數不呼叫 AI、不扣次數');
r = E.post({ code: 'secret-code', prompt: 'hi' });
assert(r.text === 'ok' && r.usage.used === 1 && r.usage.remaining === 99 && E.props[today] === '1', '成功呼叫扣 1 次並回傳剩餘');
E.props[today] = '99';
r = E.post({ code: 'secret-code', prompt: 'hi' });
assert(r.usage.remaining === 0, '第 100 次成功，剩 0');
r = E.post({ code: 'secret-code', prompt: 'hi' });
assert(/已達上限/.test(r.error) && r.usage.remaining === 0 && E.info().fetches === 2, '達上限後擋下，不再呼叫 AI');

E = makeEnv({ apiFail: true });
r = E.post({ code: 'secret-code', prompt: 'hi' });
assert(/AI 服務回應錯誤/.test(r.error) && !E.props[today], 'AI 呼叫失敗不扣次數');

E = makeEnv({});
r = E.post({ code: 'wrong', action: 'status' });
assert(/存取碼錯誤/.test(r.error) && !r.usage && E.info().slept === 1500, '錯誤存取碼：延遲回應、不透露使用次數');
for (let i = 0; i < 19; i++) E.post({ code: 'wrong' });
r = E.post({ code: 'secret-code', action: 'status' });
assert(/暫停/.test(r.error), '錯誤 20 次後暫停服務');

const old = new Date(Date.now() - 9 * 864e5);
E = makeEnv({ props: { ['USAGE_' + tz(old)]: '50', USAGE_20991231: '3' } });
r = E.post({ code: 'secret-code', prompt: 'hi' });
assert(!('USAGE_' + tz(old) in E.props) && r.usage.used === 1, '舊紀錄清除、新的一天從 0 開始');
r = E.post({ code: 'secret-code' });
assert(/沒有收到內容/.test(r.error), '空白內容不扣次數');
console.log('全部通過');
