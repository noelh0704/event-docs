// 測試：用範例活動產出四種文件的 Word 檔
const fs = require('fs'); const path = require('path');
const docx = require('docx');
const CONFIG = require('../js/config.js'); const ev = require('../js/sample.js');
const T = require('../js/templates.js'); const R = require('../js/render-docx.js').create(docx, CONFIG);
// 1x1 測試圖
ev.venueMap = { src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAA8CAIAAAAfXYiZAAAAR0lEQVR4nO3QMQEAAAjDMMC/5yFjRxMFfXpJijfXgE/MMjPLzCwzs8zMMjPLzCwzs8zMMjPLzCwzs8zMMjPLzCwzs8zMsgNQEwJ1qv3I3QAAAABJRU5ErkJggg==', w: 100, h: 60 };
fs.mkdirSync('out', { recursive: true });
(async () => {
  const jobs = [['notice', 'attendee'], ['notice', 'staff'], ['mc'], ['manual'], ['supplies'], ['press', 'post'], ['speech'], ['posts'], ['signin', 'staff'], ['score'], ['receipt', 'list'], ['receipt', 'form']];
  for (const [d, a] of jobs) {
    const m = T.build(d, ev, { audience: a, pressType: a, signType: a, receiptType: a, company: CONFIG.company.name });
    fs.writeFileSync(path.join('out', `${d}${a ? '-' + a : ''}.docx`), await R.toBuffer(m));
    if (d === 'notice' && a === 'attendee') fs.writeFileSync('out/notice.txt', T.toText(m));
  }
  fs.writeFileSync('out/supplies.csv', T.suppliesCSV(ev));
  // 報價單：Word 與 Excel（未稅、含稅兩種計價）
  fs.writeFileSync('out/quote.docx', await R.toBuffer(T.build('quote', ev, { company: CONFIG.company.name })));
  const X = require('../js/render-xlsx.js').create(require('exceljs'), CONFIG);
  fs.writeFileSync('out/quote.xlsx', Buffer.from(await X.toBuffer(X.quote(ev))));
  const ev2 = JSON.parse(JSON.stringify(ev)); ev2.quote.priceMode = 'taxed';
  fs.writeFileSync('out/quote-taxed.xlsx', Buffer.from(await X.toBuffer(X.quote(ev2))));
  fs.writeFileSync('out/supplies.xlsx', Buffer.from(await X.toBuffer(X.supplies(ev))));
  const Q = require('../js/quote.js');
  console.log('calc untaxed', JSON.stringify((({ sum, discount, untaxed, tax, total, totalText, missing }) => ({ sum, discount, untaxed, tax, total, totalText, missing }))(Q.calc(ev.quote))));
  console.log('calc taxed', JSON.stringify((({ sum, untaxed, tax, total }) => ({ sum, untaxed, tax, total }))(Q.calc(ev2.quote))));
  console.log('cn', [0, 10, 105, 1005, 10500, 100000500, 230000, 1234567].map(Q.chineseAmount).join(' / '));
  console.log('done');
})();
