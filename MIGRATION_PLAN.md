# 數位引擎搬遷執行計畫

最後更新：2026-08-09。

狀態：Phase 5 進行中。
Phase 1 的來源保全、Astro skeleton，以及 Phase 3 至 Phase 4 的核心 importer、媒體與 Stories 產物已建立。
最新 importer 產物包含 86 篇正式文章、41 篇原會員限定文章、19 篇排除 drafts、1 篇正式內容頁、2 篇 Web Stories、773 個發布媒體與 192 個外部媒體或附件參考，未知 Gutenberg blocks 為 0。
GitHub Pages base-path 成品已在本機產生 211 個 HTML，最新本機 E2E 執行結果為通過且 0 failures。
Phase 5 尚待完成桌機與手機逐頁目視驗收、完整秘密掃描與 staged-files 審查、第一個本機 commit，以及 clean-clone 重跑。
新的 public GitHub repository 與 remote 已設定，但尚未首次 push，因此 GitHub Actions 與 Pages 預覽也尚未驗證。
尚未切換 DNS，也尚未停止或刪除 AWS Lightsail。

## 1. 目標與已確認決策

- 將「數位引擎」從 WordPress、Bluehost 舊服務、AWS Lightsail 與 Vercel 搬到 GitHub Pages。
- 全新 GitHub repository 使用 `DarrenHuangTW/darrenhuang.com`，不沿用 `next-personal-blog` repository。
- 本機工作副本位於使用者指定的 workspace；實際絕對路徑不得進入 public history。
- 新 repository 預設規劃為 public，以使用 GitHub Pages 並讓公開文章與圖片可由 GitHub 發布。
- 最終網站的 86 篇文章全部公開，其中包含 45 篇原公開文章與 41 篇原會員限定文章。
- 不維護 membership、登入、付費、會員權限、密碼重設或會員資料。
- 19 篇真正的 draft 預設不公開，除非使用者日後另行指定。
- 主題與視覺樣式是次要目標，內容、媒體、網址與 SEO 完整性是第一優先。
- 在新站完成備份、部署與驗收前，不刪除 Lightsail，也不取消 Bluehost 網域。

## 2. 已確認的基礎設施現況

### 2.1 網域與 Bluehost

- `darrenhuang.com` 的 registrar 是 Bluehost Inc.。
- 網域到期日是 2026-09-21，Bluehost 畫面顯示 auto-renew 與 Domain Lock 已啟用。
- Domain Privacy 目前沒有啟用。
- Bluehost 使用自訂 nameservers，因此 Bluehost 不是目前的 authoritative DNS。
- 現行 nameservers 是 `jose.ns.cloudflare.com` 與 `wren.ns.cloudflare.com`。
- 不應將 nameservers 恢復為 Bluehost 預設值。
- 應在到期日前確認 Bluehost 自動續約付款方式有效，但網域續約與舊 hosting 取消必須視為兩件事。
- 官方 RDAP 可由 <https://rdap.verisign.com/com/v1/domain/DARRENHUANG.COM> 驗證。

### 2.2 Cloudflare

- Cloudflare 目前仍是 `darrenhuang.com` 的 authoritative DNS，zone 使用 Free plan。
- Cloudflare zone 約有 32 筆 DNS records。
- apex `darrenhuang.com` 目前是 proxied A record，舊 origin 已遮蔽為 `<redacted-origin-ip>`。
- `www.darrenhuang.com` 目前是 proxied CNAME，指向 apex。
- 這個 origin 與 Bluehost 舊服務有關，並不是 Lightsail 或 Vercel。
- apex 與 `www` 對外目前都回傳 Cloudflare 526 Invalid SSL certificate。
- Cloudflare SSL/TLS Overview 顯示 Current encryption mode 為 Full，Automatic mode 已啟用。
- 使用者確認不再使用任何 `@darrenhuang.com` 信箱。
- DNS 中仍有 Bluehost mail、MX、SPF、DKIM、cPanel、webmail、FTP 與其他舊 hosting records，切站後可清理，但必須先匯出 DNS 備份。
- Google site verification TXT 應先保留。
- Cloudflare 526 的官方說明位於 <https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-5xx-errors/error-526/>。

