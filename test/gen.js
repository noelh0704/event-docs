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
  console.log('done');
})();
