import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { createGunzip, gunzipSync } from 'node:zlib';

import {
  SourceParseError,
  type AttachmentMime,
  type HistoricalPostStatus,
  type WordPressPostsSqlSource,
  type WordPressSqlPost,
} from './types.js';

export const WORDPRESS_POST_COLUMNS = [
  'ID',
  'post_author',
  'post_date',
  'post_date_gmt',
  'post_content',
  'post_title',
  'post_excerpt',
  'post_status',
  'comment_status',
  'ping_status',
  'post_password',
  'post_name',
  'to_ping',
  'pinged',
  'post_modified',
  'post_modified_gmt',
  'post_content_filtered',
  'post_parent',
  'guid',
  'menu_order',
  'post_type',
  'post_mime_type',
  'comment_count',
] as const;

interface CreateTableCandidate {
  tableName: string;
  columns: string[];
}

type InsertMode = 'collect-posts' | 'skip';

interface ActiveInsert {
  tableName: string;
  mode: InsertMode;
  buffer: string;
  inQuote: boolean;
  escaped: boolean;
}

function columnsMatchWordPressPosts(columns: readonly string[]): boolean {
  return (
    columns.length === WORDPRESS_POST_COLUMNS.length &&
    columns.every((column, index) => column === WORDPRESS_POST_COLUMNS[index])
  );
}

function mysqlStringValue(rawValue: string, path: string): string | null {
  const value = rawValue.trim();

  if (value.toUpperCase() === 'NULL') {
    return null;
  }

  if (!value.startsWith("'")) {
    return value;
  }

  if (!value.endsWith("'")) {
    throw new SourceParseError(`Unterminated SQL string at ${path}.`);
  }

  const result: string[] = [];

  for (let index = 1; index < value.length - 1; index += 1) {
    const character = value[index];

    if (character === "'" && value[index + 1] === "'") {
      result.push("'");
      index += 1;
      continue;
    }

    if (character !== '\\') {
      result.push(character ?? '');
      continue;
    }

    index += 1;

    if (index >= value.length - 1) {
      throw new SourceParseError(`Trailing SQL escape at ${path}.`);
    }

    const escaped = value[index] ?? '';
    const replacements: Record<string, string> = {
      '0': '\0',
      b: '\b',
      n: '\n',
      r: '\r',
      t: '\t',
      Z: '\u001a',
    };

    result.push(replacements[escaped] ?? escaped);
  }

  return result.join('');
}

function splitTupleFieldTokens(tuple: string): string[] {
  const fields: string[] = [];
  let start = 0;
  let depth = 0;
  let inQuote = false;
  let escaped = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const character = tuple[index] ?? '';

    if (inQuote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === "'" && tuple[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        inQuote = false;
      }

      continue;
    }

    if (character === "'") {
      inQuote = true;
    } else if (character === '(') {
      depth += 1;
    } else if (character === ')') {
      depth -= 1;
    } else if (character === ',' && depth === 0) {
      fields.push(tuple.slice(start, index));
      start = index + 1;
    }

    if (depth < 0) {
      throw new SourceParseError(
        'Unexpected closing parenthesis in SQL tuple.',
      );
    }
  }

  if (inQuote || escaped || depth !== 0) {
    throw new SourceParseError('Unterminated value in SQL tuple.');
  }

  fields.push(tuple.slice(start));
  return fields;
}

function extractTupleBodies(values: string): string[] {
  const tuples: string[] = [];
  let start = -1;
  let depth = 0;
  let inQuote = false;
  let escaped = false;

  for (let index = 0; index < values.length; index += 1) {
    const character = values[index] ?? '';

    if (inQuote) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === "'" && values[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        inQuote = false;
      }

      continue;
    }

    if (character === "'") {
      inQuote = true;
      continue;
    }

    if (character === '(') {
      if (depth === 0) {
        start = index + 1;
      }

      depth += 1;
      continue;
    }

    if (character === ')') {
      depth -= 1;

      if (depth < 0) {
        throw new SourceParseError(
          'Unexpected closing parenthesis in SQL VALUES statement.',
        );
      }

      if (depth === 0 && start >= 0) {
        tuples.push(values.slice(start, index));
        start = -1;
      }

      continue;
    }

    if (depth === 0 && !/[\s,;]/.test(character)) {
      throw new SourceParseError(
        `Unexpected token ${JSON.stringify(character)} between SQL VALUES tuples.`,
      );
    }
  }

  if (inQuote || escaped || depth !== 0 || start !== -1) {
    throw new SourceParseError('Unterminated SQL VALUES tuple.');
  }

  return tuples;
}

