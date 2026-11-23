// ===== 文件模型 → 網頁預覽 =====
(function (root) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const br = (s) => esc(s).replace(/\n/g, '<br>');

  function block(b) {
    switch (b.t) {
      case 'h1': return `<h2 class="d-h1">${esc(b.text)}</h2>`;
      case 'h2': return `<h3 class="d-h2">${esc(b.text)}</h3>`;
      case 'p': return `<p class="${b.indent ? 'd-indent ' : ''}${b.center ? 'd-center ' : ''}${b.bold ? 'd-bold' : ''}">${br(b.text)}</p>`;
      case 'note': return `<p class="d-note">${br(b.text)}</p>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map((x) => `<li>${esc(x)}</li>`).join('')}</${tag}>`;
      }
      case 'break': return '<div class="d-break"></div>';
      case 'kv':
        return `<table class="d-kv"><tbody>${b.rows.map((r) => `<tr${b.rowH ? ` style="height:${b.rowH}px"` : ''}><th>${esc(r[0])}</th><td>${br(r[1])}</td></tr>`).join('')}</tbody></table>`;
      case 'info4':
        return `<table class="d-info4"><colgroup><col style="width:16%"><col style="width:34%"><col style="width:16%"><col style="width:34%"></colgroup><tbody>${b.rows.map((r) => `<tr><th>${esc(r[0])}</th><td>${br(r[1])}</td><th>${esc(r[2])}</th><td>${br(r[3])}</td></tr>`).join('')}</tbody></table>`;
      case 'table': {
        const n = b.head.length, al = (i) => (b.align && b.align[i] === 'r' ? ' class="num"' : b.align && b.align[i] === 'c' ? ' class="ctr"' : '');
        const cols = b.widths.map((w) => `<col style="width:${w}%">`).join('');
        const head = b.head.map((h) => `<th>${esc(h)}</th>`).join('');
        const tr = b.rowH ? ` style="height:${b.rowH}px"` : '';
        const row = (r) => {
          // 大項列：編號＋名稱（跨欄）＋大項小計；合計列：標題（跨欄）＋金額（金額都在最後一欄）
          if (r.kind === 'cat') return `<tr class="d-cat"><td class="ctr">${esc(r.no)}</td><td colspan="${n - 2}">${esc(r.text)}</td><td class="num">${esc(r.value)}</td></tr>`;
          if (r.kind === 'total') return `<tr class="d-total${r.strong ? ' strong' : ''}"><td colspan="${n - 1}" class="num">${esc(r.label)}</td><td class="num">${esc(r.value)}</td></tr>`;
          return `<tr${tr}>${r.map((c, i) => `<td${al(i)}>${br(c)}</td>`).join('')}</tr>`;
        };
        const rows = b.rows.length ? b.rows.map(row).join('') : `<tr><td colspan="${n}" class="d-empty">（尚無資料）</td></tr>`;
        return `<table class="d-table"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      case 'image':
        // 公司規範：圖片一律放在表格格子內
        return `<table class="d-table d-img"><tbody><tr><td><img src="${b.src}" alt="${esc(b.caption)}"></td></tr><tr><td class="d-cap">${esc(b.caption)}</td></tr></tbody></table>`;
      default: return '';
    }
  }

  function render(model) {
    const lh = model.letterhead;
    let html = lh ? `<div class="d-letterhead">${lh.logo && lh.logo.src ? `<img src="${lh.logo.src}" alt="">` : ''}<div><div class="d-lh-name">${esc(lh.name)}</div>${lh.lines.map((l) => `<div>${esc(l)}</div>`).join('')}</div></div>` : '';
    html += (model.pretitle ? `<p class="d-pretitle">${esc(model.pretitle)}</p>` : '') + `<h1 class="d-title">${esc(model.title)}</h1>` + (model.subtitle ? `<p class="d-subtitle">${esc(model.subtitle)}</p>` : '<p class="d-subtitle"></p>');
    if (model.toc) {
      const heads = model.blocks.filter((b) => b.t === 'h1' || b.t === 'h2');
      html += `<div class="d-toc"><div class="d-toc-title">目錄</div>${heads.map((h) => `<div class="d-toc-${h.t}">${esc(h.text)}</div>`).join('')}<div class="d-toc-hint">匯出 Word 後為可更新的正式目錄（含頁碼）</div></div>`;
    }
    html += model.blocks.map(block).join('');
    if (model.footer) html += `<div class="d-footer">${esc(model.footer)}</div>`;
    return html;
  }

  root.EDRenderHTML = { render, esc };
  if (typeof module !== 'undefined') module.exports = { render, esc };
})(typeof window !== 'undefined' ? window : globalThis);
