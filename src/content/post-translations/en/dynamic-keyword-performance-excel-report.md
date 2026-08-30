---
locale: en
sourceId: dynamic-keyword-performance-excel-report
slug: dynamic-keyword-performance-excel-report
translationKey: post:dynamic-keyword-performance-excel-report
status: published
sourceHash: 7639921c6b968f98468de4ea8380ff938fa0076b0cbd2c8a7a866ab17509c6da
reviewedAt: 2026-08-30T15:00:00+08:00
title: Build a Dynamic Keyword Performance Report in Excel
excerpt: This article shows you how to build an Excel worksheet that automatically filters its results after you enter one or more criteria.
categories:
  - Uncategorized
tags:
  - Uncategorized
---

<!-- English translation of the original article. -->

This article will show you how to build an Excel worksheet that automatically filters its results after you enter one or more criteria.

My original goal was to analyze 2016 keyword performance for one of my company's PPC accounts.
For example:
<ul>
    <li>Which keywords had more than 3 conversions and a CPL below $30?</li>
    <li>Which keywords had a CPL above $100 and an average position above 3?</li>
    <li>Which keywords had between 1 and 3 conversions, a CPL above $150, and an average position below 3?</li>
</ul>
The file automatically lists the results matching the values entered above, as shown below:

<a href="./wp-content/uploads/2017/02/dynamic-keyword-report-preview3.gif"><img class="aligncenter wp-image-250 size-full" src="./wp-content/uploads/2017/02/dynamic-keyword-report-preview3.gif" alt="Preview of the dynamic keyword performance report" width="1600" height="716" loading="lazy" decoding="async"></a>

&nbsp;

Although this example applies the method to paid-search keyword analysis, once you understand it, applying it elsewhere or adding more filter criteria will not be difficult!
I will walk through the implementation step by step below.
<a href="https://drive.google.com/file/d/0B1BdomfzSCERUlQ3NkdFMDdFQTQ/view?usp=sharing" target="_blank" rel="noopener noreferrer">Download the file here</a>!
<h2>Step One: Raw Data</h2>
<a href="./wp-content/uploads/2017/01/Raw-Data.jpg"><img class="aligncenter size-full wp-image-228" src="./wp-content/uploads/2017/01/Raw-Data.jpg" alt="Raw keyword performance data" width="1831" height="466" loading="lazy" decoding="async"></a>

The starting data looks perfectly ordinary, just like a typical export from AdWords or another tool.
Because this was work-related, I replaced the real keywords, ad groups, and campaigns with other content~

(The client was a company in mainland China... so I used Simplified Chinese. Please excuse that!)
<h2>Step Two: Choose the Filter Criteria</h2>
Here, you need to think about how dividing the data would make the analysis useful.
Some people may want to filter by CTR, while others may want to filter by time; there is no absolute right or wrong answer.

I chose website conversions, CPL, and position as the basis for my filters!

<a href="./wp-content/uploads/2017/01/determine-filter-criteria.jpg"><img class="aligncenter size-full wp-image-230" src="./wp-content/uploads/2017/01/determine-filter-criteria.jpg" alt="Choosing the filter criteria" width="776" height="132" loading="lazy" decoding="async"></a>
<h2>Step Three: Create Helper Column I</h2>
We need three helper columns to produce the result we want.
The first helper column assigns a numeric ID to every keyword using this formula:
<p style="padding-left:30px"><code>=ROWS($M$9:M9)</code></p>
<a href="./wp-content/uploads/2017/01/helper-column-1.png"><img class="aligncenter size-full wp-image-231" src="./wp-content/uploads/2017/01/helper-column-1.png" alt="Helper column I" width="1182" height="716" loading="lazy" decoding="async"></a>
<div id="helper2"></div>
If you are wondering why we do not simply enter 1 in M8 and 2 in M9, then drag down to number every keyword, there is a reason!
That method would cause problems if we added more rows to the source data later.
<h2>Step Four: Create Helper Column II*</h2>
Helper Column II is our criteria column, and it is the most important one.

