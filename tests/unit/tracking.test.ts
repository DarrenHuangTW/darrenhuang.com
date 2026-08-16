import { describe, expect, it } from 'vitest';
import { runInNewContext } from 'node:vm';

import { PRODUCTION_SITE_URL } from '../../site.config';
import {
  googleTagManagerBootstrapScript,
  isProductionTrackingTarget,
  PUBLIC_TRACKING_CONFIG,
} from '../../src/lib/tracking';

describe('public tracking configuration', () => {
  it('keeps the approved public provider IDs in one place', () => {
    expect(PUBLIC_TRACKING_CONFIG).toEqual({
      googleTagManagerContainerId: 'GTM-M7MNQP',
      googleAnalyticsMeasurementId: 'G-QKH2Z6FJED',
      microsoftClarityProjectId: 'y3ae7h8cjh',
    });
  });

  it('only enables tracking for a production build of the canonical origin', () => {
    expect(isProductionTrackingTarget(new URL(PRODUCTION_SITE_URL), true)).toBe(
      true,
    );
    expect(
      isProductionTrackingTarget(new URL(PRODUCTION_SITE_URL), false),
    ).toBe(false);
    expect(
      isProductionTrackingTarget(
        new URL('https://darrenhuangtw.github.io/darrenhuang.com/'),
        true,
      ),
    ).toBe(false);
    expect(
      isProductionTrackingTarget(
        new URL('https://www.darrenhuang.com.example/'),
        true,
      ),
    ).toBe(false);
    expect(
      isProductionTrackingTarget(
        new URL(PRODUCTION_SITE_URL),
        true,
        '/preview/',
      ),
    ).toBe(false);
    expect(isProductionTrackingTarget(undefined, true)).toBe(false);
  });

  it('guards the GTM bootstrap against local and preview origins', () => {
    const source = googleTagManagerBootstrapScript();

    expect(source).toContain(
      `window.location.origin==="${PRODUCTION_SITE_URL}"`,
    );
    expect(source).toContain('https://www.googletagmanager.com/gtm.js?id=');
    expect(source.match(/GTM-M7MNQP/gu)).toHaveLength(1);
    expect(source).not.toContain('G-QKH2Z6FJED');
    expect(source).not.toContain('y3ae7h8cjh');
  });

  it('executes the bootstrap only on the exact production origin', () => {
    function execute(origin: string) {
      const insertedScripts: Array<{ async?: boolean; src?: string }> = [];
      const window = { location: { origin } } as {
        dataLayer?: Array<Record<string, unknown>>;
        location: { origin: string };
      };
      const firstScript = {
        parentNode: {
          insertBefore(script: { async?: boolean; src?: string }) {
            insertedScripts.push(script);
          },
        },
      };
      const document = {
        createElement: () => ({}),
        getElementsByTagName: () => [firstScript],
      };

      runInNewContext(googleTagManagerBootstrapScript(), {
        Date,
        document,
        window,
      });

      return { insertedScripts, window };
    }

    const production = execute(PRODUCTION_SITE_URL);
    expect(production.insertedScripts).toEqual([
      {
        async: true,
        src: 'https://www.googletagmanager.com/gtm.js?id=GTM-M7MNQP',
      },
    ]);
    expect(production.window.dataLayer).toHaveLength(1);
    expect(production.window.dataLayer?.[0]?.event).toBe('gtm.js');

    const preview = execute('http://127.0.0.1:4321');
    expect(preview.insertedScripts).toEqual([]);
    expect(preview.window.dataLayer).toBeUndefined();
  });
});
