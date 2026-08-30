---
locale: en
sourceId: passage-retrieval-and-seo
slug: passage-retrieval-and-seo
translationKey: post:passage-retrieval-and-seo
status: published
sourceHash: 621453d9ef0d5051efb367e55182369a6a71520cf92878e8dc3a452972dfdae3
reviewedAt: 2026-08-30T15:00:00+08:00
title: An Introduction to Passage Retrieval
excerpt: >-
  Google's passage retrieval system was expected to affect about 7% of search results as it expanded to searches in every language worldwide.
  What changed, and how should SEOs respond?
  Read on for a closer look.
categories:
  - SEO
tags:
  - SEO
featuredMediaAlt: Diagram showing question processing, document and passage retrieval, and answer extraction in an NLP system
---

<!-- English translation of the original article. -->

<p>At a Search On event in October 2020, Google said it had made a major breakthrough in Search called “<strong>Passage Retrieval</strong>,” which would affect about 7% of search results once fully rolled out. What was this change? How did it differ from the previous system? This article takes a closer look.</p>

<h2>Summary</h2>

<ul><li>With the launch of passage retrieval, Google would begin considering <strong>the relevance between an individual passage on a page and the query</strong> as a ranking factor, instead of looking only at <strong>the relevance between the page as a whole and the query</strong>.</li><li>The update was scheduled to <strong>roll out by the end of 2020</strong>, beginning with English searches in the United States before gradually expanding to <strong>every language worldwide</strong>.</li><li>Once launched, it was expected to <strong>affect 7% of search results</strong>, a fairly significant share. (For comparison, BERT, launched in 2019 and described as Google's biggest leap forward in five years, initially affected about 10% of English-language search results.)</li><li>The change <strong>did not affect how Google indexes websites</strong>; it could be understood as a ranking change.</li></ul>

<h2>Passage Retrieval vs. Document Retrieval</h2>

<p>Previously, Google used <strong>Document Retrieval</strong>, finding the <em>webpages<sup>*</sup></em> in its database that were most relevant to a query and returning them in the search results. With <strong>Passage Retrieval</strong>, however, Google would return the passages of information most relevant to the query.</p>

<p>A passage is a particular section of information on a webpage. In other words, if one passage is highly relevant to a query even though the page containing it has only low overall relevance to that query, the page may have a better chance of ranking after this change.</p>

<p class="has-light-gray-background-color has-background">Strictly speaking, a document and a webpage are not the same thing. To simplify the discussion and make it easier to understand, I treat them as equivalent here. If you would like to read more, see <a href="https://support.google.com/webmasters/answer/70897?hl=en">this article</a>.</p>

<h2>What Problem Did This Change Solve?</h2>

<p>In machine learning, two especially important metrics for deciding whether something is “relevant” are precision and recall. <strong>Precision is the proportion of selected results that are relevant, while recall is the proportion of all relevant items that were selected.</strong></p>

<div class="wp-block-image"><figure class="aligncenter size-large is-resized"><img src="./wp-content/uploads/2020/10/recall-and-precision.png" alt="Diagram comparing precision and recall in information retrieval" class="wp-image-1935" width="761" height="277" loading="lazy" decoding="async"><figcaption>Precision and recall, two key measures of relevance (<a href="https://towardsdatascience.com/whats-the-deal-with-accuracy-precision-recall-and-f1-f5d8b4db1021">image source</a>)</figcaption></figure></div>

<p>With that idea in mind, it becomes easier to understand why many webpages struggle to rank under document retrieval. The information genuinely relevant to a query—the green semicircle in the illustration above—may sit on the same page, represented by the entire circle, as a large amount of useless information—the red semicircle. That produces a very low precision score and dilutes the page's relevance. <strong>Under passage retrieval, Google would place greater emphasis on recall than on precision. A page could contain a great deal of noise; what mattered more was whether its relevant information was sufficiently complete.</strong></p>

<p>In plain English: Google could more easily give users a relevant answer to the question they entered.</p>

<p class="has-light-gray-background-color has-background">Real life offers plenty of similar examples. Ask a very specific question, and one person may explain all the basic background in the field without ever answering the actual question. Someone else may know the answer but wander all over the place before finally giving it.</p>

<h2>An Example</h2>

<p>You might ask, “<em>Why would a webpage put useful information among a pile of useless information?</em>” Remember that whether information is useful depends on the query. <strong>A user's query may be so extremely specific that very little information is truly relevant</strong>, or <strong>the page itself may take the form of a news roundup or forum thread</strong>, putting multiple topics or a great deal of noise on the same page.</p>

<h3>Query: “How can I tell whether the glass in my home blocks UV?”</h3>

<p>Google's example at Search On used the query “<em>How can I tell whether the glass in my home blocks UV?</em>” The original top result (Figure A below) was an <a href="https://www.wearshade.com/articles/uv-radiation-through-windows">article</a> about UV-resistant glass. It discussed different ultraviolet wavelengths, which types of glass were most effective, test results, and more. The content was highly technical, <strong>but it did not clearly answer the searcher's question</strong>.</p>

<p>After passage-based retrieval, the top result (Figure B below) was a <a href="https://www.doityourself.com/forum/doors-skylights-windows/192584-how-can-i-tell-if-i-have-uv-protection.html">forum post</a>. The scrollbar on the right shows that the page was quite long, yet <strong>only the small yellow section in the middle answered the query precisely and was highly relevant</strong>. Farther down the thread, the discussion wandered off topic and even turned into an argument among forum members.</p>

<figure class="wp-block-gallery columns-1 is-cropped"><ul class="blocks-gallery-grid"><li class="blocks-gallery-item"><figure><img src="./wp-content/uploads/2020/10/%E7%89%87%E6%AE%B5%E8%B3%87%E8%A8%8A%E7%B4%A2%E5%BC%95-%E6%94%B9%E5%8B%95%E5%89%8D-1024x538.png" alt="Search result before passage retrieval" data-id="1918" class="wp-image-1918" loading="lazy" decoding="async" width="1024" height="538"><figcaption class="blocks-gallery-item__caption"><em>Figure A: The article discusses UV-resistant glass in depth but does not satisfy the searcher's intent</em></figcaption></figure></li><li class="blocks-gallery-item"><figure><img src="./wp-content/uploads/2020/10/%E7%89%87%E6%AE%B5%E8%B3%87%E8%A8%8A%E7%B4%A2%E5%BC%95-%E6%94%B9%E5%8B%95%E5%BE%8C.png" alt="Search result after passage retrieval" data-id="1917" class="wp-image-1917" loading="lazy" decoding="async" width="661" height="303"><figcaption class="blocks-gallery-item__caption"><em>Figure B: The page contains a great deal of irrelevant material, but Google identifies the passage that best matches the searcher's intent</em></figcaption></figure></li></ul></figure>

<h2>This Did Not Change How Google's Indexing System Worked</h2>

<p>In the Search On video, the speaker said, “<em>We are not just able to index webpages, but individual passages from those pages</em>.” This wording confused many SEOs, who thought Google had changed how it indexed content and would now index “passages” instead of webpages. <strong>That interpretation was incorrect. Google still indexed the entire webpage; it simply began considering passage-level relevance during ranking.</strong></p>

<figure class="wp-block-image size-large"><img src="./wp-content/uploads/2020/10/passage-ranking.png" alt="Danny Sullivan clarifies that passage retrieval does not change how Google indexes websites" class="wp-image-1944" loading="lazy" decoding="async" width="799" height="460"><figcaption>Google's response to the confusion.</figcaption></figure>

<p>The diagram below shows the three stages used in natural language processing (NLP) for factoid question answering. In the second stage, after Document Retrieval selects relevant documents, the system performs Passage Retrieval to extract the key passages.</p>

<figure class="wp-block-image size-large is-resized"><img src="./wp-content/uploads/2020/10/NLP%E5%95%8F%E7%AD%94%E4%B8%89%E9%9A%8E%E6%AE%B5-1.png" alt="Three stages of NLP factoid question answering" class="wp-image-1953" width="630" height="242" loading="lazy" decoding="async"><figcaption>The image comes from a <a href="https://web.stanford.edu/~jurafsky/slp3/25.pdf">Stanford University NLP textbook</a>. It does not represent Google's architecture, but it shows that passage retrieval and indexing are generally separate stages.</figcaption></figure>

<p class="has-light-gray-background-color has-background"><strong>(Note 1.)</strong> I do not think the speaker was necessarily wrong. Rather, what SEOs generally mean by “index” may differ from what engineers mean by “index.” A search for “passage indexing” also turns up many academic papers on the subject. To avoid ambiguity, this article calls the concept “Passage Retrieval.”</p>

<p class="has-light-gray-background-color has-background">(<strong>Note 2.)</strong> Although both concepts are often rendered with the same Chinese term, passage retrieval is the process by which Google finds content relevant to a query, while <a href="./how-search-engines-crawl.html">search engine crawling</a> is the process in which Google sends crawlers to webpages and retrieves their content.</p>

<h2>Closing Thoughts</h2>

<p>After BERT launched, I saw many people in the SEO field discussing how to optimize websites for BERT. Inevitably, I expected this update to prompt discussions about <em>what SEOs should do to optimize for passage retrieval</em>.</p>

<p>The purpose of this article was to introduce and explain the change: first, to cover this piece of news from the SEO field, and second, to help readers make better judgments when they encounter related SEO advice in the future. If you later hear someone say, “Google now uses passage retrieval, so websites need to do this or that for better SEO,” try asking yourself, “Is that really true?” and “Wouldn't an article already need those improvements regardless of this update?”</p>

<p>That is all for this introduction to passage retrieval. If anything is unclear or you have thoughts about the update, feel free to leave a comment and let me know!</p>

<div class="wp-block-genesis-blocks-gb-accordion gb-block-accordion gb-font-size-14"><details><summary class="gb-accordion-title">References</summary><div class="gb-accordion-text">
<ul><li><a href="https://www.youtube.com/watch?v=ZL5x3ovujiM&amp;feature=youtu.be&amp;t=1084">Search On video [18:04]</a></li><li><a href="https://www.seroundtable.com/google-passage-ranking-not-passage-indexing-30287.html">Search Engine Roundtable summary</a></li><li><a href="https://twitter.com/searchliaison/status/1318609606478680064">Explanation from Google SearchLiaison</a></li><li><a href="https://medium.com/datadriveninvestor/precision-recall-and-relevance-1d7ced4cacb5">Precision, Recall, and Relevance</a></li><li><a href="https://zhuanlan.zhihu.com/p/55588759">Zhihu — Applications of Semantic Analysis (Part 4): Question Answering</a></li><li>Paper — <a href="http://maroo.cs.umass.edu/pub/web/getpdf.php?id=541">Passage Retrieval and Evaluation</a></li><li><a href="https://www.youtube.com/watch?v=corkeW31Pr0">Video — Passage Retrieval and Answer Extraction</a></li></ul>
</div></details></div>

<p></p>
