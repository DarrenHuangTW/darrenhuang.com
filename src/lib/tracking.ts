import { PRODUCTION_SITE_URL } from '../../site.config';

export const PUBLIC_TRACKING_CONFIG = Object.freeze({
  googleTagManagerContainerId: 'GTM-M7MNQP',
  googleAnalyticsMeasurementId: 'G-QKH2Z6FJED',
  microsoftClarityProjectId: 'y3ae7h8cjh',
} as const);

function assertPublicTrackingConfig(): void {
  const checks: Array<[label: string, value: string, pattern: RegExp]> = [
    [
      'Google Tag Manager container ID',
      PUBLIC_TRACKING_CONFIG.googleTagManagerContainerId,
      /^GTM-[A-Z0-9]+$/u,
    ],
    [
      'Google Analytics measurement ID',
      PUBLIC_TRACKING_CONFIG.googleAnalyticsMeasurementId,
      /^G-[A-Z0-9]+$/u,
    ],
    [
      'Microsoft Clarity project ID',
      PUBLIC_TRACKING_CONFIG.microsoftClarityProjectId,
      /^[a-z0-9]+$/u,
    ],
  ];

  for (const [label, value, pattern] of checks) {
    if (!pattern.test(value)) {
      throw new Error(`${label} is invalid: ${value}`);
    }
  }
}

assertPublicTrackingConfig();

export function isProductionTrackingTarget(
  site: URL | undefined,
  isProductionBuild: boolean,
  basePath = '/',
): boolean {
  const normalizedBase = basePath.replace(/^\/+|\/+$/gu, '');

  return Boolean(
    isProductionBuild &&
    site &&
    site.origin === PRODUCTION_SITE_URL &&
    normalizedBase === '',
  );
}

export function googleTagManagerBootstrapScript(): string {
  const containerId = JSON.stringify(
    PUBLIC_TRACKING_CONFIG.googleTagManagerContainerId,
  );
  const productionOrigin = JSON.stringify(PRODUCTION_SITE_URL);

  return `if(window.location.origin===${productionOrigin}){(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer',${containerId});}`;
}
