import type { PublishedMediaFile } from './media';

export interface EmbedReference {
  provider: string;
  url: string;
}

export interface FeaturedMedia {
  src: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PostManifestEntry {
  wpId: number;
  slug: string;
  title: string;
  canonicalPath: string;
  aliases: string[];
  publishedAt: string;
  updatedAt: string;
  originalStatus: 'publish' | 'private';
  wasMembersOnly: boolean;
  sourceChecksum: string;
  normalizedTextChecksum: string;
  categories: string[];
  tags: string[];
  featuredMedia: FeaturedMedia | null;
  mediaDependencies: string[];
  embeds: EmbedReference[];
}

export interface DraftManifestEntry {
  wpId: number;
  slug: string;
  title: string;
  status: 'draft';
  sourceChecksum: string;
}

export interface PageManifestEntry {
  wpId: number;
  sourceSlug: string;
  slug: string;
  title: string;
  canonicalPath: string;
  aliases: string[];
  decision: 'publish' | 'review' | 'exclude-system-page';
  reason: string;
  sourceChecksum: string;
  mediaDependencies: string[];
}

export interface StoryTranscriptPage {
  id: string;
  order: number;
  lines: string[];
}

export interface StoryManifestEntry {
  slug: string;
  title: string;
  canonicalPath: string;
  aliases: string[];
  modernWpId: number;
  legacyWpId: number;
  modernPageCount: number;
  legacyPageCount: number;
  sourceChecksum: string;
  artifactChecksum: string;
  mediaDependencies: string[];
  remoteMedia: string[];
  transcript: StoryTranscriptPage[];
  comparisonDecision: string;
}

export interface MigrationManifest {
  schemaVersion: 1;
  generatedAt: string;
  sources: {
    wxr: SourceFingerprint;
    latestDatabase: SourceFingerprint;
    memberDatabase: SourceFingerprint;
    uploadsArchive: SourceFingerprint;
  };
  summary: {
    posts: number;
    formerMemberPosts: number;
    draftsExcluded: number;
    pagesPublished: number;
    stories: number;
    mediaFiles: number;
    mediaBytes: number;
  };
  posts: PostManifestEntry[];
  drafts: DraftManifestEntry[];
  pages: PageManifestEntry[];
  stories: StoryManifestEntry[];
  media: {
    files: PublishedMediaFile[];
    duplicateContent: Array<{ sha256: string; paths: string[] }>;
    totalBytes: number;
    externalReferences: string[];
  };
}

export interface SourceFingerprint {
  filename: string;
  bytes: number;
  sha256: string;
}
