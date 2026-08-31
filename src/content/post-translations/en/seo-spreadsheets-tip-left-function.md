---
locale: en
sourceId: seo-spreadsheets-tip-left-function
slug: seo-spreadsheets-tip-left-function
translationKey: post:seo-spreadsheets-tip-left-function
status: published
sourceHash: 9adc922e76ab7f1eb9f088fa612bde31ae2c2acea2c1d22c3f2af57484699710
reviewedAt: 2026-08-31T00:00:00+08:00
title: 'SEO Spreadsheet Tip: Keep Only the Domain with LEFT'
excerpt: >-
  This Google Sheets technique removes protocols, www, paths, and query strings from long URLs so that only the domain remains.
categories:
  - Uncategorized
tags:
  - Uncategorized
---

<!-- Original publication date: 2016-04-26. English translation of the original article. -->

<p>SEO work often involves a large number of external links. URLs may contain <code>http://</code>, <code>www.</code>, long paths, and query strings, even though the domain name is the part we need. The <strong><code>=LEFT()</code> function</strong> can clean these URLs so they are ready for the next step.</p>
<img class="aligncenter size-full wp-image-210" src="./wp-content/uploads/2016/04/left-function.jpg" alt="Keeping only the domain name with the LEFT function" width="738" height="364" loading="lazy" decoding="async">

<h2>Introduction</h2>
<p>This walkthrough uses Google Sheets. You can copy the sample from <a href="https://docs.google.com/spreadsheets/d/1KjlM2Y2EFlH-x9UWOmI3Mf5o1LFbbPyPlNATujO4JaQ/edit?usp=sharing" target="_blank" rel="noopener noreferrer">this spreadsheet</a> into your own sheet and follow along.</p>

<h2>Step 1: remove the prefixes</h2>
<p>Use Find and replace three times to replace <code>http://</code>, <code>https://</code>, and <code>www.</code> with nothing.</p>
<img class="aligncenter size-full wp-image-212" src="./wp-content/uploads/2016/04/Find-and-replace.jpg" alt="Finding and replacing everything before the domain name" width="869" height="386" loading="lazy" decoding="async">
<ol><li>Select the range <code>A2:A14</code>.</li><li>Choose Edit → Find and replace (Ctrl+H).</li><li>Find <code>http://</code>, leave Replace empty, and choose Replace all.</li><li>Repeat for <code>https://</code> and <code>www.</code> (do not forget the period).</li></ol>
<img class="aligncenter size-full wp-image-213" src="./wp-content/uploads/2016/04/after-find-and-replace.jpg" alt="Spreadsheet after removing URL prefixes" width="428" height="374" loading="lazy" decoding="async">

<h2>Step 2: keep the domain</h2>
<p>In B2, enter:</p>
<pre><code>=LEFT(A2,FIND("/",A2,1)-1)</code></pre>
<p>LEFT takes a string and a number, then keeps that many characters. For example, <code>LEFT("D.H. Digital Marketing Notes",5)</code> keeps the first five characters. FIND locates the first slash, and subtracting one prevents the slash from being included.</p>
<p>Because every domain has a different length, this formula works for both short and long domains, such as <code>fau.edu/...</code> and <code>valenciacollege.edu/...</code>. The formula finds the first slash and returns everything before it.</p>
<h3>Breaking down FIND</h3>
<ul><li><code>"/"</code> is the character to find.</li><li><code>A2</code> is the cell containing the URL.</li><li><code>1</code> tells Sheets to start at the first character.</li><li><code>-1</code> removes the slash from the final result.</li></ul>
<blockquote><code>FIND("/",A2,1)-1</code> means: find the first slash in A2 and return the position immediately before it.</blockquote>

<h2>SEO applications</h2>
<p>This is useful when an SEO tool expects a domain rather than a complete URL, such as when checking domain authority. It is also useful when disavowing bad backlinks at the domain level.</p>

<h2>Conclusion</h2>
<p>This formula may seem basic, but it is a practical way to remove the unnecessary parts from a large URL list. If you know a better spreadsheet method, feel free to share it. Thanks for reading.</p>
