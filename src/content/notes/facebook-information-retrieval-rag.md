---
slug: facebook-information-retrieval-rag
canonicalPath: /notes/facebook-information-retrieval-rag.html
aliases: []
title: 從搜尋引擎到 RAG：重新理解資訊檢索
publishedAt: '2025-04-23'
updatedAt: '2026-08-24'
excerpt: 從早期研究搜尋引擎的挫折，到用 RAG 重新接觸文件拆分、查詢改寫與重排序，這是一則把 AI 學習連回資訊檢索的個人記錄。
categories:
  - AI
  - 搜尋
tags:
  - 資訊檢索
  - RAG
  - Chunking
  - Reranking
relatedPosts:
  - passage-retrieval-and-seo
  - how-search-engines-crawl
  - seo-newsletter-issue-59
  - seo-newsletter-issue-70-71
relatedNotes:
  - facebook-ai-anxiety-and-learning
  - facebook-ai-product-description-style-transfer
  - facebook-gpt-seo-applications
editorialStatus: published
noteKind: technical
source:
  platform: facebook
  recordId: fb-4c70775b7a8bbadf
  sourceFile: posts/profile_posts_1.json
  sourceIndex: 34
  url: null
sourceLinks:
  - 'https://docs.google.com/document/d/e/2PACX-1vREAufCaAVZ9eu7HOpZxd9ZzFDv7prq4lPL4YP_P6JG_45R2XtzKpNhVA24sHSusIO50RN0ifoDAkOh/pub'
  - 'https://x.com/JeffDean/status/1914803487751184434'
---

這則貼文記錄我重新接觸資訊檢索的過程。

早期曾經因為覺得搜尋引擎的技術知識太龐大而放棄深入研究，後來開始用大型語言模型實作 RAG，才重新遇到文件拆分、查詢改寫與重排序等問題。

這些名詞不是 RAG 才突然出現的新技術，而是搜尋與資訊檢索長期累積的問題，在新的應用場景中重新被看見。

這也和網站既有的 Passage Retrieval 文章形成一個很好的前後呼應：一邊是搜尋結果如何理解文件中的段落，另一邊是應用程式如何把文件整理成可以被模型檢索的知識。

原始貼文也提到 Jeff Dean 分享的早期 Google Search 演講，以及一份由 AI 協助整理的摘要。

這裡保存的是學習脈絡，不把原始摘要當成今日搜尋引擎或 RAG 系統的完整技術規格。
