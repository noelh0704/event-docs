// ===== 報價單：金額計算（預覽、Word、Excel 共用）=====
(function (root) {
  const has = (s) => String(s == null ? '' : s).trim() !== '';
  // 去掉千分位逗號後轉數字；空白或非數字回傳 null
  function num(v) {
    if (!has(v)) return null;
    const n = Number(String(v).replace(/[,，\s元$]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const fmt = (n) => (n == null ? '' : Math.round(n).toLocaleString('en-US'));
  const CN_NUM = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];

  // 金額轉中文大寫，例如 105000 → 新台幣壹拾萬伍仟元整
  function chineseAmount(n) {
    n = Math.round(Math.abs(Number(n) || 0));
    if (n === 0) return '新台幣零元整';
    const D = '零壹貳參肆伍陸柒捌玖', U = ['', '拾', '佰', '仟'], S = ['', '萬', '億', '兆'];
    function section(part) {
      let out = '', zero = false;
      for (let i = 3; i >= 0; i--) {
        const d = Math.floor(part / Math.pow(10, i)) % 10;
        if (d === 0) { if (out) zero = true; }
        else { if (zero) out += '零'; out += D[d] + U[i]; zero = false; }
      }
      return out;
    }
    let result = '', k = 0;
    while (n > 0) {
      const part = n % 10000;
      n = Math.floor(n / 10000);
      if (part === 0) { if (result && !result.startsWith('零')) result = '零' + result; }
      else result = (part < 1000 && n > 0 ? '零' : '') + section(part) + S[k] + result;
      k++;
    }
    return '新台幣' + result.replace(/^零/, '') + '元整';
  }

  // 依「大項」把連續的品項分組，並算出各項小計與總計
  function calc(q) {
    q = q || {};
    const groups = [];
    let cur = null;
    (q.items || []).filter((it) => has(it.name)).forEach((it) => {
      const cat = String(it.cat || '').trim();
      if (!cur || cur.cat !== cat) { cur = { cat, items: [], sum: 0 }; groups.push(cur); }
      const qty = num(it.qty), price = num(it.price);
      const sub = qty != null && price != null ? qty * price : null;
      cur.items.push(Object.assign({}, it, { qtyN: qty, priceN: price, sub }));
      cur.sum += sub || 0;
    });
    let n = 0;
    groups.forEach((g) => { if (g.cat) g.label = CN_NUM[n++] || String(n); });
    const sum = groups.reduce((a, g) => a + g.sum, 0);
    const discount = num(q.discount) || 0;
    const rate = (num(q.taxRate) == null ? 5 : num(q.taxRate)) / 100;
    const base = sum - discount;
    let untaxed, tax, total;
    if (q.priceMode === 'taxed') { total = base; untaxed = Math.round(total / (1 + rate)); tax = total - untaxed; }
    else { untaxed = base; tax = Math.round(base * rate); total = untaxed + tax; }
    const missing = groups.reduce((a, g) => a + g.items.filter((it) => it.sub == null).length, 0);
    return { groups, sum, discount, rate, untaxed, tax, total, totalText: chineseAmount(total), missing, taxed: q.priceMode === 'taxed' };
  }

  // 民國年日期，例如 115/3/20
  function rocDate(d) { return `${d.getFullYear() - 1911}/${d.getMonth() + 1}/${d.getDate()}`; }

  const api = { calc, chineseAmount, fmt, num, rocDate };
  root.EDQuote = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
