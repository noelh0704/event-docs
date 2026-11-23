# 剩餘次數提醒測試：模擬中繼服務的回應
import json, re
from playwright.sync_api import sync_playwright
state={'remaining':11,'limit':100}
def handle(route):
    body=json.loads(route.request.post_data)
    u=lambda: {'used':state['limit']-state['remaining'],'limit':state['limit'],'remaining':state['remaining']}
    if body.get('action')=='status': return route.fulfill(status=200, content_type='application/json', body=json.dumps({'ok':True,'usage':u()}))
    if state['remaining']<=0: return route.fulfill(status=200, content_type='application/json', body=json.dumps({'error':'今日 AI 使用次數已達上限（100 次），明天 0 點後恢復。','usage':u()}))
    state['remaining']-=1
    txt=json.dumps({'scripts':[{'index':3,'script':'測試講稿'}],'adlibs':['延遲：請稍候']},ensure_ascii=False)
    route.fulfill(status=200, content_type='application/json', body=json.dumps({'text':txt,'usage':u()}))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']); pg=b.new_page(viewport={'width':1500,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    cfg=re.sub(r'\n    users: \[[\s\S]*?\n    \],', '\n    users: [],', open('js/config.js',encoding='utf-8').read())
    pg.route('**/js/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=cfg))
    pg.route('https://proxy.test/**', handle)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('#page h1')
    assert pg.locator('#usageBadge').is_hidden(), 'badge should hide without proxy'
    pg.evaluate("localStorage.setItem('eventDocs.settings.v1', JSON.stringify({aiMode:'proxy',proxyUrl:'https://proxy.test/exec',accessCode:'x'}))"); pg.reload(); pg.wait_for_selector('#page h1')
    pg.wait_for_function("document.querySelector('#usageBadge').textContent.includes('11')")
    print('load:', pg.inner_text('#usageBadge'), '| warn:', 'warn' in pg.get_attribute('#usageBadge','class'))
    pg.click('[data-section="mc"]'); pg.click('[data-act="ai"]'); print('confirm:', pg.inner_text('#confirmText')[:22]); pg.click('#confirmOk')
    pg.wait_for_selector('#toast:not([hidden])'); print('after 1:', pg.inner_text('#usageBadge'), '| warn:', 'warn' in pg.get_attribute('#usageBadge','class'), '| toast:', pg.inner_text('#toast'))
    pg.screenshot(path='test/out/ui-usage.png', clip={'x':700,'y':0,'width':800,'height':60})
    state['remaining']=1; pg.click('#usageBadge'); pg.wait_for_function("document.querySelector('#usageBadge').textContent.includes('剩餘 1')")
    pg.click('[data-act="ai"]'); pg.click('#confirmOk'); pg.wait_for_function("document.querySelector('#usageBadge').textContent.includes('用完')")
    print('at 0:', pg.inner_text('#usageBadge'), '| out:', 'out' in pg.get_attribute('#usageBadge','class'))
    pg.wait_for_timeout(3000); pg.click('[data-act="ai"]'); pg.wait_for_timeout(300)
    print('blocked, no dialog:', not pg.evaluate("document.querySelector('#dlgConfirm').open"), '|', pg.inner_text('#toast'))
    b.close()
print('errors:', errs)
