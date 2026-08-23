---
slug: facebook-guess-js-data-driven-prefetch
canonicalPath: /notes/facebook-guess-js-data-driven-prefetch.html
aliases: []
title: Guess.js：用資料預測下一頁，再決定是否預取
publishedAt: '2019-07-13'
updatedAt: '2026-08-24'
excerpt: 一則把 prefetch、使用者行為資料與機器學習放在一起討論的歷史筆記，重點是預取應該建立在機率與成本的平衡上。
categories:
  - 網站技術
  - SEO相關
tags:
  - Prefetch
  - 效能
  - 機器學習
  - Guess.js
relatedPosts:
  - core-web-vitals-lcp-fid-cls
  - seo-newsletter-issue-41
relatedNotes:
  - facebook-fid-to-inp
  - facebook-javascript-rendering-and-indexing
editorialStatus: published
noteKind: experiment
source:
  platform: facebook
  recordId: fb-1a877a3cef5446a4
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 409
  url: null
sourceLinks:
  - 'https://www.youtube.com/watch?time_continue=2093&v=Mv-l3-tJgGk'
  - 'https://blog.mgechev.com/2018/05/09/introducing-guess-js-data-driven-user-experiences-web/'
  - 'https://github.com/guess-js'
  - 'https://guess-gatsby-wikipedia.firebaseapp.com/'
---

如果把所有可能的下一頁都 prefetch，理論上可以讓點擊後的體驗更快，但也會大量消耗使用者的網路流量。

真正值得討論的問題，是如何判斷哪些頁面最有可能被接著造訪。

原始貼文提出兩種方向。

第一種是由開發者自行判斷使用者最可能前往的頁面，再針對那些資源進行預取。

第二種是利用網站的使用行為資料，推測不同頁面上的連結被點擊的機率。

Guess.js 曾被用來示範第二種做法。

它會結合 Google Analytics 的資料，分析頁面上的連結被點擊的可能性，再把 prefetch 放到較可能被造訪的連結上。

這個想法的重點不是「加入越多 prefetch 越好」，而是把預取成本、頻寬與使用者真正會走的路徑一起考慮。

這篇貼文發布於 2019 年，相關工具與範例可能已經改變或停止維護。

因此本頁保存的是當時的設計思路與研究脈絡，不保證連結中的工具仍然適合直接使用。
