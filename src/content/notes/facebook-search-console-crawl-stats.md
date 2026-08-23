---
slug: facebook-search-console-crawl-stats
canonicalPath: /notes/facebook-search-console-crawl-stats.html
aliases: []
title: Search Console 檢索統計：Google 最近在爬什麼頁面？
publishedAt: '2021-01-21'
updatedAt: '2026-08-24'
excerpt: 整理 Search Console 檢索統計資料中的發現與重新整理概念，將爬蟲行為連回 sitemap、重複網址與網站被植入頁面的排查。
categories:
  - SEO相關
  - 網站技術
tags:
  - Google Search Console
  - Crawl Budget
  - 檢索
  - sitemap
relatedPosts:
  - how-search-engines-crawl
  - seo-newsletter-issue-7
  - seo-newsletter-issue-13
relatedNotes:
  - facebook-site-wide-indexing-quality
  - facebook-javascript-rendering-and-indexing
  - facebook-empty-category-soft-404
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-e4309d05d67f9676
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 341
  url: null
sourceLinks:
  - 'https://support.google.com/webmasters/answer/9679690'
---

這則貼文介紹 Search Console 的檢索統計資料，並特別注意爬蟲是在重新整理舊頁面，還是在發現新的頁面。

如果一個經常新增內容的網站，大部分檢索都集中在舊頁面，可能需要檢查內部連結與 sitemap 是否讓新內容難以被發現。

反過來，如果網站沒有新增大量內容，卻出現非常高的發現比例，也值得檢查篩選器是否產生大量重複網址，或網站是否被植入異常頁面。

這個觀察角度能把「Google 有沒有爬網站」轉成更具體的診斷問題。

原始介面與報表名稱屬於 2021 年的背景，今日使用時應依目前 Search Console 的欄位與官方文件對照。
