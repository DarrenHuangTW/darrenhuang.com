---
locale: en
sourceId: facebook-guess-js-data-driven-prefetch
slug: facebook-guess-js-data-driven-prefetch
translationKey: note:facebook-guess-js-data-driven-prefetch
status: published
sourceHash: 8f10049124e286ab07306c9dddb4eb7969764b2cdc71cfb25a12d317cdfadffc
reviewedAt: '2026-08-31'
title: 'Guess.js: Use data to predict the next page and then decide whether to prefetch it'
excerpt:
  A historical note discussing prefetch, user behavior data and machine learning together. The key point is that prefetching
  should be based on a balance between probability and cost.
categories:
  - Web Technology
  - SEO
tags:
  - Prefetch
  - Performance
  - Machine Learning
  - Guess.js
originalFacebookTagline: Guess.js：用資料預測下一頁，再決定是否預取
---

<img alt="Guess.js’ Facebook post with image 1" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-guess-js-data-driven-prefetch/499531467451467.png"/>

<img alt="Guess.js’ Facebook post with image 2" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-guess-js-data-driven-prefetch/499531474118133.png"/>

<img alt="Guess.js’ Facebook post with image 3" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-guess-js-data-driven-prefetch/499531480784799.png"/>

If all possible next pages are prefetched, it can theoretically make the post-click experience faster, but it will also consume a lot of user network traffic.

The real question worth discussing is how to determine which pages are most likely to be visited next.

The original post suggested two directions.

The first is for developers to determine the pages that users are most likely to go to, and then prefetch those resources.

The second is to use the website's usage behavior data to infer the probability that links on different pages are clicked.

Guess.js has been used to demonstrate the second approach.

It combines Google Analytics data to analyze the likelihood of links on the page being clicked, and then places prefetch on links that are more likely to be visited.

The point of this idea is not to "add more prefetch, the better", but to consider the prefetch cost, bandwidth and the path that the user will actually take.

This post was published in 2019, and related tools and examples may have changed or ceased maintenance.

Therefore, this page preserves the design ideas and research context at that time, and does not guarantee that the tools in the link are still suitable for direct use.