### 2.3 AWS Lightsail

- AWS Lightsail region 是 Seoul `ap-northeast-2`。
- 目前有一台 running instance，名稱是 `darrenhuang.com`。
- Instance 規格是 1 GB RAM、2 vCPU、40 GB SSD、General purpose。
- 盤點時的 public IPv4 已遮蔽為 `<redacted-origin-ip>`；origin 位址不得寫死在新站內容或公開報告。
- 2026-08 的計費畫面顯示 Lightsail Bundle 1 GB 費率約為 USD 0.0094/hour。
- Lightsail 目前沒有其他 managed database、container service、static IP、distribution、load balancer、bucket、attached disk、DNS zone、snapshot 或 Lightsail certificate。
- 直接以正確 Host header 連到 Lightsail origin 時，WordPress 與 REST API 仍可讀取。
- AWS 對 stopped instance 仍會計費，因此最終要停止費用必須刪除 instance，而不是只按 Stop。
- AWS 官方計費說明位於 <https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-frequently-asked-questions-faq-billing-and-account-management.html>。
- AWS 官方刪除步驟位於 <https://docs.aws.amazon.com/lightsail/latest/userguide/delete-an-amazon-lightsail-instance.html>。

### 2.4 現行 Lightsail WordPress

- REST API 顯示 86 篇文章。
- REST API 顯示 3 個目前公開可見的 pages。
- 資料庫備份顯示 976 個 attachment records。
- 最新已發布文章日期是 2023-01-01。
- 最新文章修改時間可到 2024-09-02，修改可能包含搬遷與網址重寫，不代表當天新增文章。
- 現行內容中曾出現 WordPress origin、會員子網域與舊 uploads URL，搬遷時必須統一改為正式相對路徑。
- Lightsail 的 `wp-content/uploads` 是目前唯一可取得完整實體媒體檔案的來源，因此刪除 Lightsail 前必須先完整匯出。

### 2.5 Vercel 與舊 GitHub repository

- Vercel team slug 是 `darrenhuangtws-projects`。
- Vercel project 是 `next-personal-blog`。
- 正確且仍可讀取的公開別名是 <https://darren-huang-blog.vercel.app/>。
- Vercel sitemap 有 83 個實際文章 URL，另有首頁、文章列表、Projects 與 Tags 等 URL。
- 舊 GitHub repository 是 <https://github.com/DarrenHuangTW/next-personal-blog>。
- 舊 repository 內有 GitHub Pages workflow，但 repository Settings 中的 GitHub Pages 實際上是 disabled。
- Pages source 設為 Deploy from a branch 且 branch 為 None，因此 workflow 從未真正發布 Pages。
- `https://darrenhuangtw.github.io/next-personal-blog/` 目前是 GitHub Pages 404。
- 舊 Vercel 與 GitHub 版本只有 83 篇真實文章，比完整 86 篇少 3 篇。
- 缺少的 3 篇是 `about-the-site`、`how-to-show-images-in-google-search-results` 與 `seo-reputation-managment`。
- 舊 repository 只可作為轉換後文字、metadata 與 UI 的比對來源，不可當成唯一內容來源。

### 2.6 本機 repository

- 本機 workspace 目前是已初始化但尚未建立 commit 的 Git repository，且 origin 已連接新的 public repository。
- 目前 branch 是 `main`。
- 此資料夾將成為 `DarrenHuangTW/darrenhuang.com` 的本機工作副本。

## 3. 已找到的備份與資料來源

### 3.1 主站 Updraft DB