We will begin with a simple condition.
After confirming that it works, we will return and make the criteria more sophisticated.

<a href="./wp-content/uploads/2017/01/helper-column-2-1.png"><img class="aligncenter size-full wp-image-233" src="./wp-content/uploads/2017/01/helper-column-2-1.png" alt="Helper column II" width="1442" height="518" loading="lazy" decoding="async"></a>

The formula in N9 is:
<p style="padding-left:30px"><code>=IF(J9&gt;=$S$4,M9,"")</code></p>
This means that if the value in the website conversions column (J) is greater than 1 (S4), the formula returns the value from Helper Column I (M); otherwise, it returns a blank ("").

<a href="./wp-content/uploads/2017/01/helper-column-2-2.png"><img class="aligncenter size-full wp-image-234" src="./wp-content/uploads/2017/01/helper-column-2-2.png" alt="Helper column II returning matching keyword IDs" width="1447" height="694" loading="lazy" decoding="async"></a>

The image above shows that when website conversions are greater than or equal to our chosen threshold, Helper Column II returns that keyword's ID from Helper Column I.
If we change S4 to 2, only keyword ID 1292 remains in Helper Column II.
<h2>Step Five: Create Helper Column III</h2>
The purpose of Helper Column III is to remove all the blank cells in Helper Column II, leaving only the IDs of keywords that meet the condition (more than 1 website conversion).
The formula is:
<p style="padding-left:30px"><code>=IFERROR(SMALL($N$9:$N$3449,M9),"")</code></p>
In plain English, this formula selects the smallest value in column N for O9, the second-smallest for O10, the third-smallest for O11, and so on.
After it reaches the largest value in column N—the last one that meets the criteria—it returns a blank ("").

<a href="./wp-content/uploads/2017/01/helper-column-3.png"><img class="aligncenter size-full wp-image-235" src="./wp-content/uploads/2017/01/helper-column-3.png" alt="Helper column III" width="1036" height="702" loading="lazy" decoding="async"></a>

If you already know the basics of Excel, you may have guessed the next step by now!
The purpose of these three helper columns is to identify the rows containing every keyword that meets the criteria.
The idea is the same as INDEX+MATCH: once we know which row each result is in, the dynamic table can use INDEX to retrieve the data.
<h2>Step Six: The Dynamic Table!</h2>
In this step, we build the final table that will be displayed.
The formula uses INDEX, treating the source data as one large array, while HELPER3 lists the matching keywords one by one.

<a href="./wp-content/uploads/2017/02/dynamic-table-step-1.png"><img class="aligncenter size-full wp-image-238" src="./wp-content/uploads/2017/02/dynamic-table-step-1.png" alt="First step in building the dynamic table" width="1638" height="608" loading="lazy" decoding="async"></a>
<p style="padding-left:30px"><code>=INDEX($B$9:$O$3449,$O9,COLUMNS($R$9:R9))</code></p>

<ol>
    <li>$B$9:$O$3449 is the range containing all the source data, including the three helper columns.</li>
    <li>$O9 is the number in Helper Column III—in other words, the row within this range that contains a keyword matching our criteria. We lock column O so that when we drag the formula to the right, it still looks only at the value in O, while dragging it down moves to the next matching keyword, and so on.</li>
    <li>COLUMNS($R$9:R9) uses the same idea as Helper Column I. After we drag the formula to the right, column S displays Ad Group, T displays Campaign, U displays Impressions, and so on.</li>
</ol>
<a href="./wp-content/uploads/2017/02/dynamic-table-step-2.png"><img class="aligncenter size-full wp-image-239" src="./wp-content/uploads/2017/02/dynamic-table-step-2.png" alt="Completed dynamic table" width="1850" height="650" loading="lazy" decoding="async"></a>

Finally, if INDEX does not find anything because the value that HELPER3 is looking for is blank, it returns an ugly #VALUE! error.
We therefore wrap it in IFERROR so that the formula returns "" when INDEX finds nothing.
The final formula is:
<p style="padding-left:30px"><code>=IFERROR(INDEX($B$9:$O$3449,$O9,COLUMNS($R$9:R9)),"")</code></p>

