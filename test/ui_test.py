# 介面測試：載入頁面、切換章節、模擬 AI 回應、匯出 Word
import json, sys
from playwright.sync_api import sync_playwright
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1500,'height':950})
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('#page h1')
    pg.screenshot(path='test/out/ui-basic.png')
    for s in ['schedule','teams','vips','notice','mc','manual','supplies']:
        pg.click(f'[data-section="{s}"]'); pg.wait_for_timeout(100)
    # 編輯 → 預覽同步
    pg.click('[data-section="basic"]'); pg.fill('[data-path="name"]','測試活動ABC'); pg.wait_for_timeout(400)
    assert '測試活動ABC' in pg.inner_text('#page'), 'preview not synced'
    # 新增／刪除列
    pg.click('[data-section="vips"]'); n=pg.locator('.row-card').count(); pg.click('[data-act="rowAdd"]'); assert pg.locator('.row-card').count()==n+1
    pg.locator('[data-act="rowDel"]').last.click(); assert pg.locator('.row-card').count()==n
    # 設定 + 模擬 AI 中繼服務
    pg.evaluate("localStorage.setItem('eventDocs.settings.v1', JSON.stringify({aiMode:'proxy',proxyUrl:'https://proxy.test/exec',accessCode:'x'}))"); pg.reload(); pg.wait_for_selector('#page h1')
    seen={}
    def handle(route):
        body=json.loads(route.request.post_data); seen['body']=body
        txt='```json\n'+json.dumps({'scripts':[{'index':3,'script':'各位貴賓大家好（上台樂）'}],'adlibs':['流程延遲：請稍候']},ensure_ascii=False)+'\n```'
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'text':txt}))
    pg.route('https://proxy.test/**', handle)
    pg.click('[data-section="mc"]'); pg.click('[data-act="ai"]'); pg.click('#confirmOk'); pg.wait_for_selector('#toast:not([hidden])')
    assert '各位貴賓大家好（上台樂）' in pg.inner_text('#page'), 'AI result not applied'
    assert '0900' not in seen['body']['prompt'] and 'example.com' not in seen['body']['prompt'], 'contact leaked'
    pg.screenshot(path='test/out/ui-mc.png')
    # 匯出 Word（操作手冊）
    pg.click('[data-section="manual"]')
    with pg.expect_download() as d: pg.click('[data-act="word"]')
    f=d.value; print('download:', f.suggested_filename); f.save_as('test/out/ui-manual.docx')
    with pg.expect_download() as d: pg.click('[data-act="word"]')
    print('download2:', d.value.suggested_filename)
    # 窄螢幕
    pg.set_viewport_size({'width':420,'height':900}); pg.click('[data-section="notice"]'); pg.screenshot(path='test/out/ui-mobile.png')
    print('overflow-x:', pg.evaluate('document.documentElement.scrollWidth>innerWidth'))
    b.close()
print('errors:', errs)
