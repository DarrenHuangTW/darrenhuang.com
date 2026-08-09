import { describe, expect, it } from 'vitest';

import {
  SourceParseError,
  getPostMetaValues,
  parseWxr,
} from '../../scripts/migrate-wordpress/source/index.js';

const wxrFixture = `<?xml version="1.0" encoding="UTF-8" ?>
<rss
  version="2.0"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
  <channel>
    <title>Fixture site</title>
    <link>https://example.test</link>
    <wp:base_site_url>https://example.test</wp:base_site_url>
    <wp:base_blog_url>https://example.test</wp:base_blog_url>
    <item>
      <title><![CDATA[First & article]]></title>
      <link>http://127.0.0.1/first.html</link>
      <guid isPermaLink="false">https://example.test/?p=42</guid>
      <content:encoded><![CDATA[<p>  Keep this spacing. </p>
<p>Second line.</p>]]></content:encoded>
      <excerpt:encoded><![CDATA[A short excerpt.]]></excerpt:encoded>
      <wp:post_id>42</wp:post_id>
      <wp:post_date>2024-07-17 10:20:30</wp:post_date>
      <wp:post_date_gmt>2024-07-17 17:20:30</wp:post_date_gmt>
      <wp:post_modified>2024-08-01 01:02:03</wp:post_modified>
      <wp:post_modified_gmt>2024-08-01 08:02:03</wp:post_modified_gmt>
      <wp:post_name>first</wp:post_name>
      <wp:status>publish</wp:status>
      <wp:post_parent>0</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type>post</wp:post_type>
      <wp:post_password>must-not-be-normalized</wp:post_password>
      <category domain="category" nicename="seo"><![CDATA[SEO & Search]]></category>
      <category domain="post_tag" nicename="testing"><![CDATA[Testing]]></category>
      <wp:postmeta>
        <wp:meta_key>_thumbnail_id</wp:meta_key>
        <wp:meta_value>99</wp:meta_value>
      </wp:postmeta>
      <wp:postmeta>
        <wp:meta_key>empty_value</wp:meta_key>
        <wp:meta_value></wp:meta_value>
      </wp:postmeta>
    </item>
    <item>
      <title>Attachment</title>
      <link>http://127.0.0.1/?attachment_id=99</link>
      <guid isPermaLink="false">https://example.test/image.png</guid>
      <content:encoded></content:encoded>
      <excerpt:encoded></excerpt:encoded>
      <wp:post_id>99</wp:post_id>
      <wp:post_date>2024-07-17 10:20:30</wp:post_date>
      <wp:post_date_gmt>0000-00-00 00:00:00</wp:post_date_gmt>
      <wp:post_modified>2024-07-17 10:20:30</wp:post_modified>
      <wp:post_modified_gmt>2024-07-17 17:20:30</wp:post_modified_gmt>
      <wp:post_name>image</wp:post_name>
      <wp:status>inherit</wp:status>
      <wp:post_parent>42</wp:post_parent>
      <wp:menu_order>0</wp:menu_order>
      <wp:post_type>attachment</wp:post_type>
      <wp:attachment_url>http://127.0.0.1/wp-content/uploads/2024/07/image.png</wp:attachment_url>
      <category domain="media_source" nicename="upload">Upload</category>
      <wp:postmeta>
        <wp:meta_key>_wp_attached_file</wp:meta_key>
        <wp:meta_value>2024/07/image.png</wp:meta_value>
      </wp:postmeta>
    </item>
  </channel>
</rss>`;

describe('parseWxr', () => {
  it('keeps a singleton channel item as an array', () => {
    const singleItemFixture = wxrFixture.replace(
      /\n {4}<item>\n {6}<title>Attachment<\/title>[\s\S]*?\n {4}<\/item>/,
      '',
    );

    expect(parseWxr(singleItemFixture).items).toHaveLength(1);
  });

  it('normalizes repeated items, categories, and postmeta without parsing dates', () => {
    const source = parseWxr(wxrFixture);

    expect(source).toMatchObject({
      title: 'Fixture site',
      link: 'https://example.test',
      baseSiteUrl: 'https://example.test',
      baseBlogUrl: 'https://example.test',
    });
    expect(source.items).toHaveLength(2);

    const article = source.items[0];
    const attachment = source.items[1];

    expect(article).toBeDefined();
    expect(attachment).toBeDefined();

    if (article === undefined || attachment === undefined) {
      throw new Error('Fixture items were not parsed.');
    }

    expect(article).toMatchObject({
      wpId: 42,
      title: 'First & article',
      guid: 'https://example.test/?p=42',
      slug: 'first',
      status: 'publish',
      postType: 'post',
      parentId: 0,
      menuOrder: 0,
      attachmentUrl: null,
      dates: {
        published: {
          local: '2024-07-17 10:20:30',
          gmt: '2024-07-17 17:20:30',
        },
        modified: {
          local: '2024-08-01 01:02:03',
          gmt: '2024-08-01 08:02:03',
        },
      },
    });
    expect(article.content).toBe(
      '<p>  Keep this spacing. </p>\n<p>Second line.</p>',
    );
    expect(article.categories).toEqual([
      { domain: 'category', nicename: 'seo', name: 'SEO & Search' },
      { domain: 'post_tag', nicename: 'testing', name: 'Testing' },
    ]);
    expect(article.postMeta).toEqual([
      { key: '_thumbnail_id', value: '99' },
      { key: 'empty_value', value: '' },
    ]);
    expect(getPostMetaValues(article, '_thumbnail_id')).toEqual(['99']);

    expect(attachment.categories).toEqual([
      { domain: 'media_source', nicename: 'upload', name: 'Upload' },
    ]);
    expect(attachment.postMeta).toEqual([
      { key: '_wp_attached_file', value: '2024/07/image.png' },
    ]);
    expect(attachment.attachmentUrl).toBe(
      'http://127.0.0.1/wp-content/uploads/2024/07/image.png',
    );
    expect(attachment.dates.published.gmt).toBe('0000-00-00 00:00:00');
    expect(JSON.stringify(source)).not.toContain('must-not-be-normalized');
  });

  it('rejects duplicate WordPress IDs', () => {
    const duplicate = wxrFixture.replace(
      '<wp:post_id>99</wp:post_id>',
      '<wp:post_id>42</wp:post_id>',
    );

    expect(() => parseWxr(duplicate)).toThrow(
      new SourceParseError('Duplicate wp:post_id 42 in WXR.'),
    );
  });

  it('rejects a missing required post type', () => {
    const invalid = wxrFixture.replace(
      '<wp:post_type>post</wp:post_type>',
      '<wp:post_type></wp:post_type>',
    );

    expect(() => parseWxr(invalid)).toThrow(/Missing wp:post_type/);
  });
});