function requiredSqlString(
  fields: readonly string[],
  index: number,
  path: string,
): string {
  const value = mysqlStringValue(fields[index] ?? '', path);

  if (value === null) {
    throw new SourceParseError(`Unexpected NULL at ${path}.`);
  }

  return value;
}

function strictSqlInteger(
  fields: readonly string[],
  index: number,
  path: string,
  options?: { positive?: boolean },
): number {
  const value = requiredSqlString(fields, index, path).trim();

  if (!/^-?\d+$/.test(value)) {
    throw new SourceParseError(
      `Expected an integer at ${path}, received ${JSON.stringify(value)}.`,
    );
  }

  const parsed = Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    (options?.positive === true && parsed <= 0)
  ) {
    throw new SourceParseError(
      `Integer at ${path} is outside the supported range.`,
    );
  }

  return parsed;
}

function parsePostTuple(tuple: string, rowNumber: number): WordPressSqlPost {
  const fields = splitTupleFieldTokens(tuple);
  const path = `posts row ${rowNumber}`;

  if (fields.length !== WORDPRESS_POST_COLUMNS.length) {
    throw new SourceParseError(
      `${path} has ${fields.length} fields; expected ${WORDPRESS_POST_COLUMNS.length}.`,
    );
  }

  // Decode only migration-safe columns. In particular, post_author and post_password
  // are deliberately never decoded or returned.
  return {
    id: strictSqlInteger(fields, 0, `${path}.ID`, { positive: true }),
    title: requiredSqlString(fields, 5, `${path}.post_title`),
    content: requiredSqlString(fields, 4, `${path}.post_content`),
    excerpt: requiredSqlString(fields, 6, `${path}.post_excerpt`),
    status: requiredSqlString(fields, 7, `${path}.post_status`),
    slug: requiredSqlString(fields, 11, `${path}.post_name`),
    postType: requiredSqlString(fields, 20, `${path}.post_type`),
    parentId: strictSqlInteger(fields, 17, `${path}.post_parent`),
    guid: requiredSqlString(fields, 18, `${path}.guid`),
    mimeType: requiredSqlString(fields, 21, `${path}.post_mime_type`),
    dates: {
      published: {
        local: requiredSqlString(fields, 2, `${path}.post_date`),
        gmt: requiredSqlString(fields, 3, `${path}.post_date_gmt`),
      },
      modified: {
        local: requiredSqlString(fields, 14, `${path}.post_modified`),
        gmt: requiredSqlString(fields, 15, `${path}.post_modified_gmt`),
      },
    },
  };
}

class WordPressPostsSqlParser {
  private createCandidate: CreateTableCandidate | null = null;

  private activeInsert: ActiveInsert | null = null;

  private postsTableName: string | null = null;

  private readonly posts: WordPressSqlPost[] = [];