- 本機檔案位於 repository 外的私人封存；實際絕對路徑不得進入 public history。
- 此檔案是解壓後的 MySQL SQL dump，原始 gzip 檔名為 `backup_2024-07-17-1738_wwwdarrenhuangcom_a535527a61fe-db.gz`。
- gzip 通過 CRC 測試，串流解壓結果與 SQL 完全一致。
- gzip SHA-256 是 `27D6B8271D844E0484B93CB7AA0A261B02B4020ADAE78B05DCD6D838000C4670`。
- SQL SHA-256 是 `E9DD2376AD2EAD04CB67393EED81CF426939F4668E59E11BAFCEB99DE0C6F4E5`。
- 此 DB 只有 60 篇已發布文章、1 個已發布 page 與 497 個 attachment records。
- 此 DB 的最新公開文章日期是 2020-11-22，因此不是完整且最新的搬遷來源。
- 此 DB 可作為舊 revisions、SEO metadata、redirects、Gutenberg blocks 與災難備援的次要來源。

### 3.2 會員站 Updraft DB

- Google Drive 的 `UpdraftPlus` 資料夾中找到 `backup_2024-07-17-2042_memberdarrenhuangcom_cf82e71af88f-db.gz`。
- 此 DB 的 `siteurl` 與 `home` 都是 `https://member.darrenhuang.com/`。
- 此 DB 的 blog name 是「數位引擎會員專區」。
- 此 DB 的 permalink structure 是 `/%postname%.html`。
- 此 DB 有 45 篇 published posts 與 41 篇 private posts，合計正好 86 篇文章。
- 41 篇 private posts 是原會員限定的 SEO 電子報，時間從第 24 期延伸到第 70～71 期。
- 此 DB 有 19 篇 draft posts，預設不發布。
- 此 DB 有 4 個 published pages、2 個 draft pages、976 個 attachments，以及兩個邏輯上的 Web Stories。
- 此 DB 保存原始 membership 狀態，可用來標記 `wasMembersOnly`，但會員帳號、會員資料、付款、密碼雜湊與登入資訊不可搬進公開 repository。

### 3.3 Updraft 備份缺口

- Drive 的 UpdraftPlus 資料夾只找到主站與會員站各自的 DB、`others.zip` 與 `mu-plugins.zip`。
- 沒有找到任何 `uploads.zip`、一般 `plugins.zip` 或 `themes.zip`。
- 因此兩套 Updraft 備份都沒有實體圖片、影片與 WordPress uploads。
- 最終媒體來源必須是 Lightsail 的 `wp-content/uploads`。

### 3.4 其他 fallback

- Google Drive 中的「數位引擎 ADMIN SHEET」保存電子報期數與會員子網域 URL 對照。
- Google Drive 中的「數位引擎 Newsletter」保存 2022 下半年至 2023 年初的研究筆記與部分原稿，可作為文字 fallback。
- Internet Archive 在 2024-05-05 仍有最後一份正常首頁快照。
- Internet Archive 至少保存約 57 篇一般文章的個別快照，也保存過兩篇 Story 的線索。
- Wayback 適合作為逐篇 fallback，不適合取代正式 DB 與 uploads export。

## 4. 正式內容基準

### 4.1 文章

- 正式文章母數是 86 篇，而不是主站舊 DB 的 60 篇，也不是 Vercel 的 83 篇。
- 45 篇原公開文章與 41 篇原會員文章在新站全部公開。
- 每篇內容仍保留 `originalStatus` 與 `wasMembersOnly` metadata，供遷移稽核使用。
- 新站不顯示會員鎖定標記，也不要求登入。
- 19 篇 drafts 建立獨立報告，但不自動發布。

### 4.2 Pages

- 會員站 DB 的 published pages 包含「關於作者」、會員說明頁、會員登入頁與 404 頁。
- 「關於作者」應搬遷為正式內容頁。
- 會員說明頁可保存為歷史說明或合併到 About，但不可保留登入或付費功能。
- 會員登入、密碼重設等系統頁不應搬成可操作功能。
- 404 頁應以新站的靜態 404 template 重建。
- 「SEO 腦筋急轉彎」等 draft page 應列入人工審核清單，不預設發布。

### 4.3 Web Stories

