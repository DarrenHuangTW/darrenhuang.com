import { describe, expect, it } from 'vitest';

import { enrichLocalMediaHtml } from '../../scripts/migrate-wordpress/html.js';

import {
  parseGutenbergAst,
  rewriteWordPressUrl,
  transformWordPressContent,
} from '../../scripts/migrate-wordpress/transform/index.js';

const TEST_ORIGIN = '192.0.2.1';

describe('WordPress content transformation', () => {
  it('normalizes migrated image dimensions to the intrinsic aspect ratio', () => {
    const html = enrichLocalMediaHtml(
      '<figure><img src="/wp-content/uploads/example.png" width="600" height="500"></figure>',
      [
        {
          bytes: 1_024,
          height: 544,
          mime: 'image/png',
          path: '/wp-content/uploads/example.png',
          sha256: 'test',
          width: 1_024,
        },
      ],
    );

    expect(html).toContain('width="600"');
    expect(html).toContain('height="319"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('parses nested Gutenberg blocks and preserves their sanitized HTML', () => {
    const content = `
<!-- wp:group -->
<div class="wp-block-group" onclick="steal()">
<!-- wp:paragraph -->
<p>安全的<strong>巢狀內容</strong><script>alert(1)</script></p>
<!-- /wp:paragraph -->
<!-- wp:image {"id":10} -->
<figure><a href="https://www.darrenhuang.com/example.html"><img src="http://${TEST_ORIGIN}/wp-content/uploads/2022/04/example.png" alt="範例"></a></figure>
<!-- /wp:image -->
<p><code>http://${TEST_ORIGIN}/example.html</code></p>
</div>
<!-- /wp:group -->`;

    const ast = parseGutenbergAst(content);
    const result = transformWordPressContent(content, {
      internalHosts: [TEST_ORIGIN],
    });

    expect(ast[0]?.blockName).toBeNull();
    expect(ast[1]?.blockName).toBe('core/group');
    expect(ast[1]?.innerBlocks.map((block) => block.blockName)).toEqual([
      'core/paragraph',
      'core/image',
    ]);
    expect(result.html).toContain('<strong>巢狀內容</strong>');
    expect(result.html).toContain('href="/example.html"');
    expect(result.html).toContain(
      'src="/wp-content/uploads/2022/04/example.png"',
    );
    expect(result.html).toContain(
      '<code>https://www.darrenhuang.com/example.html</code>',
    );
    expect(result.html).not.toContain(TEST_ORIGIN);
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onclick');
    expect(result.report.mediaDependencies).toContainEqual({
      external: false,
      kind: 'image',
      originalUrl: '/wp-content/uploads/2022/04/example.png',
      rewrittenUrl: '/wp-content/uploads/2022/04/example.png',
    });
  });

  it('renders modern and legacy providers with durable fallbacks', () => {
    const content = `
<!-- wp:embed {"url":"https://www.youtube.com/watch?v=abcdefghijk&t=1m2s","type":"video","providerNameSlug":"youtube"} -->
<figure>https://www.youtube.com/watch?v=abcdefghijk&amp;t=1m2s</figure>
<!-- /wp:embed -->
<!-- wp:core-embed/twitter {"url":"https://twitter.com/example/status/123"} -->
<figure>tweet</figure>
<!-- /wp:core-embed/twitter -->
<!-- wp:core-embed/spotify {"url":"https://open.spotify.com/episode/ABC123"} -->
<figure>podcast</figure>
<!-- /wp:core-embed/spotify -->
<!-- wp:embed {"url":"https://www.slideshare.net/example/deck","providerNameSlug":"slideshare"} -->
<figure>slides</figure>
<!-- /wp:embed -->`;

    const result = transformWordPressContent(content);

    expect(result.html).toContain(
      'https://www.youtube-nocookie.com/embed/abcdefghijk?start=62',
    );
    expect(result.html).toContain('loading="lazy"');
    expect(result.html).toContain('在 YouTube 查看原始影片');
    expect(result.html).toContain('class="embed embed--twitter"');
    expect(result.html).toContain(
      'href="https://twitter.com/example/status/123"',
    );
    expect(result.html).toContain(
      'src="https://open.spotify.com/embed/episode/ABC123"',
    );
    expect(result.html).toContain('在 SlideShare 查看原始內容');
    expect(result.report.embeds.map((entry) => entry.provider)).toEqual([
      'youtube',
      'twitter',
      'spotify',
      'slideshare',
    ]);
  });

  it('redacts credential-like values and removes expired URL signatures', () => {
    const apiKey = 'A'.repeat(31);
    const signature = 'B'.repeat(48);
    const keyPairId = 'C'.repeat(20);
    const accessToken = 'D'.repeat(32);
    const content = `
<p>POST /api?apikey=${apiKey} HTTP/1.1</p>
<p data-api-key="${apiKey}">apikey="${apiKey}"</p>
<pre>{"apiKey":"${apiKey}","access_token":"${accessToken}"}</pre>
<p><a href="https://media.example.com/transcript.pdf?Expires=1&amp;Signature=${signature}&amp;Key-Pair-Id=${keyPairId}">逐字稿</a></p>
<p><a href="/relative.pdf?keep=1&amp;Signature=${signature}&amp;Key-Pair-Id=${keyPairId}">相對連結</a></p>
<!-- wp:vendor/private {"endpoint":"https://media.example.com/private.jpg?Signature=${signature}","nested":{"apiKey":"${apiKey}"}} -->
<figure><img srcset="https://media.example.com/one.jpg?Signature=${signature} 1x, https://media.example.com/two.jpg?api_key=${apiKey} 2x"></figure>
<!-- /wp:vendor/private -->`;

    const result = transformWordPressContent(content);

    expect(result.html).toContain('apikey=REDACTED');
    expect(result.html).not.toContain(apiKey);
    expect(result.html).not.toContain(signature);
    expect(result.html).not.toContain(keyPairId);
    expect(result.html).not.toContain(accessToken);
    expect(result.html).not.toContain('Signature=');
    expect(result.html).not.toContain('Key-Pair-Id=');
    expect(result.html).toContain('data-api-key="REDACTED"');
    expect(result.html).toContain('apikey="REDACTED"');
    expect(result.html).toContain('href="/relative.pdf?keep=1"');
    expect(JSON.stringify(result.report)).not.toContain(apiKey);
    expect(JSON.stringify(result.report)).not.toContain(signature);
    expect(JSON.stringify(result.report)).not.toContain(keyPairId);
    expect(JSON.stringify(result.report)).not.toContain('Signature=');
    expect(result.report.mediaDependencies).toContainEqual(
      expect.objectContaining({
        external: true,
        originalUrl: 'https://media.example.com/transcript.pdf?Expires=1',
      }),
    );
  });

  it('converts raw iframes and plugin blocks without retaining fake forms', () => {
    const content = `
<iframe src="https://www.youtube.com/embed/rawvideo123"></iframe>
<!-- wp:genesis-blocks/gb-accordion -->
<div><details><summary>答案</summary><p>內容</p></details></div>
<!-- /wp:genesis-blocks/gb-accordion -->
<!-- wp:genesis-blocks/gb-notice -->
<div><p>通知內容</p></div>
<!-- /wp:genesis-blocks/gb-notice -->
<!-- wp:coblocks/alert -->
<div><p>警示內容</p></div>
<!-- /wp:coblocks/alert -->
<!-- wp:mailchimp-for-wp/form {"id":1205} /-->
<!-- wp:vendor/unsafe {"mode":"legacy"} -->
<div onmouseover="bad()"><script>bad()</script><p>未知區塊內容</p></div>
<!-- /wp:vendor/unsafe -->`;

    const result = transformWordPressContent(content);

    expect(result.html).toContain('<details>');
    expect(result.html).toContain('wp-callout--notice');
    expect(result.html).toContain('wp-callout--alert');
    expect(result.html).toContain('原電子報訂閱表單已停止運作');
    expect(result.html).not.toContain('<form');
    expect(result.html).not.toContain('<input');
    expect(result.html).not.toContain('<script');
    expect(result.html).not.toContain('onmouseover');
    expect(result.html).toContain('未知區塊內容');
    expect(result.report.unknownBlocks).toHaveLength(1);
    expect(result.report.unknownBlocks[0]).toMatchObject({
      blockName: 'vendor/unsafe',
      strategy: 'sanitized-html',
    });
    expect(result.report.unknownBlocks[0]?.htmlPreview).not.toContain(
      '<script',
    );
    expect(result.report.embeds).toContainEqual({
      blockName: 'raw-html/iframe',
      provider: 'youtube',
      renderedAs: 'lazy-iframe',
      sourceUrl: 'https://www.youtube.com/embed/rawvideo123',
    });
  });

  it('rewrites legacy hosts while leaving external URLs unchanged', () => {
    expect(
      rewriteWordPressUrl(
        'https://member.darrenhuang.com/wp-content/uploads/2020/01/a.jpg?x=1#top',
      ),
    ).toBe('/wp-content/uploads/2020/01/a.jpg?x=1#top');
    expect(rewriteWordPressUrl('http://127.0.0.1:8080/private-page.html')).toBe(
      '/private-page.html',
    );
    expect(
      rewriteWordPressUrl('https://www.darrenhuang.com/about-darren-huang'),
    ).toBe('/about-darren-huang');
    expect(rewriteWordPressUrl('https://example.com/a.jpg')).toBe(
      'https://example.com/a.jpg',
    );
  });
});
