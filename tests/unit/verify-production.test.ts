import { describe, expect, it } from 'vitest';

import {
  inspectRobots,
  isManagedRobotsCanonicalization,
  isCanonicalProductionUrl,
  isExpectedCanonicalRedirect,
  parseSitemapLocations,
} from '../../scripts/verify/production';

describe('production verification helpers', () => {
  it('accepts the canonical HTTPS origin and rejects other hosts', () => {
    expect(isCanonicalProductionUrl('https://www.darrenhuang.com/')).toBe(true);
    expect(isCanonicalProductionUrl('http://www.darrenhuang.com/')).toBe(false);
    expect(isCanonicalProductionUrl('https://darrenhuang.com/')).toBe(false);
    expect(isCanonicalProductionUrl('https://evil.example/')).toBe(false);
  });

  it('requires a permanent redirect to the canonical host with path and query preserved', () => {
    expect(
      isExpectedCanonicalRedirect(
        'https://darrenhuang.com/articles.html?check=1',
        'https://www.darrenhuang.com/articles.html?check=1',
      ),
    ).toBe(true);
    expect(
      isExpectedCanonicalRedirect(
        'https://darrenhuang.com/articles.html?check=1',
        'https://www.darrenhuang.com/',
      ),
    ).toBe(false);
    expect(
      isExpectedCanonicalRedirect(
        'http://www.darrenhuang.com/',
        'http://www.darrenhuang.com/',
      ),
    ).toBe(false);
  });

  it('parses the raw robots policy without treating escaped text as directives', () => {
    const policy = inspectRobots(
      'User-agent: *\nAllow: /\n\nSitemap: https://www.darrenhuang.com/sitemap-index.xml\n',
    );
    expect(policy.wildcardGroupFound).toBe(true);
    expect(policy.wildcardAllowsRoot).toBe(true);
    expect(policy.wildcardDisallowsRoot).toBe(false);
    expect(policy.sitemapUrls).toEqual([
      'https://www.darrenhuang.com/sitemap-index.xml',
    ]);
  });

  it('parses sitemap indexes and URL sets', () => {
    expect(
      parseSitemapLocations(
        '<sitemapindex><sitemap><loc>https://www.darrenhuang.com/sitemap-0.xml</loc></sitemap></sitemapindex>',
      ),
    ).toEqual({
      kind: 'index',
      locations: ['https://www.darrenhuang.com/sitemap-0.xml'],
    });
    expect(
      parseSitemapLocations(
        '<urlset><url><loc>https://www.darrenhuang.com/</loc></url></urlset>',
      ),
    ).toEqual({
      kind: 'urlset',
      locations: ['https://www.darrenhuang.com/'],
    });
  });

  it('models only the Cloudflare-managed apex robots canonicalization exception', () => {
    const body = 'User-agent: *\nAllow: /\n';
    expect(
      isManagedRobotsCanonicalization(
        'https://darrenhuang.com/robots.txt?check=1',
        200,
        'https://www.darrenhuang.com/robots.txt?check=1',
        'text/plain; charset=utf-8',
        body,
      ),
    ).toBe(true);
    expect(
      isManagedRobotsCanonicalization(
        'https://darrenhuang.com/about.html?check=1',
        200,
        'https://www.darrenhuang.com/about.html?check=1',
        'text/plain; charset=utf-8',
        body,
      ),
    ).toBe(false);
    expect(
      isManagedRobotsCanonicalization(
        'https://darrenhuang.com/robots.txt?check=1',
        200,
        'https://www.darrenhuang.com/robots.txt?check=1',
        'text/plain; charset=utf-8',
        'User-agent: *\nDisallow: /\n',
      ),
    ).toBe(false);
    expect(
      isManagedRobotsCanonicalization(
        'https://darrenhuang.com/robots.txt?check=1',
        200,
        'https://www.darrenhuang.com/robots.txt?check=1',
        'text/plainish; charset=utf-8',
        body,
      ),
    ).toBe(false);
  });
});