- DB 內有 4 個 Story custom posts，但實際只有 2 個故事主題。
- 每個故事同時保存一份舊 `amp_story` 與一份新版 `web-story`。
- 「英國首相狂人強森的政治 SEO 手腕」新版有 13 pages，舊版也有 13 pages。
- 「李奧貝納與 The North Face 的爭議性 SEO 策略」新版有 10 pages，舊版有 12 pages。
- 李奧貝納故事必須逐頁比較新版與舊版，確定舊版多出的兩頁是否需要補回。
- 新版 Web Stories 已保存完整 AMP HTML、文字、頁面順序、圖片、影片與連結，可作為靜態重建基礎。
- 新站應保留 `/web-stories/<slug>/` URL，並讓舊 `<slug>.html` URL 導向相應 Story。
- 每篇 Story 同時提供可閱讀的 HTML transcript，避免 AMP runtime 或 JavaScript 失效時完全無內容。

### 4.4 Gutenberg 與第三方 embeds

- 86 篇正式文章中約有 124 個 YouTube provider blocks，分布於約 57 篇文章。
- 86 篇正式文章中約有 96 個 Twitter/X provider blocks，分布於約 42 篇文章。
- 86 篇正式文章中約有 31 個 Spotify provider blocks，分布於約 27 篇文章。
- 另有 SlideShare、Facebook、gallery、video、audio、Genesis Blocks、CoBlocks accordion 與 raw HTML。
- 舊 Vercel 搬遷失敗的核心不是傳統 shortcode，而是 Gutenberg embed、provider attributes、legacy `core-embed/*` blocks 與少量 raw iframe。
- 搬遷工具必須解析 Gutenberg block AST，不可只移除 HTML comments 或用單一正規表示式粗略轉換。
- 未知 blocks 必須保留為清理過的 HTML 並寫入報告，不可靜默刪除。

### 4.5 媒體

- 會員站 DB 有 976 個 attachment records。
- MIME 分布約為 740 PNG、200 JPEG、20 GIF、14 MP4、1 PDF 與 1 WebP。
- attachment record 數量不等於實體檔案數，WordPress 還可能有多個衍生縮圖。
- 搬遷時先保存完整 uploads archive，再建立文章、pages 與 Stories 的媒體 dependency graph。
- GitHub Pages 只發布被內容引用的 originals 與必要 derivatives，未使用的自動縮圖不必全部發布。
- 原始媒體完整封存另外保存在本機或 Drive，不放在公開 repository 的 Git history 中反覆更新。
- GitHub Pages 的 published site 最大為 1 GB，source repository 建議不超過 1 GB，deployment 超過 10 分鐘會 timeout。
- 一般 Git repository 中的單一檔案超過 50 MiB 會警告，超過 100 MiB 會被阻擋。
- GitHub Pages 限制位於 <https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits>。
- GitHub 大型檔案限制位於 <https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github>。
- 若發布成品超過約 900 MiB，或有單一 MP4 超過 100 MiB，應先壓縮、移除未引用 derivatives，或將大型影片移到 YouTube／獨立物件儲存。

## 5. 目標技術架構

### 5.1 Framework

- 新站使用 Astro，而不是直接沿用舊 Next.js project。
- Astro 的靜態輸出、Content Collections、Markdown/MDX、schema validation 與低前端 JavaScript 更符合內容型網站。
- 本機 Node.js 支援範圍是 `>=22.12.0 <25`，GitHub Actions CI 固定使用 Node.js 24。
- Astro 官方 GitHub Pages 指南位於 <https://docs.astro.build/en/guides/deploy/github/>。
- Astro Content Collections 指南位於 <https://docs.astro.build/en/guides/content-collections/>。

### 5.2 建議 repository 結構

```text
darrenhuang.com/
├─ src/content/posts/
├─ src/content/pages/
├─ src/content/stories/
├─ src/components/embeds/
├─ src/pages/
├─ public/wp-content/uploads/
├─ scripts/migrate-wordpress/
├─ migration/manifest.json
├─ migration/reports/
├─ .github/workflows/pages.yml
└─ MIGRATION_PLAN.md
```

