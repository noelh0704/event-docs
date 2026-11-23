// ===== Excel（.xlsx）匯出：報價單（含公式）、備品清單 =====
(function (root) {
  function create(ExcelJS, CONFIG) {
    const T = root.EDTemplates || (typeof require !== 'undefined' ? require('./templates.js') : null);
    const Q = root.EDQuote || (typeof require !== 'undefined' ? require('./quote.js') : null);
    const D = CONFIG.doc;
    const FONT = { name: D.fontEastAsia, size: D.bodyPt };
    const has = (s) => String(s == null ? '' : s).trim() !== '';
    const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const THIN = { style: 'thin', color: { argb: 'FF999999' } };
    const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
    const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + hex } });
    const NUM = '#,##0';

    function base(title) {
      const wb = new ExcelJS.Workbook();
      wb.creator = CONFIG.company.name;
      const ws = wb.addWorksheet(title, {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 } },
      });
      return { wb, ws };
    }
    // 寫入一格：v＝值或 { formula }；o＝樣式
    function put(ws, addr, v, o) {
      o = o || {};
      const c = ws.getCell(addr);
      c.value = v;
      c.font = Object.assign({}, FONT, o.font || {});
      c.alignment = Object.assign({ vertical: 'middle', wrapText: true }, o.align || {});
      if (o.border) c.border = BOX;
      if (o.fill) c.fill = fill(o.fill);
      if (o.num) c.numFmt = NUM;
      return c;
    }
    function boxRange(ws, r, c1, c2) { for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = BOX; }
    const col = (n) => String.fromCharCode(64 + n);

    // 依內容估算列高，讓換行的文字不會被切掉
    function fitHeight(ws, r, texts) {
      const maxLines = Math.max(1, ...texts.map(([t, w]) => lines(t).reduce((a, l) => a + Math.max(1, Math.ceil(l.length * 2 / w)), 0)));
      ws.getRow(r).height = Math.max(18, maxLines * 16);
    }

    // ---------- 報價單 ----------
    function quote(ev) {
      const q = ev.quote || {}, co = ev.company || {}, r = Q.calc(q);
      const { wb, ws } = base('報價單');
      // 欄位：A No.｜B 品名｜C 規格／說明｜D 數量｜E 單位｜F 單價｜G 小計
      [6, 22, 42, 8, 7, 12, 14].forEach((w, i) => (ws.getColumn(i + 1).width = w));
      let row = 1;
      const logo = ev.brand && ev.brand.logo;
      if (logo && logo.src) {
        const id = wb.addImage({ base64: logo.src, extension: /image\/png/.test(logo.src) ? 'png' : 'jpeg' });
        const h = 60, w = Math.min(220, Math.round(h * (logo.w / logo.h || 2.5)));
        ws.addImage(id, { tl: { col: 0.2, row: 0.2 }, ext: { width: w, height: h } });
      }
      const head = [has(co.name) ? co.name : ev.orgExec || CONFIG.company.name].concat(
        [has(co.taxId) && `統一編號：${co.taxId}`, has(co.address) && `地址：${co.address}`, has(co.phone) && `電話：${co.phone}`, has(co.email) && `E-mail：${co.email}`].filter(Boolean));
      head.forEach((t, i) => {
        ws.mergeCells(row, 4, row, 7);
        put(ws, `D${row}`, t, { align: { horizontal: 'right' }, font: i === 0 ? { bold: true, size: D.h2Pt } : {} });
        row++;
      });
      row++;
      ws.mergeCells(row, 1, row, 7);
      put(ws, `A${row}`, '報價單', { align: { horizontal: 'center' }, font: { bold: true, size: D.titlePt, color: { argb: 'FF' + D.accent } } });
      ws.getRow(row).height = 36;
      row += 2;

      // 專案與客戶資訊（左右兩欄）
      const info = [
        ['報價單號', q.no, '報價日期', q.date],
        ['專案名稱', has(q.projectName) ? q.projectName : ev.name, '執行日期', has(q.execDate) ? q.execDate : ev.dateText],
        ['客戶名稱', q.client, '執行地點', has(q.execPlace) ? q.execPlace : ev.venue],
        ['客戶統編', q.clientTaxId, '專案人員', q.staff],
        ['客戶聯絡人', q.clientContact, '聯絡電話', q.clientPhone],
        ['客戶地址', q.clientAddr, '有效期限', q.validUntil],
      ];
      info.forEach((it) => {
        ws.mergeCells(row, 1, row, 2); ws.mergeCells(row, 4, row, 5); ws.mergeCells(row, 6, row, 7);
        put(ws, `A${row}`, it[0], { fill: D.headFill, font: { bold: true } });
        put(ws, `C${row}`, it[1] || '');
        put(ws, `D${row}`, it[2], { fill: D.headFill, font: { bold: true } });
        put(ws, `F${row}`, it[3] || '');
        boxRange(ws, row, 1, 7);
        fitHeight(ws, row, [[it[1], 42], [it[3], 26]]);
        row++;
      });
      row++;

      // 品項明細
      const hdr = ['No.', '品名', '規格／說明', '數量', '單位', '單價', '小計'];
      hdr.forEach((h, i) => put(ws, `${col(i + 1)}${row}`, h, { border: true, fill: D.headFill, font: { bold: true }, align: { horizontal: 'center' } }));
      const headerRow = row;
      row++;
      const sumParts = [];
      let n = 0;
      r.groups.forEach((g) => {
        let catRow = null;
        if (g.cat) {
          catRow = row;
          put(ws, `A${row}`, g.label, { border: true, fill: 'F3EFE8', font: { bold: true }, align: { horizontal: 'center' } });
          ws.mergeCells(row, 2, row, 6);
          put(ws, `B${row}`, g.cat, { fill: 'F3EFE8', font: { bold: true } });
          boxRange(ws, row, 2, 6);
          row++;
        }
        const first = row;
        g.items.forEach((it, i) => {
          n++;
          put(ws, `A${row}`, g.cat ? i + 1 : n, { border: true, align: { horizontal: 'center' } });
          put(ws, `B${row}`, it.name || '', { border: true });
          put(ws, `C${row}`, it.spec || '', { border: true });
          put(ws, `D${row}`, it.qtyN == null ? it.qty || '' : it.qtyN, { border: true, num: true, align: { horizontal: 'right' } });
          put(ws, `E${row}`, it.unit || '', { border: true, align: { horizontal: 'center' } });
          put(ws, `F${row}`, it.priceN == null ? '' : it.priceN, { border: true, num: true, align: { horizontal: 'right' } });
          put(ws, `G${row}`, { formula: `IF(OR(D${row}="",F${row}=""),"",D${row}*F${row})`, result: it.sub == null ? '' : it.sub }, { border: true, num: true, align: { horizontal: 'right' } });
          fitHeight(ws, row, [[it.name, 22], [it.spec, 42]]);
          row++;
        });
        const range = `G${first}:G${row - 1}`;
        if (catRow) { put(ws, `G${catRow}`, { formula: `SUM(${range})`, result: g.sum }, { border: true, fill: 'F3EFE8', num: true, font: { bold: true }, align: { horizontal: 'right' } }); sumParts.push(`G${catRow}`); }
        else sumParts.push(range);
      });
      if (!r.groups.length) row++;

      // 合計
      const total = (label, formula, result, strong) => {
        ws.mergeCells(row, 1, row, 6);
        put(ws, `A${row}`, label, { font: { bold: true }, align: { horizontal: 'right' }, fill: strong ? D.headFill : undefined });
        boxRange(ws, row, 1, 6);
        put(ws, `G${row}`, formula == null ? '' : { formula, result }, { border: true, num: true, font: { bold: true }, align: { horizontal: 'right' }, fill: strong ? D.headFill : undefined });
        return `G${row++}`;
      };
      const tag = r.taxed ? '含稅' : '未稅';
      const rate = r.rate;
      const S = total(`小計（${tag}）`, sumParts.length ? `SUM(${sumParts.join(',')})` : '0', r.sum);
      let B = S, d = null;
      if (r.discount) d = total(has(q.discountLabel) ? q.discountLabel : '專案優惠', `-${r.discount}`, -r.discount);
      const pctLabel = `${Math.round(rate * 1000) / 10}%`;
      if (r.taxed) {
        // 單價已含稅：總計＝小計－優惠，再反推未稅與稅額
        const TOT = total('總計（含稅）', d ? `${S}+${d}` : `${S}`, r.total, true);
        if (rate) { const u = total('其中未稅金額', `ROUND(${TOT}/(1+${rate}),0)`, r.untaxed); total(`其中營業稅（${pctLabel}）`, `${TOT}-${u}`, r.tax); }
      } else {
        // 單價為未稅：未稅金額＋營業稅＝總計
        if (d) B = total('未稅金額', `${S}+${d}`, r.untaxed);
        const t = total(`營業稅（${pctLabel}）`, `ROUND(${B}*${rate},0)`, r.tax);
        total('總計（含稅）', `${B}+${t}`, r.total, true);
      }
      row++;
      ws.mergeCells(row, 1, row, 7);
      put(ws, `A${row}`, `總計金額：${r.totalText}（含稅）`, { font: { bold: true } });
      row++;
      ws.mergeCells(row, 1, row, 7);
      put(ws, `A${row}`, '※ 大寫金額依匯出時的總計產生；在 Excel 修改數量或單價後，請一併更正此列。', { font: { color: { argb: 'FF777777' } } });
      row += 2;

      // 條件事項、匯款資訊、回簽
      const para = (title, items, numbered) => {
        ws.mergeCells(row, 1, row, 7);
        put(ws, `A${row}`, title, { font: { bold: true, size: D.h2Pt, color: { argb: 'FF' + D.accent } } });
        row++;
        items.forEach((t, i) => {
          put(ws, `A${row}`, numbered ? i + 1 : '', { align: { horizontal: 'center', vertical: 'top' } });
          ws.mergeCells(row, 2, row, 7);
          put(ws, `B${row}`, t, { align: { vertical: 'top' } });
          fitHeight(ws, row, [[t, 120]]);
          row++;
        });
        row++;
      };
      para('條件事項', lines(has(q.terms) ? q.terms : T.QUOTE_TERMS), true);
      if (lines(co.bank).length) para('匯款資訊', lines(co.bank), false);
      // 回簽欄做成單一列（標題與簽名空間在同一格），列印時不會被拆到兩頁
      const signCell = (title, body) => ({ richText: [{ text: title + '\n', font: Object.assign({}, FONT, { bold: true }) }, { text: body, font: FONT }] });
      ws.mergeCells(row, 1, row, 3); ws.mergeCells(row, 4, row, 7);
      put(ws, `A${row}`, signCell('報價單位', '\n（用印）\n\n'), { align: { horizontal: 'center', vertical: 'top' } });
      put(ws, `D${row}`, signCell('客戶確認回簽', '\n（簽名／用印）\n\n日期：　　　年　　　月　　　日'), { align: { horizontal: 'center', vertical: 'top' } });
      boxRange(ws, row, 1, 7);
      ws.getRow(row).height = 86;

      ws.headerFooter.oddFooter = '&C第 &P 頁，共 &N 頁';
      return wb;
    }

    // ---------- 備品清單 ----------
    function supplies(ev) {
      const { wb, ws } = base('備品清單');
      // 欄位：A No.｜B 區域｜C 項目｜D 確認｜E 數量｜F 規格｜G 備註
      [6, 14, 30, 7, 8, 8, 36].forEach((w, i) => (ws.getColumn(i + 1).width = w));
      let row = 1;
      ws.mergeCells(row, 1, row, 7);
      put(ws, `A${row}`, ev.name || '（請填寫活動名稱）', { align: { horizontal: 'center' }, font: { bold: true, size: D.titlePt, color: { argb: 'FF' + D.accent } } });
      ws.getRow(row).height = 34; row++;
      ws.mergeCells(row, 1, row, 7);
      put(ws, `A${row}`, '－備品清單－', { align: { horizontal: 'center' }, font: { bold: true, size: D.subtitlePt } });
      row += 2;
      [['活動日期', ev.dateText], ['活動地點', ev.venue]].filter((x) => has(x[1])).forEach((x) => {
        ws.mergeCells(row, 1, row, 2); ws.mergeCells(row, 3, row, 7);
        put(ws, `A${row}`, x[0], { fill: D.headFill, font: { bold: true } });
        put(ws, `C${row}`, x[1]);
        boxRange(ws, row, 1, 7); row++;
      });
      const rem = lines(ev.supplyReminders);
      if (rem.length) {
        row++;
        ws.mergeCells(row, 1, row, 7);
        put(ws, `A${row}`, '清點提醒', { font: { bold: true, size: D.h2Pt, color: { argb: 'FF' + D.accent } } });
        row++;
        rem.forEach((t, i) => {
          put(ws, `A${row}`, i + 1, { align: { horizontal: 'center', vertical: 'top' } });
          ws.mergeCells(row, 2, row, 7);
          put(ws, `B${row}`, t, { align: { vertical: 'top' } });
          fitHeight(ws, row, [[t, 100]]);
          row++;
        });
      }
      row++;
      const hdr = ['No.', '區域', '項目', '確認', '數量', '規格', '備註'];
      hdr.forEach((h, i) => put(ws, `${col(i + 1)}${row}`, h, { border: true, fill: D.headFill, font: { bold: true }, align: { horizontal: 'center' } }));
      const headerRow = row;
      row++;
      let last = null;
      (ev.supplies || []).filter((s) => has(s.item)).forEach((s, i) => {
        const q = Number(String(s.qty).replace(/,/g, ''));
        put(ws, `A${row}`, i + 1, { border: true, align: { horizontal: 'center' } });
        put(ws, `B${row}`, s.area === last ? '' : s.area || '', { border: true, font: { bold: true } });
        put(ws, `C${row}`, s.item || '', { border: true });
        put(ws, `D${row}`, '□', { border: true, align: { horizontal: 'center' } });
        put(ws, `E${row}`, has(s.qty) && Number.isFinite(q) ? q : s.qty || '', { border: true, align: { horizontal: 'right' } });
        put(ws, `F${row}`, s.unit || '', { border: true, align: { horizontal: 'center' } });
        put(ws, `G${row}`, s.note || '', { border: true });
        fitHeight(ws, row, [[s.item, 30], [s.note, 36]]);
        last = s.area; row++;
      });
      ws.views = [{ state: 'frozen', ySplit: headerRow }];
      ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: row - 1, column: 7 } };
      ws.pageSetup.printTitlesRow = `${headerRow}:${headerRow}`;
      ws.headerFooter.oddFooter = '&C第 &P 頁，共 &N 頁';
      return wb;
    }

    return { quote, supplies, toBuffer: (wb) => wb.xlsx.writeBuffer() };
  }

  root.EDRenderXlsx = { create };
  if (typeof module !== 'undefined') module.exports = { create };
})(typeof window !== 'undefined' ? window : globalThis);
