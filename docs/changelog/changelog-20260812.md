# Changelog: UI Consolidation & Export Features

## 變更項目 (Changes)

1. **首頁動線重構 (Navigation Refactor)**
   - 修改預設首頁直接指向「實時轉錄」頁面。
   - 實作錄音儲存後的無縫跳轉，自動將使用者導向 Workspace 列表。

2. **智能自動分段與大綱 (AskAI Auto Segmentation)**
   - 於 `AskAIService.ts` 擴充 `autoSegmentNote` 方法，透過背景呼叫 Ollama 分析逐字稿，提取主題與大綱。
   - 分析結果自動以 `AI Auto Segmentation` 標籤存入 Subnote，提供使用者快速導覽。

3. **匯出功能 (Export to Word & PDF)**
   - 建立 `ExportService.ts`。
   - 支援將筆記匯出為 `.doc` 格式 (HTML base)，完美保留標題與段落格式。
   - 支援背景呼叫 Electron `printToPDF` 匯出為 A4 排版的無干擾 `.pdf`。

4. **多筆記關聯分析 (Multi-Note Connection Analysis)**
   - 在 Workspace 筆記卡片增加 Checkbox。
   - 加入浮動操作列，允許使用者選取多篇筆記並點擊「分析選中筆記」。
   - 新增 `WorkspaceMultiNoteModal` 專屬對話框，自動呼叫本地 LLM 進行交叉比對。
   - 優化了 `AskAI` 後端的 IPC 介面，支援 `multi-note` 範圍與多個 `noteIds` 傳遞。
   - 增加友善錯誤處理：當未啟動 Ollama 或未下載模型時，會於對話框內顯示明確錯誤提示。