- `src/content/posts` 保存清理後的 Markdown 或 MDX 文章。
- `src/content/pages` 保存 About 與其他選定內容頁。
- `src/content/stories` 保存兩篇 Stories 的結構化來源或靜態 AMP source。
- `src/components/embeds` 保存 YouTube、Twitter/X、Spotify、SlideShare 與 GenericEmbed components。
- `public/wp-content/uploads` 保存新站實際發布的舊媒體路徑。
- `scripts/migrate-wordpress` 保存可重跑、相同輸入產生相同輸出的 importer。
- `migration/manifest.json` 保存 WordPress ID、slug、canonical path、aliases、來源狀態、checksum 與媒體依賴。
- `migration/reports` 保存缺漏 blocks、媒體缺口、內容差異、壞連結與驗收報告。
- SQL、gzip DB、WordPress users、會員資料、密碼雜湊、API keys、tokens 與 `.env` 必須由 `.gitignore` 排除，並保存在 repository 外。

### 5.3 內容 schema

每篇文章至少保存下列欄位：

```text
wpId
title
slug
canonicalPath
aliases
publishedAt
updatedAt
excerpt
categories
tags
featuredMedia
originalStatus
wasMembersOnly
sourceChecksum
```

### 5.4 URL 策略

- WordPress 的 `/<slug>.html` 直接作為文章 canonical URL，不先改成 `/blog/...`。
- Build 後必須真的產生相同 `.html` path，而不是只依賴 client-side routing。
- 舊 Vercel `/blog/newsletter/...` 與 `/blog/seo/...` paths 建立 alias pages 或 redirect map。
- `member.darrenhuang.com/<slug>.html` 使用 Cloudflare Redirect Rules 301 到 `https://darrenhuang.com/<slug>.html`。
- GitHub Pages 本身不提供完整的 server-side redirect，因此重要 301 由 Cloudflare 管理。
- 若 Cloudflare redirect 尚未設定，靜態 alias page 至少要包含 canonical、meta refresh 與可點擊連結。

### 5.5 Embed 策略

- Twitter/X embed 永久顯示原始貼文 URL，平台 script 只作 progressive enhancement。
- YouTube 使用 lazy-load `youtube-nocookie.com` iframe，並永久顯示原始影片連結。
- Spotify 使用 lazy iframe，並顯示直接開啟連結。
- SlideShare、Facebook 與未知 oEmbed 使用 GenericEmbed fallback。
- 第三方服務失效只可產生 warning，不可讓整站 build 失敗。
- 在瀏覽器阻擋第三方 scripts 的情境下，所有文章仍必須可閱讀並可點擊來源。

## 6. 執行階段與 Gate

### Phase 0：保全與再確認

- 確認 Bluehost auto-renew 付款方式有效。
- 匯出 Cloudflare DNS records 與 redirect／SSL 設定。
- 對目前 Lightsail、Drive 備份與舊 repository 建立只讀 inventory。
- 不在此階段修改 DNS 或刪除任何服務。

### Phase 1：完整匯出 Lightsail

- 先偵測實際 WordPress 安裝路徑、DB 工具與 uploads 路徑，不假設所有 Bitnami 路徑完全相同。
- 匯出最新 Lightsail WordPress DB。
- 完整封存 `wp-content/uploads`。
- 如可行，另匯出 WordPress WXR 作為易讀備份。
- 計算 DB 與 uploads archive 的 SHA-256。
- 驗證 gzip／tar／zip 能完整列出並抽樣解壓。
- 記錄 uploads 的實際容量、檔案數、最大檔案與所有超過 50 MiB、100 MiB 的檔案。
- 將原始封存放在 repository 外的安全本機資料夾，並備份到 Drive。
- 在此 Gate 完成前，不可刪除或停止 Lightsail。

### Phase 2：建立新 repository 與 Astro skeleton

