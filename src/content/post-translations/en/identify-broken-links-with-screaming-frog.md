---
locale: en
sourceId: identify-broken-links-with-screaming-frog
slug: identify-broken-links-with-screaming-frog
translationKey: post:identify-broken-links-with-screaming-frog
status: published
sourceHash: 55b770a3ec8646b0688428dca8463e0f84c6776c107f913dde9cee555eef0d0f
reviewedAt: 2026-08-30T15:00:00+08:00
title: How to Find 404 Pages on a Website with Screaming Frog
excerpt: >-
  4XX pages are an essential part of any SEO audit.
  This article shows you how to use the powerful Screaming Frog SEO tool to find broken links across a website.
categories:
  - Uncategorized
tags:
  - Uncategorized
---

<!-- English translation of the original article. -->

When conducting an SEO audit, a website's 4XX pages are an essential area to examine.
One of my standard first steps with a new client is to provide a report showing which links on the site are broken and which pages contain them.
This article will show you how to use Screaming Frog, a powerful SEO tool, to find broken links on a website.

<a href="./wp-content/uploads/2017/02/screaming-frog.png"><img class="aligncenter wp-image-254" src="./wp-content/uploads/2017/02/screaming-frog.png" alt="Screaming Frog logo" width="484" height="165" loading="lazy" decoding="async"></a>

If you are familiar with Screaming Frog, you might be thinking, “Wait, don't you just enter the URL and let it run?”
Yes, that is true, but one frequently overlooked issue is the 301 redirect.
Sometimes the crawl results show that a link redirects to another page, which then redirects again with a 301 to a 404 page.
This is known as a redirect chain, and this kind of 404 page is much less obvious.

