# 登入測試：用 setup-password.html 產生設定碼，注入 config.js 後驗證登入流程
import re
from playwright.sync_api import sync_playwright
BASE='http://localhost:8765/'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1300,'height':900}); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    # 1) 沒有帳號時不出現登入畫面
    pg.goto(BASE+'index.html'); pg.wait_for_selector('#page h1')
    assert pg.locator('#authGate').count()==0 and pg.locator('[data-auth="logout"]').count()==0
    # 2) 產生設定碼
    pg.goto(BASE+'setup-password.html')
    pg.fill('[name=user]','tester'); pg.fill('[name=pass]','Abc-12345-xyz'); pg.fill('[name=pass2]','Abc-12345-xyz'); pg.click('button[type=submit]')
    pg.wait_for_selector('#out:not([hidden])'); code=pg.inner_text('#code'); print('code:', code[:60]+'…')
    assert 'Abc-12345' not in code
    cfg=open('js/config.js',encoding='utf-8').read().replace('    users: [\n', '    users: [\n      '+code+'\n',1)
    ctx.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=cfg))
    # 3) 登入畫面、錯誤密碼、正確密碼
    pg.goto(BASE+'index.html'); pg.wait_for_selector('#authGate')
    assert not pg.locator('.layout').is_visible(), 'app visible while locked'
    pg.fill('#authGate [name=user]','tester'); pg.fill('#authGate [name=pass]','wrong-pass'); pg.click('#authGate button')
    pg.wait_for_selector('.auth-err:not([hidden])'); print('wrong:', pg.inner_text('.auth-err'))
    pg.screenshot(path='test/out/ui-login.png')
    pg.fill('#authGate [name=pass]','Abc-12345-xyz'); pg.click('#authGate button')
    pg.wait_for_selector('#authGate', state='detached'); assert pg.locator('.layout').is_visible()
    assert pg.locator('[data-auth="logout"]').count()==1
    # 4) 重新整理仍保持登入（同一分頁）
    pg.reload(); pg.wait_for_selector('#page h1'); assert pg.locator('#authGate').count()==0, 'lost session on reload'
    # 5) 登出
    pg.click('[data-auth="logout"]'); pg.wait_for_selector('#authGate'); print('logout ok')
    # 6) 保持登入：新分頁仍為登入狀態；未勾選時新分頁需重新登入
    pg.fill('#authGate [name=user]','tester'); pg.fill('#authGate [name=pass]','Abc-12345-xyz'); pg.click('#authGate button'); pg.wait_for_selector('#authGate', state='detached')
    p2=ctx.new_page(); p2.goto(BASE+'index.html'); p2.wait_for_timeout(800); print('new tab without keep → gate:', p2.locator('#authGate').count()==1); p2.close()
    pg.click('[data-auth="logout"]'); pg.wait_for_selector('#authGate')
    pg.fill('#authGate [name=user]','tester'); pg.fill('#authGate [name=pass]','Abc-12345-xyz'); pg.check('#authGate [name=keep]'); pg.click('#authGate button'); pg.wait_for_selector('#authGate', state='detached')
    p3=ctx.new_page(); p3.goto(BASE+'index.html'); p3.wait_for_selector('#page h1'); print('new tab with keep → gate:', p3.locator('#authGate').count()==1)
    b.close()
print('errors:', errs)