- 將本機預設 branch 設為 `main`。
- 建立 public repository `DarrenHuangTW/darrenhuang.com`。
- 將本機 repository 連接到新 remote。
- 初始化 Astro、TypeScript、Content Collections、lint、tests 與 GitHub Pages workflow。
- 建立嚴格 `.gitignore`，排除 SQL、archives、會員資料、secrets、temporary exports 與 `.env*`。
- 在 push 前再次檢查 Git staged files，確認沒有 DB 或個資。

### Phase 3：建立可重跑的內容 importer

- 以最新 Lightsail DB 為主要內容來源。
- 以會員站 DB 補充 41 篇原會員狀態與第二份內容校驗。
- 以舊 GitHub／Vercel 內容補充已轉換 metadata 與人工比對。
- 以主站舊 DB、Drive 原稿與 Wayback 作為 fallback。
- 解析 Gutenberg block AST。
- 將已知 blocks 轉為 Markdown／MDX 或具名 components。
- 將未知 blocks 保存為 sanitized HTML 並列入報告。
- 產生 86 篇文章、pages review list、2 篇 Stories 與完整 manifest。
- 產生 normalized text checksum 與逐篇差異報告。

### Phase 4：媒體搬遷與 Stories

- 建立文章、pages、Stories 對媒體的 dependency graph。
- 以 SHA-256 去重 originals。
- 將被引用的媒體放入 `public/wp-content/uploads` 並保留舊路徑。
- 將所有 `member.darrenhuang.com`、`www.darrenhuang.com`、Lightsail IP 與 Blogger hotlink 依策略改寫或鏡像。
- 對 14 個 MP4 逐一檢查大小、引用狀態與瀏覽器播放能力。
- 重建兩篇 Web Stories。
- 對李奧貝納 Story 比較 legacy 12 pages 與 newer 10 pages。
- 使用 AMP validator 或對應的靜態 Story 驗證工具。
- 使用手機 viewport 逐頁視覺比對 Stories。

### Phase 5：自動驗收與本機預覽

- 驗證正式文章數正好為 86。
- 驗證 41 篇文章有 `wasMembersOnly: true`，但前端全部公開。
- 驗證 19 篇 drafts 沒有被意外發布。
- 驗證 3 篇舊 Vercel 缺漏文章已補回。
- 驗證 2 個邏輯 Stories 都存在。
- 驗證 manifest 中所有 WordPress `.html` canonical paths 都有實體輸出。
- 驗證所有 internal links 沒有 404。
- 驗證所有被引用的圖片、音訊與影片可讀取。
- 驗證網站內容沒有殘留 Lightsail IP、Bluehost origin 或失效會員登入 URL。
- 驗證 Twitter/X、YouTube、Spotify scripts 被阻擋時仍有 fallback。
- 驗證 sitemap、RSS、canonical、Open Graph、日期、分類、標籤與 404 頁。
- 驗證 clean clone 可以安裝、build 與測試。
- 驗證 published artifact 小於 1 GB，建議在 750 MiB 顯示 warning、900 MiB 直接 fail。
- 驗證 GitHub Actions build 在 10 分鐘內完成，建議在 8 分鐘顯示 warning。
- 使用桌機與手機 E2E 檢查首頁、長文、圖片多的文章、原會員文章、embed、Story 與 404。

### Phase 6：GitHub Pages 預覽與 custom domain

- GitHub Pages publishing source 使用 GitHub Actions。
- 先使用 GitHub Pages 預覽網址驗收，不先修改正式 DNS。
- 在 repository Settings 中先設定 custom domain `darrenhuang.com`。
- 執行 DNS 變更前，重新查閱 GitHub 官方 custom-domain 文件，避免使用過時 IP。
- GitHub custom-domain 文件位於 <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>。
- 目前官方 apex A records 通常是 `185.199.108.153`、`185.199.109.153`、`185.199.110.153` 與 `185.199.111.153`，執行當天必須再次核對。
- `www` CNAME 規劃直接指向 `DarrenHuangTW.github.io`。
- 初次憑證驗證時優先使用 Cloudflare DNS-only，待 GitHub Pages HTTPS 正常後再決定是否恢復 proxy。
- DNS 切換只修改 apex、`www` 與 `member` 網站流量 records。
- 因使用者沒有網域信箱，舊 MX、SPF、DKIM 與 mail records 可在網站穩定後清理。
- Google verification TXT 先保留。