If you have never heard of Screaming Frog or are not familiar with it, it is a crawler.
Enter a URL (for example, www.darrenhhuang.com), and this little frog follows the links on the site and begins crawling it.
It then returns all the data it collects, including each page's title and description, image alt tags and file sizes, and the server code returned by each outgoing link mentioned above.
It is extremely useful.
I will introduce the product in a little more detail at the end of the article, and I will write more about its practical applications in future posts.
<h2>Introduction</h2>
This article uses the website of Taiwan Startup Stadium (<a href="http://www.startupstadium.tw/" target="_blank" rel="noopener noreferrer">http://www.startupstadium.tw/</a>) as an example.
There was no special reason for choosing it: I happened to come across the site and really liked what the organization was doing.
Of course, if this could also help them fix a few small issues on the site and improve the user experience, that would be even better!
<h2>Direct 404 Pages</h2>
<a href="./wp-content/uploads/2017/02/crawl-startupstadium.tw_.png"><img class="aligncenter size-full wp-image-257" src="./wp-content/uploads/2017/02/crawl-startupstadium.tw_.png" alt="Screaming Frog crawl of startupstadium.tw" width="1920" height="1080" loading="lazy" decoding="async"></a>
<ol>
    <li>Enter the website in Screaming Frog and let it crawl.</li>
    <li>On the right, select pages with a Response Code of 4XX. Here, you can see that 17 nonexistent pages were found.</li>
    <li>The URLs of these 17 pages and some other data appear on the left.<a href="./wp-content/uploads/2017/03/Export-404-and-inlinks.jpg"><img class="aligncenter size-full wp-image-262" src="./wp-content/uploads/2017/03/Export-404-and-inlinks.jpg" alt="Exporting 404 pages and their inlinks from Screaming Frog" width="1279" height="610" loading="lazy" decoding="async"></a></li>
    <li>Next, go to Bulk Export &gt; Response Codes &gt; Client Error (4xx) Inlinks and export “these pages and the pages that link to them.”</li>
</ol>
<a href="./wp-content/uploads/2017/03/exported-404-page.png"><img class="aligncenter size-full wp-image-263" src="./wp-content/uploads/2017/03/exported-404-page.png" alt="Exported 404 pages in Excel" width="1866" height="288" loading="lazy" decoding="async"></a>
<ul>
    <li><strong>Destination</strong>: Tells you which page does not exist.</li>
    <li><strong>Source</strong>: Indicates the Startup Stadium page where the link to the nonexistent page was found.</li>
    <li><strong>Type</strong>: Identifies the type of link, such as a broken hyperlink (HREF), a missing referenced image (IMG), or another cause.</li>
</ul>
<a href="./wp-content/uploads/2017/03/invalid-link-example.png"><img class="aligncenter size-full wp-image-264" src="./wp-content/uploads/2017/03/invalid-link-example.png" alt="Example of a broken link" width="1458" height="768" loading="lazy" decoding="async"></a>

<a href="./wp-content/uploads/2017/03/404-pages.png"><img class="aligncenter size-full wp-image-265" src="./wp-content/uploads/2017/03/404-pages.png" alt="Example of a 404 page" width="1222" height="826" loading="lazy" decoding="async"></a>

This lets us find and fix broken links on the website!
<h2>Indirect 404 Pages (Redirect Chains to 404s)</h2>
After finding pages that return a direct 404 error, the next step is to find indirect 404 pages, which are easy to overlook.
As mentioned at the beginning of the article, these links are less obvious because crawler tools such as Screaming Frog do not directly report a 4XX server code for them.
They only tell you that the links were redirected somewhere else with a 3XX response.

Where were they redirected?
It could be a page that returns 200, a page that returns 404, or another 301 page that ultimately leads to a 404 page.

<a href="./wp-content/uploads/2017/03/redirects-from-screaming-frog.png"><img class="aligncenter size-full wp-image-269" src="./wp-content/uploads/2017/03/redirects-from-screaming-frog.png" alt="Redirects shown in Screaming Frog" width="1816" height="1009" loading="lazy" decoding="async"></a>
<ol>
    <li>As before, enter the URL and then select Redirects (3XX) on the right. You can see that there are 151.</li>
    <li>The data for these 151 links that return a 3XX server code appears on the left.</li>
    <li>Next, choose Export at the top to export the data and see where these links redirect.<a href="./wp-content/uploads/2017/03/exported-301-pages.png"><img class="aligncenter size-full wp-image-271" src="./wp-content/uploads/2017/03/exported-301-pages.png" alt="Exported 301 redirect pages" width="1442" height="442" loading="lazy" decoding="async"></a></li>
    <li>Select the URLs in column A, return to Screaming Frog, switch the mode to “List&nbsp;Mode,” and paste them in.<a href="./wp-content/uploads/2017/03/Screaming-Frog-List-Mode.jpg"><img class="aligncenter wp-image-272" src="./wp-content/uploads/2017/03/Screaming-Frog-List-Mode.jpg" alt="Screaming Frog List Mode" width="600" height="178" loading="lazy" decoding="async"></a></li>
    <li>Go to Configuration-&gt;Spider-&gt;Advanced-&gt;Always Follow Redirects, check the box, and then click Start.<a href="./wp-content/uploads/2017/03/always-follow-redirects.png"><img class="aligncenter size-full wp-image-274" src="./wp-content/uploads/2017/03/always-follow-redirects.png" alt="Always Follow Redirects setting in Screaming Frog" width="638" height="678" loading="lazy" decoding="async"></a></li>
    <li>When the crawl is finished, go to Reports-&gt;Redirect Chains and export the spreadsheet.<a href="./wp-content/uploads/2017/03/export-redirect-chain-sheet.jpg"><img class="aligncenter size-full wp-image-273" src="./wp-content/uploads/2017/03/export-redirect-chain-sheet.jpg" alt="Exporting the Redirect Chains report from Screaming Frog" width="545" height="278" loading="lazy" decoding="async"></a></li>
    <li>After exporting, you will see an Excel file like the one below. Here, you can see:
<ul>
    <li>The link in row 47 redirects with a 301 to another URL that returns 404.</li>
    <li>The link in row 51 redirects with a 301 to another URL, which redirects again with a 301 to a URL that returns 200.</li>
</ul>
<a href="./wp-content/uploads/2017/03/Redirect-Chain.png"><img class="aligncenter size-full wp-image-280" src="./wp-content/uploads/2017/03/Redirect-Chain.png" alt="Redirect chain report" width="1416" height="412" loading="lazy" decoding="async"></a></li>
    <li>Finally, cross-reference these results with the data exported in step 3 to identify which 3XX links ultimately lead to 404 pages!</li>
</ol>
<h2>Additional Note 1: Server Codes</h2>
This article sometimes uses 4XX and 3XX, and at other times uses 404 and 301.
I hope that has not been too confusing!&nbsp;These three-digit numbers are the <strong>server codes</strong> we receive when requesting a URL from a server:
<ul>
    <li>200 means everything is working correctly.</li>
    <li>3XX means a redirect: the URL A that we requested has moved to URL B.</li>
    <li>4XX means a client-side error: the URL we requested does not exist.</li>
    <li>5XX means a server-side error: the server was unable to respond to our request.</li>
</ul>
There are different types of server codes—301, 302, 403, 404, 410, and so on.
For readability, I use some of these terms interchangeably: when I say 301, I really mean all types of redirects (3XX), and when I say 404, I really mean all types of client errors (4XX)~
<h2>Additional Note 2: Screaming Frog</h2>
This <a href="https://www.screamingfrog.co.uk/seo-spider/" target="_blank" rel="noopener noreferrer">Screaming Frog</a> is a tool that practically everyone in the SEO world knows!
The free version can crawl only 500 links, while the paid version costs £149 per year.
Besides finding broken links as described in this article, it can also...
<ul>
    <li>Check whether every page on a website has the GA code installed.</li>
    <li>List the metadata for every page, including title, description, canonical, and more.</li>
    <li>Check whether the URLs in a sitemap are correct.</li>
    <li>Check for image files that are too large.</li>
</ul>
<h2>Conclusion</h2>
I hope anyone patient enough to finish this very long article learned something!
If you have a website but cannot afford Screaming Frog, feel free to leave a comment below~
In exchange, leave <strong>your URL</strong> and <strong>one or two SEO topics you would like to see covered on this blog</strong>, and I will gladly spend some time checking your site for broken links!

If I do not respond within two days, please email me at darrenhhuang@gmail.com.
Thank you again for reading!
