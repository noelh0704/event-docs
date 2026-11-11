// ===== 活動文件公版平台｜主程式 =====
(function () {
  const T = window.EDTemplates;
  const esc = window.EDRenderHTML.esc;
  const $ = (s, el) => (el || document).querySelector(s);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- 資料 ----------
  function blankPress() {
    const o = {};
    Object.keys(T.PRESS_TYPES).forEach((k) => (o[k] = { issuer: '', date: '', contact: '', headline: '', subhead: '', highlights: '', body: '', closing: '', captions: '' }));
    return o;
  }
  function blankEvent() {
    const notices = {};
    Object.keys(T.AUDIENCES).forEach((k) => (notices[k] = { intro: '', notes: '', bring: '', closing: '' }));
    return {
      name: '', series: '', theme: '', dateText: '', timeText: '', venue: '', address: '', headcount: '',
      orgGuide: '', orgHost: '', orgCo: '', orgExec: CONFIG.company.name, description: '', setup: '', teardown: '',
      checkinTime: '', checkinPlace: '', staffCall: '', transport: '', postMentions: '',
      contact: { name: '', phone: '', onsite: '', email: '' }, venueMap: null,
      teams: [], vips: [], schedule: [], notices, mc: { host: '', adlibs: '' },
      sops: [], emergencies: [], supplyReminders: SAMPLE_EVENT.supplyReminders, supplies: [],
      press: blankPress(), speeches: [], posts: [], _ver: {},
    };
  }
  // 補齊缺少的欄位（舊版專案檔或 AI 匯入後使用）
  function normalize(e) {
    const base = blankEvent();
    const out = Object.assign(base, e || {});
    out.contact = Object.assign({ name: '', phone: '', onsite: '', email: '' }, (e && e.contact) || {});
    out.mc = Object.assign({ host: '', adlibs: '' }, (e && e.mc) || {});
    out.notices = Object.assign(blankEvent().notices, (e && e.notices) || {});
    const bp = blankPress(), ep = (e && e.press) || {};
    Object.keys(bp).forEach((k) => (bp[k] = Object.assign(bp[k], ep[k] || {})));
    out.press = bp;
    ['teams', 'vips', 'schedule', 'sops', 'emergencies', 'supplies', 'speeches', 'posts'].forEach((k) => { if (!Array.isArray(out[k])) out[k] = []; });
    out.schedule.forEach((r) => { if (r.script == null) r.script = ''; if (r.ops == null) r.ops = ''; });
    if (!out._ver || typeof out._ver !== 'object') out._ver = {};
    return out;
  }
  function readStore(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function writeStore(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }

  let ev = normalize(readStore(CONFIG.storage.project) || clone(SAMPLE_EVENT));
  let settings = Object.assign({ aiMode: CONFIG.ai.defaultMode, proxyUrl: '', accessCode: '', apiKey: '', model: '' }, readStore(CONFIG.storage.settings) || {});
  const ui = { section: 'basic', doc: 'notice', audience: 'attendee', pressType: 'pre' };

  const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  function setPath(obj, path, val) {
    const ks = path.split('.');
    let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  // ---------- 章節定義 ----------
  const f = (path, label, o) => Object.assign({ path, label }, o || {});
  const SCHEDULE_BLANK = { start: '', end: '', item: '', content: '', place: '', script: '', ops: '' };
  const SECTIONS = [
    { id: 'basic', group: '共用資料', label: '活動基本資料', hint: '這裡填一次，四種文件都會自動帶入。', ai: 'importEvent', aiLabel: 'AI 匯入企劃內容',
      parts: () => [
        { type: 'fields', fields: [
          f('name', '活動名稱', { wide: true }), f('series', '系列活動（選填）'), f('theme', '活動主題'),
          f('dateText', '活動日期', { ph: '2027年3月20日（星期六）' }), f('timeText', '活動時間', { ph: '14:00－20:00' }),
          f('venue', '活動地點'), f('address', '地址'), f('headcount', '參與人數'), f('staffCall', '工作人員集合時間'),
          f('checkinTime', '報到時間'), f('checkinPlace', '報到地點'),
          f('description', '活動說明', { type: 'textarea', wide: true }),
        ] },
        { type: 'title', text: '單位' },
        { type: 'fields', fields: [f('orgGuide', '指導單位'), f('orgHost', '主辦單位'), f('orgCo', '協辦單位'), f('orgExec', '執行單位')] },
        { type: 'title', text: '進撤場與交通' },
        { type: 'fields', fields: [f('setup', '活動進場'), f('teardown', '活動撤場'), f('transport', '交通資訊（一行一項）', { type: 'textarea', wide: true })] },
        { type: 'title', text: '聯絡窗口' },
        { type: 'fields', fields: [f('contact.name', '聯絡人'), f('contact.phone', '聯絡電話'), f('contact.onsite', '現場聯繫電話'), f('contact.email', '電子信箱')] },
        { type: 'title', text: '場地配置圖（選填）' },
        { type: 'image', path: 'venueMap' },
      ] },
    { id: 'schedule', group: '共用資料', label: '流程表', hint: '時間請用 24 小時制（例如 14:05）。主持人稿與操作手冊會沿用這份流程。',
      parts: () => [{ type: 'rows', path: 'schedule', blank: SCHEDULE_BLANK, grid: '1fr 1fr 2.2fr', cols: [
        f('start', '開始'), f('end', '結束'), f('item', '項目'), f('content', '內容', { full: true }), f('place', '地點', { full: true }),
      ] }] },
    { id: 'teams', group: '共用資料', label: '人員分工', hint: '工作內容一行一項。',
      parts: () => [{ type: 'rows', path: 'teams', blank: { group: '', people: '', phone: '', duties: '' }, grid: '1fr 1.3fr 1fr', cols: [
        f('group', '組別'), f('people', '人員'), f('phone', '聯絡電話'), f('duties', '工作內容', { type: 'textarea', full: true }),
      ] }] },
    { id: 'vips', group: '共用資料', label: '貴賓名單', hint: '依唱名順序排列。',
      parts: () => [{ type: 'rows', path: 'vips', blank: { org: '', title: '', name: '' }, grid: '2fr 1fr 1fr', cols: [f('org', '單位'), f('title', '職稱'), f('name', '姓名')] }] },

    { id: 'notice', group: '文件', label: '行前通知', doc: 'notice', hint: '先在右上角選「對象」，每種對象各有一份內容。留空的段落會使用公版預設文字。', ai: 'notice', aiLabel: 'AI 撰寫此對象的通知',
      parts: () => [{ type: 'fields', fields: [
        f(`notices.${ui.audience}.intro`, '開頭說明（留空用預設）', { type: 'textarea', wide: true }),
        f(`notices.${ui.audience}.notes`, '注意事項（一行一項）', { type: 'textarea', wide: true, rows: 7 }),
        f(`notices.${ui.audience}.bring`, '攜帶物品／服裝準備（一行一項）', { type: 'textarea', wide: true }),
        f(`notices.${ui.audience}.closing`, '結尾（留空用預設）', { type: 'textarea', wide: true }),
      ] }] },
    { id: 'mc', group: '文件', label: '主持人稿', doc: 'mc', hint: '每個流程環節寫一段講稿；音樂與工作人員動作用括號標示。', ai: 'mc', aiLabel: 'AI 撰寫全場講稿',
      parts: () => [
        { type: 'fields', fields: [f('mc.host', '主持人')] },
        { type: 'title', text: '各環節講稿' },
        { type: 'rows', path: 'schedule', blank: SCHEDULE_BLANK, grid: '1fr 1fr 2.2fr', cols: [f('start', '開始'), f('end', '結束'), f('item', '環節'), f('script', '主持人稿', { type: 'textarea', full: true, rows: 4 })] },
        { type: 'title', text: '突發狀況應對' },
        { type: 'fields', fields: [f('mc.adlibs', '應對句（一行一項）', { type: 'textarea', wide: true, rows: 5 })] },
      ] },
    { id: 'manual', group: '文件', label: '操作手冊', doc: 'manual', hint: '作業一行一項，匯出時會自動加上勾選框。', ai: 'manual', aiLabel: 'AI 撰寫作業、SOP 與應變',
      parts: () => [
        { type: 'title', text: '各時段作業' },
        { type: 'rows', path: 'schedule', blank: SCHEDULE_BLANK, grid: '1fr 1fr 2.2fr', cols: [f('start', '開始'), f('end', '結束'), f('item', '活動'), f('ops', '作業（一行一項）', { type: 'textarea', full: true, rows: 4 })] },
        { type: 'title', text: 'SOP 專區' },
        { type: 'rows', path: 'sops', blank: { title: '', items: '' }, grid: '1fr', cols: [f('title', 'SOP 名稱'), f('items', '步驟（一行一項）', { type: 'textarea', full: true, rows: 4 })] },
        { type: 'title', text: '緊急應變' },
        { type: 'rows', path: 'emergencies', blank: { situation: '', handling: '' }, grid: '1fr 2.5fr', cols: [f('situation', '狀況'), f('handling', '處理原則')] },
      ] },
    { id: 'supplies', group: '文件', label: '備品清單', doc: 'supplies', hint: '同一區域的項目排在一起，匯出時區域名稱只顯示一次。', ai: 'supplies', aiLabel: 'AI 建議備品清單',
      parts: () => [
        { type: 'fields', fields: [f('supplyReminders', '清點提醒（一行一項）', { type: 'textarea', wide: true, rows: 5 })] },
        { type: 'title', text: '備品明細' },
        { type: 'rows', path: 'supplies', blank: { area: '', item: '', qty: '', unit: '', note: '' }, grid: '1.1fr 2fr .7fr .7fr', cols: [
          f('area', '區域'), f('item', '項目'), f('qty', '數量'), f('unit', '規格'), f('note', '備註', { full: true }),
        ] },
      ] },
    { id: 'press', group: '文件', label: '新聞稿', doc: 'press', hint: '先在右上角選「事前稿」或「事後稿」。內文一行一段；發稿單位留空會帶入主辦單位。', ai: 'press', aiLabel: 'AI 撰寫新聞稿',
      parts: () => { const k = `press.${ui.pressType}`; return [{ type: 'fields', fields: [
        f(`${k}.issuer`, '發稿單位（留空用主辦單位）'), f(`${k}.date`, '發布日期'),
        f(`${k}.contact`, '新聞聯絡', { wide: true }),
        f(`${k}.headline`, '主標', { wide: true }), f(`${k}.subhead`, '副標', { wide: true }),
        f(`${k}.highlights`, '補充資訊：亮點、現場數據（給 AI 參考，不會印出）', { type: 'textarea', wide: true }),
        f(`${k}.body`, '內文（一行一段）', { type: 'textarea', wide: true, rows: 12 }),
        f(`${k}.captions`, '照片圖說（一行一項）', { type: 'textarea', wide: true }),
        f(`${k}.closing`, '結尾（留空用預設）', { wide: true }),
      ] }]; } },
    { id: 'speech', group: '文件', label: '致詞稿', doc: 'speech', hint: '一位致詞人一列；重點一行一項，AI 會依重點與分鐘數撰寫。', ai: 'speech', aiLabel: 'AI 撰寫致詞稿',
      parts: () => [{ type: 'rows', path: 'speeches', blank: { speaker: '', minutes: '3', points: '', body: '' }, grid: '3fr 1fr', cols: [
        f('speaker', '致詞人（單位＋姓名＋職稱）'), f('minutes', '分鐘'),
        f('points', '重點（給 AI 參考，不會印出）', { type: 'textarea', full: true }),
        f('body', '致詞稿（一行一段）', { type: 'textarea', full: true, rows: 8 }),
      ] }] },
    { id: 'posts', group: '文件', label: '社群貼文', doc: 'posts', hint: '一篇貼文一列、一篇一個主題。文案照實際發文的分行方式填寫；寫好後可用「複製文字」貼到臉書或排程工具。', ai: 'posts', aiLabel: 'AI 規劃並撰寫系列貼文',
      parts: () => [
        { type: 'fields', fields: [f('postMentions', '固定標記單位（每篇結尾自動帶入）', { wide: true, ph: '@主辦單位 @協辦單位 #執行單位' })] },
        { type: 'title', text: '各篇貼文' },
        { type: 'rows', path: 'posts', blank: { platform: 'Facebook', stage: '', date: '', body: '', tags: '', visual: '' }, grid: '1fr 2fr 1fr', cols: [
          f('platform', '平台'), f('stage', '主題'), f('date', '曝光日期'),
          f('body', '文案', { type: 'textarea', full: true, rows: 10 }),
          f('tags', '主題標籤', { full: true }),
          f('visual', '搭配圖卡（一行一張）', { type: 'textarea', full: true }),
        ] },
      ] },
  ];
  const sectionById = (id) => SECTIONS.find((s) => s.id === id);

  // ---------- 畫面：左側選單 ----------
  function renderNav() {
    let html = '', group = '';
    SECTIONS.forEach((s) => {
      if (s.group !== group) { group = s.group; html += `<div class="nav-group">${group}</div>`; }
      html += `<button data-section="${s.id}" aria-current="${s.id === ui.section}">${s.label}</button>`;
    });
    $('#nav').innerHTML = html;
  }

  // ---------- 畫面：填寫區 ----------
  function inputHTML(fd, path) {
    const v = getPath(ev, path);
    const val = esc(v == null ? '' : v);
    const ph = fd.ph ? ` placeholder="${esc(fd.ph)}"` : '';
    if (fd.type === 'textarea') return `<textarea data-path="${path}" rows="${fd.rows || 3}"${ph}>${val}</textarea>`;
    return `<input type="text" data-path="${path}" value="${val}"${ph}>`;
  }
  function partHTML(p) {
    if (p.type === 'title') return `<div class="part-title">${esc(p.text)}</div>`;
    if (p.type === 'fields') {
      return `<div class="fields">${p.fields.map((fd) => `<label class="${fd.wide ? 'wide' : ''}">${esc(fd.label)}${inputHTML(fd, fd.path)}</label>`).join('')}</div>`;
    }
    if (p.type === 'image') {
      const img = getPath(ev, p.path);
      return `<div class="img-box">${img && img.src ? `<img src="${img.src}" alt="場地配置圖"><button class="btn small" data-act="imgRemove">移除圖片</button>` : ''}
        <label class="btn">選擇圖片<input type="file" id="imgFile" accept="image/png,image/jpeg" hidden></label>
        <span class="hint" style="margin:0">匯出 Word 時會放在表格格子內。</span></div>`;
    }
    if (p.type === 'rows') {
      const rows = getPath(ev, p.path) || [];
      const cards = rows.map((r, i) => `<div class="row-card">
        <div class="row-tools"><span>第 ${i + 1} 列</span><span>
          <button class="btn" data-act="rowUp" data-path="${p.path}" data-i="${i}" title="上移" aria-label="上移">↑</button>
          <button class="btn" data-act="rowDown" data-path="${p.path}" data-i="${i}" title="下移" aria-label="下移">↓</button>
          <button class="btn" data-act="rowDel" data-path="${p.path}" data-i="${i}" title="刪除" aria-label="刪除">✕</button></span></div>
        <div class="row-grid" style="grid-template-columns:${p.grid}">${p.cols.map((c) => `<label class="${c.full ? 'full' : ''}">${esc(c.label)}${inputHTML(c, `${p.path}.${i}.${c.path}`)}</label>`).join('')}</div>
      </div>`).join('');
      return `${cards}<button class="btn add-row" data-act="rowAdd" data-path="${p.path}" data-blank='${esc(JSON.stringify(p.blank))}'>＋ 新增一列</button>`;
    }
    return '';
  }
  function renderForm() {
    const s = sectionById(ui.section);
    $('#sectionTitle').textContent = s.label + (s.id === 'notice' ? `｜${T.AUDIENCES[ui.audience].label}` : s.id === 'press' ? `｜${T.PRESS_TYPES[ui.pressType].label}` : '');
    $('#sectionHint').textContent = s.hint || '';
    $('#sectionActions').innerHTML = s.ai ? `<button class="btn ai" data-act="ai" data-task="${s.ai}">${s.aiLabel}</button>` : '';
    $('#form').innerHTML = s.parts().map(partHTML).join('');
  }

  // ---------- 畫面：預覽 ----------
  function currentModel() {
    return T.build(ui.doc, ev, { audience: ui.audience, pressType: ui.pressType, company: CONFIG.company.name });
  }
  function renderPreview() {
    $('#docTabs').innerHTML = Object.keys(T.DOCS).map((k) => `<button role="tab" data-doc="${k}" aria-selected="${k === ui.doc}">${T.DOCS[k].label}</button>`).join('');
    // 「對象／類型」選單：行前通知選對象、新聞稿選事前或事後
    const opts = ui.doc === 'notice' ? T.AUDIENCES : ui.doc === 'press' ? T.PRESS_TYPES : null;
    $('#audWrap').style.display = opts ? '' : 'none';
    if (opts) {
      const cur = ui.doc === 'notice' ? ui.audience : ui.pressType;
      $('#audLabel').textContent = ui.doc === 'notice' ? '對象' : '類型';
      $('#audience').innerHTML = Object.keys(opts).map((k) => `<option value="${k}"${k === cur ? ' selected' : ''}>${opts[k].label}</option>`).join('');
    }
    $('#csvBtn').style.display = ui.doc === 'supplies' ? '' : 'none';
    $('#page').innerHTML = window.EDRenderHTML.render(currentModel());
  }
  function renderAll() { renderNav(); renderForm(); renderPreview(); }

  // ---------- 儲存 ----------
  let saveTimer = null, previewTimer = null;
  function touch() {
    clearTimeout(saveTimer); clearTimeout(previewTimer);
    previewTimer = setTimeout(renderPreview, 150);
    saveTimer = setTimeout(save, 400);
  }
  function save() {
    const ok = writeStore(CONFIG.storage.project, ev);
    $('#saveState').textContent = ok ? '已自動儲存於此瀏覽器' : '儲存失敗（空間不足），請匯出專案備份';
  }

  // ---------- 小工具 ----------
  let toastTimer = null;
  function toast(msg, isErr) {
    const el = $('#toast');
    el.textContent = msg; el.className = 'toast' + (isErr ? ' err' : ''); el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), isErr ? 7000 : 2600);
  }
  function busy(on, text) { $('#busy').hidden = !on; if (text) $('#busyText').textContent = text; }
  function ask(title, text, okLabel) {
    return new Promise((resolve) => {
      const d = $('#dlgConfirm');
      $('#confirmTitle').textContent = title; $('#confirmText').textContent = text; $('#confirmOk').textContent = okLabel || '確定';
      d.onclose = () => resolve(d.returnValue === 'ok');
      d.returnValue = ''; d.showModal();
    });
  }
  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function datePrefix() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return String(d.getFullYear()).slice(2) + p(d.getMonth() + 1) + p(d.getDate());
  }
  const safeName = (s) => String(s || '未命名活動').replace(/[\\/:*?"<>|]/g, '').trim();
  // 檔名規則：日期_活動名稱-文件名稱_v版號（每次匯出版號加一，不覆蓋舊檔）
  function nextFilename(label, ext) {
    const key = `${label}.${ext}`;
    const n = (ev._ver[key] || 0) + 1;
    ev._ver[key] = n; save();
    return `${datePrefix()}_${safeName(ev.name)}-${label}_v${n}.${ext}`;
  }

  // ---------- 匯出 ----------
  async function exportWord() {
    try {
      const model = currentModel();
      const R = window.EDRenderDocx.create(window.docx, CONFIG);
      const blob = await R.toBlob(model);
      const name = nextFilename(model.fileLabel, 'docx');
      download(blob, name);
      toast(`已匯出 ${name}` + (model.toc ? '｜開啟時 Word 會詢問是否更新目錄，請選「是」' : ''));
    } catch (e) { console.error(e); toast('Word 匯出失敗：' + e.message, true); }
  }
  async function copyText() {
    try { await navigator.clipboard.writeText(T.toText(currentModel())); toast('已複製文字，可貼到 E-mail 或 LINE'); }
    catch (e) { toast('無法複製，請改用列印或匯出 Word', true); }
  }

  // ---------- AI ----------
  const join = (a) => (Array.isArray(a) ? a.map((x) => String(x).trim()).filter(Boolean).join('\n') : String(a || ''));
  const APPLY = {
    importEvent(r) {
      ['name', 'series', 'theme', 'dateText', 'timeText', 'venue', 'address', 'headcount', 'orgGuide', 'orgHost', 'orgCo', 'description', 'setup', 'teardown', 'checkinTime', 'checkinPlace', 'transport']
        .forEach((k) => { if (r[k] && String(r[k]).trim()) ev[k] = join(r[k]); });
      if (Array.isArray(r.teams) && r.teams.length) ev.teams = r.teams.map((t) => ({ group: t.group || '', people: t.people || '', phone: t.phone || '', duties: join(t.duties) }));
      if (Array.isArray(r.vips) && r.vips.length) ev.vips = r.vips.map((v) => ({ org: v.org || '', title: v.title || '', name: v.name || '' }));
      if (Array.isArray(r.schedule) && r.schedule.length) ev.schedule = r.schedule.map((s) => Object.assign({}, SCHEDULE_BLANK, { start: s.start || '', end: s.end || '', item: s.item || '', content: s.content || '', place: s.place || '' }));
    },
    notice(r) { ev.notices[ui.audience] = { intro: r.intro || '', notes: join(r.notes), bring: join(r.bring), closing: r.closing || '' }; },
    mc(r) {
      (r.scripts || []).forEach((s) => { if (ev.schedule[s.index]) ev.schedule[s.index].script = s.script || ''; });
      if (r.adlibs) ev.mc.adlibs = join(r.adlibs);
    },
    manual(r) {
      (r.ops || []).forEach((o) => { if (ev.schedule[o.index]) ev.schedule[o.index].ops = join(o.ops); });
      if (Array.isArray(r.sops) && r.sops.length) ev.sops = r.sops.map((s) => ({ title: s.title || '', items: join(s.items) }));
      if (Array.isArray(r.emergencies) && r.emergencies.length) ev.emergencies = r.emergencies.map((e) => ({ situation: e.situation || '', handling: e.handling || '' }));
    },
    supplies(r) {
      if (Array.isArray(r.supplies) && r.supplies.length) ev.supplies = r.supplies.map((s) => ({ area: s.area || '', item: s.item || '', qty: String(s.qty == null ? '' : s.qty), unit: s.unit || '', note: s.note || '' }));
    },
    press(r) {
      const p = ev.press[ui.pressType];
      p.headline = r.headline || p.headline; p.subhead = r.subhead || p.subhead;
      p.body = join(r.body); p.captions = join(r.captions);
    },
    speech(r) { (r.speeches || []).forEach((s) => { if (ev.speeches[s.index]) ev.speeches[s.index].body = join(s.body); }); },
    posts(r) {
      if (Array.isArray(r.posts) && r.posts.length) ev.posts = r.posts.map((s) => ({ platform: s.platform || '', stage: s.stage || '', date: s.date || '', body: join(s.body), tags: join(s.tags).replace(/\n/g, ' '), visual: join(s.visual) }));
    },
  };
  async function runAI(task, arg) {
    busy(true, 'AI 撰寫中，約需 20 至 60 秒…');
    try {
      const r = await window.EDAI.run(task, settings, ev, arg);
      APPLY[task](r);
      ev = normalize(ev); save(); renderAll();
      toast('AI 已完成初稿，請檢查內容後再匯出');
    } catch (e) { console.error(e); toast(e.message || 'AI 發生錯誤', true); }
    finally { busy(false); }
  }
  async function startAI(task) {
    if (task === 'importEvent') {
      const d = $('#dlgImport');
      d.onclose = () => { const text = $('#importText').value.trim(); if (d.returnValue === 'go' && text) runAI('importEvent', text); };
      d.returnValue = ''; d.showModal();
      return;
    }
    if (!ev.name.trim() || !ev.schedule.length) { toast('請先填寫活動名稱與流程表，AI 才有依據', true); return; }
    if (task === 'speech' && !ev.speeches.length) { toast('請先新增至少一位致詞人', true); return; }
    const ok = await ask('AI 代寫', 'AI 產生的內容會取代這份文件目前的對應欄位。活動名稱、流程、分組與貴賓名單會送到 AI 服務處理（不含聯絡電話與信箱）。', '開始撰寫');
    if (ok) runAI(task, task === 'press' ? ui.pressType : ui.audience);
  }

  // ---------- 設定 ----------
  function openSettings() {
    const d = $('#dlgSettings'), fm = $('#settingsForm');
    fm.aiMode.value = settings.aiMode; fm.proxyUrl.value = settings.proxyUrl; fm.accessCode.value = settings.accessCode;
    fm.apiKey.value = settings.apiKey; fm.model.value = settings.model; fm.model.placeholder = CONFIG.ai.defaultModel;
    const sync = () => d.querySelectorAll('[data-mode]').forEach((el) => (el.style.display = el.dataset.mode === fm.aiMode.value ? '' : 'none'));
    fm.onchange = sync; sync();
    d.onclose = () => {
      if (d.returnValue !== 'save') return;
      settings = { aiMode: fm.aiMode.value, proxyUrl: fm.proxyUrl.value.trim(), accessCode: fm.accessCode.value, apiKey: fm.apiKey.value.trim(), model: fm.model.value.trim() };
      writeStore(CONFIG.storage.settings, settings); toast('設定已儲存');
    };
    d.returnValue = ''; d.showModal();
  }

  // ---------- 圖片 ----------
  function loadImage(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 縮到最長邊 1600 像素，避免瀏覽器儲存空間不足
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        ev.venueMap = { src: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
        save(); renderForm(); renderPreview();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  // ---------- 事件 ----------
  document.addEventListener('input', (e) => {
    const path = e.target.dataset && e.target.dataset.path;
    if (path && e.target.closest('#form')) { setPath(ev, path, e.target.value); touch(); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'audience') { if (ui.doc === 'press') ui.pressType = e.target.value; else ui.audience = e.target.value; renderForm(); renderPreview(); }
    if (e.target.id === 'imgFile' && e.target.files[0]) loadImage(e.target.files[0]);
    if (e.target.id === 'projectFile' && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        try { ev = normalize(JSON.parse(reader.result)); save(); renderAll(); toast('專案已匯入'); }
        catch (err) { toast('專案檔格式不正確', true); }
        e.target.value = '';
      };
      reader.readAsText(e.target.files[0]);
    }
  });
  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-section]');
    if (nav) {
      ui.section = nav.dataset.section;
      const s = sectionById(ui.section);
      if (s.doc) ui.doc = s.doc;
      renderAll(); $('.form-pane').scrollTop = 0; return;
    }
    const tab = e.target.closest('[data-doc]');
    if (tab) { ui.doc = tab.dataset.doc; renderPreview(); return; }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'rowAdd') { getPath(ev, btn.dataset.path).push(JSON.parse(btn.dataset.blank)); renderForm(); touch(); }
    else if (act === 'rowDel' || act === 'rowUp' || act === 'rowDown') {
      const arr = getPath(ev, btn.dataset.path), i = Number(btn.dataset.i);
      if (act === 'rowDel') arr.splice(i, 1);
      else { const j = act === 'rowUp' ? i - 1 : i + 1; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }
      e.preventDefault(); renderForm(); touch();
    }
    else if (act === 'imgRemove') { ev.venueMap = null; save(); renderForm(); renderPreview(); }
    else if (act === 'word') exportWord();
    else if (act === 'print') window.print();
    else if (act === 'copy') copyText();
    else if (act === 'csv') { download(new Blob([T.suppliesCSV(ev)], { type: 'text/csv;charset=utf-8' }), nextFilename('備品清單', 'csv')); }
    else if (act === 'ai') { e.preventDefault(); startAI(btn.dataset.task); }
    else if (act === 'settings') openSettings();
    else if (act === 'exportProject') { download(new Blob([JSON.stringify(ev, null, 2)], { type: 'application/json' }), nextFilename('專案檔', 'json')); toast('專案檔已匯出，可傳給同事匯入'); }
    else if (act === 'importProject') $('#projectFile').click();
    else if (act === 'sample') { if (await ask('載入範例', '目前的內容會被範例活動取代。需要保留請先「匯出專案」。', '載入範例')) { ev = normalize(clone(SAMPLE_EVENT)); save(); renderAll(); } }
    else if (act === 'new') { if (await ask('新專案', '目前的內容會被清空。需要保留請先「匯出專案」。', '清空並開始')) { ev = blankEvent(); save(); ui.section = 'basic'; renderAll(); } }
  });

  // ---------- 啟動 ----------
  renderAll();
})();
