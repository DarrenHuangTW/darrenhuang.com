# Bluehost 到 Cloudflare Registrar 移轉驗收

最後更新：2026-08-29。

這份清單用來在 registrar transfer pending 期間，重跑正式網站的公開可用性檢查。
它把可由匿名 HTTP 請求驗證的網站行為，和必須登入 Cloudflare、Bluehost、GitHub 或郵件服務才能確認的狀態分開。

## 一鍵自動檢查

在 repository 根目錄執行：

```powershell
npm run verify:production
```

這個命令只發出帶有明確 user agent 的 `GET` 請求，並在每個請求套用 15 秒 timeout。
它不會修改 registrar、DNS、Cloudflare zone、GitHub Pages 設定、郵件設定或任何遠端資料。

它會檢查：

- HTTP requests to the apex and `www` hosts, plus an HTTPS apex root request, must use permanent redirects to the canonical HTTPS `www` host.
- 非 canonical host 的 redirect 是否保留 path 與 query。
- The HTTPS apex `robots.txt` exception is checked separately because Cloudflare Managed `robots.txt` can return a valid `200` policy with an exact canonical `Location` header instead of a redirect status.
- `https://www.darrenhuang.com/` 是否以 HTTPS 直接回傳 HTML `200`。
- `https://darrenhuangtw.github.io/darrenhuang.com/` 是否可用，或以永久 redirect 指向正式 custom domain。
- 正式 host 的 `robots.txt` 是否回傳 `text/plain`、允許 wildcard crawler、沒有 wildcard `Disallow: /`，並指向正式 sitemap。
- sitemap index 與其 child sitemap 是否回傳有效 XML、只列出正式 HTTPS host，且包含所有代表性頁面。
- 首頁、文章列表、About、代表性文章與一篇 Web Story 是否回傳 HTML `200`、沒有 `noindex`，並指向正確 canonical URL。

自動檢查通過只代表目前從執行命令的網路位置觀察到的公開 HTTP 行為正常。
它不能證明 registrar transfer 已完成，也不能證明 DNS zone、DNSSEC 或 email 服務仍然正確。

## 必須人工確認的 registrar gate

在 Cloudflare Registrar dashboard 確認 `darrenhuang.com` 的 transfer 狀態已由 pending 變成 completed 或 equivalent completed state。
保留 Bluehost 的 transfer approval、release 或 Form of Authorization 信件作為證據。
不要把 `Your Domain Transfer Authorization Code` 當成 transfer 完成證明；那只是提交 transfer 所需的 EPP／auth code。
確認 registrar 顯示的到期日、auto-renew 與 domain lock 狀態符合預期。
確認 Cloudflare Registrar 顯示的 registrant、privacy、billing contact 與 renewal 設定正確。
在上述確認完成以前，不要取消 Bluehost domain、hosting、email 或任何仍可能承載 DNS／mail 的服務。

## 必須人工確認的 DNS gate

在 Cloudflare 匯出或保存目前 zone records，並將移轉前後的 record inventory 逐筆比較。
從至少兩個不同行動網路或外部 resolver 查詢 `darrenhuang.com` 與 `www.darrenhuang.com` 的 A、AAAA、CNAME、CAA 與 TXT 結果。
確認 authoritative nameservers 仍然是 Cloudflare 顯示的 nameservers，而不是 Bluehost nameservers。
確認 apex 與 `www` 的 proxied／DNS-only 狀態、GitHub Pages custom domain、redirect rule 與 SSL/TLS mode 都符合預期。
確認 DNSSEC 的 DS、DNSKEY 與 Cloudflare 設定互相一致；如果沒有使用 DNSSEC，也要明確記錄為未啟用。
確認 Google、Bing、GitHub Pages 與其他仍在使用的 verification TXT records 沒有被刪除。
確認沒有把舊 Bluehost origin、cPanel、FTP 或 webmail records 誤當成新的網站 origin。
在不同 resolver 的 TTL 逐步收斂前，持續保留舊服務與可回復的 DNS 備份。

匿名 HTTP 檢查可以看到 redirect 和內容，但不能可靠地判斷 nameserver delegation、DNSSEC chain、Cloudflare zone ownership、record provenance 或 resolver propagation 是否完整。

## 必須人工確認的 email gate

先確認目前是否仍有任何人使用 `@darrenhuang.com` 信箱、alias、forwarder、catch-all、SMTP credential 或應用程式寄信設定。
如果仍有使用者，從外部信箱寄信到每個重要收件地址，並從每個重要地址回信到外部信箱。
確認 MX records 指向仍在使用的 mail provider，並確認 SPF、DKIM selector 與 DMARC policy／reporting records 正確。
檢查寄件服務的 DKIM signature、SPF pass、DMARC alignment、反向 DNS 與 bounce queue。
確認 Bluehost webmail、cPanel forwarder、mailbox quota、archive 與舊信件已完成保留或遷移。
確認網站 contact form、交易通知、GitHub Actions、analytics alerts 或其他 automation 沒有使用已停用的 Bluehost SMTP。
確認至少一輪外寄、內寄、附件與退信測試成功後，才可以評估取消 Bluehost email 相關服務。

網站 verifier 不會登入 mailbox、發送測試信、讀取郵件、查詢第三方 mail dashboard 或修改 MX／TXT records。

## 完成判定

只有在 `npm run verify:production` 通過，Cloudflare Registrar 顯示 transfer completed，DNS record 與 delegation 比對完成，且 email 收發測試成功後，才可把 registrar transfer 視為完成。
Bluehost hosting、email 與 domain registrar 是不同產品；完成其中一項不代表另外兩項可以取消。
每次重跑請記錄執行日期、網路位置、自動檢查結果與人工 gate 的截圖或 dashboard reference。
