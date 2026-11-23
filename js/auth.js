// ===== 登入畫面 =====
// 注意：這是純前端的登入門檻，用來擋一般訪客，不是伺服器等級的安全保護。
// 密碼不會出現在程式碼裡，config.js 只存「加鹽雜湊值」（PBKDF2-SHA256）。
// 帳號設定方式：打開 setup-password.html 產生設定碼，貼進 config.js 的 CONFIG.auth.users。
(function () {
  // config.js 用 const 宣告，不在 window 上，所以直接取用全域的 CONFIG
  const C = typeof CONFIG !== 'undefined' ? CONFIG : {};
  const A = C.auth || {};
  const users = Array.isArray(A.users) ? A.users.filter((u) => u && u.user && u.hash && u.salt) : [];
  if (!users.length) return; // 沒有設定任何帳號時，不啟用登入
  const KEY = 'eventDocs.auth.v1';
  const ITER = A.iterations || 210000;
  const root = document.documentElement;

  // 讀取登入狀態：保持登入存在 localStorage，未勾選則只存在這個分頁（sessionStorage）
  function readSession() {
    for (const store of [sessionStorage, localStorage]) {
      try {
        const s = JSON.parse(store.getItem(KEY));
        if (s && s.until > Date.now() && users.some((u) => u.user === s.user && u.hash.slice(0, 12) === s.tag)) return s;
      } catch (e) { /* 忽略 */ }
    }
    return null;
  }
  if (readSession()) { addLogout(); return; }
  root.classList.add('locked');

  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64(salt), iterations }, key, 256));
  }

  function show() {
    const gate = document.createElement('div');
    gate.id = 'authGate';
    gate.innerHTML = `
      <form class="auth-box" autocomplete="on">
        <div class="auth-brand"><span class="brand-mark">文</span><div><div class="auth-title">活動文件公版平台</div><div class="auth-sub">${(C.company && C.company.name) || ''}｜請登入後使用</div></div></div>
        <label>帳號<input type="text" name="user" autocomplete="username" required></label>
        <label>密碼<input name="pass" type="password" autocomplete="current-password" required></label>
        <label class="auth-keep"><input type="checkbox" name="keep"> 在這台電腦保持登入 ${A.keepDays || 7} 天</label>
        <p class="auth-err" role="alert" hidden></p>
        <button class="btn primary" type="submit">登入</button>
      </form>`;
    document.body.prepend(gate);
    const form = gate.querySelector('form'), err = gate.querySelector('.auth-err'), btn = gate.querySelector('button');
    form.user.focus();
    let fails = 0, lockUntil = 0;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const wait = Math.ceil((lockUntil - Date.now()) / 1000);
      if (wait > 0) { err.textContent = `嘗試次數過多，請 ${wait} 秒後再試。`; err.hidden = false; return; }
      btn.disabled = true; btn.textContent = '驗證中…'; err.hidden = true;
      const name = form.user.value.trim(), pass = form.pass.value;
      let ok = null;
      try {
        for (const u of users) {
          if (u.user !== name) continue;
          if ((await derive(pass, u.salt, u.iterations || ITER)) === u.hash) { ok = u; break; }
        }
      } catch (e2) {
        err.textContent = '這個瀏覽器無法驗證密碼，請改用最新版 Chrome、Edge 或 Safari。'; err.hidden = false;
      }
      btn.disabled = false; btn.textContent = '登入';
      if (!ok) {
        if (err.hidden) {
          fails++;
          if (fails >= 5) { lockUntil = Date.now() + 30000; fails = 0; }
          err.textContent = '帳號或密碼錯誤。'; err.hidden = false;
        }
        form.pass.value = ''; form.pass.focus();
        return;
      }
      const keep = form.keep.checked;
      const s = { user: ok.user, tag: ok.hash.slice(0, 12), until: Date.now() + (keep ? (A.keepDays || 7) * 864e5 : 12 * 36e5) };
      try { (keep ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(s)); } catch (e3) { /* 無法儲存時只在本次有效 */ }
      gate.remove();
      root.classList.remove('locked');
      addLogout();
    });
  }

  // 右上角加「登出」按鈕
  function addLogout() {
    const add = () => {
      const bar = document.querySelector('.top-actions');
      if (!bar || bar.querySelector('[data-auth="logout"]')) return;
      const b = document.createElement('button');
      b.className = 'btn ghost'; b.dataset.auth = 'logout'; b.textContent = '登出';
      b.addEventListener('click', () => {
        try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch (e) { /* 忽略 */ }
        location.reload();
      });
      bar.appendChild(b);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