  pushLine(line: string): void {
    if (this.activeInsert !== null) {
      this.consumeInsertFragment(line);
      return;
    }

    if (this.createCandidate !== null) {
      this.consumeCreateTableLine(line);
      return;
    }

    const createMatch = /^\s*CREATE TABLE(?: IF NOT EXISTS)?\s+`([^`]+)`/i.exec(
      line,
    );

    if (createMatch !== null) {
      const tableName = createMatch[1] ?? '';

      if (tableName.endsWith('_posts')) {
        this.createCandidate = { tableName, columns: [] };
      }

      return;
    }

    const insertMatch = /^\s*INSERT INTO\s+`([^`]+)`\s+VALUES\s*/i.exec(line);

    if (insertMatch === null) {
      return;
    }

    const tableName = insertMatch[1] ?? '';

    if (tableName.endsWith('_posts') && this.postsTableName === null) {
      throw new SourceParseError(
        `Encountered INSERT for ${tableName} before discovering a valid WordPress posts schema.`,
      );
    }

    this.activeInsert = {
      tableName,
      mode: tableName === this.postsTableName ? 'collect-posts' : 'skip',
      buffer: '',
      inQuote: false,
      escaped: false,
    };
    this.consumeInsertFragment(line.slice(insertMatch[0].length));
  }

  finish(): WordPressPostsSqlSource {
    if (this.createCandidate !== null) {
      throw new SourceParseError(
        `Unterminated CREATE TABLE statement for ${this.createCandidate.tableName}.`,
      );
    }

    if (this.activeInsert !== null) {
      throw new SourceParseError(
        `Unterminated INSERT statement for ${this.activeInsert.tableName}.`,
      );
    }

    if (this.postsTableName === null) {
      throw new SourceParseError(
        'No standard WordPress posts table was found in the SQL dump.',
      );
    }

    const seenIds = new Set<number>();

    for (const post of this.posts) {
      if (seenIds.has(post.id)) {
        throw new SourceParseError(
          `Duplicate WordPress post ID ${post.id} in SQL dump.`,
        );
      }

      seenIds.add(post.id);
    }

    return {
      tableName: this.postsTableName,
      tablePrefix: this.postsTableName.slice(0, -'posts'.length),
      posts: this.posts,
    };
  }

  private consumeCreateTableLine(line: string): void {
    const candidate = this.createCandidate;

    if (candidate === null) {
      return;
    }

    const columnMatch = /^\s*`([^`]+)`\s+/.exec(line);

    if (columnMatch !== null) {
      candidate.columns.push(columnMatch[1] ?? '');
    }

    if (!/^\s*\)\s*(?:ENGINE\s*=|;)/i.test(line)) {
      return;
    }

    if (columnsMatchWordPressPosts(candidate.columns)) {
      if (
        this.postsTableName !== null &&
        this.postsTableName !== candidate.tableName
      ) {
        throw new SourceParseError(
          `Multiple standard WordPress posts tables found: ${this.postsTableName} and ${candidate.tableName}.`,
        );
      }

      this.postsTableName = candidate.tableName;
    }

    this.createCandidate = null;
  }

  private consumeInsertFragment(fragment: string): void {
    const active = this.activeInsert;

    if (active === null) {
      return;
    }

    let statementEnd = -1;

    for (let index = 0; index < fragment.length; index += 1) {
      const character = fragment[index] ?? '';

      if (active.inQuote) {
        if (active.escaped) {
          active.escaped = false;
        } else if (character === '\\') {
          active.escaped = true;
        } else if (character === "'" && fragment[index + 1] === "'") {
          index += 1;
        } else if (character === "'") {
          active.inQuote = false;
        }

        continue;
      }

      if (character === "'") {
        active.inQuote = true;
      } else if (character === ';') {
        statementEnd = index;
        break;
      }
    }

    if (active.mode === 'collect-posts') {
      active.buffer +=
        statementEnd >= 0 ? fragment.slice(0, statementEnd + 1) : fragment;
    }

    if (statementEnd < 0) {
      return;
    }

    if (active.mode === 'collect-posts') {
      for (const tuple of extractTupleBodies(active.buffer)) {
        this.posts.push(parsePostTuple(tuple, this.posts.length + 1));
      }
    }

    this.activeInsert = null;
    const remainder = fragment.slice(statementEnd + 1);

    if (remainder.trim().length > 0) {
      this.pushLine(remainder);
    }
  }
}

export function parseWordPressPostsSql(sql: string): WordPressPostsSqlSource {
  const parser = new WordPressPostsSqlParser();

  for (const line of sql.split('\n')) {
    parser.pushLine(`${line}\n`);
  }

  return parser.finish();
}

export function parseWordPressPostsGzip(
  gzip: Uint8Array,
): WordPressPostsSqlSource {
  try {
    return parseWordPressPostsSql(gunzipSync(gzip).toString('utf8'));
  } catch (error) {
    if (error instanceof SourceParseError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new SourceParseError(`Unable to read gzip SQL dump: ${message}`);
  }
}

export async function readWordPressPostsGzipFile(
  path: string,
): Promise<WordPressPostsSqlSource> {
  const parser = new WordPressPostsSqlParser();
  const gunzip = createReadStream(path).pipe(createGunzip());
  const lines = createInterface({ input: gunzip, crlfDelay: Infinity });

  for await (const line of lines) {
    parser.pushLine(`${line}\n`);
  }

  return parser.finish();
}

export function selectHistoricalPostStatuses(
  source: WordPressPostsSqlSource,
): HistoricalPostStatus[] {
  return source.posts
    .filter((post) => post.postType === 'post')
    .map((post) => ({
      wpId: post.id,
      slug: post.slug,
      originalStatus: post.status,
    }))
    .sort((left, right) => left.wpId - right.wpId);
}

export function selectAttachmentMimes(
  source: WordPressPostsSqlSource,
): AttachmentMime[] {
  return source.posts
    .filter((post) => post.postType === 'attachment')
    .map((post) => ({ wpId: post.id, mimeType: post.mimeType }))
    .sort((left, right) => left.wpId - right.wpId);
}

export function selectLegacyAmpStories(
  source: WordPressPostsSqlSource,
): WordPressSqlPost[] {
  return source.posts
    .filter((post) => post.postType === 'amp_story')
    .sort((left, right) => left.id - right.id);
}
