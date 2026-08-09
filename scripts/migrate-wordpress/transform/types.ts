export type GutenbergAttributes = Record<string, unknown> | null;

export interface GutenbergBlock {
  blockName: string | null;
  attrs: GutenbergAttributes;
  innerBlocks: GutenbergBlock[];
  innerHTML: string;
  innerContent: Array<string | null>;
}

export type EmbedProvider =
  'facebook' | 'generic' | 'slideshare' | 'spotify' | 'twitter' | 'youtube';

export interface EmbedReportEntry {
  blockName: string;
  provider: EmbedProvider;
  sourceUrl: string;
  renderedAs:
    'generic-fallback' | 'lazy-iframe' | 'permanent-link' | 'url-blockquote';
}

export type MediaDependencyKind =
  'audio' | 'document' | 'image' | 'poster' | 'video';

export interface MediaDependency {
  external: boolean;
  kind: MediaDependencyKind;
  originalUrl: string;
  rewrittenUrl: string;
}

export interface UnknownBlockReportEntry {
  attrs: GutenbergAttributes;
  blockName: string;
  htmlPreview: string;
  strategy: 'sanitized-html';
}

export interface TransformReport {
  embeds: EmbedReportEntry[];
  mediaDependencies: MediaDependency[];
  unknownBlocks: UnknownBlockReportEntry[];
  warnings: string[];
}

export interface TransformOptions {
  internalHosts?: string[];
}

export interface TransformResult {
  ast: GutenbergBlock[];
  html: string;
  report: TransformReport;
}

export type StoryAssetKind =
  'audio' | 'image' | 'poster' | 'publisher-logo' | 'video';

export interface StoryAsset {
  attribute: string;
  external: boolean;
  kind: StoryAssetKind;
  pageIndex: number | null;
  rewrittenUrl: string;
  sourceUrl: string;
  tagName: string;
}

export interface StoryPageAnalysis {
  assets: StoryAsset[];
  autoAdvanceAfter: string | null;
  id: string;
  index: number;
  links: string[];
  transcript: string[];
}

export interface StoryAnalysisOptions extends TransformOptions {
  canonicalUrl?: string;
  language?: string;
  publisherLogoUrl?: string;
  siteUrl?: string;
  slug?: string;
  title?: string;
}

export interface StoryAnalysis {
  assets: StoryAsset[];
  canonicalUrl: string | null;
  language: string;
  links: string[];
  normalizedHtml: string;
  pageCount: number;
  pages: StoryPageAnalysis[];
  title: string;
  transcript: string[];
  warnings: string[];
}
