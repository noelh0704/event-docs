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
      case 'kv':
        return `<table class="d-kv"><tbody>${b.rows.map((r) => `<tr><th>${esc(r[0])}</th><td>${br(r[1])}</td></tr>`).join('')}</tbody></table>`;
      case 'table': {
        const cols = b.widths.map((w) => `<col style="width:${w}%">`).join('');
        const head = b.head.map((h) => `<th>${esc(h)}</th>`).join('');
        const rows = b.rows.length
          ? b.rows.map((r) => `<tr>${r.map((c) => `<td>${br(c)}</td>`).join('')}</tr>`).join('')
          : `<tr><td colspan="${b.head.length}" class="d-empty">（尚無資料）</td></tr>`;
        return `<table class="d-table"><colgroup>${cols}</colgroup><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
      }
      case 'image':
        // 公司規範：圖片一律放在表格格子內
        return `<table class="d-table d-img"><tbody><tr><td><img src="${b.src}" alt="${esc(b.caption)}"></td></tr><tr><td class="d-cap">${esc(b.caption)}</td></tr></tbody></table>`;
      default: return '';
    }
  }

  function render(model) {
    let html = (model.pretitle ? `<p class="d-pretitle">${esc(model.pretitle)}</p>` : '') + `<h1 class="d-title">${esc(model.title)}</h1>` + (model.subtitle ? `<p class="d-subtitle">${esc(model.subtitle)}</p>` : '<p class="d-subtitle"></p>');
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
