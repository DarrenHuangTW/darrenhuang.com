export interface WordPressDatePair {
  local: string;
  gmt: string;
}

export interface WordPressSourceDates {
  published: WordPressDatePair;
  modified: WordPressDatePair;
}

export interface WxrCategory {
  domain: string;
  nicename: string;
  name: string;
}

export interface WxrPostMeta {
  key: string;
  value: string;
}

export interface WxrItem {
  wpId: number;
  title: string;
  link: string;
  guid: string;
  content: string;
  excerpt: string;
  slug: string;
  status: string;
  postType: string;
  parentId: number;
  menuOrder: number;
  dates: WordPressSourceDates;
  categories: WxrCategory[];
  postMeta: WxrPostMeta[];
  attachmentUrl: string | null;
}

export interface WxrSource {
  title: string;
  link: string;
  baseSiteUrl: string;
  baseBlogUrl: string;
  items: WxrItem[];
}

export interface WordPressSqlPost {
  id: number;
  title: string;
  content: string;
  excerpt: string;
  status: string;
  slug: string;
  postType: string;
  parentId: number;
  guid: string;
  mimeType: string;
  dates: WordPressSourceDates;
}

export interface WordPressPostsSqlSource {
  tableName: string;
  tablePrefix: string;
  posts: WordPressSqlPost[];
}

export interface HistoricalPostStatus {
  wpId: number;
  slug: string;
  originalStatus: string;
}

export interface AttachmentMime {
  wpId: number;
  mimeType: string;
}

export class SourceParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceParseError';
  }
}
