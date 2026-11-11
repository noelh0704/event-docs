// ===== 文件模型 → Word（.docx）=====
// 公司規範：字體最小 12 級、目錄確實套用標題樣式、圖片一律放在表格格子內。
(function (root) {
  function create(docx, CONFIG) {
    const D = CONFIG.doc;
    const FONT = { ascii: D.fontAscii, hAnsi: D.fontAscii, eastAsia: D.fontEastAsia, cs: D.fontAscii };
    const pt = (n) => n * 2; // Word 以「半點」為單位
    const cm = (n) => Math.round(n * 567); // 公分 → twip
    const PAGE_W = 11906, PAGE_H = 16838; // A4
    const CONTENT_W = PAGE_W - cm(D.marginCm) * 2;
    const BORDER = { style: docx.BorderStyle.SINGLE, size: 4, color: '999999' };
    const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
    const CELL_MARGIN = { top: 60, bottom: 60, left: 100, right: 100 };

    const run = (text, o) => new docx.TextRun(Object.assign({ text: String(text == null ? '' : text), font: FONT, size: pt(D.bodyPt) }, o || {}));

    function paras(text, o) {
      // 一格內的多行文字 → 多個段落
      const arr = String(text == null ? '' : text).split('\n');
      return arr.map((line) => new docx.Paragraph(Object.assign({ children: [run(line, o && o.run)], spacing: { before: 20, after: 20 } }, (o && o.para) || {})));
    }

    function cell(text, width, o) {
      o = o || {};
      return new docx.TableCell({
        width: { size: width, type: docx.WidthType.DXA },
        borders: BORDERS,
        margins: CELL_MARGIN,
        verticalAlign: docx.VerticalAlign.CENTER,
        shading: o.fill ? { fill: o.fill, type: docx.ShadingType.CLEAR, color: 'auto' } : undefined,
        children: o.children || paras(text, { run: o.bold ? { bold: true } : undefined, para: o.center ? { alignment: docx.AlignmentType.CENTER } : undefined }),
      });
    }

    function widthsOf(percents) {
      const w = percents.map((p) => Math.floor((CONTENT_W * p) / 100));
      w[w.length - 1] += CONTENT_W - w.reduce((a, b) => a + b, 0);
      return w;
    }

    // rowH：列高（像素），用於需要手寫或黏貼的表格
    const rowHeight = (px) => (px ? { height: { value: Math.round(px * 15), rule: docx.HeightRule.ATLEAST } } : {});
    function table(head, rows, percents, rowH) {
      const w = widthsOf(percents);
      const trs = [];
      if (head) {
        trs.push(new docx.TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, w[i], { fill: D.headFill, bold: true, center: true })) }));
      }
      (rows.length ? rows : [head.map(() => '')]).forEach((r) => {
        trs.push(new docx.TableRow(Object.assign({ cantSplit: true, children: r.map((c, i) => cell(c, w[i])) }, rowHeight(rowH))));
      });
      return new docx.Table({ width: { size: CONTENT_W, type: docx.WidthType.DXA }, columnWidths: w, rows: trs });
    }

    function kv(rows, rowH) {
      const w = widthsOf([22, 78]);
      return new docx.Table({
        width: { size: CONTENT_W, type: docx.WidthType.DXA }, columnWidths: w,
        rows: rows.map((r) => new docx.TableRow(Object.assign({ children: [cell(r[0], w[0], { fill: D.headFill, bold: true }), cell(r[1], w[1])] }, rowHeight(rowH)))),
      });
    }

    function dataUrlToBytes(src) {
      const b64 = src.split(',')[1] || '';
      if (typeof atob === 'function') {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
      }
      return Buffer.from(b64, 'base64');
    }

    function image(b) {
      // 圖片放進單格表格內
      const maxW = 600; // 像素（約等於版心寬度）
      const ratio = b.w && b.h ? b.h / b.w : 0.6;
      const wpx = Math.min(maxW, b.w || maxW);
      const img = new docx.ImageRun({ data: dataUrlToBytes(b.src), transformation: { width: wpx, height: Math.round(wpx * ratio) } });
      const w = [CONTENT_W];
      return new docx.Table({
        width: { size: CONTENT_W, type: docx.WidthType.DXA }, columnWidths: w,
        rows: [
          new docx.TableRow({ children: [cell('', w[0], { children: [new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, children: [img] })] })] }),
          new docx.TableRow({ children: [cell(b.caption || '', w[0], { center: true })] }),
        ],
      });
    }

    const gap = () => new docx.Paragraph({ children: [run('')], spacing: { before: 0, after: 0 } });

    function blocks(model) {
      const out = [];
      model.blocks.forEach((b) => {
        if (b.t === 'h1') out.push(new docx.Paragraph({ heading: docx.HeadingLevel.HEADING_1, children: [new docx.TextRun({ text: b.text })] }));
        else if (b.t === 'h2') out.push(new docx.Paragraph({ heading: docx.HeadingLevel.HEADING_2, children: [new docx.TextRun({ text: b.text })] }));
        else if (b.t === 'p') {
          const para = { spacing: { before: 80, after: 80, line: 360 } };
          if (b.indent) para.indent = { firstLine: D.bodyPt * 20 * 2 }; // 首行縮排兩個字
          if (b.center) para.alignment = docx.AlignmentType.CENTER;
          paras(b.text, { run: b.bold ? { bold: true } : undefined, para }).forEach((p) => out.push(p));
        }
        else if (b.t === 'note') paras(b.text, { run: { color: '555555' }, para: { spacing: { before: 60, after: 60 } } }).forEach((p) => out.push(p));
        else if (b.t === 'list') {
          b.items.forEach((x) => out.push(new docx.Paragraph({
            numbering: { reference: b.ordered ? 'ed-num' : 'ed-bullet', level: 0 },
            children: [run(x)], spacing: { before: 40, after: 40, line: 340 },
          })));
        } else if (b.t === 'break') out.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
        else if (b.t === 'kv') { out.push(kv(b.rows, b.rowH)); out.push(gap()); }
        else if (b.t === 'table') { out.push(table(b.head, b.rows, b.widths, b.rowH)); out.push(gap()); }
        else if (b.t === 'image') { out.push(image(b)); out.push(gap()); }
      });
      return out;
    }

    function build(model) {
      const children = [];
      if (model.pretitle) children.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { before: 0, after: 120 }, children: [run(model.pretitle, { bold: true, size: pt(D.h2Pt) })] }));
      children.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { before: 0, after: 80 }, children: [run(model.title, { bold: true, size: pt(D.titlePt), color: D.accent })] }));
      children.push(new docx.Paragraph({ alignment: docx.AlignmentType.CENTER, spacing: { before: 0, after: 240 }, children: [run(model.subtitle || '', { bold: true, size: pt(D.subtitlePt) })] }));
      if (model.toc) {
        children.push(new docx.Paragraph({ spacing: { before: 120, after: 120 }, children: [run('目錄', { bold: true, size: pt(D.h1Pt), color: D.accent })] }));
        children.push(new docx.TableOfContents('目錄', { hyperlink: true, headingStyleRange: '1-2' }));
        children.push(new docx.Paragraph({ children: [new docx.PageBreak()] }));
      }
      blocks(model).forEach((x) => children.push(x));

      const footer = new docx.Footer({
        children: [new docx.Paragraph({
          alignment: docx.AlignmentType.CENTER,
          children: [run((model.footer ? model.footer + '　｜　' : '') + '第 '), new docx.TextRun({ children: [docx.PageNumber.CURRENT], font: FONT, size: pt(D.bodyPt) }), run(' 頁')],
        })],
      });

      const tocStyle = (id, name, indent) => ({
        id, name, basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { font: FONT, size: pt(D.bodyPt) },
        paragraph: { indent: { left: indent }, spacing: { before: 60, after: 60 } },
      });

      return new docx.Document({
        features: { updateFields: !!model.toc }, // 開啟時讓 Word 更新目錄頁碼
        styles: {
          default: { document: { run: { font: FONT, size: pt(D.bodyPt) } } },
          paragraphStyles: [
            { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { font: FONT, size: pt(D.h1Pt), bold: true, color: D.accent },
              paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 0, keepNext: true } },
            { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
              run: { font: FONT, size: pt(D.h2Pt), bold: true },
              paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1, keepNext: true } },
            tocStyle('TOC1', 'toc 1', 0),
            tocStyle('TOC2', 'toc 2', 480),
          ],
        },
        numbering: {
          config: [
            { reference: 'ed-bullet', levels: [{ level: 0, format: docx.LevelFormat.BULLET, text: '▶', alignment: docx.AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 360 } }, run: { font: FONT, size: pt(D.bodyPt) } } }] },
            { reference: 'ed-num', levels: [{ level: 0, format: docx.LevelFormat.DECIMAL, text: '%1.', alignment: docx.AlignmentType.LEFT, style: { paragraph: { indent: { left: 480, hanging: 360 } }, run: { font: FONT, size: pt(D.bodyPt) } } }] },
          ],
        },
        sections: [{
          properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: cm(D.marginCm), bottom: cm(D.marginCm), left: cm(D.marginCm), right: cm(D.marginCm) } } },
          footers: { default: footer },
          children,
        }],
      });
    }

    return {
      build,
      toBlob: (model) => docx.Packer.toBlob(build(model)),
      toBuffer: (model) => docx.Packer.toBuffer(build(model)),
    };
  }

  root.EDRenderDocx = { create };
  if (typeof module !== 'undefined') module.exports = { create };
})(typeof window !== 'undefined' ? window : globalThis);
