---
slug: facebook-url-trailing-slash-duplicate-content
canonicalPath: /notes/facebook-url-trailing-slash-duplicate-content.html
aliases: []
title: 網址結尾斜線與重複內容：真正要統一的是整個 URL 訊號
publishedAt: '2021-05-07'
updatedAt: '2026-08-24'
excerpt: 整理網址結尾斜線、HTTP/HTTPS、www 與非 www 版本的差異，並說明 canonical、轉址、內部連結與 sitemap 應該共同指向同一版本。
categories:
  - SEO相關
  - 網站技術
tags:
  - Canonical
  - URL
  - 重複內容
  - 轉址
relatedPosts:
  - how-search-engines-crawl
  - seo-newsletter-issue-49
  - seo-newsletter-issue-53
relatedNotes:
  - facebook-https-not-just-checkout
  - facebook-http-request-lifecycle
  - facebook-empty-category-soft-404
editorialStatus: published
noteKind: technical
source:
  platform: facebook
  recordId: fb-fa10321a8cc743cf
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 313
  url: null
sourceLinks:
  - 'https://domain.com'
  - 'http://domain.com'
  - 'https://twitter.com/JohnMu/status/943076424130363392'
  - 'https://www.seroundtable.com/google-trailing-slashes-url-24943.html'
  - 'https://ahrefs.com/blog/trailing-slash/'
---

網址是否帶有結尾斜線，會依 URL 所在層級與伺服器設定產生不同結果。

根網址的 `https://domain.com` 與 `https://domain.com/` 通常代表同一個資源，但 `https://domain.com/page` 與 `https://domain.com/page/` 可能被當成不同網址。

同樣需要統一的還有 HTTP 與 HTTPS、www 與非 www 等版本。

實務上應先選定標準網址，再透過 301 轉址或 canonical 標籤表達偏好，並同步檢查內部連結、sitemap 與 hreflang 中使用的 URL。

這篇內容最值得保存的不是某個固定的斜線規則，而是「所有重要訊號都應指向同一個 canonical 版本」這個診斷原則。
