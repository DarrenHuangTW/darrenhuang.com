---
locale: en
sourceId: how-search-engines-crawl
slug: how-search-engines-crawl
translationKey: post:how-search-engines-crawl
status: published
sourceHash: 4f029cae5f36e8afb6f49548ed254c7d55c7f9c357aa68fecd76823d6a7667c5
reviewedAt: 2026-08-30T15:00:00+08:00
title: 'How Search Engines Work: Crawling'
excerpt: >-
  Crawling is the first step in search.
  A crawler starts with a URL, visits it, discovers more URLs, and repeats the cycle.
  The concept sounds simple, but it contains many important SEO details.
categories:
  - SEO
tags:
  - SEO
featuredMediaAlt: Diagram of the search engine process from crawling and rendering through indexing, algorithms, and ranking
---

<!-- English translation of the original article. -->

<p>Crawling is the first step toward getting a website ranked on Google. The basic idea is not especially complicated: <strong>Google has a URL, visits the webpage, discovers more URLs in the page's content, adds them to its crawl queue, and repeats the cycle.</strong></p>

<p>The process sounds simple, but the web is a complicated place... (Otherwise I would not have written this much 😂)</p>

<hr class="wp-block-separator">

<h2>Table of Contents</h2>

<p>This article is a little long, but if you read patiently to the end, you will definitely learn something. Enjoy!</p>

<ul><li><a href="#intro">Introduction</a></li><li><a href="#why-care">Why You Should Understand Crawling</a></li><li><a href="#all-about-urls">It All Starts with URLs</a></li><li><a href="#3-crawl-steps">The Three Stages of Crawling</a><ul><li><a href="#step-1">Step 1: Entering the Crawl Queue</a></li><li><a href="#step-2">Step 2: The Crawler Visits</a></li><li><a href="#step-3">Step 3: Page Processing</a></li></ul></li><li><a href="#seo-to-do">What SEOs Can Optimize During Crawling</a></li><li><a href="#blocking">How Can You Stop Search Engines from Crawling?</a></li><li><a href="#testing">How to Test for Search Engine Crawling Problems</a></li><li><a href="#case">A Cautionary Tale Caused by Incorrect Crawl Settings</a></li><li><a href="#faq">Frequently Asked Questions About Search Engine Crawling</a></li><li><a href="#final-note">Conclusion</a></li></ul>

<hr class="wp-block-separator">

<h2 id="intro">Introduction</h2>

<p>I recently gave an internal SEO training session at work called “Before Google Ranks a Page: The Lifecycle of Googlebot.” It explored the three stages a webpage must pass through before it is eligible to appear in search results: <strong>crawling</strong>, <strong>rendering</strong>, and <strong>indexing</strong>. Not long afterward, I read Mr. Harris's article <a rel="noreferrer noopener" aria-label="SEO Basics: Understanding Crawling and Indexing (opens in a new tab)" href="https://www.yesharris.com/crawl-and-index/" target="_blank">“SEO Basics: Understanding Crawling and Indexing”</a>. It inspired me to write this article and, I hope, add more depth to the Chinese-language SEO resources available online. This series will divide the concept into three articles so that everyone can gain a deeper understanding of technical SEO.</p>

<hr class="wp-block-separator">

<h2 id="why-care">Why You Should Understand Crawling</h2>

<p>“Crawling” is the essential first step toward getting a webpage into search results. If Google does not even know that a page exists, ranking it in search results is out of the question. When we run a website, <strong>we want Google to crawl the pages we want people to find, and we want Google not to crawl pages we do not want people to see.</strong> In addition, as a website grows and plugins are installed and removed, the site often accumulates “technical debt.” <strong>SEO's job here is to help Google crawl the website as efficiently as possible.</strong></p>

