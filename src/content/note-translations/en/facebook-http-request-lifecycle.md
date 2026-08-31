---
locale: en
sourceId: facebook-http-request-lifecycle
slug: facebook-http-request-lifecycle
translationKey: note:facebook-http-request-lifecycle
status: published
sourceHash: 46b2388bc49333f8d9d9dfccccf3c074a166b90768c67157d85a70bf8499cec5
reviewedAt: '2026-08-31'
title: 'What happens after entering the URL: from Request to Status Code'
excerpt:
  Use a simplified web page request process to understand how Request Headers, Response Headers and 2XX, 3XX, 4XX,
  and 5XX status codes describe the results of resources.
categories:
  - Web Technology
  - SEO
tags:
  - HTTP
  - Status Code
  - Request Headers
  - Response Headers
originalFacebookTagline: 輸入網址後發生什麼事：從 Request 到 Status Code
---

<img alt="HTTP Request Lifecycle’s Facebook post with image 1
Picture 2 of" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-http-request-lifecycle/225793264825290.jpg"/>

<img alt="HTTP Request Lifecycle’s Facebook post
Picture 3 of" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-http-request-lifecycle/225793274825289.jpg"/>

<img alt="HTTP Request Lifecycle’s Facebook post" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-http-request-lifecycle/225793261491957.jpg"/>

<img alt="HTTP Request Lifecycle’s Facebook post with image 4" decoding="async" loading="lazy" src="/images/facebook-notes/facebook-http-request-lifecycle/225793304825286.jpg"/>

After entering the URL in the browser and pressing Enter, the browser sends a request to the server, and the server sends back a response describing the status of the resource.

Request Headers will bring information such as User-Agent, target path, and supported compression methods.

Response Headers will describe the return file and server processing results, among which the Status Code is most commonly used by SEO workers.

2XX usually means success, 3XX means you need to go to another location, 4XX usually means there is a problem with the request or the resource itself, and 5XX usually means a server-side error occurred.

After understanding this basic process, 404, 301, HTTPS, cache and crawler are no longer separate terms, but different signals in the life cycle of the same web page request.
