// ===== 貼文圖卡：版型套字 =====
// 文字由程式排版（不是 AI 產圖），確保中文字、日期、地點完全正確。
(function (root) {
  const SIZES = {
    portrait: { label: '直式 1080×1350', w: 1080, h: 1350 },
    square: { label: '方形 1080×1080', w: 1080, h: 1080 },
  };
  // 版型與各欄位的用途
  const TYPES = {
    cover: { label: '首圖' },         // 標題＝大標；副標；條列＝日期地點；角標＝右上角小標籤
    info: { label: '資訊卡' },        // 條列每行「項目｜內容」
    points: { label: '重點條列卡' },  // 條列每行一個重點
    lottery: { label: '抽獎卡' },     // 條列＝參加步驟；副標＝獎項
    countdown: { label: '倒數卡' },   // 角標＝倒數數字；條列＝截止資訊
  };
  const DEFAULT_BRAND = { primary: '#1d2b3a', secondary: '#d9772b', logo: null, bg: null };
  const FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","微軟正黑體",sans-serif';
  const PAPER = '#faf7f2';
  const PAD = 84;

  const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  const has = (s) => String(s || '').trim() !== '';

  // --- 顏色 ---
  function rgb(hex) {
    const m = String(hex || '').replace('#', '').match(/^([0-9a-f]{6})$/i);
    const n = parseInt(m ? m[1] : '1d2b3a', 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // 依底色深淺決定用白字或深色字
  function textOn(hex) {
    const [r, g, b] = rgb(hex);
    return (r * 299 + g * 587 + b * 114) / 1000 > 160 ? '#1d2b3a' : '#ffffff';
  }
  const rgba = (hex, a) => { const c = rgb(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };

  // --- 文字排版 ---
  function setFont(ctx, size, weight) { ctx.font = `${weight || 700} ${size}px ${FONT}`; }
  // 中文逐字換行；英數字不拆開
  function wrap(ctx, text, maxW) {
    const out = [];
    String(text || '').split('\n').forEach((para) => {
      const tokens = para.match(/[A-Za-z0-9@#:/.\-_%+&]+|\s+|[\s\S]/gu) || [];
      let line = '';
      tokens.forEach((tk) => {
        if (ctx.measureText(line + tk).width > maxW && line.trim()) { out.push(line.trim()); line = tk.trim() ? tk : ''; }
        else line += tk;
      });
      if (line.trim()) out.push(line.trim());
    });
    return out;
  }
  // 多行時讓每行長度接近，避免最後一行只剩一兩個字
  function balance(ctx, text, maxW, ls) {
    if (ls.length < 2) return ls;
    let best = ls;
    for (let w = maxW * 0.95; w > maxW * 0.45; w -= maxW * 0.05) {
      const t = wrap(ctx, text, w);
      if (t.length > ls.length) break;
      best = t;
    }
    return best;
  }
  // 從大到小找出能在限定行數內排完的字級
  function fit(ctx, text, maxW, maxLines, sizes, weight) {
    for (const size of sizes) {
      setFont(ctx, size, weight);
      const ls = wrap(ctx, text, maxW);
      if (ls.length <= maxLines) return { size, lines: balance(ctx, text, maxW, ls) };
    }
    const size = sizes[sizes.length - 1];
    setFont(ctx, size, weight);
    return { size, lines: wrap(ctx, text, maxW).slice(0, maxLines) };
  }
  function drawLines(ctx, ls, x, y, size, lh, color, weight, align) {
    setFont(ctx, size, weight); ctx.fillStyle = color; ctx.textBaseline = 'top'; ctx.textAlign = align || 'left';
    ls.forEach((l, i) => ctx.fillText(l, x, y + i * size * lh));
    return y + ls.length * size * lh;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function coverImage(ctx, img, W, H) {
    const s = Math.max(W / img.width, H / img.height);
    ctx.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
  }

  // --- 圖片快取（Logo、底圖）---
  const cache = {};
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (cache[src]) return cache[src];
    cache[src] = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img); img.onerror = () => resolve(null); img.src = src;
    });
    return cache[src];
  }

  // --- 共用元件 ---
  function header(ctx, ev, logo, W, color) {
    // 左上角：有 Logo 放 Logo，沒有就放主辦單位名稱
    if (logo) {
      const h = 76, w = Math.min(360, (logo.width / logo.height) * h);
      ctx.drawImage(logo, PAD, PAD - 10, w, h);
    } else if (has(ev.orgHost)) {
      setFont(ctx, 30, 500);
      drawLines(ctx, wrap(ctx, ev.orgHost, W - PAD * 2 - 260).slice(0, 1), PAD, PAD, 30, 1.3, color, 500);
    }
  }
  function footer(ctx, ev, W, H, color) {
    setFont(ctx, 30, 500);
    const t = wrap(ctx, ev.name || '', W - PAD * 2).slice(0, 1);
    drawLines(ctx, t, PAD, H - PAD - 30, 30, 1.3, color, 500);
  }
  function pill(ctx, text, xRight, y, bg, fg) {
    setFont(ctx, 34, 700);
    const w = ctx.measureText(text).width + 56;
    ctx.fillStyle = bg; roundRect(ctx, xRight - w, y, w, 66, 33); ctx.fill();
    ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(text, xRight - w + 28, y + 14);
  }
  function darkBase(ctx, B, bg, W, H) {
    ctx.fillStyle = B.primary; ctx.fillRect(0, 0, W, H);
    if (bg) { coverImage(ctx, bg, W, H); ctx.fillStyle = rgba(B.primary, 0.62); ctx.fillRect(0, 0, W, H); }
    else {
      // 沒有底圖時用幾何色塊當裝飾
      ctx.fillStyle = rgba(B.secondary, 0.9); ctx.beginPath(); ctx.arc(W + 40, -40, 300, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.beginPath(); ctx.arc(-60, H * 0.62, 340, 0, Math.PI * 2); ctx.fill();
    }
  }
  function lightBase(ctx, B, W, H) {
    ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = B.primary; ctx.fillRect(0, 0, W, 26);
    ctx.fillStyle = B.secondary; ctx.fillRect(0, 26, W * 0.34, 10);
  }
  function titleBlock(ctx, text, y, W, color, accent) {
    const t = fit(ctx, text, W - PAD * 2, 2, [84, 72, 62, 54]);
    const end = drawLines(ctx, t.lines, PAD, y, t.size, 1.25, color);
    ctx.fillStyle = accent; ctx.fillRect(PAD, end + 14, 120, 10);
    return end + 70;
  }

  // --- 五種版型 ---
  const DRAW = {
    cover(ctx, c, ev, B, im, W, H) {
      darkBase(ctx, B, im.bg, W, H);
      const fg = textOn(B.primary);
      header(ctx, ev, im.logo, W, fg);
      if (has(c.badge)) pill(ctx, c.badge, W - PAD, PAD, '#ffffff', B.primary);
      const info = lines(c.lines).slice(0, 3);
      const stripH = info.length ? 70 + info.length * 62 : 0;
      const t = fit(ctx, c.title || ev.name || '', W - PAD * 2, 4, [120, 104, 90, 78, 66]);
      setFont(ctx, 46, 500);
      const sub = has(c.sub) ? wrap(ctx, c.sub, W - PAD * 2).slice(0, 2) : [];
      const blockH = t.lines.length * t.size * 1.2 + (sub.length ? 30 + sub.length * 46 * 1.4 : 0);
      let y = Math.max(PAD + 130, (H - stripH - blockH) / 2);
      y = drawLines(ctx, t.lines, PAD, y, t.size, 1.2, fg);
      if (sub.length) { ctx.fillStyle = B.secondary; ctx.fillRect(PAD, y + 6, 120, 10); drawLines(ctx, sub, PAD, y + 36, 46, 1.4, fg, 500); }
      if (info.length) {
        ctx.fillStyle = B.secondary; ctx.fillRect(0, H - stripH, W, stripH);
        const sf = textOn(B.secondary);
        info.forEach((l, i) => { const f = fit(ctx, l, W - PAD * 2, 1, [44, 40, 36, 32]); drawLines(ctx, f.lines, PAD, H - stripH + 36 + i * 62, f.size, 1.2, sf); });
      }
    },
    info(ctx, c, ev, B, im, W, H) {
      lightBase(ctx, B, W, H);
      header(ctx, ev, im.logo, W, B.primary);
      let y = titleBlock(ctx, c.title || '活動資訊', PAD + 120, W, B.primary, B.secondary);
      if (has(c.sub)) { setFont(ctx, 40, 500); y = drawLines(ctx, wrap(ctx, c.sub, W - PAD * 2).slice(0, 2), PAD, y - 20, 40, 1.4, '#4a5b6c', 500) + 30; }
      const rows = lines(c.lines).slice(0, 6);
      const labelW = 220, gap = Math.min(150, (H - y - PAD - 60) / Math.max(rows.length, 1));
      rows.forEach((r, i) => {
        const parts = r.split(/[｜|]/), label = parts.length > 1 ? parts[0].trim() : '', val = (parts.length > 1 ? parts.slice(1).join('｜') : r).trim();
        const yy = y + i * gap;
        if (label) {
          ctx.fillStyle = B.primary; roundRect(ctx, PAD, yy, labelW, 72, 12); ctx.fill();
          const lf = fit(ctx, label, labelW - 30, 1, [38, 34, 30, 26]);
          drawLines(ctx, lf.lines, PAD + labelW / 2, yy + (72 - lf.size) / 2 - 2, lf.size, 1, textOn(B.primary), 700, 'center');
        }
        const x = label ? PAD + labelW + 30 : PAD;
        const vf = fit(ctx, val, W - x - PAD, 2, [44, 40, 36, 32], 500);
        drawLines(ctx, vf.lines, x, yy + (vf.lines.length > 1 ? 0 : (72 - vf.size) / 2 - 2), vf.size, 1.3, '#1d2b3a', 500);
      });
      footer(ctx, ev, W, H, '#4a5b6c');
    },
    points(ctx, c, ev, B, im, W, H) {
      lightBase(ctx, B, W, H);
      header(ctx, ev, im.logo, W, B.primary);
      let y = titleBlock(ctx, c.title || '活動亮點', PAD + 120, W, B.primary, B.secondary);
      const items = lines(c.lines).slice(0, 5);
      const gap = Math.min(170, (H - y - PAD - 60) / Math.max(items.length, 1));
      items.forEach((it, i) => {
        const yy = y + i * gap;
        ctx.fillStyle = B.secondary; ctx.beginPath(); ctx.arc(PAD + 40, yy + 40, 40, 0, Math.PI * 2); ctx.fill();
        drawLines(ctx, [String(i + 1)], PAD + 40, yy + 16, 46, 1, textOn(B.secondary), 700, 'center');
        const f = fit(ctx, it, W - PAD * 2 - 120, 2, [46, 42, 38, 34], 500);
        drawLines(ctx, f.lines, PAD + 120, yy + (f.lines.length > 1 ? -6 : (80 - f.size) / 2 - 2), f.size, 1.3, '#1d2b3a', 500);
      });
      footer(ctx, ev, W, H, '#4a5b6c');
    },
    lottery(ctx, c, ev, B, im, W, H) {
      darkBase(ctx, B, im.bg, W, H);
      const fg = textOn(B.primary);
      header(ctx, ev, im.logo, W, fg);
      if (has(c.badge)) pill(ctx, c.badge, W - PAD, PAD, '#ffffff', B.primary);
      let y = titleBlock(ctx, c.title || '留言抽好禮', PAD + 130, W, fg, B.secondary);
      const prizeH = has(c.sub) ? 210 : 0;
      const steps = lines(c.lines).slice(0, 4);
      const gap = Math.min(150, (H - y - PAD - prizeH - 30) / Math.max(steps.length, 1));
      steps.forEach((s, i) => {
        const yy = y + i * gap, txt = s.replace(/^[①②③④⑤\d]+[.、\s]*/, '');
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(PAD + 38, yy + 38, 38, 0, Math.PI * 2); ctx.fill();
        drawLines(ctx, [String(i + 1)], PAD + 38, yy + 16, 44, 1, B.primary, 700, 'center');
        const f = fit(ctx, txt, W - PAD * 2 - 110, 2, [44, 40, 36, 32], 500);
        drawLines(ctx, f.lines, PAD + 110, yy + (f.lines.length > 1 ? -6 : (76 - f.size) / 2 - 2), f.size, 1.3, fg, 500);
      });
      if (prizeH) {
        const py = H - PAD - prizeH + 30;
        ctx.fillStyle = B.secondary; roundRect(ctx, PAD, py, W - PAD * 2, prizeH - 30, 24); ctx.fill();
        const sf = textOn(B.secondary);
        drawLines(ctx, ['🎁 獎項'], PAD + 40, py + 26, 32, 1, sf, 500);
        const f = fit(ctx, c.sub, W - PAD * 2 - 80, 2, [50, 44, 38, 34]);
        drawLines(ctx, f.lines, PAD + 40, py + 74, f.size, 1.25, sf);
      }
    },
    countdown(ctx, c, ev, B, im, W, H) {
      darkBase(ctx, B, im.bg, W, H);
      const fg = textOn(B.primary);
      header(ctx, ev, im.logo, W, fg);
      const info = lines(c.lines).slice(0, 3);
      const cy = H * 0.36;
      drawLines(ctx, [has(c.sub) ? c.sub : '倒數'], W / 2, cy - 250, 60, 1, fg, 700, 'center');
      const num = has(c.badge) ? String(c.badge) : '?';
      setFont(ctx, 380, 900); ctx.fillStyle = B.secondary; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const nw = ctx.measureText(num).width; ctx.fillText(num, W / 2 - 40, cy - 190);
      drawLines(ctx, ['天'], W / 2 - 40 + nw / 2 + 60, cy + 60, 80, 1, fg, 700, 'center');
      const t = fit(ctx, c.title || ev.name || '', W - PAD * 2, 2, [78, 68, 58, 50]);
      let y = drawLines(ctx, t.lines, W / 2, cy + 230, t.size, 1.25, fg, 700, 'center') + 30;
      info.forEach((l) => { const f = fit(ctx, l, W - PAD * 2, 1, [42, 38, 34, 30], 500); y = drawLines(ctx, f.lines, W / 2, y, f.size, 1.5, fg, 500, 'center'); });
    },
  };

  // 把一張圖卡畫到畫布上
  async function draw(canvas, card, ev, sizeKey) {
    const S = SIZES[sizeKey] || SIZES.portrait;
    const B = Object.assign({}, DEFAULT_BRAND, ev.brand || {});
    canvas.width = S.w; canvas.height = S.h;
    const ctx = canvas.getContext('2d');
    const im = { logo: await loadImg(B.logo && B.logo.src), bg: await loadImg(B.bg && B.bg.src) };
    (DRAW[card.type] || DRAW.points)(ctx, card, ev, B, im, S.w, S.h);
    return canvas;
  }

  // 依貼文的「搭配圖卡」清單自動建立圖卡（不經 AI）
  function fromPosts(ev) {
    const out = [];
    const when = [ev.dateText, ev.timeText].filter(has).join(' ');
    (ev.posts || []).forEach((p, i) => {
      lines(p.visual).forEach((v, j) => {
        const name = v.replace(/[（(].*?[）)]/g, '').trim() || v;
        const post = String(i + 1);
        if (j === 0) out.push({ post, type: 'cover', title: ev.name || '', sub: ev.theme || '', badge: '', lines: [when, ev.venue].filter(has).join('\n') });
        else if (/抽|好禮|獎/.test(v)) out.push({ post, type: 'lottery', title: name, sub: '', badge: '', lines: '按讚這篇貼文\n標記一位朋友\n留言回答問題' });
        else if (/倒數/.test(v)) out.push({ post, type: 'countdown', title: ev.name || '', sub: '倒數', badge: (v.match(/\d+/) || [''])[0], lines: when });
        else if (/資訊|時間|地點|交通|報名/.test(v)) out.push({ post, type: 'info', title: name, sub: '', badge: '', lines: [['日期', ev.dateText], ['時間', ev.timeText], ['地點', ev.venue], ['報到', ev.checkinPlace]].filter((r) => has(r[1])).map((r) => r.join('｜')).join('\n') });
        else {
          // 重點條列卡：先帶入貼文中以符號開頭的條列行（排除日期、地點、連結）
          const bullets = lines(p.body).filter((l) => /^[^\w\u4e00-\u9fff「【（(#@\-①-⑩]/u.test(l) && !/^(📅|📍|👉|⏰|🎁|📣|-)/u.test(l))
            .map((l) => l.replace(/^[^\w\u4e00-\u9fff「【]+/u, '').trim()).filter(has).slice(0, 5);
          out.push({ post, type: 'points', title: name, sub: '', badge: '', lines: bullets.join('\n') });
        }
      });
    });
    return out;
  }

  // 圖卡檔名：同一篇內依序編號，例如「1 首圖.png」
  function fileNames(cards) {
    const count = {};
    return cards.map((c) => {
      const p = String(c.post || '1');
      count[p] = (count[p] || 0) + 1;
      const label = count[p] === 1 && c.type === 'cover' ? '首圖' : (c.title || TYPES[c.type].label);
      return { folder: `第${p}篇`, name: `${count[p]} ${String(label).replace(/[\\/:*?"<>|\n]/g, '').slice(0, 20)}.png` };
    });
  }

  // --- 打包成 ZIP（不壓縮；PNG 本身已壓縮）---
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function zip(files) { // files: [{ name, data: Uint8Array }]
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0;
    files.forEach((f) => {
      const name = enc.encode(f.name), crc = crc32(f.data), size = f.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); // 0x0800＝檔名使用 UTF-8
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, f.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true); ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    });
    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }

  root.EDCards = { SIZES, TYPES, DEFAULT_BRAND, draw, fromPosts, fileNames, zip };
})(window);