<figure class="wp-block-image size-large"><img src="./wp-content/uploads/2020/05/%E6%90%9C%E5%B0%8B%E5%BC%95%E6%93%8E%E6%8A%93%E5%8F%96%E7%A4%BA%E6%84%8F%E5%9C%96-1024x548.png" alt="Diagram showing a search engine crawler discovering and following links between webpages" class="wp-image-1211" loading="lazy" decoding="async" width="1024" height="548"></figure>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">I don't get it. Can you explain it another way?</summary><div class="gb-accordion-text">
<p>Imagine the entire web as an enormous library. Every webpage is a book, and search engines are the librarians, with Google being the smartest one. The librarians remember every book they have read. Whenever someone asks a question, they use their impressions to recommend books that might help. “Crawling” is the process in which a librarian comes to read your “book.” If the librarian has never seen it, the book will not be recommended, no matter how well it is written.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Why would a website have pages it does not want Google to see? Can you give an example?</summary><div class="gb-accordion-text">
<p>For example, you generally would not want search engines to see a website that is still under development or a “mirror” site used specifically by engineers to test new features.</p>
</div></details></div>

<hr class="wp-block-separator is-style-default">

<h2 id="all-about-urls">It All Starts with URLs</h2>

<p>A URL is the address of a webpage. For example, <code>https://darrenhuang.com/about-darren-huang</code> is a URL. Here is a quiz for you. If you do not get it right, promise me you will finish this article!</p>

<p>Of the six URLs below, which ones are the same as the URL above in the eyes of a search engine, and which are different?</p>

<pre class="wp-block-preformatted"> A) https://darrenhuang.com/about-darren-huang/ (has a trailing slash)
 B) https://darrenhuang.com/about-darren-huang (starts with http instead of https)
 C) https://darrenhuang.com/ABOUT-DARREN-HUANG (uppercase)
 D) https://darrenhuang.com/about-darren-huang (does not include www)
 E) https://darrenhuang.com/about-darren-huang?utm_source=facebook (has a tracking parameter at the end)
 F) https://darrenhuang.com/about-darren-huang.html (has the .html filename at the end) </pre>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Think it over before revealing the answer!</summary><div class="gb-accordion-text">
<p>The answer is: <strong>none of them</strong>. That's right. Technically, every example above is a different URL. Although it is uncommon, each one “could” represent a different page. During crawling, search engines therefore treat all seven as separate URLs.</p>
</div></details></div>

<hr class="wp-block-separator is-style-default">

<h2 id="3-crawl-steps">The Three Stages of Crawling</h2>

<p>Crawling is the first of the three major steps through which Google indexes a webpage. This first major step can itself be divided into three stages: “<strong>entering the Crawl Queue</strong>,” “<strong>the Crawler's visit</strong>,” and “<strong>Processing</strong>.” I will introduce them in order below.</p>

<h3 id="step-1">Step 1: <strong>Entering the Crawl Queue</strong></h3>

<div class="wp-block-image"><figure class="aligncenter size-medium"><img src="./wp-content/uploads/2020/05/%E6%AA%A2%E7%B4%A2%E9%9A%8A%E5%88%97-300x100.png" alt="Crawl queue" class="wp-image-1222" loading="lazy" decoding="async" width="300" height="100"></figure></div>

<p>Search engines place every URL they discover into a crawl queue. URLs in the queue will then be visited by the search engine's “crawler.” Search engines primarily discover new URLs in the following three ways:</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">1. Links</summary><div class="gb-accordion-text">
<p>This includes both internal and external links. A crawler can discover new URLs through links on a page and add them to the crawl queue.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">2. Sitemaps</summary><div class="gb-accordion-text">
<p>Rather than finding new URLs one link at a time and adding them to the queue, a sitemap tells a crawler which URLs exist on a website all at once, making it a more efficient method.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">3. Webmaster Tools</summary><div class="gb-accordion-text">
<p>Major search engines such as Google and Bing provide their own webmaster tools, allowing site administrators to submit URLs or sitemaps. Doing this is essentially like telling Google directly: “Hey! I have one URL—or a whole bunch of them—over here. Add it, or them, to your crawl queue!”</p>
</div></details></div>

<p>SEO takeaway: For a website to rank, it first has to be crawled. To be crawled, it first has to make Google aware of its existence and enter the crawl queue.</p>

<h3 id="step-2">Step 2: The Crawler Visits</h3>

<div class="wp-block-image"><figure class="aligncenter size-large is-resized"><img src="./wp-content/uploads/2020/05/%E7%88%AC%E8%9F%B2%E6%8B%9C%E8%A8%AA-1.png" alt="Crawler requesting a queued webpage URL" class="wp-image-1227" width="300" height="104" loading="lazy" decoding="async"></figure></div>

