// ===== AI 代寫 =====
// 兩種連線方式（在「設定」切換）：
//   proxy ：經由公司自架的中繼服務（proxy/Code.gs），金鑰放在中繼服務，不會出現在網頁上
//   direct：瀏覽器直接使用個人金鑰（金鑰只存在這台電腦的瀏覽器）
(function (root) {
  const SYSTEM = [
    '你是台灣整合行銷與活動執行公司的資深執行企劃，熟悉政府標案活動、記者會、論壇、市集與舞台活動的現場執行文件。',
    '一律使用繁體中文與台灣慣用語。內容要具體、可直接上場使用，不寫空話。',
    '不得捏造使用者沒有提供的人名、電話、地址、單位名稱；不確定的地方用「○○○」或「（待確認）」標示。',
    '只輸出一個 JSON 物件，不要加任何說明文字，也不要用程式碼區塊包起來。',
  ].join('\n');

  function eventBrief(ev) {
    // 只送出寫稿需要的欄位；聯絡人電話與信箱不送出
    const T = root.EDTemplates;
    return JSON.stringify({
      活動名稱: ev.name, 系列活動: ev.series, 主題: ev.theme, 日期: ev.dateText, 時間: ev.timeText,
      地點: ev.venue, 地址: ev.address, 人數: ev.headcount,
      指導單位: ev.orgGuide, 主辦單位: ev.orgHost, 協辦單位: ev.orgCo, 執行單位: ev.orgExec,
      活動說明: ev.description, 報到時間: ev.checkinTime, 報到地點: ev.checkinPlace,
      分組: (ev.teams || []).map((t) => ({ 組別: t.group, 工作: t.duties })),
      貴賓: (ev.vips || []).map((v) => ({ 單位: v.org, 職稱: v.title, 姓名: v.name })),
      流程: (ev.schedule || []).map((r, i) => ({ index: i, 時間: T.timeRange(r), 項目: r.item, 內容: r.content, 地點: r.place })),
    });
  }

  const TASKS = {
    importEvent: (ev, text) => `以下是一份活動的企劃內容或舊文件。請擷取資訊，整理成活動資料。
輸出 JSON，欄位如下（找不到的欄位給空字串或空陣列，不要猜測）：
{"name":"活動名稱","series":"系列活動名稱","theme":"活動主題","dateText":"活動日期","timeText":"活動時間","venue":"場地名稱","address":"地址","headcount":"參與人數",
"orgGuide":"指導單位","orgHost":"主辦單位","orgCo":"協辦單位","description":"活動說明（100 字內）","setup":"進場時間","teardown":"撤場時間",
"checkinTime":"報到時間","checkinPlace":"報到地點","transport":"交通資訊，一行一項",
"teams":[{"group":"組別","people":"人員","phone":"電話","duties":"工作內容，一行一項"}],
"vips":[{"org":"單位","title":"職稱","name":"姓名"}],
"schedule":[{"start":"HH:MM","end":"HH:MM","item":"項目","content":"內容","place":"地點"}]}

原始內容：
${text}`,

    notice: (ev, aud) => `請為下列活動撰寫「${root.EDTemplates.AUDIENCES[aud].label}」的行前通知內容。
輸出 JSON：{"intro":"開頭問候後的說明段落，1 段","notes":["注意事項，每項一句，6 至 10 項"],"bring":["建議攜帶物品或服裝準備，3 至 6 項"],"closing":"結尾段落，1 段"}
語氣：對參加者與貴賓要親切有禮；對工作人員要明確、可執行；對表演團體與廠商要清楚說明進場、彩排、搬運與設備規定。
活動資料：${eventBrief(ev)}`,

    mc: (ev) => `請為下列活動撰寫主持人稿。依「流程」每一個環節各寫一段主持人講稿。
輸出 JSON：{"scripts":[{"index":流程的 index,"script":"該環節的講稿"}],"adlibs":["突發狀況應對句，格式為「狀況：講稿」，5 項"]}
寫作要求：
- 純工作環節（佈設、彩排、撤場）不需要講稿，script 給空字串。
- 開場要點出活動名稱、主辦單位與主題；唱名環節用「讓我們歡迎……」帶出貴賓名單（依提供的貴賓資料，姓名不明用○○○）。
- 用括號標出音樂與工作人員動作提示，例如（上台樂）（工作人員引導貴賓上台）。
- 合照環節要有口令與拍照姿勢引導；結尾要感謝與預告。
- 口語、好念、有節奏，每段約 80 至 200 字。
活動資料：${eventBrief(ev)}`,

    manual: (ev) => `請為下列活動撰寫工作人員操作手冊的內容。
輸出 JSON：{"ops":[{"index":流程的 index,"ops":["該時段各組要完成的作業，每項一句，3 至 6 項"]}],
"sops":[{"title":"SOP 名稱","items":["步驟，每項一句"]}],
"emergencies":[{"situation":"狀況","handling":"處理原則"}]}
寫作要求：
- ops 要寫出誰在什麼位置做什麼，包含需拍照留存的核銷影像。
- sops 請依活動性質提供 4 至 6 組（例如報到作業、貴賓接待、舞台流程、媒體接待、撤場復原）。
- emergencies 提供 6 至 8 項，須包含天候、設備、人員身體不適、流程延誤。
活動資料：${eventBrief(ev)}`,

    supplies: (ev) => `請為下列活動列出現場備品清單。
輸出 JSON：{"supplies":[{"area":"區域","item":"項目","qty":"數量","unit":"單位","note":"備註"}]}
寫作要求：
- 區域請用：報到區、舞台區、佈置、行政，並依活動性質增加（例如市集區、媒體區、貴賓區）。
- 數量依人數與分組推估，備品要抓備份量，並在備註說明（例如「發 120 份，預備 10 份」）。
- 包含簽到表、識別證、唱名單、主持人稿、桌牌、指引牌、工具箱、清潔用品等現場必備項目，共 30 至 45 項。
- 同一區域的項目請排在一起。
活動資料：${eventBrief(ev)}`,
  };

  TASKS.press = (ev, type) => {
    const p = (ev.press && ev.press[type]) || {};
    const label = root.EDTemplates.PRESS_TYPES[type].label;
    return `請為下列活動撰寫「${label}」新聞稿。
輸出 JSON：{"headline":"主標，20 字內","subhead":"副標，30 字內","body":["內文段落，4 至 5 段"],"captions":["照片圖說，3 項"]}
寫作要求：
- 採政府機關新聞稿體例。第一段交代主辦單位、活動名稱、時間、地點與重點；${type === 'pre' ? '事前稿著重活動亮點、參與方式、交通與報名資訊，吸引民眾參加。' : '事後稿描述現場實況、出席貴賓、活動亮點與成果，最後帶到後續活動或延伸資訊。'}
- 可草擬一段主辦單位長官的引述（「○○○表示，……」），並在該段結尾加上（引述內容待確認）。
- 出席人數、參與人次等數據若「補充資訊」沒有提供，一律用「○○」表示，不可自行編造。
- 不寫誇大不實的形容，結尾不需要寫敬請刊登字樣。
補充資訊（亮點、現場數據、想強調的重點）：${p.highlights || '（未提供）'}
活動資料：${eventBrief(ev)}`;
  };

  TASKS.speech = (ev) => `請為下列活動的致詞人撰寫致詞稿。
輸出 JSON：{"speeches":[{"index":致詞人的 index,"body":["致詞稿段落"]}]}
寫作要求：
- 開頭依序問候在場貴賓（依提供的貴賓名單，姓名不明用○○○）與現場來賓。
- 內容依該致詞人的「重點」展開；沒有提供重點時，寫歡迎與感謝、活動緣起與意義、對未來的期許。
- 口語、適合現場念，每分鐘約 200 字，依「分鐘」控制長度；結尾以「謝謝大家」作結。
- 不可編造政績數字或未提供的事實。
致詞人：${JSON.stringify((ev.speeches || []).map((s, i) => ({ index: i, 致詞人: s.speaker, 分鐘: s.minutes || '3', 重點: s.points })))}
活動資料：${eventBrief(ev)}`;

  TASKS.posts = (ev) => `請為下列活動規劃並撰寫社群貼文。
輸出 JSON：{"posts":[{"platform":"Facebook 或 Instagram","stage":"活動預告／倒數加催／活動當日／活動花絮","date":"建議曝光日期，例如 活動前 10 天","body":"貼文文案，段落之間用換行","tags":"主題標籤，以空白分隔","visual":"建議搭配的素材說明"}]}
寫作要求：
- 共 6 則：Facebook 4 則（預告、倒數加催、當日、花絮），Instagram 2 則（預告、花絮）。
- Facebook 文案 80 至 150 字，開頭第一句要能吸引停留，內含時間地點；Instagram 文案較短、語氣更輕鬆。
- 可適度使用表情符號，每則不超過 4 個；主題標籤 3 至 5 個，須包含活動名稱。
- 花絮貼文中的人數與成果若未提供，用「○○」表示。
活動資料：${eventBrief(ev)}`;

  function parseJSON(text) {
    let s = String(text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a === -1 || b === -1) throw new Error('AI 回傳的內容不是預期格式，請再試一次。');
    try { return JSON.parse(s.slice(a, b + 1)); }
    catch (e) { throw new Error('AI 回傳的內容無法解析，可能是內容過長被截斷，請再試一次。'); }
  }

  async function call(settings, prompt) {
    const mode = settings.aiMode || CONFIG.ai.defaultMode;
    const model = settings.model || CONFIG.ai.defaultModel;
    if (mode === 'proxy') {
      if (!settings.proxyUrl) throw new Error('尚未設定 AI 中繼服務網址，請先到「設定」填寫。');
      // 用 text/plain 送出，避免瀏覽器對 Apps Script 發出預檢請求
      const res = await fetch(settings.proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ code: settings.accessCode || '', system: SYSTEM, prompt, model, maxTokens: CONFIG.ai.maxTokens }),
      });
      if (!res.ok) throw new Error(`中繼服務回應錯誤（${res.status}）`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data.text;
    }
    if (!settings.apiKey) throw new Error('尚未設定 API 金鑰，請先到「設定」填寫。');
    const res = await fetch(CONFIG.ai.directUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': CONFIG.ai.apiVersion,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model, max_tokens: CONFIG.ai.maxTokens, system: SYSTEM, messages: [{ role: 'user', content: prompt }] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || `AI 服務回應錯誤（${res.status}）`);
    return (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  }

  async function run(task, settings, ev, arg) {
    const text = await call(settings, TASKS[task](ev, arg));
    return parseJSON(text);
  }

  root.EDAI = { run, parseJSON, TASKS, SYSTEM };
  if (typeof module !== 'undefined') module.exports = root.EDAI;
})(typeof window !== 'undefined' ? window : globalThis);
