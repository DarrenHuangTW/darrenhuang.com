---
slug: facebook-javascript-rendering-and-indexing
canonicalPath: /notes/facebook-javascript-rendering-and-indexing.html
aliases: []
title: JavaScript 產生的內容，搜尋引擎真的看得到嗎？
publishedAt: '2022-04-10'
updatedAt: '2026-08-24'
excerpt: 保存一份以 Search Console 網址檢查工具確認 JavaScript 內容是否被渲染的實務筆記，並連回搜尋引擎抓取與索引的基礎文章。
categories:
  - 網站技術
  - SEO相關
tags:
  - JavaScript SEO
  - 渲染
  - Google Search Console
  - 索引
relatedPosts:
  - how-search-engines-crawl
  - seo-newsletter-issue-12
  - seo-newsletter-issue-53
relatedNotes:
  - facebook-site-wide-indexing-quality
  - facebook-search-console-crawl-stats
  - facebook-mobile-first-indexing
editorialStatus: published
noteKind: technical
source:
  platform: facebook
  recordId: fb-f902d0797d159796
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 218
  url: null
sourceLinks:
  - 'https://www.facebook.com/searchenginecommunity/videos/399775824108328/'
  - 'https://www.onely.com/blog/ultimate-guide-javascript-seo/'
  - 'https://ahrefs.com/blog/javascript-seo/'
  - 'https://www.seo-tea.com/javascript-seo/'
---

JavaScript SEO 的問題不是「網站能不能使用 JavaScript」，而是重要內容能不能被搜尋引擎順利取得、渲染與理解。

原始貼文建議使用 Google Search Console 的網址檢查工具，查看測試結果中的頁面截圖與 HTML，確認由 JavaScript 產生的內容是否真的出現。

如果內容沒有出現，可能需要檢查 robots.txt、資源請求、載入速度、錯誤處理與渲染時機。

把所有互動都改回純 HTML 並不一定是正確答案。

比較實際的方向，是把核心內容與主要導覽做成可被穩定取得的結構，再讓 JavaScript 增加互動與漸進式體驗。

原始文章與工具畫面屬於 2022 年的脈絡，今天進行技術診斷時仍應以目前的 Search Console 與官方文件為準。
