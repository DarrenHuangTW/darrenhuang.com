import type { Locale } from '@/i18n/config';

const zhHantMessages = {
  baseLayout: {
    defaultDescription: '數位行銷、SEO、內容策略與科技趨勢的長期觀察。',
    defaultOgImageAlt: 'Darren Huang｜數位引擎',
    markdownAlternateTitle: (title: string) => `${title}（Markdown）`,
    pageTitle: (title: string, brand: string) =>
      title === brand
        ? `${brand} by Darren Huang`
        : `${title}｜${brand} by Darren Huang`,
    rssTitle: '數位引擎 RSS',
    skipToMain: '跳到主要內容',
  },
  navigation: {
    about: '關於',
    articles: '文章',
    home: '首頁',
    homeAria: '數位引擎首頁',
    notes: '筆記',
    primaryAria: '主要導覽',
    tags: '標籤',
  },
  languageSwitcher: {
    ariaLabel: '語言選擇',
    switchTo: (language: string) => `切換為${language}`,
  },
  footer: {
    agentDescription:
      '如果你要研究數位引擎的公開內容，可以直接使用下列文件與唯讀介面，不需要登入、API key 或瀏覽器 JavaScript。',
    agentLinks: {
      apiDescription: '公開文章與保存筆記的唯讀 JSON API。',
      developersDescription: '快速了解 API、MCP、WebMCP 與版本政策。',
      developersLabel: '開發者與 Agent 入口',
      llmsDescription: '網站定位、內容索引與 agent 使用說明。',
      mcpDescription: '公開 MCP endpoint 與兩個 read-only tools。',
    },
    contact: '聯絡',
    copyright: (year: number) => `© ${year} Darren Huang．數位引擎`,
    developerHeading: '給開發者與 Agent 的公開入口',
    navigationAria: '頁尾導覽',
    privacy: '隱私',
  },
  cards: {
    note: {
      historical: '歷史保存',
      read: '閱讀筆記',
      readAria: (title: string) => `閱讀〈${title}〉`,
      siteNote: '數位引擎筆記',
      statusPublished: '已整理',
      statusReview: '草稿審核中',
    },
    post: {
      read: '閱讀文章',
      readAria: (title: string) => `閱讀〈${title}〉`,
    },
  },
  reading: {
    imageLightbox: {
      closeAria: '關閉圖片預覽',
      enlargeAria: (alt: string) => (alt ? `放大圖片：${alt}` : '放大圖片'),
      openOriginal: '開啟原圖',
      previewAria: '圖片預覽',
    },
    tableOfContents: {
      ariaLabel: '本文目錄',
      sectionCount: (count: number) => `${count} 個段落`,
      title: '本文目錄',
    },
  },
  relatedContent: {
    eyebrow: 'Keep exploring',
    noteType: 'Facebook 保存筆記',
    postType: '網站文章',
    title: '延伸閱讀',
  },
  articleJourney: {
    allArticles: '全部文章',
    eyebrow: 'Keep exploring',
    nextIssue: '下一期',
    previousIssue: '上一期',
    readArticle: '閱讀文章',
    readArticleAria: (title: string) => `閱讀〈${title}〉`,
    relatedArticles: '相關文章',
    seriesAria: (series: string) => `${series}系列導覽`,
    title: '繼續閱讀',
  },
  article: {
    categories: '分類',
    eyebrow: '數位引擎文章',
    historicalTranslationNotice: (publishedDate: string) =>
      `本文原於 ${publishedDate} 以中文發布。英文翻譯保留當時的原始脈絡；文中的產品、介面與政策可能已經改變。`,
    readingTime: (minutes: number) => `約 ${minutes} 分鐘`,
    reviewBanner: '這是本地英文翻譯審核稿，尚未列入正式網站與內容索引。',
    tags: '標籤',
    updatedAt: (date: string) => `更新於 ${date}`,
  },
  note: {
    categories: '分類',
    editorialStatusAria: '編輯狀態',
    eyebrow: '數位引擎筆記 · Facebook 保存',
    mentionedLinks: '原文提到的連結',
    organizedAt: (date: string) => `整理於 ${date}`,
    originalFacebookByline: '原始分享於數位引擎 Facebook',
    readingTime: (minutes: number) => `約 ${minutes} 分鐘`,
    reviewBanner: '這是本地審核草稿，尚未列入正式內容索引。',
    sourceContext:
      '這篇內容保留 Facebook 貼文的原始脈絡，部分工具、介面與外部連結可能已經改變。',
    sourceHeading: '來源註記',
    tags: '標籤',
    translationNotice:
      '原文以中文發布於 Facebook。這份英文翻譯保留原貼文的脈絡，連結的社群貼文仍為中文。',
    viewOriginal: '查看原始貼文',
  },
  media: {
    embeds: {
      generic: '開啟外部內容',
      spotifyOpen: '在 Spotify 開啟原始內容',
      spotifyTitle: 'Spotify 音訊',
      twitterOpen: '在 X／Twitter 查看原始貼文',
      youtubeOpen: '在 YouTube 開啟原始影片',
      youtubeTitle: 'YouTube 影片',
    },
    photoCarousel: {
      defaultLabel: 'Darren Huang 的活動照片',
      dotAria: (index: number) => `前往第 ${index} 張照片`,
      dotsAria: '選擇照片',
      nextAria: '下一張照片',
      previousAria: '上一張照片',
      slideAria: (index: number, total: number) =>
        `第 ${index} 張，共 ${total} 張`,
      status: (index: number, total: number) =>
        `第 ${index} 張，共 ${total} 張`,
    },
  },
  home: {
    hero: {
      headingBeforeEmphasis: '讓寫過的內容，',
      headingEmphasis: '繼續被找到',
      kicker: 'SEO · AI · Automation · UI／UX',
      lede: '我是 Darren Huang，一位轉換到 AI 賽道的 SEO 人。這裡收錄過去寫下的 SEO、網站分析、Python、UI／UX 與數位行銷文章，也留下一些關於數位產品與科技文化的觀察。',
      panelBody: '關於搜尋、內容、網站、產品，以及科技如何影響工作與生活。',
      panelTitle: '一些實作，一些觀察。',
    },
    notes: {
      description:
        '把社群裡值得長期閱讀的觀察，整理成可以和文章互相參照的內容。',
      title: 'Facebook 保存筆記',
      viewAll: (count: number) => `查看全部 ${count} 篇`,
    },
    posts: {
      description: '從搜尋與內容策略，到數位產品與科技文化。',
      emptyBody: 'Astro 架構已就緒，WordPress 文章會由可重跑 importer 產生。',
      emptyTitle: '內容正在匯入',
      title: '文章紀錄',
      viewAll: (count: number) => `查看全部 ${count} 篇`,
    },
    schemaDescription: '數位行銷、SEO、內容策略與科技趨勢的繁體中文長期觀察。',
    title: '數位引擎',
  },
  articles: {
    count: (count: number) =>
      `共 ${count} 篇文章，依原始發佈日期由新到舊排列。`,
    description: '數位引擎完整文章列表。',
    eyebrow: 'Archive',
    title: '全部文章',
  },
  notes: {
    browseChinese: '瀏覽中文原始筆記',
    description: '從數位引擎 Facebook 保存下來的技術筆記、實驗與個人觀察。',
    eyebrow: 'Facebook Archive',
    intro: '把適合長期保存的社群內容整理成可閱讀、可搜尋、也能繼續更新的筆記。',
    reviewBanner: '目前顯示的是本地審核草稿，這些內容尚未列入正式網站索引。',
    statsAria: '筆記統計',
    statsLabel: '篇本地保存內容',
    title: '數位引擎筆記',
    translationPending: '英文翻譯將在後續批次加入。',
  },
  taxonomy: {
    categories: {
      description: '依分類瀏覽數位引擎文章。',
      detailCount: (count: number) => `共 ${count} 篇文章與筆記。`,
      detailDescription: (category: string) =>
        `數位引擎的「${category}」分類文章。`,
      detailTitle: (category: string) => `分類：${category}`,
      eyebrow: 'Categories',
      intro: '文章與 Facebook 保存筆記的主要內容分類。',
      noteGroupTitle: 'Facebook 保存筆記',
      title: '分類',
    },
    tags: {
      description: '依標籤瀏覽數位引擎文章。',
      detailCount: (count: number) => `共 ${count} 篇文章與筆記。`,
      detailDescription: (tag: string) => `數位引擎的「${tag}」相關文章。`,
      detailTitle: (tag: string) => `標籤：${tag}`,
      eyebrow: 'Topics',
      intro: '依主題探索完整文章與 Facebook 保存筆記。',
      noteGroupTitle: 'Facebook 保存筆記',
      title: '標籤',
    },
  },
  about: {
    coffeeChat: {
      bodyBeforeEmail:
        '如果你有 SEO、AI、自動化或職涯顧問需求，都歡迎找我 Coffee Chat，線上也可以！可以直接寫信到',
      title: '歡迎 Coffee Chat',
    },
    digitalEngine: {
      bodyAfterLink:
        '是我過去經營的 Facebook 專頁。現在因時間考量已經停更，不過仍保留大量實用的 SEO 與數位行銷資訊，歡迎當作資料庫慢慢翻閱。',
      linkLabel: '數位引擎',
      title: '關於數位引擎',
    },
    introduction: {
      career:
        '工作上，我是一位轉換到 AI 賽道的 SEO 人。這裡的文章大多是過去所寫，內容涵蓋 SEO、網站分析、Python、UI／UX 與數位行銷；我把它們保留下來，當作一路走來的紀錄，也希望其中仍有一些資訊能對你有幫助。',
      greeting:
        '歡迎來到我的網站！我曾在美國生活 8 年，陸續住過波士頓、紐約與矽谷。在美國期間曾於 WeWork 擔任 SEO Strategist，也曾是 Google 站長論壇的產品專家。',
      residenceAfterDiary: '，歡迎 follow！',
      residenceBeforeDiary:
        '現在我已搬回台灣，平時定居高雄，任職於澳洲公司，採全遠距工作。我和太太兩人都是數位游牧者，也會四處旅居，並一起經營',
      title: '你好，我是 Darren',
    },
    photos: {
      danny: {
        alt: 'Darren Huang 與 Danny Sullivan 在 2018 年 Google Product Experts Summit 合影',
        caption:
          '2018 年 Google Product Experts Summit，與 Danny Sullivan 合影。',
      },
      eric: {
        alt: 'Darren Huang 與 Eric Enge 於 2017 年在波士頓合影',
        caption: '2017 年在波士頓，與 Eric Enge 合影。',
      },
      gary2017: {
        alt: 'Darren Huang 與 Gary Illyes 於 2017 年在波士頓合影',
        caption: '2017 年在波士頓，與 Gary Illyes 合影。',
      },
      gary2024: {
        alt: 'Darren Huang 於 2024 年與 Gary Illyes、Terence、Cherry 合影',
        caption: '2024 年與 Gary Illyes、Terence、Cherry 合影。',
      },
      john: {
        alt: 'Darren Huang 與 John Mueller 於 2017 年合影',
        caption: '2017 年與 John Mueller 合影。',
      },
      paul: {
        alt: 'Darren Huang 與 Paul Haahr 在 2018 年 Google Product Experts Summit 合影',
        caption: '2018 年 Google Product Experts Summit，與 Paul Haahr 合影。',
      },
      rand: {
        alt: 'Darren Huang 與 Rand Fishkin 在 2016 年 SearchLove Boston 合影',
        caption: '2016 年 SearchLove Boston，與 Rand Fishkin 合影。',
      },
      summit: {
        alt: 'Darren Huang 參與 2018 年 Google Product Experts Summit',
        caption: '2018 年參與 Google Product Experts Summit。',
      },
    },
    schema: {
      digitalEngineDescription:
        'Darren 過去經營的 SEO 與數位行銷內容品牌，保留大量實用資訊。',
      nomadDiaryDescription: 'Darren 與太太共同經營的數位游牧與旅居紀錄。',
      personDescription: '一位轉換到 AI 賽道的 SEO 人。',
    },
    schemaIntroduction: {
      body: '下面用個 SEO 人的方法介紹自己：',
      title: '用 Schema 介紹自己',
    },
    summary:
      '一位轉換到 AI 賽道的 SEO 人。這裡收錄過去寫下的 SEO、網站分析、Python、UI／UX 與數位行銷筆記。',
    title: '關於作者',
  },
  contact: {
    content: {
      body: '若你是針對某篇文章提供更正、補充或來源，也可以直接附上文章標題與 canonical 網址。文章多數是過去的觀察與實作紀錄，產品介面、搜尋政策、工具功能與市場資訊可能隨時間改變；我會把讀者提供的更新當作參考，不保證每項歷史內容都代表目前狀態。',
      title: '關於網站內容',
    },
    description:
      '聯絡 Darren Huang，討論 SEO、AI、自動化、內容策略與網站體驗。',
    method: {
      availability:
        '我目前有全職工作，回覆時間與可承接的工作量都有限。寄信不代表已建立委任、顧問或其他契約關係；若有進一步合作可能，我會在回信中另行說明範圍、時間與費用。',
      bodyAfterEmail:
        '為了讓我能快速判斷是否能協助，信件主旨可以包含你的主題，例如「SEO 健診」、「AI 內容策略」或「自動化流程」。',
      bodyBeforeEmail: '最直接的方式是寄信到',
      title: '聯絡方式',
    },
    purpose: {
      archiveNotice:
        '這個網站主要是公開內容 archive，不是客服平台，也沒有登入、付款或案件管理系統。因此請不要在信件中傳送密碼、身分證件、付款資料、未公開的客戶資料或其他不必要的敏感資訊。',
      body: '如果你正在處理 SEO 策略、AI 搜尋、內容整理、自動化流程、網站分析、網站效能或使用者體驗，歡迎寫信分享你的背景與問題。我會先了解問題的範圍，再判斷是否適合以 Coffee Chat、一次性的網站健診或其他方式討論。',
      title: '適合討論的主題',
    },
    schemaName: '聯絡 Darren Huang',
    title: '聯絡',
    visibleTitle: '聯絡 Darren',
  },
  privacy: {
    description: '數位引擎網站的資料蒐集、第三方服務、公開內容與聯絡方式說明。',
    lastUpdated: (date: string) => `最後更新：${date}。`,
    requests: {
      bodyAfterEmail:
        '，並提供可定位的頁面網址與必要說明。我會依問題性質確認、回覆並在合理範圍內處理；請不要把密碼、身分證件或其他敏感資料附在信件中。',
      bodyBeforeEmail:
        '如果你認為網站公開了不應公開的個人資料，或希望更正由你提供的聯絡資訊，請寄信到',
      closing:
        '本頁是網站目前實際運作方式的摘要，不是對任何特定地區法律的完整法律意見。如果網站功能、託管服務或資料處理方式有重大變更，我會更新本頁的內容與日期。',
      title: '問題與要求',
    },
    scope: {
      publicData:
        '文章、圖片替代文字、日期與其他頁面資訊會公開出現在網站與 agent-readable 的 Markdown、RSS、sitemap 及唯讀 API 版本中。如果你主動寄信聯絡我，信件內容與你的聯絡資訊會留在我的郵件服務中，僅用於回覆、討論合作或處理你提出的更正要求。',
      siteData:
        '數位引擎是以靜態頁面為主的公開內容網站，提供 SEO、數位行銷、網站分析、AI、自動化與科技文化相關文章與筆記。網站沒有會員登入、公開留言、購物車、付款流程或需要使用者建立帳號的服務，也不會要求你在頁面上填寫身分證件、密碼或付款資料。',
      title: '這個網站保存什麼資料',
    },
    services: {
      analytics:
        '正式網站可能透過 Google Tag Manager 載入 Google Analytics 及 Microsoft Clarity，以了解頁面瀏覽、網站使用情況與體驗問題。這些工具可能使用 cookie 或類似技術；瀏覽器設定、內容阻擋工具與服務商政策都可能影響它們是否執行。我不會透過這個網站要求你提供額外的個人識別資料，也不會把公開文章 API 當成個人資料查詢服務。',
      hosting:
        '網站託管在 GitHub Pages，網域與部分邊緣服務使用 Cloudflare。這些服務可能為了傳送頁面、快取、資安防護、錯誤診斷與流量管理而處理 IP 位址、瀏覽器資訊、請求時間、請求網址及相關技術記錄；這些記錄的保留方式依各服務商的政策與設定而定。',
      title: '網站與分析服務',
    },
    thirdParty: {
      agents:
        '網站也提供公開的 agent discovery、OpenAPI、MCP 與 WebMCP 入口。這些入口只提供公開文章與筆記的唯讀搜尋、metadata 與內容，不提供登入後操作、付款、帳戶修改或其他代表你行動的功能。',
      embeds:
        '部分文章保留 YouTube、Spotify、社群平台、圖片託管或其他外部網站的連結與嵌入內容。你點擊或載入這些內容時，對方可能依自己的隱私政策處理請求資料；外部網站的內容、可用性與資料處理不由數位引擎控制。',
      title: '第三方內容與外部連結',
    },
    title: '隱私說明',
  },
  membership: {
    description:
      '數位引擎目前不需要會員登入或付費，公開文章、歷史電子報與保存筆記都可以直接閱讀。',
    newsletter: {
      body: '網站保留部分過去的會員電子報，作為公開的歷史文章 archive。這些內容反映原始發布時的背景與工具狀態，不代表目前仍有相同的電子報訂閱服務，也不代表所有外部服務今天仍然使用相同介面。',
      title: '歷史電子報',
    },
    publicContent: {
      body: '數位引擎現在是一個公開內容 archive，不提供會員登入、付款或訂閱後才能閱讀的文章。目前網站上的文章、過去的會員電子報保存內容，以及已發布的 Facebook 保存筆記，都可以直接透過 HTML、Markdown、RSS、JSON API、MCP 或支援的 WebMCP 介面閱讀。',
      browseAfterArticles: '開始，或先閱讀',
      browseAfterLlms: '，再依主題選擇文章。',
      browseBeforeArticles: '你可以從',
      title: '目前的閱讀方式',
    },
    questions: {
      bodyAfterContact:
        '上的公開 email。寄信不會建立會員帳號或自動建立任何付費關係，也請不要傳送密碼、身分證件、付款資料或其他敏感資訊。',
      bodyBeforeContact:
        '如果你要討論 SEO、AI、自動化、內容策略或網站體驗，請使用',
      title: '需要進一步聯絡',
    },
    title: '公開內容與電子報說明',
    visibleTitle: '公開內容，不需要會員',
  },
  developers: {
    description:
      '數位引擎提供給開發者與 AI agent 的公開唯讀 API、Markdown、MCP、WebMCP 與 Agent Skills 入口。',
    errors: {
      body: 'API 錯誤會使用 HTTP status code 和 JSON body，不會把 HTML app shell 當成 API response。錯誤 body 會包含機器可讀的 code、人類可讀的 message，以及可協助恢復的 hint。',
      title: '錯誤處理',
    },
    limits: {
      body: '數位引擎是公開內容 archive，不是 SaaS product 或交易平台。本站沒有 API key 發放、sandbox、帳號管理、付款、訂單、留言或寫入 API。文章中的歷史介面、政策、產品功能與外部連結可能已改變；涉及目前狀態的問題應再查閱相關服務的最新一手來源。',
      contactAfterLink: '。',
      contactBeforeLink:
        '如需討論 SEO、AI、內容策略、自動化或網站體驗，可以前往',
      title: '範圍與限制',
    },
    mcp: {
      browser:
        '支援 WebMCP 的瀏覽器可以直接使用頁面上的同一組搜尋與讀取 tools。不支援 WebMCP 的 client 仍可使用 Markdown、JSON API 或 MCP HTTP endpoint。',
      endpoint:
        'MCP endpoint 位於 /mcp，支援 initialize、ping、tools/list 與 tools/call。它只提供 search_content 與 read_content 兩個唯讀工具，不支援登入、購買、寫入、刪除或代表使用者操作。',
      title: 'MCP 與 WebMCP',
    },
    quickstart: {
      agentSkill: '提供搜尋、判讀與引用本站內容的工作流程。',
      apiCatalog:
        '依 RFC 9727 列出 OpenAPI、內容 collections 與 MCP endpoint。',
      auth: '說明本站為什麼不需要註冊、token 或 credential。',
      contentIndex:
        '提供文章與 Facebook 保存筆記的 metadata、canonical URL 和 Markdown URL。',
      contentIndexLabel: '內容索引',
      mcpCard:
        '描述不需要 authentication 的 stateless streamable HTTP MCP server。',
      openApi:
        '描述所有公開 JSON endpoints、參數、response schemas 與 typed errors。',
      title: '快速開始',
    },
    restApi: {
      current:
        '目前穩定版本是 version 1。API client 可以省略 header 以使用目前版本，也可以送出 X-API-Version: 1 明確選擇 version 1。成功與錯誤 response 都會回傳 X-API-Version: 1。',
      policy:
        '未來若需要不相容的變更，會發布新的版本並保留既有版本一段合理的遷移期間。任何即將淘汰的 endpoint 都會以 Deprecation 與 Sunset response headers，以及本頁和 OpenAPI description 公告。目前沒有 endpoint 被淘汰。',
      title: 'REST API 與版本政策',
    },
    title: '開發者與 Agent 入口',
    whenToUse: {
      bodyAfterLlms:
        '開始。這裡的介面適合需要搜尋公開內容、取得文章 metadata、讀取 Markdown，或在支援的瀏覽器中使用 WebMCP 的 agent。所有內容都是公開唯讀資料，不需要登入、API key、帳號或瀏覽器 JavaScript。',
      bodyBeforeLlms:
        '當你要研究數位引擎的 SEO、數位行銷、內容策略、網站分析、AI 或自動化文章時，請先從這個入口或',
      title: '何時使用這個入口',
    },
  },
  webStories: {
    detail: {
      iframeTitle: (title: string) => `${title} 視覺故事`,
      pageHeading: (page: number) => `第 ${page} 頁`,
      playerAria: (title: string, count: number) => `${title}，共 ${count} 頁`,
      transcriptDescription:
        '即使第三方 runtime 或影片無法載入，故事文字仍可直接閱讀。',
      transcriptEyebrow: 'Accessible transcript',
      transcriptTitle: '完整文字稿',
      visualOnly: '此頁為純視覺內容。',
    },
    index: {
      browseChinese: '瀏覽中文 Web Stories',
      description: '數位引擎的兩篇視覺故事。',
      eyebrow: 'Visual stories',
      intro: '保留原始頁面順序、媒體與完整文字 transcript。',
      readStory: '閱讀 Story',
      title: 'Web Stories',
      translationPending: '英文逐頁內容將在後續批次加入。',
    },
  },
  notFound: {
    agentIndex: 'Agent 內容索引',
    allArticles: '完整文章列表',
    description: '這個網址目前沒有對應內容。',
    developers: '開發者與 Agent 入口',
    heading: '這一頁不在引擎裡',
    home: '回到首頁',
    nextSteps: '接下來可以去哪裡？',
    title: '找不到頁面',
    explanation:
      '網址可能已移動或輸入錯誤。你可以回到首頁，或從完整文章列表繼續探索。',
  },
  webMcp: {
    readDescription: '讀取數位引擎的公開內容。',
    readTitle: '讀取數位引擎內容',
    searchDescription: '搜尋數位引擎公開的繁體中文文章與筆記。',
    searchTitle: '搜尋數位引擎內容',
  },
} as const;

