---
locale: en
sourceId: facebook-chatgpt-seo-bookmarklets
slug: facebook-chatgpt-seo-bookmarklets
translationKey: note:facebook-chatgpt-seo-bookmarklets
status: published
sourceHash: beec475060237cccf91fbcd02be2822424793e15227494f9a53233ed49663150
reviewedAt: '2026-08-31'
title: An early attempt to generate SEO Bookmarklet using ChatGPT
excerpt:
  A record of how to use natural language to generate social posts for the browser bookmarklet tool after ChatGPT became
  popular and link them back to existing Bookmarklet articles on the website.
categories:
  - SEO
  - Tools
tags:
  - ChatGPT
  - Bookmarklet
  - JavaScript
originalFacebookTagline: 用 ChatGPT 產生 SEO Bookmarklet 的早期嘗試
---

<img alt="ChatGPT SEO Bookmarklet’s Facebook post with image" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-chatgpt-seo-bookmarklets/563031205938965.jpg"/>

This post records a very intuitive way of working after ChatGPT became popular: hand the requirements to the model and ask it to generate JavaScript that can be put into browser bookmarks.

The original post lists a few examples.

- Copy all links on the page to the clipboard, distinguishing between internal links and external links.
- Copy the headers on the page to the clipboard and mark them H1 to H6.
- Find the text in the `em` tag on the page.
- Turn on the Wayback Machine to view historical versions of the page.

The value of this approach is not only to allow SEO workers to check pages faster, but also to demonstrate the workflow of "describing one-time manual checks as requirements, and then letting the model generate prototypes first."

However, Bookmarklet directly executes JavaScript on the current page, which still requires manual inspection of the code and permissions.

In particular, tools that read page data, write to the clipboard, or call external services should not be used directly without understanding the content.

This content overlaps with the existing SEO Bookmarklet article on the website, so it is kept as a community context note on the website instead of copying a complete tutorial.
