// ===== 全站設定：要改公司名稱、字體、AI 模型，都改這裡 =====
const CONFIG = {
  // 公司資訊（會帶入文件頁尾與「執行單位」預設值）
  // 統編、地址、電話、匯款資訊請在網頁的「公司資料」填寫，只存在使用者的瀏覽器，不要寫在這裡
  company: {
    name: '萊司整合行銷有限公司',
  },
  // 報價單預設值
  quote: {
    taxRate: 5,          // 營業稅率（%）
    validDays: 30,       // 報價有效天數（自報價日期起算）
    priceMode: 'untaxed', // 'untaxed'＝單價為未稅，另加營業稅；'taxed'＝單價已含稅
  },
  // Word 文件格式
  doc: {
    fontEastAsia: '微軟正黑體',      // 中文字體
    fontAscii: 'Microsoft JhengHei', // 英數字體
    bodyPt: 12,                      // 內文字級（公司規範：最小 12 級）
    h1Pt: 16,
    h2Pt: 14,
    titlePt: 22,
    subtitlePt: 16,
    accent: '1D2B3A',                // 標題與表頭底色（深墨藍）
    headFill: 'E8EDF2',              // 表頭底色
    marginCm: 2,                     // 頁邊界（公分）
  },
  // AI 代寫
  ai: {
    defaultMode: 'proxy',            // 'proxy'＝走中繼服務；'direct'＝瀏覽器直接用個人金鑰
    defaultModel: 'claude-sonnet-5-5',
    maxTokens: 8000,
    directUrl: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
  },
  // 登入設定：users 清單是空的時候不啟用登入畫面
  // 新增帳號：打開網站的 setup-password.html 產生一行設定碼，貼在 users: [ ] 裡（一個帳號一行）
  // 這裡只存加密後的雜湊值，不會有密碼本身
  auth: {
    keepDays: 7,      // 勾選「保持登入」時的天數；未勾選則關閉分頁即登出（最長 12 小時）
    users: [
    ],
  },
  // 瀏覽器儲存用的鍵名
  storage: {
    project: 'eventDocs.project.v1',
    settings: 'eventDocs.settings.v1',
    company: 'eventDocs.company.v1', // 公司資料（統編、地址、匯款資訊），所有專案共用
  },
};
if (typeof module !== 'undefined') module.exports = CONFIG;
