import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import {
  SourceParseError,
  WORDPRESS_POST_COLUMNS,
  parseWordPressPostsGzip,
  parseWordPressPostsSql,
  selectAttachmentMimes,
  selectHistoricalPostStatuses,
  selectLegacyAmpStories,
} from '../../scripts/migrate-wordpress/source/index.js';

interface FixturePost {
  id: number;
  content?: string;
  status?: string;
  slug?: string;
  postType?: string;
  mimeType?: string;
  password?: string;
  dateLocal?: string;
  dateGmt?: string;
}

function sqlString(value: string): string {
  return `'${value
    .replaceAll('\\', '\\\\')
    .replaceAll("'", "\\'")
    .replaceAll('\0', '\\0')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')}'`;
}

function postTuple({
  id,
  content = '<p>Body</p>',
  status = 'publish',
  slug = `post-${id}`,
  postType = 'post',
  mimeType = '',
  password = '',
  dateLocal = '2024-07-17 10:20:30',
  dateGmt = '2024-07-17 17:20:30',
}: FixturePost): string {
  const fields = [
    String(id),
    '777',
    sqlString(dateLocal),
    sqlString(dateGmt),
    sqlString(content),
    sqlString(`Title ${id}`),
    sqlString(`Excerpt ${id}`),
    sqlString(status),
    sqlString('closed'),
    sqlString('closed'),
    sqlString(password),
    sqlString(slug),
    sqlString(''),
    sqlString(''),
    sqlString('2024-08-01 01:02:03'),
    sqlString('2024-08-01 08:02:03'),
    sqlString(''),
    '0',
    sqlString(`https://example.test/?p=${id}`),
    '0',
    sqlString(postType),
    sqlString(mimeType),
    '0',
  ];

  expect(fields).toHaveLength(WORDPRESS_POST_COLUMNS.length);
  return `(${fields.join(',')})`;
}

function createPostsTable(tableName: string): string {
  const columns = WORDPRESS_POST_COLUMNS.map(
    (column) => `  \`${column}\` longtext NOT NULL`,
  );

  return `CREATE TABLE \`${tableName}\` (\n${columns.join(',\n')}\n) ENGINE=InnoDB;`;
}

function sqlFixture(prefix = 'wp_random_'): string {
  const postsTable = `${prefix}posts`;
  const trickyContent =
    "before, literal ),( and semicolon; quote ' plus slash \\ after\nnext line";

  return `-- Tables outside the fixed posts allowlist must never be decoded.
CREATE TABLE \`${prefix}users\` (\`ID\` bigint, \`user_pass\` text) ENGINE=InnoDB;
INSERT INTO \`${prefix}users\` VALUES (1,'do-not-expose;still-secret');
${createPostsTable(postsTable)}
INSERT INTO \`${postsTable}\` VALUES
${postTuple({ id: 10, content: trickyContent, status: 'private', password: 'post-secret' })},
${postTuple({ id: 20, slug: 'media', postType: 'attachment', mimeType: 'image/png' })};
INSERT INTO \`${prefix}usermeta\` VALUES (1,1,'private_key','do-not-expose-either');
INSERT INTO \`${postsTable}\` VALUES ${postTuple({
    id: 30,
    slug: 'legacy-story',
    postType: 'amp_story',
    content: '<amp-story-page id="one"></amp-story-page>',
  })};`;
}

describe('WordPress posts SQL source parser', () => {
  it('discovers a dynamic prefix and parses both multiline and extended tuples', () => {
    const source = parseWordPressPostsSql(sqlFixture());

    expect(source.tableName).toBe('wp_random_posts');
    expect(source.tablePrefix).toBe('wp_random_');
    expect(source.posts).toHaveLength(3);

    const article = source.posts.find((post) => post.id === 10);

    expect(article).toBeDefined();
    expect(article?.content).toBe(
      "before, literal ),( and semicolon; quote ' plus slash \\ after\nnext line",
    );
    expect(article?.status).toBe('private');
    expect(article?.dates).toEqual({
      published: {
        local: '2024-07-17 10:20:30',
        gmt: '2024-07-17 17:20:30',
      },
      modified: {
        local: '2024-08-01 01:02:03',
        gmt: '2024-08-01 08:02:03',
      },
    });
    expect(JSON.stringify(source)).not.toContain('post-secret');
    expect(JSON.stringify(source)).not.toContain('do-not-expose');
  });

  it('returns migration-specific status, MIME, and legacy Story projections', () => {
    const source = parseWordPressPostsSql(sqlFixture());

    expect(selectHistoricalPostStatuses(source)).toEqual([
      { wpId: 10, slug: 'post-10', originalStatus: 'private' },
    ]);
    expect(selectAttachmentMimes(source)).toEqual([
      { wpId: 20, mimeType: 'image/png' },
    ]);
    expect(selectLegacyAmpStories(source)).toMatchObject([
      { id: 30, slug: 'legacy-story', postType: 'amp_story' },
    ]);
  });

  it('accepts a gzip buffer without changing the parser result', () => {
    const sql = sqlFixture('custom_');

    expect(parseWordPressPostsGzip(gzipSync(sql))).toEqual(
      parseWordPressPostsSql(sql),
    );
  });

  it('asserts the exact 23-field posts tuple shape', () => {
    const validTuple = postTuple({ id: 1 });
    const lastComma = validTuple.lastIndexOf(',');
    const shortTuple = `${validTuple.slice(0, lastComma)})`;
    const fixture = `${createPostsTable('wp_posts')}\nINSERT INTO \`wp_posts\` VALUES ${shortTuple};`;

    expect(() => parseWordPressPostsSql(fixture)).toThrow(
      /has 22 fields; expected 23/,
    );
  });

  it('rejects a dump without a standard WordPress posts schema', () => {
    const fixture =
      'CREATE TABLE `wp_users` (`ID` bigint);\nINSERT INTO `wp_users` VALUES (1);';

    expect(() => parseWordPressPostsSql(fixture)).toThrow(
      new SourceParseError(
        'No standard WordPress posts table was found in the SQL dump.',
      ),
    );
  });
});
