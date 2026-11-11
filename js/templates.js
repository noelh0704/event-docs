// ===== 文件公版：把「活動資料」轉成「文件模型」=====
// 文件模型是一串區塊（標題、段落、清單、表格、圖片），
// 預覽（render-html.js）與 Word 匯出（render-docx.js）共用同一份模型，確保兩邊內容一致。
(function (root) {
  // 行前通知的對象
  const AUDIENCES = {
    attendee: { label: '參加者', salute: '親愛的與會貴賓 您好：' },
    speaker: { label: '講者／貴賓', salute: '○○○ 貴賓 您好：' },
    staff: { label: '工作人員', salute: '各位工作夥伴 您好：' },
    vendor: { label: '表演團體／廠商', salute: '各位合作夥伴 您好：' },
  };

  const DOCS = {
    notice: { label: '行前通知' },
    mc: { label: '主持人稿' },
    manual: { label: '操作手冊' },
    supplies: { label: '備品清單' },
    press: { label: '新聞稿' },
    speech: { label: '致詞稿' },
    posts: { label: '社群貼文' },
  };

  // 新聞稿的類型
  const PRESS_TYPES = {
    pre: { label: '事前稿' },
    post: { label: '事後稿' },
  };
  const PRESS_CLOSING = '【敬請媒體先進惠予刊登報導，感謝】';

  // --- 小工具 ---
  const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const has = (s) => String(s || '').trim() !== '';

  function toMin(t) {
    const m = String(t || '').match(/^(\d{1,2}):?(\d{2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }
  function duration(row) {
    const a = toMin(row.start), b = toMin(row.end);
    return a !== null && b !== null && b > a ? String(b - a) : '';
  }
  function timeRange(row) {
    return has(row.end) ? `${row.start || ''}－${row.end}` : row.start || '';
  }
  function kvRows(pairs) {
    return pairs.filter((p) => has(p[1]));
  }
  function place(ev) {
    return has(ev.address) ? `${ev.venue || ''}（${ev.address}）` : ev.venue || '';
  }
  function contactRows(ev) {
    const c = ev.contact || {};
    return kvRows([
      ['執行單位', ev.orgExec],
      ['聯絡人', c.name],
      ['聯絡電話', c.phone],
      ['現場聯繫', c.onsite],
      ['電子信箱', c.email],
    ]);
  }
  function orgRows(ev) {
    return kvRows([
      ['指導單位', ev.orgGuide],
      ['主辦單位', ev.orgHost],
      ['協辦單位', ev.orgCo],
      ['執行單位', ev.orgExec],
    ]);
  }
  function scheduleRows(ev) {
    return (ev.schedule || []).filter((r) => has(r.start) || has(r.item));
  }
  function mapBlocks(ev, heading, level) {
    if (!ev.venueMap || !ev.venueMap.src) return [];
    return [
      { t: level || 'h1', text: heading },
      { t: 'image', src: ev.venueMap.src, w: ev.venueMap.w, h: ev.venueMap.h, caption: '場地配置圖' },
    ];
  }

  // --- 行前通知 ---
  function defaultIntro(ev, aud) {
    const n = ev.name || '本活動';
    return {
      attendee: `感謝您報名參與【${n}】，我們誠摯歡迎您的蒞臨。為協助您順利參與，敬請詳閱以下行前資訊：`,
      speaker: `感謝您撥冗參與「${n}」，為活動增添光彩。以下為行前重要提醒事項，敬請參閱：`,
      staff: `「${n}」即將辦理，為確保活動順利進行，以下整理活動資訊及現場工作注意事項，請各位工作人員務必詳閱：`,
      vendor: `感謝您參與「${n}」，以下為活動相關注意事項，敬請參閱：`,
    }[aud];
  }
  const DEFAULT_CLOSING = '若您對活動有任何疑問或需求，歡迎隨時與我們聯繫，我們將竭誠為您服務。期待與您相見！';

  function buildNotice(ev, aud) {
    aud = AUDIENCES[aud] ? aud : 'attendee';
    const A = AUDIENCES[aud];
    const n = (ev.notices && ev.notices[aud]) || {};
    const b = [];
    b.push({ t: 'p', text: A.salute });
    b.push({ t: 'p', text: has(n.intro) ? n.intro : defaultIntro(ev, aud) });

    b.push({ t: 'h1', text: '活動資訊' });
    const info = [
      ['活動名稱', ev.name],
      ['活動日期', ev.dateText],
      ['活動時間', ev.timeText],
      ['活動地點', place(ev)],
    ];
    if (aud === 'attendee' || aud === 'speaker') {
      info.push(['報到時間', ev.checkinTime], ['報到地點', ev.checkinPlace]);
    }
    if (aud === 'staff') {
      info.push(['集合時間', ev.staffCall]);
      info.push(['工作人員', (ev.teams || []).map((t) => t.people).filter(has).join('、')]);
    }
    if (aud === 'vendor') info.push(['進場時間', ev.setup]);
    b.push({ t: 'kv', rows: kvRows(info) });

    if (aud === 'staff' && (ev.teams || []).length) {
      b.push({ t: 'h1', text: '角色分工' });
      b.push({
        t: 'table', head: ['組別', '人員', '主要工作內容'], widths: [22, 28, 50],
        rows: ev.teams.map((t) => [t.group, t.people, t.duties]),
      });
    }

    const sch = scheduleRows(ev);
    if (sch.length) {
      b.push({ t: 'h1', text: '活動流程' });
      b.push({
        t: 'table', head: ['時間', '項目', '內容', '地點'], widths: [20, 26, 34, 20],
        rows: sch.map((r) => [timeRange(r), r.item, r.content, r.place]),
      });
      b.push({ t: 'note', text: '※ 以上流程將依現場狀況機動調整。' });
    }

    if (lines(n.notes).length) {
      b.push({ t: 'h1', text: aud === 'staff' ? '工作注意事項' : '參與須知' });
      b.push({ t: 'list', items: lines(n.notes) });
    }
    if (lines(n.bring).length) {
      b.push({ t: 'h1', text: aud === 'staff' ? '服裝及基本準備' : '建議攜帶物品' });
      b.push({ t: 'list', items: lines(n.bring) });
    }
    if (lines(ev.transport).length) {
      b.push({ t: 'h1', text: '交通資訊' });
      b.push({ t: 'list', items: lines(ev.transport) });
    }
    mapBlocks(ev, '場地配置').forEach((x) => b.push(x));

    b.push({ t: 'p', text: has(n.closing) ? n.closing : DEFAULT_CLOSING });
    b.push({ t: 'h1', text: aud === 'staff' ? '緊急聯繫' : '聯絡資訊' });
    b.push({ t: 'kv', rows: contactRows(ev) });

    return {
      title: ev.name || '（請填寫活動名稱）',
      subtitle: `【${A.label} 行前通知】`,
      fileLabel: `${A.label.replace('／', '')}-行前通知`,
      toc: false,
      blocks: b,
    };
  }

  // --- 主持人稿 ---
  function buildMC(ev) {
    const b = [];
    const mc = ev.mc || {};
    b.push({ t: 'h1', text: '基本資訊' });
    b.push({
      t: 'kv',
      rows: orgRows(ev).concat(kvRows([
        ['活動主題', ev.theme],
        ['活動時間', [ev.dateText, ev.timeText].filter(has).join(' ')],
        ['活動地點', place(ev)],
        ['主持人', mc.host],
      ])),
    });

    const vips = (ev.vips || []).filter((v) => has(v.org) || has(v.name));
    if (vips.length) {
      b.push({ t: 'h1', text: '貴賓唱名單' });
      b.push({
        t: 'table', head: ['序', '單位', '職稱', '姓名'], widths: [8, 46, 22, 24],
        rows: vips.map((v, i) => [String(i + 1), v.org, v.title, v.name]),
      });
      b.push({ t: 'note', text: '※ 唱名順序以現場最終唱名單為準。' });
    }

    b.push({ t: 'h1', text: '流程與講稿' });
    b.push({
      t: 'table', head: ['時間', '分鐘', '環節', '主持人稿'], widths: [15, 10, 17, 58],
      rows: scheduleRows(ev).map((r) => [timeRange(r), duration(r), r.item, has(r.script) ? r.script : '（待填）']),
    });

    if (lines(mc.adlibs).length) {
      b.push({ t: 'h1', text: '突發狀況應對' });
      b.push({ t: 'list', items: lines(mc.adlibs) });
    }
    return { title: ev.name || '（請填寫活動名稱）', subtitle: '－主持人稿－', fileLabel: '主持人稿', toc: false, blocks: b };
  }

  // --- 操作手冊 ---
  function buildManual(ev) {
    const b = [];
    b.push({ t: 'h1', text: '基本資訊' });
    b.push({
      t: 'kv',
      rows: kvRows([['系列活動', ev.series]]).concat(orgRows(ev), kvRows([
        ['活動主題', ev.theme],
        ['活動時間', [ev.dateText, ev.timeText].filter(has).join(' ')],
        ['活動地點', place(ev)],
        ['參與人數', ev.headcount],
        ['活動說明', ev.description],
        ['活動進場', ev.setup],
        ['活動撤場', ev.teardown],
        ['工作人員集合', ev.staffCall],
      ])),
    });

    if ((ev.teams || []).length) {
      b.push({ t: 'h1', text: '工項分組' });
      b.push({
        t: 'table', head: ['組別', '人員', '聯絡電話', '工作內容'], widths: [18, 22, 18, 42],
        rows: ev.teams.map((t) => [t.group, t.people, t.phone, lines(t.duties).map((x) => '• ' + x).join('\n')]),
      });
    }

    const sch = scheduleRows(ev);
    b.push({ t: 'h1', text: '活動流程表' });
    b.push({
      t: 'table', head: ['時間', '項目', '內容', '地點'], widths: [20, 26, 34, 20],
      rows: sch.map((r) => [timeRange(r), r.item, r.content, r.place]),
    });

    b.push({ t: 'h1', text: '活動細流' });
    b.push({
      t: 'table', head: ['時間', '分鐘', '活動', '作業'], widths: [15, 10, 22, 53],
      rows: sch.map((r) => [timeRange(r), duration(r), r.item, lines(r.ops).map((x) => '□ ' + x).join('\n')]),
    });

    const sops = (ev.sops || []).filter((s) => has(s.title));
    if (sops.length) {
      b.push({ t: 'h1', text: 'SOP 專區' });
      sops.forEach((s) => {
        b.push({ t: 'h2', text: s.title });
        b.push({ t: 'list', items: lines(s.items) });
      });
    }

    const em = (ev.emergencies || []).filter((e) => has(e.situation));
    if (em.length) {
      b.push({ t: 'h1', text: '緊急應變' });
      b.push({ t: 'table', head: ['狀況', '處理原則'], widths: [25, 75], rows: em.map((e) => [e.situation, e.handling]) });
    }

    mapBlocks(ev, '場地配置').forEach((x) => b.push(x));

    b.push({ t: 'h1', text: '聯絡資訊' });
    b.push({ t: 'kv', rows: contactRows(ev) });
    return { title: ev.name || '（請填寫活動名稱）', subtitle: '－工作人員操作手冊－', fileLabel: '操作手冊', toc: true, blocks: b };
  }

  // --- 備品清單 ---
  function buildSupplies(ev) {
    const b = [];
    if (lines(ev.supplyReminders).length) {
      b.push({ t: 'h1', text: '清點提醒' });
      b.push({ t: 'list', ordered: true, items: lines(ev.supplyReminders) });
    }
    b.push({ t: 'h1', text: '備品明細' });
    const rows = [];
    let last = null;
    (ev.supplies || []).filter((s) => has(s.item)).forEach((s, i) => {
      rows.push([String(i + 1), s.area === last ? '' : s.area, s.item, '□', s.qty, s.unit, s.note]);
      last = s.area;
    });
    b.push({ t: 'table', head: ['No.', '區域', '項目', '確認', '數量', '規格', '備註'], widths: [7, 14, 28, 8, 9, 9, 25], rows });
    return { title: ev.name || '（請填寫活動名稱）', subtitle: '－備品清單－', fileLabel: '備品清單', toc: false, blocks: b };
  }

  // 多段文字 → 多個段落區塊（空行略過）
  function paraBlocks(text, opt) {
    return lines(text).map((x) => Object.assign({ t: 'p', text: x }, opt || {}));
  }

  // --- 新聞稿 ---
  function buildPress(ev, type) {
    type = PRESS_TYPES[type] ? type : 'pre';
    const p = (ev.press && ev.press[type]) || {};
    const b = [];
    const meta = kvRows([['發布日期', p.date], ['新聞聯絡', p.contact]]);
    if (meta.length) b.push({ t: 'kv', rows: meta });
    const body = paraBlocks(p.body, { indent: true });
    if (body.length) body.forEach((x) => b.push(x));
    else b.push({ t: 'note', text: '（請填寫新聞稿內文，或使用 AI 撰寫初稿）' });
    b.push({ t: 'p', text: has(p.closing) ? p.closing : PRESS_CLOSING, center: true, bold: true });
    if (lines(p.captions).length) {
      b.push({ t: 'h1', text: '照片圖說' });
      b.push({ t: 'list', ordered: true, items: lines(p.captions) });
    }
    return {
      pretitle: `${has(p.issuer) ? p.issuer : ev.orgHost || ''}新聞稿`,
      title: has(p.headline) ? p.headline : '（請填寫新聞標題）',
      subtitle: p.subhead || '',
      fileLabel: `${PRESS_TYPES[type].label.replace('稿', '')}新聞稿`,
      toc: false, blocks: b,
    };
  }

  // --- 致詞稿 ---
  function buildSpeech(ev) {
    const b = [];
    const list = (ev.speeches || []).filter((s) => has(s.speaker) || has(s.body));
    if (!list.length) b.push({ t: 'note', text: '（請新增致詞人）' });
    list.forEach((s) => {
      b.push({ t: 'h1', text: `${s.speaker || '○○○'} 致詞稿` });
      if (has(s.minutes)) b.push({ t: 'note', text: `※ 建議致詞時間：約 ${s.minutes} 分鐘` });
      const body = paraBlocks(s.body, { indent: true });
      if (body.length) body.forEach((x) => b.push(x));
      else b.push({ t: 'note', text: '（待填）' });
    });
    return { pretitle: ev.series || '', title: ev.name || '（請填寫活動名稱）', subtitle: '－致詞稿－', fileLabel: '致詞稿', toc: false, blocks: b };
  }

  // --- 社群貼文 ---
  function buildPosts(ev) {
    const b = [];
    const list = (ev.posts || []).filter((s) => has(s.body) || has(s.stage));
    b.push({ t: 'h1', text: '貼文規劃表' });
    b.push({
      t: 'table', head: ['No.', '平台', '階段', '曝光日期', '素材說明'], widths: [8, 16, 16, 18, 42],
      rows: list.map((s, i) => [String(i + 1), s.platform, s.stage, s.date, s.visual]),
    });
    list.forEach((s, i) => {
      b.push({ t: 'h2', text: `貼文 ${i + 1}｜${[s.platform, s.stage, s.date].filter(has).join('｜')}` });
      const body = paraBlocks(s.body);
      if (body.length) body.forEach((x) => b.push(x));
      else b.push({ t: 'note', text: '（待填）' });
      if (has(s.tags)) b.push({ t: 'p', text: s.tags });
    });
    return { title: ev.name || '（請填寫活動名稱）', subtitle: '－社群貼文－', fileLabel: '社群貼文', toc: false, blocks: b };
  }

  function build(docId, ev, opts) {
    const company = (opts && opts.company) || '';
    let m;
    if (docId === 'mc') m = buildMC(ev);
    else if (docId === 'manual') m = buildManual(ev);
    else if (docId === 'supplies') m = buildSupplies(ev);
    else if (docId === 'press') m = buildPress(ev, opts && opts.pressType);
    else if (docId === 'speech') m = buildSpeech(ev);
    else if (docId === 'posts') m = buildPosts(ev);
    else m = buildNotice(ev, opts && opts.audience);
    // 新聞稿與致詞稿以主辦單位名義對外，頁尾不放執行單位名稱
    m.footer = docId === 'press' || docId === 'speech' ? '' : ev.orgExec || company;
    return m;
  }

  // 備品清單另存 CSV（給 Excel／Google 試算表）
  function suppliesCSV(ev) {
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const out = [['No.', '區域', '項目', '確認', '數量', '規格', '備註'].map(q).join(',')];
    (ev.supplies || []).filter((s) => has(s.item)).forEach((s, i) => {
      out.push([i + 1, s.area, s.item, '', s.qty, s.unit, s.note].map(q).join(','));
    });
    return '﻿' + out.join('\r\n');
  }

  // 文件模型轉純文字（複製貼到 E-mail／LINE 用）
  function toText(model) {
    const out = [model.pretitle, model.title, model.subtitle, ''].filter((x, i) => i === 3 || has(x));
    model.blocks.forEach((b) => {
      if (b.t === 'h1') out.push('', `【${b.text}】`);
      else if (b.t === 'h2') out.push('', `■ ${b.text}`);
      else if (b.t === 'p' || b.t === 'note') out.push(b.text);
      else if (b.t === 'list') b.items.forEach((x, i) => out.push(b.ordered ? `${i + 1}. ${x}` : `▶ ${x}`));
      else if (b.t === 'kv') b.rows.forEach((r) => out.push(`▶ ${r[0]}｜${r[1]}`));
      else if (b.t === 'table') {
        out.push(b.head.join('｜'));
        b.rows.forEach((r) => out.push(r.map((c) => String(c || '').replace(/\n/g, ' ／ ')).join('｜')));
      } else if (b.t === 'image') out.push(`（${b.caption}請見附件）`);
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  const api = { AUDIENCES, PRESS_TYPES, DOCS, build, suppliesCSV, toText, lines, timeRange, duration };
  root.EDTemplates = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
