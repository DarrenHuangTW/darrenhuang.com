---
slug: facebook-http-request-lifecycle
canonicalPath: /notes/facebook-http-request-lifecycle.html
aliases: []
title: 輸入網址後發生什麼事：從 Request 到 Status Code
publishedAt: '2018-03-29'
updatedAt: '2026-08-29'
excerpt: 用一個簡化的網頁請求流程，理解 Request Headers、Response Headers 與 2XX、3XX、4XX、5XX 狀態碼如何描述資源的結果。
categories:
  - 網站技術
  - SEO相關
tags:
  - HTTP
  - Status Code
  - Request Headers
  - Response Headers
relatedPosts:
  - how-search-engines-crawl
  - identify-broken-links-with-screaming-frog
relatedNotes:
  - facebook-https-not-just-checkout
  - facebook-url-trailing-slash-duplicate-content
  - facebook-mobile-first-indexing
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-b61ef59028d08873
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 469
  url: 'https://www.facebook.com/searchenginecommunity/posts/pfbid0wGAsQ5cCpw7svnw91cwM2vM8DkTqkCcSM5smm9mHAJHtfeT4UXb2WWLJ2nvNrDQol'
sourceLinks:
  - 'http://www.example.com/hello-world'
  - 'https://httpstatusdogs.com/'
---

<img src="../images/facebook-notes/facebook-http-request-lifecycle/225793264825290.jpg" alt="HTTP Request Lifecycle 的 Facebook 貼文附圖 1" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-http-request-lifecycle/225793274825289.jpg" alt="HTTP Request Lifecycle 的 Facebook 貼文附圖 2" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-http-request-lifecycle/225793261491957.jpg" alt="HTTP Request Lifecycle 的 Facebook 貼文附圖 3" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-http-request-lifecycle/225793304825286.jpg" alt="HTTP Request Lifecycle 的 Facebook 貼文附圖 4" loading="lazy" decoding="async">

在瀏覽器輸入網址並按下 Enter 之後，瀏覽器會向伺服器送出請求，伺服器再回傳描述資源狀態的回應。

Request Headers 會帶上 User-Agent、目標路徑與支援的壓縮方式等資訊。

Response Headers 則會描述回傳檔案與伺服器處理結果，其中最常被 SEO 工作者使用的就是 Status Code。

2XX 通常代表成功，3XX 代表需要前往其他位置，4XX 通常是請求或資源本身有問題，5XX 則通常表示伺服器端發生錯誤。

理解這個基本流程後，404、301、HTTPS、快取與爬蟲抓取就不再是互相分離的名詞，而是同一個網頁請求生命週期中的不同訊號。