### Phase 7：正式切換、觀察與 AWS 退場

- 驗證 apex、`www`、HTTPS、86 篇文章、2 篇 Stories 與舊 URLs 全部正常。
- 驗證 `member.darrenhuang.com` 301 到 apex 相同文章 path。
- 觀察至少 48 至 72 小時，並檢查 GitHub Actions、Cloudflare、瀏覽器 console 與 404 logs。
- 在刪除前再次確認最新 DB、uploads archive、本機工作副本與 GitHub remote 都存在。
- 在刪除前再次盤點 Lightsail snapshots、static IP、disks、load balancers、databases、buckets 與其他 regions。
- 刪除 Lightsail 是不可復原操作，必須在當下取得使用者明確確認。
- 刪除 `darrenhuang.com` instance，而不是只 Stop。
- 刪除後重新檢查 Lightsail inventory 與 AWS Billing。
- 在 24 至 48 小時後再次確認沒有新 Lightsail usage。
- Vercel project 保留到正式站穩定後，再由使用者決定是否刪除。

## 7. 最終驗收門檻

- 新站公開 86 篇正式文章。
- 41 篇原會員文章無需登入且可正常索引。
- 19 篇 drafts 沒有意外公開。
- 2 篇 Stories 的文字、順序、圖片與影片完成逐頁驗收。
- 所有舊 `/<slug>.html` URLs 回傳可閱讀內容或真正的 301。
- `member.darrenhuang.com` 的舊文章 URLs 導向 apex。
- 舊 Vercel paths 有對應 alias 或 redirect map。
- 文章 normalized text 比對沒有未解釋的大段缺失。
- 未知 Gutenberg blocks 數量為 0，或每一筆都有明確人工處理紀錄。
- 所有站內連結 404 數量為 0。
- 所有被引用的媒體回傳 200，且沒有公開依賴 Lightsail。
- 第三方 embed 失效時仍保留可點擊來源。
- Sitemap、RSS、canonical、Open Graph、日期、分類、標籤與 404 正常。
- GitHub Pages artifact 小於 1 GB。
- GitHub Actions build 小於 10 分鐘。
- Apex、`www` 與 HTTPS 穩定，不再出現 526。
- 完整離線 DB 與 uploads 封存已驗證且有 checksum。
- 使用者明確同意後才刪除 AWS Lightsail。

## 8. Rollback 原則

- 每次 Cloudflare DNS 變更前保存原 records、TTL 與 timestamp。
- 正式切換前保留 Lightsail running，以便排查內容或媒體缺口。
- 若 GitHub Pages custom domain 或 HTTPS 發生問題，先恢復上一版 Cloudflare records，不刪除新 repository。
- 若單篇內容有問題，依 manifest 回溯 Lightsail DB、會員 DB、舊 Git repository、Drive 原稿與 Wayback。
- 不使用 `git reset --hard`、覆寫原始備份或刪除未驗證封存。

## 9. 不可逆操作邊界

- 建立 public GitHub repository 與 push 程式碼前，確認 staged files 不含 DB、會員資料或 secrets。
- 修改 Cloudflare apex、`www`、`member` 或 redirect rules 前，需要清楚說明預期影響並取得使用者確認。
- 修改 Bluehost auto-renew、付款、nameservers、transfer lock 或 registrar 前，需要使用者明確確認。
- 刪除 Lightsail instance、snapshot、disk 或其他 AWS resource 前，需要使用者明確確認。
- 刪除 Vercel project 或舊 GitHub repository 前，需要使用者明確確認。