<p>Once a search engine knows that a URL exists, it sends a “crawler” to inspect the URL and retrieve the page's content. Note that, before this point, the crawler knows only that the address exists. It has very little information about what is actually located there.</p>

<p>This is a conversation between the crawler—the search engine—and the server—your website. First, the crawler makes a request: “<em>Hey, I have a URL. Can I see what is there?</em>” It may then encounter one of the following situations:</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Situation A — Server: Here you go. <em>(Code: 2XX)</em></summary><div class="gb-accordion-text">
<p>The crawler receives what it wanted and moves to the next step.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Situation B — Server: That URL is old. Try this other URL instead. <em>(Code: 3XX)</em></summary><div class="gb-accordion-text">
<p>The crawler is directed to another URL and repeats the same steps. This is known as a redirect.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Situation C — Server: No! There is a problem with that URL! <em>(Code: 4XX)</em></summary><div class="gb-accordion-text">
<p>The crawler does not receive what it wanted because the URL is incorrect. Perhaps the file does not exist on the server, or perhaps the server has determined that the crawler does not have permission to request the page.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Situation D — Server: *&amp;#@!$ Sorry, I cannot give it to you right now. Something went wrong over here. <em>(Code: 5XX)</em></summary><div class="gb-accordion-text">
<p>The crawler does not receive what it wanted, but this time the problem is with the server, not necessarily the URL. In this situation, the crawler puts the URL back into the crawl queue in Step 1 and tries again later.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Situation E — ..... (The server never hears the crawler's request and does not respond.) <em>(Code: none)</em></summary><div class="gb-accordion-text">
<p>In this situation, the crawler's request fails to reach the server for some reason, such as a firewall. The crawler receives no response and does not even know whether anything exists at the URL.</p>
</div></details></div>

<p>SEO takeaway: Of the situations above, D is the most problematic because it indicates an unstable server. A user or crawler visiting the URL sees a server error. The other four situations are not absolutely good or bad. <strong>That's right: A does not necessarily mean there is no problem, while B, C, and E do not necessarily mean there is one.</strong> I will explain this in more detail below.</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">What do the codes in parentheses mean?</summary><div class="gb-accordion-text">
<p>They are <strong>HTTP status codes</strong>. HTTP is the “language” that crawlers and servers use to communicate. After receiving a request, a server uses a three-digit code to tell the crawler the status of the requested URL.</p>

<ul><li>“2XX” — Codes beginning with 2 mean that the server can process the request.</li><li>“3XX” — Codes beginning with 3 indicate a redirect.</li><li>“4XX” — Codes beginning with 4 indicate a problem with the request, such as the common 404 error meaning that a page does not exist.</li><li>“5XX” — Codes beginning with 5 indicate that the server encountered an error while processing the request, such as a Carrefour server becoming overloaded when everyone rushes to buy a Nintendo Switch.</li></ul>
</div></details></div>

<h3 id="step-3">Step 3: Page Processing</h3>

<div class="wp-block-image"><figure class="aligncenter size-large is-resized"><img src="./wp-content/uploads/2020/05/%E7%B6%B2%E9%A0%81%E8%99%95%E7%90%86.png" alt="SEO indexing process" class="wp-image-1231" width="300" height="102" loading="lazy" decoding="async"></figure></div>

<p>This is the final step of the crawling stage. The crawler processes the file that it successfully retrieved from the server in Situation A, finds links in its content, and places those links into the crawl queue in Step 1. The cycle then repeats.</p>

<p>This “processing” stage is also known as rendering. I will explain the concept in the next article, but here is a preview: “<em>A search engine has retrieved a file from the server, but will it process the file immediately? And after processing it, is the search engine guaranteed to understand it?</em>”</p>

<p>SEO takeaway: Within the scope of crawling, the most important part of this step is <strong>finding links on the webpage</strong>. For a search engine to recognize a URL as a link, it must appear in the <code>href</code> attribute of an <code>&lt;a&gt;</code> tag. Websites built with common site-building platforms generally do not need to worry about this because links normally use the standard HTML syntax described above.</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">What kinds of links can a crawler fail to see?</summary><div class="gb-accordion-text">
<p>If you are an SEO practitioner or web engineer, pay attention to this section. JavaScript makes SEO more complicated. Some links can be clicked by ordinary users but are ignored by search engines. Here are several common examples:</p>

<ul><li><code>&lt;a href="/good-link"&gt;crawlable&lt;/a&gt;</code></li><li><code>&lt;a href="javascript: changePage('bad-link')"&gt;not crawlable&lt;/a&gt;</code></li><li><code>&lt;a onclick="changePage('bad-link')"&gt;not crawlable&lt;/a&gt;</code></li><li><code>&lt;span onclick="changePage('bad-link')"&gt;not crawlable&lt;/span&gt;</code></li><li><code>&lt;a href="/good-link" onclick="changePage('good-link')"&gt;crawlable&lt;/a&gt;</code></li></ul>
</div></details></div>

<hr class="wp-block-separator">

<h2 id="seo-to-do">What SEOs Can Optimize During Crawling</h2>

<p>Now that we have covered how search engines crawl, the next question is what SEOs can do at this stage to keep a website “friendly” with search engines. The concept is not difficult. <strong>Our goal is to optimize the crawler's experience when it crawls our website.</strong> We can approach this from several angles.</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Make sure crawlers can visit the pages they should visit</summary><div class="gb-accordion-text">
<p>This corresponds to Step 2 in the previous section. For pages that should be visited, the communication channel between the crawler and the server must remain open. This is not hard to understand: if you want a page to appear in search results, it should not be password-protected, placed behind a firewall, or configured to prohibit search engine visits.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Make sure crawlers cannot visit pages they do not need to visit</summary><div class="gb-accordion-text">
<p>By the same logic, we should use appropriate methods to keep crawlers away from pages that we do not want search engines to crawl. Even a search engine as large as Google does not have unlimited resources for crawling the entire web. Proactively telling crawlers which pages they do not need to crawl is a “friendly” gesture that helps them find the pages worth discovering on your site as efficiently as possible.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Make sure pages that should be crawled are easy to discover</summary><div class="gb-accordion-text">
<p>This corresponds to Step 1 in the previous section. Pages that should be visited need to be discoverable through internal links. Imagine an important page with no links pointing to it. How would Google know it exists? Even if Google did know, it would not consider the page important.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Make sure the server gives crawlers the correct response</summary><div class="gb-accordion-text">
<p>If something exists at a URL, say that it exists; if nothing exists there, say that it does not. With some strange server configurations, a URL may return a page saying that the webpage does not exist while simultaneously returning a successful HTTP code (2XX). In SEO, this situation is called a <a href="https://support.google.com/webmasters/answer/181708?hl=zh-Hant">Soft 404 Error</a>.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Make sure a crawler's request can reach the server easily</summary><div class="gb-accordion-text">
<p>I mentioned redirects earlier. Redirects are not inherently wrong, but too many of them can become a problem. Here are two issues redirects can cause:</p>

<ul><li><strong>Redirect Chain</strong>: A crawler has URL A. After visiting it, the crawler is told that the page has moved to URL B. At URL B, it is told that the page has moved to URL C, then D, E, and so on. A few redirects are fine, but after too many, the crawler may simply throw up its hands and stop.</li><li><strong>Redirect Loop</strong>: The server at URL A tells the crawler that the content is on page B, while the server at page B tells the crawler that the content is at URL A, creating an infinite loop.</li></ul>
</div></details></div>

<hr class="wp-block-separator">

<h2 id="blocking">How Can You Stop Search Engines from Crawling?</h2>

<p>As mentioned above, we can proactively prevent search engines from visiting specific pages so that they can crawl the website more efficiently. Look at this diagram again: the crawler can be blocked at the second and third steps.</p>

<div class="wp-block-image"><figure class="aligncenter size-large"><img src="./wp-content/uploads/2020/05/%E6%90%9C%E5%B0%8B%E5%BC%95%E6%93%8E%E7%B4%A2%E5%BC%95-2.png" alt="Diagram contrasting crawl controls with search engine indexing" class="wp-image-1247" loading="lazy" decoding="async" width="366" height="130"><figcaption>As an aside, “How can you stop search engines from crawling?” is a common question testing basic concepts in SEO interviews.</figcaption></figure></div>

<p>We cannot prevent a URL from entering the crawl queue in Step 1 because a crawler may discover a link to our website somewhere else.</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Step 2: Apply restrictions <strong>before</strong> the crawler visits</summary><div class="gb-accordion-text">
<p>When a crawler is about to visit a URL, tell it that it is not allowed to enter. Webmasters can set up a firewall, use password protection, or <strong>define rules for crawlers through robots.txt</strong>.</p>

<p>robots.txt is a text file that must be placed in the root directory. For example, this site's robots.txt is located at <code><a href="./robots.txt">https://darrenhuang.com/robots.txt</a></code>. In this file, we can define rules for search engine crawlers and disallow them from visiting certain files.</p>

<p>For example, if robots.txt contains the line <code>Disallow: /secret-weapon</code>, a search engine crawler that sees a URL containing /secret-weapon in its crawl queue will turn around and leave.</p>

<p>Because this is an introductory article, you only need to understand that the robots.txt file can restrict the paths crawlers are allowed to visit. For detailed rules and syntax, see <a href="https://support.google.com/webmasters/answer/6062608?hl=zh-Hant">Google's documentation</a>. If you think you already understand robots.txt quite well, try <a href="https://www.facebook.com/pg/searchenginecommunity/photos/?tab=album&amp;album_id=221651911906092">Digital Engine's robots.txt challenge</a>!</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Step 3: Apply restrictions <strong>after</strong> the crawler visits</summary><div class="gb-accordion-text">
<p>We can also tell a crawler, while it processes a page, “Do not place the links you see here into the crawl queue.”</p>

<p>Webmasters can accomplish this with a <strong>Robots Meta Tag</strong>, an <strong>X-Robots-Tag</strong>, or <strong>the link's rel="nofollow" attribute</strong>.</p>

<ul><li><strong>Robots Meta Tag:</strong> Adding <code>&lt;meta name="robots" content="nofollow" /&gt;</code> to a website's &lt;head&gt; section can prevent search engines from adding any links found on that page to the crawl queue.</li><li><strong>X-Robots-Tag:</strong> Adding <code>X-Robots-Tag: nofollow</code> to the server response can prevent search engines from adding any links found on that page to the crawl queue.</li><li><strong>The link's rel="nofollow" attribute:</strong> Adding the attribute to a link—for example, <code>&lt;a href="/dont-crawl"&nbsp;rel="nofollow"&gt;do not crawl&lt;/a&gt;</code>—can prevent search engines from adding that particular link to the crawl queue.</li></ul>

<p>In practice, the three methods above are rarely used for this purpose. If you do not want crawlers to visit one of your own pages, you would usually restrict it in robots.txt. <a href="./what-is-backlink-in-seo.html#:~:text=%E8%A8%BB:%20Rel=%E2%80%9Dnofollow%E2%80%9D">nofollow is more closely related to backlinks</a>, but because the directive was so easily misused, <a href="./seo-newsletter-issue-3.html#toc-2">Google later began treating it as a hint rather than strictly obeying it</a>.</p>

<p>For a deeper look at the details of this syntax, see these Google documents: “<a href="https://support.google.com/webmasters/answer/96569?hl=zh-Hant">Link rel attributes</a>” and “<a href="https://developers.google.com/search/reference/robots_meta_tag">Robots Meta Tags and X-Robots-Tag</a>.”</p>
</div></details></div>

<hr class="wp-block-separator">

<h2 id="testing">How to Test for Search Engine Crawling Problems</h2>

<p>The fact that a webpage opens in a browser does not mean that a crawler can visit it. The easiest way to confirm whether Google's crawler can actually access a page is to use the URL Inspection tool at the top of <a rel="noreferrer noopener" aria-label="Google Search Console (opens in a new tab)" href="https://www.google.com/intl/zh-TW/webmasters/" target="_blank">Google Search Console</a>. It can tell you about problems Google's crawler encountered while crawling and indexing the page.</p>

<div class="wp-block-image"><figure class="aligncenter size-large"><img src="./wp-content/uploads/2020/05/%E7%B6%B2%E5%9D%80%E6%AA%A2%E6%9F%A5%E5%B7%A5%E5%85%B7-1024x411.png" alt="Testing a page's crawl status in Google Search Console" class="wp-image-1276" loading="lazy" decoding="async" width="1024" height="411"></figure></div>

<p>If you are troubleshooting a client's or someone else's website and do not have GSC access, you can also use another Google tool, such as the <a rel="noreferrer noopener" aria-label="Mobile-Friendly Test (opens in a new tab)" href="https://search.google.com/u/1/test/mobile-friendly" target="_blank">Mobile-Friendly Test</a>. The important thing is to run the test with Google's crawler.</p>

<figure class="wp-block-image size-large"><img src="./wp-content/uploads/2020/05/%E8%A1%8C%E5%8B%95%E8%A3%9D%E7%BD%AE%E7%9B%B8%E5%AE%B9%E6%80%A7%E6%B8%AC%E8%A9%A6-1024x353.png" alt="Testing a page's crawl status with the Mobile-Friendly Test" class="wp-image-1277" loading="lazy" decoding="async" width="1024" height="353"></figure>

<p>If the page reports that it cannot be loaded or crawled but robots.txt does not appear to contain a problem, a firewall or another unusual server setting may be blocking Google's crawler requests. Server-side problems are harder to diagnose from the outside, so I recommend contacting the hosting provider directly.</p>

<hr class="wp-block-separator">

<h2 id="case">A Cautionary Tale Caused by Incorrect Crawl Settings</h2>

<p>In February 2020, a story broke that invite links for private WhatsApp groups—WhatsApp being Facebook's messaging app—could be found in Google Search. The results included links to pornographic and illegal groups, and anyone could join those private groups through links in the search results (<a rel="noreferrer noopener" href="https://kknews.cc/tech/ljaqyab.html" target="_blank">Daily Headlines report</a>).</p>

<blockquote class="embed embed--twitter"><p>Post on Twitter/X</p><a href="https://twitter.com/JordanWildon/status/1230829082662842369" rel="noopener noreferrer">View the original post on Twitter/X</a></blockquote>

<p>This unfortunate situation occurred because WhatsApp had not blocked crawlers during crawling or prevented search engines from indexing the pages during indexing, which I will cover in the next chapter. <strong>In a crawler's eyes, a private-group invitation link is still just a URL. It can be placed in the crawl queue, visited by a crawler, and of course potentially indexed after processing.</strong></p>

<figure class="wp-block-image size-full is-resized"><img src="./wp-content/uploads/2020/05/Google%E5%9B%9E%E6%87%89whatsapp%E7%A7%81%E4%BA%BA%E7%BE%A4%E7%B5%84%E6%94%B6%E9%8C%84%E4%BA%8B%E4%BB%B6.png" alt="Google spokesperson responds to the indexing of WhatsApp group invitations" class="wp-image-1267" width="452" height="248" loading="lazy" decoding="async"><figcaption>Google spokesperson Danny Sullivan responded to the incident: “Search engines like Google index links they discover. We do not decide whether those links were meant to be public. If a site does not want them indexed, tools are available for that purpose.”</figcaption></figure>

<hr class="wp-block-separator">

<h2 id="faq">Frequently Asked Questions About Search Engine Crawling</h2>

<p>That concludes the main explanation of crawling. So far, we have learned how search engines crawl webpages, why crawling matters, how SEOs can optimize a crawler's experience, and more. This section answers some common questions.</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">I only have a simple website. Do I really need to understand this much?</summary><div class="gb-accordion-text">
<p>First, thank you for reading this far XD. As an SEO, I would love to tell you that crawling is incredibly important and that terrible things will happen if you do not optimize it. In reality, if your website is just a simple blog or company site, there is a good chance you do not need to worry about how search engines work behind the scenes.</p>

<p>As mentioned above, the web is enormous, and crawlers do not spend unlimited resources on any one website. But search engines such as Google are no slouches. They have their own systems for optimizing crawler efficiency—which links to crawl, which not to crawl, how frequently to crawl them, and so on. These are generally not issues that a small website needs to worry about.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Can I use robots.txt to block private pages?</summary><div class="gb-accordion-text">
<p>Robots.txt can block search engine crawlers, but it cannot block ordinary users. Putting <code>Disallow: /private-page.html</code> in robots.txt will only make people curious about what embarrassing secret might be hiding at that URL. 😉</p>

<p>If you really need to put something private online, password protection is still the best approach!</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Common crawling problems on e-commerce websites</summary><div class="gb-accordion-text">
<p>E-commerce sites often use what is known as faceted navigation. Imagine the men's clothing category page on an e-commerce site, with a panel on the left that lets visitors filter products by “size,” “brand,” “color,” and so on. Every condition you add changes the URL, like this:</p>

<ul><li><code>/mens-clothing</code> Men's clothing</li><li><code>/mens-clothing?size=XL</code> Men's clothing in XL</li><li><code>/mens-clothing?size=XL&amp;brand=nike</code> Nike men's clothing in XL</li><li><code>/mens-clothing?size=XL&amp;brand=nike&amp;color=red</code> Red Nike men's clothing in XL</li></ul>

<p>The example above has only three filter criteria—size, brand, and color—but real e-commerce platforms offer many more. Imagine that every criterion has multiple options, some filters can be selected more than once or left unselected, and even the order after the <code>?</code> can change—for example, <code>?brand=nike&amp;size=XL</code> vs. <code>?size=XL&amp;brand=nike</code>... You may already see where this is going. That's right: all those combinations can create an enormous number of URLs for the men's clothing category alone. <strong>To a crawler, every one of those URLs is a “separate” URL, and the content on them is not especially strong!</strong></p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Do I need to submit every new article through webmaster tools so that Google knows about it and places it in the crawl queue as soon as possible?</summary><div class="gb-accordion-text">
<p>Crawlers discover URLs in three main ways, and manual submission is only one of them. Even if you do not submit a page, Google can still find its link through the other methods. Submission can indeed get a page crawled and indexed more quickly, but it has nothing to do with rankings.</p>

<p>On a healthy website, Google can usually discover a webpage shortly after it is published even if you do not submit the URL, so there is no particular need to do so. If you find that new articles consistently take several days to be indexed, you can try the submission tool. More importantly, though, that pattern is a reason to check whether the website has another problem.</p>
</div></details></div>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion"><details><summary class="gb-accordion-title">Does a URL's format affect search engine crawling?</summary><div class="gb-accordion-text">
<p>No. Whether a webpage's URL is <code>https://example.com/seo-friendly</code> or <code>https://example.com/?p=3828482</code>, it is still just a URL. An ugly URL does not affect the crawler's ability to crawl it. Other debates—whether a URL ends in .html, contains Chinese characters, or uses a hyphen “-” instead of an underscore “_”—do not matter here either. A URL is a URL, and its format does not affect search engine crawling. Whether a pretty URL affects rankings is beyond the scope of this article!</p>

<p>Fun fact: The previous paragraph is not entirely correct. One HTTP status code is <code>414 URI Too Long</code>, which means that the URL is too long for the server or crawler to process. The limit can be as high as 2,000 characters, however, so it is not something a normal website needs to worry about. (<a href="https://stackoverflow.com/questions/417142/what-is-the-maximum-length-of-a-url-in-different-browsers" target="_blank" rel="noreferrer noopener" aria-label="Stack Overflow discussion (opens in a new tab)">Stack Overflow discussion</a>)</p>
</div></details></div>

<p>Do you still have a question or concern about “crawling” that I have not answered clearly enough? Leave a comment and let me know. I will answer it there or edit it into the FAQ section above! This article is meant for beginners, so if something is difficult to understand, that is my problem. Throw all your strange questions at me!</p>

<hr class="wp-block-separator">

<h2 id="final-note">Conclusion</h2>

<p>That concludes this introduction to search engine crawling. Thank you for reading all the way to the end. When I have time, I will turn the other two steps—rendering and indexing—into articles as well. “<a href="https://www.facebook.com/searchenginecommunity/">Digital Engine</a>” is a Facebook page I run in my spare time. The image below is a bit of trivia I shared before that relates to this article's topic. I hope the joke makes sense now!</p>

<aside class="embed embed--fallback" data-embed-provider="facebook"><p>This third-party content must be viewed on the source website.</p><a href="https://www.facebook.com/searchenginecommunity/photos/a.193015414769742/222830055121611/" rel="noopener noreferrer">View the original content on Facebook</a></aside>

<p></p>
