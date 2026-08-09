# Phase 1：來源取得與封存驗證

執行日期：2026-08-02。

結果：Phase 1 Gate 已通過。
最新 WordPress database、完整 uploads archive 與 WXR 已從仍在運作的 Lightsail instance 匯出，並完成來源端與本機端完整性校驗。
原始封存只保存在 repository 外的本機位置與私人雲端備份中。

## 唯讀來源盤點

- WordPress core 版本為 6.4.8。
- 最新 database 中有 86 篇 published posts 與 19 篇 draft posts。
- 最新 database 中有 976 筆 attachment records。
- 最新 database 中有兩個 `amp_story` 與兩個 `web-story` custom posts，對應兩個邏輯 Stories 主題。
- WordPress 實際安裝與 uploads 路徑已在匯出前解析，沒有假設未驗證的 Bitnami 預設路徑。

盤點與匯出期間沒有停止、重啟或刪除 Lightsail instance。
本報告刻意不記錄 AWS 帳號、instance IP、資料庫連線資訊或遠端登入資料。

## 主要封存

| 封存                               |        壓縮後大小 | SHA-256                                                            |
| ---------------------------------- | ----------------: | ------------------------------------------------------------------ |
| 最新 WordPress database gzip       |   5,978,268 bytes | `8e824e422cc8b8899af2f2495c66dfa0fad66e69c6bf76dc90adfc5a265c3dfc` |
| 完整 `wp-content/uploads` tar gzip | 726,947,994 bytes | `c919ffbeadb68b4a307cfe128f87271d5344198800dc00f17e07dcc2aa8d5e4e` |
| WordPress WXR XML                  |  11,812,201 bytes | `6c216bc872944f8da65cb82b069dbedcc860ea695c30dc2b2ccd7a5858d197d2` |

來源端與本機端計算出的三筆 SHA-256 完全相同。
Database gzip 通過完整串流解壓測試。
Uploads tar gzip 可以完整列出，並成功抽樣解壓 MP4、GIF、PNG 與含中文檔名的媒體。
WXR 通過 XML parse 驗證。

## Uploads 統計

| 指標                |              結果 |
| ------------------- | ----------------: |
| 解壓後總容量        | 748,684,758 bytes |
| 實體檔案數          |             7,570 |
| Tar entries 數量    |             7,716 |
| 最大單一檔案        |  14,069,332 bytes |
| 超過 50 MiB 的檔案  |                 0 |
| 超過 100 MiB 的檔案 |                 0 |

這些數字代表完整原始 uploads 封存，不代表最後會發布到 GitHub Pages 的媒體量。
Phase 4 仍須建立 dependency graph，只發布文章、選定 pages 與 Stories 實際引用的 originals 及必要 derivatives。

## 備援與重組驗證

Repository 外的本機封存保留原始 database gzip、uploads tar gzip、WXR、checksum manifest 與驗證摘要。
私人雲端備份保留 database gzip、WXR、checksum manifest，以及拆成八個小於 100 MiB 的 uploads 分段。
八個分段依序串接後的串流 SHA-256 與原始 uploads archive 完全相同。
雲端備份沒有設為公開分享，且 public repository 不包含雲端資料夾識別碼或下載連結。

既有的會員站 database 備份也已取得並通過 gzip 測試。
它只作為 `wasMembersOnly` 與內容差異的私人校驗來源，不會把 users、會員資料、付款資料或密碼雜湊帶入網站來源。

## 安全清理

- 匯出時使用的暫時 SSH 私鑰與憑證已從本機移除。
- Public workspace 中沒有複製 SQL、database gzip、uploads archive、私鑰或會員資料。
- `.gitignore` 已排除 database、archives、secrets、私人 migration inputs 與 `.env`。
- 遠端與本機的原始封存仍保留，因此後續 importer 可以重跑且不需再次依賴公開網站。

## Gate 結論

Phase 1 的完整離線封存、checksum、格式驗證、容量統計與第二份私人備份已完成。
Lightsail 仍保持原狀，且在 Phase 6 預覽與 Phase 7 正式切換驗收完成前不得刪除。
任何 Lightsail 刪除仍需在操作當下取得使用者明確確認。
