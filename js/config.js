// ===== 全站設定：要改公司名稱、字體、AI 模型，都改這裡 =====
const CONFIG = {
  // 公司資訊（會帶入文件頁尾與「執行單位」預設值）
  company: {
    name: '萊司整合行銷有限公司',
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
  // 瀏覽器儲存用的鍵名
  storage: {
    project: 'eventDocs.project.v1',
    settings: 'eventDocs.settings.v1',
  },
};
if (typeof module !== 'undefined') module.exports = CONFIG;
