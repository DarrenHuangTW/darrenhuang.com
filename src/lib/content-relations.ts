import type { CollectionEntry } from 'astro:content';

type PostEntry = CollectionEntry<'posts'>;
type NoteEntry = CollectionEntry<'notes'>;

export interface ContentRelations {
  notes: NoteEntry[];
  posts: PostEntry[];
}

function normalizeTerm(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('zh-Hant');
}

function sharedTerms(left: string[], right: string[]): number {
  const rightTerms = new Set(right.map(normalizeTerm));
  return left.filter((term) => rightTerms.has(normalizeTerm(term))).length;
}

function explicitPosition(values: string[], value: string): number {
  return values.indexOf(value);
}

function notePostScore(note: NoteEntry, post: PostEntry): number {
  const explicit = explicitPosition(note.data.relatedPosts, post.data.slug);
  const categoryScore =
    sharedTerms(note.data.categories, post.data.categories) * 4;
  const tagScore = sharedTerms(note.data.tags, post.data.tags) * 6;

  return (explicit >= 0 ? 1000 - explicit : 0) + categoryScore + tagScore;
}

function noteNoteScore(left: NoteEntry, right: NoteEntry): number {
  const explicit = explicitPosition(left.data.relatedNotes, right.data.slug);
  const categoryScore =
    sharedTerms(left.data.categories, right.data.categories) * 2;
  const tagScore = sharedTerms(left.data.tags, right.data.tags) * 7;
  const kindScore = left.data.noteKind === right.data.noteKind ? 1 : 0;

  return (
    (explicit >= 0 ? 1000 - explicit : 0) + categoryScore + tagScore + kindScore
  );
}

export function getRelatedNotesForPost(
  post: PostEntry,
  notes: NoteEntry[],
  limit = 3,
): NoteEntry[] {
  return notes
    .filter((note) => note.data.editorialStatus === 'published')
    .map((note) => ({ note, score: notePostScore(note, post) }))
    .filter(({ score }) => score > 0)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        right.note.data.publishedAt.getTime() -
          left.note.data.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map(({ note }) => note);
}

export function getRelatedContentForNote(
  note: NoteEntry,
  posts: PostEntry[],
  notes: NoteEntry[],
  limit = 3,
): ContentRelations {
  const relatedPosts = posts
    .map((post) => ({ post, score: notePostScore(note, post) }))
    .filter(({ score }) => score >= 6)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        right.post.data.publishedAt.getTime() -
          left.post.data.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map(({ post }) => post);

  const relatedNotes = notes
    .filter(
      (candidate) =>
        candidate.id !== note.id &&
        candidate.data.editorialStatus === 'published',
    )
    .map((candidate) => ({
      note: candidate,
      score: noteNoteScore(note, candidate),
    }))
    .filter(({ score }) => score >= 7)
    .toSorted(
      (left, right) =>
        right.score - left.score ||
        right.note.data.publishedAt.getTime() -
          left.note.data.publishedAt.getTime(),
    )
    .slice(0, limit)
    .map(({ note: candidate }) => candidate);

  return { notes: relatedNotes, posts: relatedPosts };
}
