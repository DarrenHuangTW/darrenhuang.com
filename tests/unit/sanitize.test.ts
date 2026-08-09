import { describe, expect, it } from 'vitest';

import { sanitizePublicUrl } from '../../scripts/migrate-wordpress/transform/sanitize.js';

describe('public URL sanitization', () => {
  it('removes HTTP userinfo from absolute URLs', () => {
    expect(
      sanitizePublicUrl(
        'https://migration-user:super-secret-password@example.com/private',
      ),
    ).toBe('https://example.com/private');
  });

  it('redacts credentials outside the query after removing query credentials', () => {
    const apiKey = 'A'.repeat(31);
    const signature = 'B'.repeat(48);
    const accessToken = 'C'.repeat(32);
    const sanitized = sanitizePublicUrl(
      `https://example.com/archive/api_key=${apiKey}?Signature=${signature}&keep=1#access_token=${accessToken}`,
    );

    expect(sanitized).toBe(
      'https://example.com/archive/api_key=REDACTED?keep=1#access_token=REDACTED',
    );
    expect(sanitized).not.toContain(signature);
    expect(sanitized).not.toContain(accessToken);
    expect(sanitized).not.toContain(apiKey);
  });

  it('redacts credentials in relative paths and fragments after changing the query', () => {
    const apiKey = 'D'.repeat(31);
    const signature = 'E'.repeat(48);
    const accessToken = 'F'.repeat(32);

    expect(
      sanitizePublicUrl(
        `/archive/api_key=${apiKey}?Signature=${signature}&keep=1#access_token=${accessToken}`,
      ),
    ).toBe('/archive/api_key=REDACTED?keep=1#access_token=REDACTED');
  });

  it('removes capability query parameters while preserving usable parameters', () => {
    const noteKey = `fixture-note-${'N'.repeat(24)}`;
    const shareKey = `fixture-share-${'S'.repeat(24)}`;
    const sanitized = sanitizePublicUrl(
      `https://example.com/note?noteGuid=00000000-0000-4000-8000-000000000000&noteKey=${noteKey}&keep=1&share_key=${shareKey}`,
    );

    expect(sanitized).toBe(
      'https://example.com/note?noteGuid=00000000-0000-4000-8000-000000000000&keep=1',
    );
    expect(sanitized).not.toContain(noteKey);
    expect(sanitized).not.toContain(shareKey);
  });

  it('removes capability parameters from relative HTML-encoded queries', () => {
    const shareToken = `fixture-share-${'T'.repeat(24)}`;

    expect(
      sanitizePublicUrl(`/shared?keep=1&amp;shareToken=${shareToken}#section`),
    ).toBe('/shared?keep=1#section');
  });
});
