---
locale: en
sourceId: google-before-after-search-commands
slug: google-before-after-search-commands
translationKey: post:google-before-after-search-commands
status: published
sourceHash: fa7292db996c4a8ba021d4a535beae0e9f2fe6fbc20a6f4f3affd2efa0af928c
reviewedAt: 2026-08-31T00:00:00+08:00
title: 'New Google Search Commands: before: and after:'
excerpt: >-
  Google’s before: and after: operators filter results before, after, or between specified dates.
categories:
  - Uncategorized
tags:
  - Uncategorized
---

<!-- Original publication date: 2019-04-09. English translation of the original article. -->

<p>On April 9, 2019, Google’s <a rel="noreferrer noopener" aria-label="Official Twitter announcement" href="https://twitter.com/searchliaison/status/1115706765088182272" target="_blank">official Twitter account</a> announced two search commands: <em><strong>before:</strong></em> and <em><strong>after:</strong></em>. Add a year or an exact date after either operator to filter results.</p>

<figure class="wp-block-image"><img src="./wp-content/uploads/2019/04/google-before-after-search-command.png" alt="Google before and after search commands" class="wp-image-474" loading="lazy" decoding="async" width="812" height="531"><figcaption><a href="https://twitter.com/searchliaison/status/1115707059998052354" target="_blank" rel="noreferrer noopener" aria-label="Original example">Original example</a></figcaption></figure>

<h2>How to use them</h2>
<p>The syntax is simple: add <strong>before:</strong> or <strong>after:</strong> and a year or date to a query. You can use either operator alone or combine both.</p>
<pre class="wp-block-preformatted">韓國瑜 before:2017</pre>
<figure class="wp-block-image"><img src="./wp-content/uploads/2019/04/google-before-command-example-1-1024x689.png" alt="Search results filtered with before 2017" class="wp-image-479" loading="lazy" decoding="async" width="1024" height="689"><figcaption>Results for news published before the subject became mayor.</figcaption></figure>
<pre class="wp-block-preformatted">韓國瑜 after:2018</pre>
<figure class="wp-block-image"><img src="./wp-content/uploads/2019/04/google-after-command-example-1024x690.png" alt="Search results filtered with after 2018" class="wp-image-480" loading="lazy" decoding="async" width="1024" height="690"><figcaption>Results published after 2018.</figcaption></figure>
<pre class="wp-block-preformatted">韓國瑜 after:2018-11-1 before:2018-11-15</pre>
<figure class="wp-block-image"><img src="./wp-content/uploads/2019/04/google-before-and-after-command-example-1024x723.png" alt="Search results between two dates" class="wp-image-482" loading="lazy" decoding="async" width="1024" height="723"><figcaption>Results published between November 1 and November 15, 2018.</figcaption></figure>
<p>These operators work in ordinary Google Search and Google News.</p>

<h2>Date details</h2>
<ul><li><code>before:2018</code> returns results before 2018-01-01.</li><li><code>after:2018</code> returns results after 2018-12-31.</li><li><code>before:2019 after:2017</code> limits results to 2018.</li><li>Hyphens and slashes are both accepted: <code>before:2018-12-31</code> equals <code>before:2018/12/31</code>.</li><li>Months and days may use one or two digits, such as <code>before:2018-5-17</code> and <code>before:2018-05-17</code>.</li></ul>

<h2>Notes</h2>
<p>Google News always displays a publication time, while ordinary Search shows one only when Google considers it useful. Google estimates dates in several ways, but the result is not guaranteed to be exact because pages can be edited and declared dates may differ from actual publication dates.</p>
<figure class="wp-block-image"><img src="./wp-content/uploads/2019/04/google-timestamp.png" alt="Publication timestamp shown in Google Search" class="wp-image-487" loading="lazy" decoding="async" width="796" height="455"></figure>
<p>For more detail, see Google’s <a rel="noreferrer noopener" aria-label="Official explanation" href="https://webmasters.googleblog.com/2019/03/help-google-search-know-best-date-for.html" target="_blank">official explanation</a>.</p>
