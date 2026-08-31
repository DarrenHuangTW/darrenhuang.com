---
locale: en
sourceId: facebook-mobile-first-indexing
slug: facebook-mobile-first-indexing
translationKey: note:facebook-mobile-first-indexing
status: published
sourceHash: 24cabb7b69039aa079a9c59fb42799271ef9824993c735944325d780a937185d
reviewedAt: '2026-08-31'
title: 'Mobile content-first indexing: Dynamic Serving Don’t forget Vary'
excerpt:
  "Save a working case that explains why HTTP's Vary: User-Agent may become an important cache signal when Dynamic
  Serving returns different HTML based on User-Agent."
categories:
  - SEO
  - Web Technology
tags:
  - Mobile-First Indexing
  - Dynamic Serving
  - HTTP Header
  - Vary
originalFacebookTagline: 行動版內容優先索引：Dynamic Serving 別忘了 Vary
---

<img alt="Mobile content-first indexed Facebook post with image" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-mobile-first-indexing/682384215832857.png"/>

This post contains a working example related to mobile-first content indexing.

The website in the case uses Dynamic Serving, and the server will return different versions of HTML based on the User-Agent, but the URL remains the same.

This approach requires attention to whether the cache server knows that the response content will change with the User-Agent, so the case specifically checks the `Vary: User-Agent` HTTP Response Header.

If the cache only saves a copy of the HTML, it may mistakenly serve the desktop version to mobile users, or the mobile version to desktop users.

This content was published in 2020, and the policy background of mobile indexing may be different from today’s implementation environment.

The long-term caveat is that whenever the same URL returns different content based on request conditions, caching, crawling, and user experience must be examined together.