<h2>Step Six: Add More Filter Criteria</h2>
At this point, our dynamic worksheet is complete, but it can currently evaluate only one “condition”: it can select only website conversions greater than or equal to the number in S4.
That is not especially useful, so we need to return to <a href="#helper2">Helper Column II</a> and enhance its formula so that it can evaluate multiple conditions at once.
<p style="padding-left:30px"><code>=IF(J9&gt;=$S$4,M9,"")</code></p>
The formula above contains only one condition: whether J9 is greater than or equal to S4.
To add more conditions in Excel, we simply use the AND and OR functions:
<h3>AND</h3>
<a href="./wp-content/uploads/2017/02/more-criteria-1.png"><img class="aligncenter wp-image-243 size-full" src="./wp-content/uploads/2017/02/more-criteria-1.png" alt="Adding criteria with the AND function" width="996" height="206" loading="lazy" decoding="async"></a>

Suppose we want to filter for results with at least 2 but fewer than 4 website conversions.
The formula in Helper Column II becomes the following.
Only when both J9&gt;=$S$4 and J9&lt;$S$5 are true does the IF formula return M9; otherwise, it returns a blank ("").
<p style="padding-left:30px"><code>=IF(AND(J9&gt;=$S$4,J9&lt;$S$5),M9,"")</code></p>

<h3>OR</h3>
The formula above has a small bug.
When no value is entered in S5, the number in column J will always be greater than the blank cell ("").
Suppose a keyword has 3 conversions, we enter 2 in S4, and leave S5 blank.
AND(3&gt;=S4,3&lt;S5) returns FALSE because the conversions column (J) in the source data always contains a number (0, 1, 2, 3, 4, and so on), and a number will always be considered greater than a blank cell.

To avoid this result, we can make the formula above slightly more complex:
<p style="padding-left:30px"><code>=IF(AND(J9&gt;=$S$4,OR(J9&lt;$S$5,$S$5=""),M9,"")</code></p>
Now the condition OR(J9&lt;$S$5,$S$5="") returns TRUE when S5 is blank, because an OR expression is true whenever either of its two conditions is true ($S$5="").
<h3>Mix</h3>
Once we know how to use AND and OR, we can add as many comparison criteria as we want.
At the beginning of the article, I selected three values to compare, so the final formula in Helper Column II becomes:

<a href="./wp-content/uploads/2017/02/more-criteria-2.jpg"><img class="aligncenter size-full wp-image-244" src="./wp-content/uploads/2017/02/more-criteria-2.jpg" alt="Combining multiple filter criteria" width="1654" height="553" loading="lazy" decoding="async"></a>
<p style="padding-left:30px"><code>=IF(AND(J9&gt;=$S$4,OR(J9&lt;$S$5,$S$5=""),K9&gt;=$T$4,OR(K9&lt;$T$5,$T$5=""),L9&gt;$U$4,OR(L9&lt;$U$5,$U$5="")),M9,"")</code></p>
It looks a little complicated, but this string is nothing more than a combination of AND and OR expressions that ultimately returns either TRUE or FALSE.
<h2>Step Seven: A Few Simple Improvements</h2>
That brings the main work to an end.
Everything left is just a matter of simple refinement and appearance.
You can hide columns A through O because users do not need to see them.

You can also add a “count” at the top so that users can clearly see how many keywords meet the selected criteria.
The formula is:
<p style="padding-left:30px"><code>=COUNTIF(R9:R3449,"?*")</code></p>
<a href="./wp-content/uploads/2017/02/last-step.jpg"><img class="aligncenter size-full wp-image-245" src="./wp-content/uploads/2017/02/last-step.jpg" alt="Final dynamic keyword report with result count" width="1553" height="700" loading="lazy" decoding="async"></a>
<h2>Summary</h2>
I would not claim that this is absolutely the best method, but it is a small lesson from my own work that I wanted to share.
I hope it comes in handy for you someday.
If you have questions, suggestions, or feedback, feel free to leave a comment below or email me.
Thank you for reading!
