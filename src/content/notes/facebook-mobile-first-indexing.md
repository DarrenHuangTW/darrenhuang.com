---
slug: facebook-mobile-first-indexing
canonicalPath: /notes/facebook-mobile-first-indexing.html
aliases: []
title: 行動版內容優先索引：Dynamic Serving 別忘了 Vary
publishedAt: '2020-03-09'
updatedAt: '2026-08-24'
excerpt: >-
  保存一則工作案例，說明 Dynamic Serving 依 User-Agent 回傳不同 HTML 時，為什麼 HTTP 的 Vary: User-Agent 可能成為重要的快取訊號。
categories:
  - SEO相關
  - 網站技術
tags:
  - Mobile-First Indexing
  - Dynamic Serving
  - HTTP Header
  - Vary
relatedPosts:
  - core-web-vitals-lcp-fid-cls
  - how-search-engines-crawl
  - amp-story-dedicated-section-google-serp
relatedNotes:
  - facebook-javascript-rendering-and-indexing
  - facebook-cwv-faq
  - facebook-http-request-lifecycle
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-d72c3cfddce8015a
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 386
  url: null
sourceLinks: []
---

這則貼文保存一個與行動版內容優先索引有關的工作案例。

案例中的網站採用 Dynamic Serving，伺服器會依 User-Agent 回傳不同版本的 HTML，但網址保持不變。

這種做法需要注意快取伺服器是否知道回應內容會隨 User-Agent 變化，因此案例特別檢查 `Vary: User-Agent` 這個 HTTP Response Header。

如果快取只保存一份 HTML，就可能把桌機版本錯誤地提供給手機使用者，或把手機版本提供給桌機使用者。

這篇內容發布於 2020 年，行動版索引的政策背景與今日實作環境可能已經不同。

長期值得保留的是：只要同一網址會依請求條件回傳不同內容，就必須把快取、爬蟲與使用者體驗一起檢查。