type LocalizedCatalog<T> = T extends (...args: infer Arguments) => string
  ? (...args: Arguments) => string
  : T extends string
    ? string
    : T extends object
      ? { [Key in keyof T]: LocalizedCatalog<T[Key]> }
      : T;

export type Messages = LocalizedCatalog<typeof zhHantMessages>;

const enMessages = {
  baseLayout: {
    defaultDescription:
      'Long-running notes on digital marketing, SEO, content strategy, and technology.',
    defaultOgImageAlt: 'Darren Huang | Digital Engine',
    markdownAlternateTitle: (title: string) => `${title} (Markdown)`,
    pageTitle: (title: string, brand: string) =>
      title === brand
        ? `${brand} by Darren Huang`
        : `${title} | ${brand} by Darren Huang`,
    rssTitle: 'Digital Engine RSS',
    skipToMain: 'Skip to main content',
  },
  navigation: {
    about: 'About',
    articles: 'Articles',
    home: 'Home',
    homeAria: 'Digital Engine home',
    notes: 'Notes',
    primaryAria: 'Primary navigation',
    tags: 'Topics',
  },
  languageSwitcher: {
    ariaLabel: 'Language selection',
    switchTo: (language: string) => `Switch to ${language}`,
  },
  footer: {
    agentDescription:
      'If you want to research the public content on Digital Engine, you can use these documents and read-only interfaces directly. No login, API key, or browser JavaScript is required.',
    agentLinks: {
      apiDescription:
        'A read-only JSON API for public articles and saved notes.',
      developersDescription:
        'A quick guide to the API, MCP, WebMCP, and versioning policy.',
      developersLabel: 'Developer and Agent Portal',
      llmsDescription:
        'Site context, content indexes, and guidance for agents.',
      mcpDescription: 'The public MCP endpoint and its two read-only tools.',
    },
    contact: 'Contact',
    copyright: (year: number) => `© ${year} Darren Huang · Digital Engine`,
    developerHeading: 'Public resources for developers and agents',
    navigationAria: 'Footer navigation',
    privacy: 'Privacy',
  },
  cards: {
    note: {
      historical: 'Historical archive',
      read: 'Read note',
      readAria: (title: string) => `Read “${title}”`,
      siteNote: 'Digital Engine note',
      statusPublished: 'Edited and published',
      statusReview: 'Draft under review',
    },
    post: {
      read: 'Read article',
      readAria: (title: string) => `Read “${title}”`,
    },
  },
  reading: {
    imageLightbox: {
      closeAria: 'Close image preview',
      enlargeAria: (alt: string) =>
        alt ? `Enlarge image: ${alt}` : 'Enlarge image',
      openOriginal: 'Open full-size image',
      previewAria: 'Image preview',
    },
    tableOfContents: {
      ariaLabel: 'Table of contents',
      sectionCount: (count: number) =>
        `${count} ${count === 1 ? 'section' : 'sections'}`,
      title: 'Table of contents',
    },
  },
  relatedContent: {
    eyebrow: 'Keep exploring',
    noteType: 'Saved Facebook note',
    postType: 'Article',
    title: 'Related reading',
  },
  articleJourney: {
    allArticles: 'All articles',
    eyebrow: 'Keep exploring',
    nextIssue: 'Next issue',
    previousIssue: 'Previous issue',
    readArticle: 'Read article',
    readArticleAria: (title: string) => `Read “${title}”`,
    relatedArticles: 'Related articles',
    seriesAria: (series: string) => `${series} series navigation`,
    title: 'Keep reading',
  },
  article: {
    categories: 'Categories',
    eyebrow: 'Digital Engine article',
    historicalTranslationNotice: (publishedDate: string) =>
      `Originally published in Chinese on ${publishedDate}. This English translation preserves the original context; referenced products, interfaces, and policies may have changed.`,
    readingTime: (minutes: number) => `${minutes}-min read`,
    reviewBanner:
      'This English translation is a local review draft and is not included in the public site or content index.',
    tags: 'Topics',
    updatedAt: (date: string) => `Updated ${date}`,
  },
  note: {
    categories: 'Categories',
    editorialStatusAria: 'Editorial status',
    eyebrow: 'Digital Engine note · Saved from Facebook',
    mentionedLinks: 'Links mentioned in the original post',
    organizedAt: (date: string) => `Archived ${date}`,
    originalFacebookByline:
      'Originally shared on the Digital Engine Facebook page',
    readingTime: (minutes: number) => `${minutes}-min read`,
    reviewBanner:
      'This is a local review draft and is not included in the public content index.',
    sourceContext:
      'This note preserves the original context of the Facebook post. Some tools, interfaces, and external links may have changed.',
    sourceHeading: 'Source note',
    tags: 'Topics',
    translationNotice:
      "Originally published in Chinese on Facebook. This English translation preserves the original post's context. The linked social post remains in Chinese.",
    viewOriginal: 'View the original post',
  },
  media: {
    embeds: {
      generic: 'Open external content',
      spotifyOpen: 'Open the original on Spotify',
      spotifyTitle: 'Spotify audio',
      twitterOpen: 'View the original post on X/Twitter',
      youtubeOpen: 'Open the original video on YouTube',
      youtubeTitle: 'YouTube video',
    },
    photoCarousel: {
      defaultLabel: 'Photos of Darren Huang at industry events',
      dotAria: (index: number) => `Go to photo ${index}`,
      dotsAria: 'Choose a photo',
      nextAria: 'Next photo',
      previousAria: 'Previous photo',
      slideAria: (index: number, total: number) => `Photo ${index} of ${total}`,
      status: (index: number, total: number) => `Photo ${index} of ${total}`,
    },
  },
  home: {
    hero: {
      headingBeforeEmphasis: 'Helping old ideas ',
      headingEmphasis: 'stay findable',
      kicker: 'SEO · AI · Automation · UI/UX',
      lede: "I'm Darren Huang, an SEO practitioner who moved into AI. This site brings together the articles I've written about SEO, web analytics, Python, UI/UX, and digital marketing, along with a few observations on digital products and tech culture.",
      panelBody:
        'Search, content, websites, products, and how technology shapes the way we work and live.',
      panelTitle: 'Some hands-on work, some observations.',
    },
    notes: {
      description:
        'Social posts worth keeping, edited into lasting notes that connect back to the longer articles.',
      title: 'Saved Facebook notes',
      viewAll: (count: number) =>
        `View all ${count} ${count === 1 ? 'note' : 'notes'}`,
    },
    posts: {
      description:
        'From search and content strategy to digital products and tech culture.',
      emptyBody:
        'The Astro foundation is ready. WordPress articles will be generated by the rerunnable importer.',
      emptyTitle: 'Content is being imported',
      title: 'From the archive',
      viewAll: (count: number) =>
        `View all ${count} ${count === 1 ? 'article' : 'articles'}`,
    },
    schemaDescription:
      'Long-running observations on digital marketing, SEO, content strategy, and technology.',
    title: 'Digital Engine',
  },
  articles: {
    count: (count: number) =>
      `${count} ${count === 1 ? 'article' : 'articles'}, ordered from newest to oldest by the original publication date.`,
    description: 'The complete Digital Engine article archive.',
    eyebrow: 'Archive',
    title: 'All articles',
  },
  notes: {
    browseChinese: 'Browse the original Chinese notes',
    description:
      'Technical notes, experiments, and personal observations saved from the Digital Engine Facebook page.',
    eyebrow: 'Facebook archive',
    intro:
      'Social posts worth keeping, edited into notes that are readable, searchable, and easier to revisit.',
    reviewBanner:
      'Local review drafts are currently visible. They are not included in the public site index.',
    statsAria: 'Note count',
    statsLabel: 'notes saved locally',
    title: 'Digital Engine notes',
    translationPending:
      'English translations of the saved Facebook notes will be added in a later release.',
  },
  taxonomy: {
    categories: {
      description: 'Browse Digital Engine articles by category.',
      detailCount: (count: number) =>
        `${count} ${count === 1 ? 'article or note' : 'articles and notes'}.`,
      detailDescription: (category: string) =>
        `Digital Engine articles and notes in the “${category}” category.`,
      detailTitle: (category: string) => `Category: ${category}`,
      eyebrow: 'Categories',
      intro:
        'The main categories used across articles and saved Facebook notes.',
      noteGroupTitle: 'Saved Facebook notes',
      title: 'Categories',
    },
    tags: {
      description: 'Browse Digital Engine articles by topic.',
      detailCount: (count: number) =>
        `${count} ${count === 1 ? 'article or note' : 'articles and notes'}.`,
      detailDescription: (tag: string) =>
        `Digital Engine articles and notes about “${tag}.”`,
      detailTitle: (tag: string) => `Topic: ${tag}`,
      eyebrow: 'Topics',
      intro: 'Explore articles and saved Facebook notes by topic.',
      noteGroupTitle: 'Saved Facebook notes',
      title: 'Topics',
    },
  },
  about: {
    coffeeChat: {
      bodyBeforeEmail:
        "If you'd like to talk about SEO, AI, automation, or career consulting, I'm always open to a coffee chat—online works too. Email me at",
      title: "Let's have a coffee chat",
    },
    digitalEngine: {
      bodyAfterLink:
        'was the Facebook page I used to run. I no longer update it because of time constraints, but it still holds plenty of useful SEO and digital marketing material. Feel free to browse it as an archive.',
      linkLabel: 'Digital Engine',
      title: 'About Digital Engine',
    },
    introduction: {
      career:
        "Professionally, I'm an SEO practitioner who moved into AI. Most of the writing here comes from earlier in my career and covers SEO, web analytics, Python, UI/UX, and digital marketing. I keep it online as a record of the path I've taken, and I hope some of it is still useful to you.",
      greeting:
        'Welcome to my site. I spent eight years living in the United States, including time in Boston, New York, and Silicon Valley. While I was there, I worked as an SEO Strategist at WeWork and served as a Product Expert in the Google Search Central community.',
      residenceAfterDiary: "—follow along if you'd like.",
      residenceBeforeDiary:
        "I've since moved back to Taiwan and am based in Kaohsiung, working remotely for an Australian company. My wife and I are both digital nomads, and we share our travels at",
      title: "Hi, I'm Darren",
    },
    photos: {
      danny: {
        alt: 'Darren Huang with Danny Sullivan at the 2018 Google Product Experts Summit',
        caption:
          'With Danny Sullivan at the 2018 Google Product Experts Summit.',
      },
      eric: {
        alt: 'Darren Huang with Eric Enge in Boston in 2017',
        caption: 'With Eric Enge in Boston in 2017.',
      },
      gary2017: {
        alt: 'Darren Huang with Gary Illyes in Boston in 2017',
        caption: 'With Gary Illyes in Boston in 2017.',
      },
      gary2024: {
        alt: 'Darren Huang with Gary Illyes, Terence, and Cherry in 2024',
        caption: 'With Gary Illyes, Terence, and Cherry in 2024.',
      },
      john: {
        alt: 'Darren Huang with John Mueller in 2017',
        caption: 'With John Mueller in 2017.',
      },
      paul: {
        alt: 'Darren Huang with Paul Haahr at the 2018 Google Product Experts Summit',
        caption: 'With Paul Haahr at the 2018 Google Product Experts Summit.',
      },
      rand: {
        alt: 'Darren Huang with Rand Fishkin at SearchLove Boston in 2016',
        caption: 'With Rand Fishkin at SearchLove Boston in 2016.',
      },
      summit: {
        alt: 'Darren Huang at the 2018 Google Product Experts Summit',
        caption: 'At the 2018 Google Product Experts Summit.',
      },
    },
    schema: {
      digitalEngineDescription:
        "Darren's former SEO and digital marketing content brand, with a large archive of practical material.",
      nomadDiaryDescription:
        'A digital nomad and travel journal that Darren runs with his wife.',
      personDescription: 'An SEO practitioner who moved into AI.',
    },
    schemaIntroduction: {
      body: 'Here is the SEO way to introduce myself:',
      title: 'Introducing myself with Schema',
    },
    summary:
      'An SEO practitioner who moved into AI. This site preserves my writing on SEO, web analytics, Python, UI/UX, and digital marketing.',
    title: 'About Darren',
  },
  contact: {
    content: {
      body: 'If you are sending a correction, an additional source, or other context for an article, please include its title and canonical URL. Most articles are records of past observations and hands-on work, so product interfaces, search policies, tool features, and market information may have changed. I appreciate reader updates, but historical content should not be treated as a statement of current conditions.',
      title: "About the site's content",
    },
    description:
      'Contact Darren Huang to talk about SEO, AI, automation, content strategy, or web experience.',
    method: {
      availability:
        "I currently work full time, so my response time and availability are limited. Sending an email does not create an engagement, consulting relationship, or other contract. If there is a good fit for further work, I'll reply with the proposed scope, timing, and cost.",
      bodyAfterEmail:
        'To help me quickly understand whether I can help, put the topic in the subject line—for example, “SEO audit,” “AI content strategy,” or “automation workflow.”',
      bodyBeforeEmail: 'The most direct way to reach me is by email at',
      title: 'How to reach me',
    },
    purpose: {
      archiveNotice:
        'This site is primarily a public content archive, not a customer support portal, and it has no login, payment, or case-management system. Please do not email passwords, identity documents, payment details, unpublished client data, or other sensitive information that is not needed for the conversation.',
      body: "If you are working on SEO strategy, AI search, content organization, automation, web analytics, performance, or user experience, feel free to email me with some background and the question you are trying to solve. I'll first get a sense of the scope, then decide whether a coffee chat, a one-time website review, or another format makes sense.",
      title: 'Good reasons to get in touch',
    },
    schemaName: 'Contact Darren Huang',
    title: 'Contact',
    visibleTitle: 'Contact Darren',
  },
  privacy: {
    description:
      'How Digital Engine handles site data, third-party services, public content, and direct inquiries.',
    lastUpdated: (date: string) => `Last updated: ${date}.`,
    requests: {
      bodyAfterEmail:
        "and include the page URL plus enough context to locate the issue. I'll review it, respond, and address it where reasonable. Please do not attach passwords, identity documents, or other sensitive data.",
      bodyBeforeEmail:
        'If you believe the site exposes personal information that should not be public, or you want to correct contact information you provided, email',
      closing:
        "This page summarizes how the site currently operates. It is not comprehensive legal advice for any particular jurisdiction. If the site's features, hosting, or data practices materially change, I'll update this page and its date.",
      title: 'Questions and requests',
    },
    scope: {
      publicData:
        'Articles, image alternative text, dates, and other page information are publicly available through the website and its agent-readable Markdown, RSS, sitemap, and read-only API. If you email me, your message and contact details remain with my email provider and are used only to reply, discuss possible work, or handle a correction request.',
      siteData:
        'Digital Engine is a mostly static public content site with articles and notes about SEO, digital marketing, web analytics, AI, automation, and tech culture. It has no member login, public comments, shopping cart, payment flow, or account-based service, and it will not ask you to enter identity documents, passwords, or payment information on a page.',
      title: 'What this site stores',
    },
    services: {
      analytics:
        'The production site may load Google Analytics and Microsoft Clarity through Google Tag Manager to understand page views, site usage, and experience issues. These tools may use cookies or similar technology, and browser settings, content blockers, and provider policies may affect whether they run. I do not use this site to request additional identifying information, and the public article API is not a personal-data lookup service.',
      hosting:
        "The site is hosted on GitHub Pages, while its domain and some edge services use Cloudflare. To deliver and cache pages, protect the site, diagnose errors, and manage traffic, these providers may process IP addresses, browser details, request times, requested URLs, and related technical logs. Retention depends on each provider's policies and settings.",
      title: 'Hosting and analytics services',
    },
    thirdParty: {
      agents:
        'The site also provides public agent discovery, OpenAPI, MCP, and WebMCP endpoints. They offer read-only search, metadata, and content for public articles and notes. They do not support authenticated actions, payments, account changes, or any other action on your behalf.',
      embeds:
        'Some articles retain links to or embeds from YouTube, Spotify, social platforms, image hosts, and other external sites. When you click or load them, those providers may process request data under their own privacy policies. Digital Engine does not control their content, availability, or data practices.',
      title: 'Third-party content and external links',
    },
    title: 'Privacy',
  },
  membership: {
    description:
      'Digital Engine does not require a membership or payment. Public articles, archived newsletters, and saved notes are free to read.',
    newsletter: {
      body: 'The site preserves some former members-only newsletters as a public historical archive. They reflect the context and tools available when they were first published. They do not mean the same newsletter subscription still exists, or that every external service still uses the same interface today.',
      title: 'Newsletter archive',
    },
    publicContent: {
      body: 'Digital Engine is now a public content archive. There is no member login, payment, or subscriber-only reading. The articles, archived member newsletters, and published Facebook notes can all be read through HTML, Markdown, RSS, the JSON API, MCP, or a supported WebMCP interface.',
      browseAfterArticles: 'or start with the',
      browseAfterLlms: 'and choose an article by topic.',
      browseBeforeArticles: 'You can browse the',
      title: 'How to read the site',
    },
    questions: {
      bodyAfterContact:
        'for the public email address. Emailing me does not create a member account or any paid relationship. Please do not send passwords, identity documents, payment details, or other sensitive information.',
      bodyBeforeContact:
        'To discuss SEO, AI, automation, content strategy, or the site experience, use the',
      title: 'Need to get in touch?',
    },
    title: 'Public content and newsletter archive',
    visibleTitle: 'Public content, no membership required',
  },
  developers: {
    description:
      'Digital Engine provides public, read-only API, Markdown, MCP, WebMCP, and Agent Skills resources for developers and AI agents.',
    errors: {
      body: 'API errors use HTTP status codes and JSON bodies, never an HTML app shell. The error body includes a machine-readable code, a human-readable message, and a hint that can help the client recover.',
      title: 'Error handling',
    },
    limits: {
      body: 'Digital Engine is a public content archive, not a SaaS product or transaction platform. It does not issue API keys and has no sandbox, account management, payments, orders, comments, or write API. Historical interfaces, policies, product features, and external links in the articles may have changed. For questions about current conditions, check the latest primary sources from the relevant service.',
      contactAfterLink: '.',
      contactBeforeLink:
        'To discuss SEO, AI, content strategy, automation, or the site experience, visit the',
      title: 'Scope and limitations',
    },
    mcp: {
      browser:
        'Browsers with WebMCP support can use the same search and read tools directly from the page. Other clients can still use Markdown, the JSON API, or the MCP HTTP endpoint.',
      endpoint:
        "The MCP endpoint is at /mcp and supports initialize, ping, tools/list, and tools/call. It exposes only two read-only tools, search_content and read_content. It cannot log in, buy, write, delete, or act on a user's behalf.",
      title: 'MCP and WebMCP',
    },
    quickstart: {
      agentSkill:
        'A workflow for finding, evaluating, and citing content from this site.',
      apiCatalog:
        'An RFC 9727 catalog of the OpenAPI document, content collections, and MCP endpoint.',
      auth: 'Why this site requires no registration, token, or credential.',
      contentIndex:
        'Metadata, canonical URLs, and Markdown URLs for articles and saved Facebook notes.',
      contentIndexLabel: 'Content index',
      mcpCard:
        'A description of the stateless, streamable HTTP MCP server, which requires no authentication.',
      openApi:
        'All public JSON endpoints, parameters, response schemas, and typed errors.',
      title: 'Quick start',
    },
    restApi: {
      current:
        'The current stable version is version 1. API clients may omit the header to use the current version, or send X-API-Version: 1 to select version 1 explicitly. Successful and error responses both return X-API-Version: 1.',
      policy:
        'If a future change is incompatible, a new version will be released while the existing version remains available for a reasonable migration period. Any endpoint scheduled for removal will be announced with Deprecation and Sunset response headers, on this page, and in the OpenAPI description. No endpoint is currently deprecated.',
      title: 'REST API and versioning',
    },
    title: 'Developer and Agent Portal',
    whenToUse: {
      bodyAfterLlms:
        'These interfaces are for agents that need to search public content, retrieve article metadata, read Markdown, or use WebMCP in a supported browser. Everything is public and read-only, with no login, API key, account, or browser JavaScript required.',
      bodyBeforeLlms:
        'When researching Digital Engine articles about SEO, digital marketing, content strategy, web analytics, AI, or automation, start here or with',
      title: 'When to use this portal',
    },
  },
  webStories: {
    detail: {
      iframeTitle: (title: string) => `${title} visual story`,
      pageHeading: (page: number) => `Page ${page}`,
      playerAria: (title: string, count: number) =>
        `${title}, ${count} ${count === 1 ? 'page' : 'pages'}`,
      transcriptDescription:
        'The story text remains readable even if the third-party runtime or video does not load.',
      transcriptEyebrow: 'Accessible transcript',
      transcriptTitle: 'Full transcript',
      visualOnly: 'This page contains visual content only.',
    },
    index: {
      browseChinese: 'Browse the Chinese Web Stories',
      description: 'Visual stories from Digital Engine.',
      eyebrow: 'Visual stories',
      intro:
        'The original page order and media, with a complete text transcript.',
      readStory: 'Read story',
      title: 'Web Stories',
      translationPending:
        'English page-by-page story text will be added in a later release.',
    },
  },
  notFound: {
    agentIndex: 'Agent content index',
    allArticles: 'Complete article archive',
    description: 'There is no content at this address.',
    developers: 'Developer and Agent Portal',
    heading: 'This page is not in the engine',
    home: 'Back to the homepage',
    nextSteps: 'Where can you go next?',
    title: 'Page not found',
    explanation:
      'The page may have moved, or the address may be incorrect. You can return home or keep exploring from the complete article archive.',
  },
  webMcp: {
    readDescription: 'Read public content from Digital Engine.',
    readTitle: 'Read Digital Engine content',
    searchDescription:
      'Search public English articles and notes on Digital Engine.',
    searchTitle: 'Search Digital Engine content',
  },
} satisfies Messages;

export const messages = {
  'zh-hant': zhHantMessages,
  en: enMessages,
} satisfies Record<Locale, Messages>;

export function getMessages(locale: Locale): Messages {
  return messages[locale];
}
