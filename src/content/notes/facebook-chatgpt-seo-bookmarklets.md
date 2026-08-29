---
slug: facebook-chatgpt-seo-bookmarklets
canonicalPath: /notes/facebook-chatgpt-seo-bookmarklets.html
aliases: []
title: 用 ChatGPT 產生 SEO Bookmarklet 的早期嘗試
publishedAt: '2023-04-30'
updatedAt: '2026-08-29'
excerpt: 一則記錄 ChatGPT 開始普及後，如何用自然語言產生瀏覽器書籤工具的社群貼文，並連回網站既有的 Bookmarklet 文章。
categories:
  - SEO相關
  - 工具
tags:
  - ChatGPT
  - Bookmarklet
  - JavaScript
relatedPosts:
  - seo-efficient-tool-bookmarklets
relatedNotes:
  - facebook-gpt-seo-applications
  - facebook-technical-seo-15-common-problems
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-54113acaddb236bf
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 109
  url: 'https://www.facebook.com/searchenginecommunity/posts/563031205938965'
sourceLinks:
  - 'https://www.darrenhuang.com/seo-efficient-tool-bookmarklets.html'
  - 'https://seonotebook.notion.site/SEO-Bookmarklets-Brought-to-you-by-ChatGPT-22de9256a65d40609d93c68c58d857dd'
  - 'https://github.com/circleghost/SEO-bookmark'
---

<img src="../images/facebook-notes/facebook-chatgpt-seo-bookmarklets/563031205938965.jpg" alt="ChatGPT SEO Bookmarklet 的 Facebook 貼文附圖" loading="lazy" decoding="async">

這則貼文記錄 ChatGPT 開始普及後，一種很直覺的工作方式：把需求交給模型，請它產生可以放進瀏覽器書籤的 JavaScript。

原始貼文列出幾個例子。

- 把頁面上的所有連結複製到剪貼簿，並區分內部連結與外部連結。
- 把頁面上的標題複製到剪貼簿，並標記 H1 到 H6。
- 找出頁面中 `em` 標籤裡的文字。
- 開啟 Wayback Machine 查看頁面的歷史版本。

這種做法的價值，不只在於讓 SEO 工作者更快檢查頁面，也在於示範「把一次性手動檢查描述成需求，再讓模型先產生原型」的工作流程。

不過 Bookmarklet 直接在目前頁面執行 JavaScript，仍然需要人工檢查程式碼與權限範圍。

特別是會讀取頁面資料、寫入剪貼簿或呼叫外部服務的工具，不應該在不了解內容的情況下直接使用。

這篇內容與網站既有的 SEO Bookmarklet 文章有重疊，因此在網站中保留成社群脈絡筆記，而不是再複製一份完整教學。
