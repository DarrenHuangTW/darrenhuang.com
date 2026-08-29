---
slug: facebook-ai-product-description-style-transfer
canonicalPath: /notes/facebook-ai-product-description-style-transfer.html
aliases: []
title: 用 Style Transfer、Few-Shot 與 LoRA 做產品描述
publishedAt: '2025-03-26'
updatedAt: '2026-08-29'
excerpt: 一則記錄電商產品描述實驗的社群貼文，從提示詞、範例學習到 LoRA 微調，整理出不同方法的成本與控制力。
categories:
  - AI
  - 內容策略
tags:
  - 生成式 AI
  - 電商
  - LoRA
  - 產品文案
relatedPosts:
  - seo-newsletter-issue-52
  - seo-newsletter-issue-55
  - seo-newsletter-issue-70-71
relatedNotes:
  - facebook-ai-anxiety-and-learning
  - facebook-gpt-seo-applications
  - facebook-information-retrieval-rag
editorialStatus: published
noteKind: experiment
source:
  platform: facebook
  recordId: fb-47bfbc2562f9ba16
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 36
  url: 'https://www.facebook.com/searchenginecommunity/posts/pfbid03b1Ti4fLervSLbAusz7JrTVQHchywTS74EZzRuzBftrh9veEwpRY2ZwbYaoZmcwml'
sourceLinks:
  - 'https://colab.research.google.com/drive/1uabc4lmQHPvWjkWOh4c_VQLg1j3ig161?usp=sharing'
  - 'https://www.everlane.com/products/womens-everywhere-pant-stretch-linen-cedarwood'
  - 'https://www.everlane.com/products/womens-organic-cotton-box-cut-pocket-tee-kalamata'
  - 'https://www.everlane.com/products/womens-relaxed-linen-shirt-cornstalk-chambray'
  - 'https://www.everlane.com/products/womens-gardener-jean-diamond-stone'
---

<img src="../images/facebook-notes/facebook-ai-product-description-style-transfer/978545244387557.jpg" alt="產品描述實驗的 Facebook 貼文附圖 1" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-ai-product-description-style-transfer/978545164387565.jpg" alt="產品描述實驗的 Facebook 貼文附圖 2" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-ai-product-description-style-transfer/978545184387563.jpg" alt="產品描述實驗的 Facebook 貼文附圖 3" loading="lazy" decoding="async">

<img src="../images/facebook-notes/facebook-ai-product-description-style-transfer/978550381053710.jpg" alt="產品描述實驗的 Facebook 貼文附圖 4" loading="lazy" decoding="async">

這則貼文記錄一個電商產品描述的實驗。

目標是輸入產品圖片，產生符合品牌語氣的產品描述。

## 三種不同的控制方式

最直接的方法，是在提示詞中描述想要的風格與語氣。

這種方式成本最低，也最容易開始，但「品牌語氣」這種抽象概念很難只靠文字完整傳達。

第二種方法是 Few-Shot Prompting。

做法是在提示詞中放入多個範例，讓模型從範例中模仿句型、用字與敘事方式。

通常範例越多，模型越容易抓到目標風格，但每次執行都要附帶這些範例，推論成本也會增加。

第三種方法是 LoRA Fine-Tuning。

LoRA 不直接修改整個基礎模型，而是訓練一組額外的參數層，讓模型在特定任務或風格上產生穩定的行為變化。

它需要比較繁瑣的資料準備與訓練流程，但訓練完成後可以保存 Adapter Layers，之後重複使用。

## 實驗觀察

原始實驗使用 Everlane 的產品資料，微調 Llama 3.2，並比較微調前後的輸出。

貼文中的提示詞相當簡單，但在 Zero-Shot 情境下，微調後的描述已經出現明顯差異。

原始貼文也附上 Google Colab 範例，讓讀者可以載入微調後的 LoRA 模型，從測試資料讀取一項產品，再比較微調前後的回應。

這筆保存內容的價值，不只是展示某一次模型輸出，而是把「提示詞控制」、「範例控制」與「模型微調」放在同一個實驗脈絡中比較。

實際使用時仍應重新檢查模型版本、訓練資料、產品資訊的正確性，以及品牌是否允許使用生成式內容。
