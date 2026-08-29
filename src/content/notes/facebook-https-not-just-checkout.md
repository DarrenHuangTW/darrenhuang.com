---
slug: facebook-https-not-just-checkout
canonicalPath: /notes/facebook-https-not-just-checkout.html
aliases: []
title: HTTPS 不只是登入與結帳時才需要
publishedAt: '2018-07-10'
updatedAt: '2026-08-29'
excerpt: 2018 年的一則基礎觀念分享，從加密、資料完整性與伺服器驗證三個角度說明為什麼整個網站都應該使用 HTTPS。
categories:
  - SEO相關
  - 網站技術
tags:
  - HTTPS
  - 資安
  - 網站基礎
relatedPosts:
  - how-search-engines-crawl
relatedNotes:
  - facebook-http-request-lifecycle
  - facebook-url-trailing-slash-duplicate-content
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-1f48afcd39700518
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 487
  url: 'https://www.facebook.com/searchenginecommunity/posts/282607862477163'
sourceLinks: []
---

<img src="../images/facebook-notes/facebook-https-not-just-checkout/282607862477163.png" alt="HTTPS 的 Facebook 貼文附圖" loading="lazy" decoding="async">

網站並不是只有在要求使用者輸入密碼或結帳時才需要 HTTPS。

HTTPS 主要從三個部分保護網路使用者。

1. **加密**：避免傳輸中的資料被旁人讀取。
2. **資料完整性**：讓接收者能察覺資料是否在傳輸過程中被竄改。
3. **驗證**：讓使用者知道自己正在和預期的網站伺服器建立連線，而不是被冒充的對象。

如果只在登入或交易頁面使用 HTTPS，其他 HTTP 頁面仍然可能成為攻擊入口。

攻擊者不一定要直接竊取帳號密碼，也可能竄改圖片、JavaScript 或頁面內容，或讓使用者誤以為自己正在瀏覽正確的網站。

這篇貼文發布於 2018 年，當時也提到 Chrome 即將把 HTTP 網站標示為不安全。

這裡保留它作為網站安全觀念的歷史筆記，而不是一份針對今日瀏覽器介面的操作指南。
