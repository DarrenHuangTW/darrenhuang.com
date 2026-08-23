---
slug: facebook-fid-to-inp
canonicalPath: /notes/facebook-fid-to-inp.html
aliases: []
title: 從 FID 到 INP：互動回應速度指標的歷史轉換
publishedAt: '2023-05-14'
updatedAt: '2026-08-24'
excerpt: 保存 2023 年記錄 Core Web Vitals 指標轉換的說明，從使用者互動到下一個畫面繪製，理解 INP 想測量的體驗問題。
categories:
  - 網站技術
  - SEO相關
tags:
  - Core Web Vitals
  - INP
  - FID
  - 使用者體驗
relatedPosts:
  - core-web-vitals-lcp-fid-cls
  - seo-newsletter-issue-8
  - seo-newsletter-issue-9
relatedNotes:
  - facebook-guess-js-data-driven-prefetch
  - facebook-cwv-faq
editorialStatus: published
noteKind: historical
source:
  platform: facebook
  recordId: fb-8f02f922617f4df1
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 105
  url: null
sourceLinks:
  - 'https://www.seroundtable.com/inp-fid-core-web-vitals-google-35358.html'
---

這則 2023 年的貼文記錄 Core Web Vitals 從 FID 轉向 INP 的背景。

INP 關注使用者點擊、觸摸或使用鍵盤操作後，頁面多久能產生可見的回應。

相較於只觀察特定互動的 FID，這個觀念更接近使用者在整個瀏覽過程中感受到的互動延遲。

原始貼文用購物車、手機導覽選單與登入表單作為例子，說明「操作之後沒有反應」為什麼會讓使用者誤以為網站壞掉。

這頁是歷史保存與概念整理，不是今日 Core Web Vitals 的操作指南。

若要進行實作或判讀門檻，仍應以目前的 Chrome、CrUX、PageSpeed Insights 與 Google 官方文件為準。
