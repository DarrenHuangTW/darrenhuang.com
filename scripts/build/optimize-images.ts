import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { load } from 'cheerio';
import sharp from 'sharp';

type OutputFormat = 'avif' | 'webp';

interface ImageVariant {
  artifactPath: string;
  bytes: number;
  format: OutputFormat;
  width: number;
}

interface OptimizedImage {
  artifactPath: string;
  bytes: number;
  height: number;
  variants: ImageVariant[];
  width: number;
}

export interface ImageOptimizationOptions {
  basePath?: string;
  cacheRoot: string;
  concurrency?: number;
  distRoot: string;
  minBytes?: number;
  minWidth?: number;
}

export interface ImageOptimizationSummary {
  htmlFilesChanged: number;
  originalBytes: number;
  sourceImages: number;
  variantBytes: number;
  variants: number;
}

const OPTIMIZER_VERSION = 'responsive-v1-webp82-avif58-lossless-png';
const RESPONSIVE_WIDTHS = [480, 800, 1200, 1600];
const SUPPORTED_IMAGE = /\.(?:jpe?g|png|webp)$/iu;

function normalizeBase(value: string): string {
  const normalized = `/${value.replace(/^\/+|\/+$/gu, '')}`;
  return normalized === '/' ? '' : normalized;
}

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(absolute)));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }

  return files;
}

function artifactRelative(root: string, file: string): string {
  return path.relative(root, file).replaceAll('\\', '/');
}

function safeDecodePath(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function resolveLocalImageArtifact(
  htmlArtifact: string,
  source: string,
  basePath = '/',
): string | null {
  const trimmed = source.trim();
  if (!trimmed || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/iu.test(trimmed)) {
    return null;
  }

  const pathname = trimmed.split('#', 1)[0]!.split('?', 1)[0]!;
  const decoded = safeDecodePath(pathname);
  if (decoded === null || decoded.includes('\0')) return null;

  const base = normalizeBase(basePath);
  let relative: string;
  if (decoded.startsWith('/')) {
    const withoutBase =
      base && (decoded === base || decoded.startsWith(`${base}/`))
        ? decoded.slice(base.length)
        : decoded;
    relative = withoutBase.replace(/^\/+/, '');
  } else {
    relative = path.posix.join(path.posix.dirname(htmlArtifact), decoded);
  }

  const normalized = path.posix.normalize(relative);
  if (
    !normalized ||
    normalized === '.' ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized) ||
    !SUPPORTED_IMAGE.test(normalized)
  ) {
    return null;
  }

  if (
    !normalized.startsWith('wp-content/uploads/') &&
    !normalized.startsWith('images/')
  ) {
    return null;
  }

  return normalized;
}

async function pathExists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function mapLimited<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, values.length));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await task(values[index]!);
      }
    }),
  );

  return results;
}

function outputFormats(extension: string): OutputFormat[] {
  if (extension === '.png') return ['webp'];
  if (extension === '.jpg' || extension === '.jpeg') {
    return ['avif', 'webp'];
  }
  return ['webp'];
}

async function renderVariant(options: {
  cacheFile: string;
  extension: string;
  format: OutputFormat;
  source: Buffer;
  width: number;
}): Promise<{ bytes: number; width: number }> {
  if (await pathExists(options.cacheFile)) {
    try {
      const cached = await readFile(options.cacheFile);
      const metadata = await sharp(cached).metadata();
      return {
        bytes: cached.length,
        width: metadata.width ?? options.width,
      };
    } catch {
      // An interrupted prior build can leave a partial cache entry; regenerate it.
    }
  }

  await mkdir(path.dirname(options.cacheFile), { recursive: true });
  let pipeline = sharp(options.source, {
    animated: false,
    limitInputPixels: 100_000_000,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      fit: 'inside',
      width: options.width,
      withoutEnlargement: true,
    });

  if (options.format === 'avif') {
    pipeline = pipeline.avif({ effort: 3, quality: 58 });
  } else if (options.extension === '.png') {
    pipeline = pipeline.webp({ effort: 4, lossless: true });
  } else {
    pipeline = pipeline.webp({ effort: 4, quality: 82 });
  }

  const rendered = await pipeline.toBuffer({ resolveWithObject: true });
  await writeFile(options.cacheFile, rendered.data);

  return {
    bytes: rendered.data.length,
    width: rendered.info.width,
  };
}

async function optimizeSource(
  artifactPath: string,
  options: Required<ImageOptimizationOptions>,
): Promise<OptimizedImage | null> {
  const absoluteSource = path.join(
    options.distRoot,
    ...artifactPath.split('/'),
  );
  const source = await readFile(absoluteSource);
  const metadata = await sharp(source, {
    animated: false,
    limitInputPixels: 100_000_000,
    sequentialRead: true,
  }).metadata();
  const width = metadata.autoOrient.width ?? metadata.width ?? 0;
  const height = metadata.autoOrient.height ?? metadata.height ?? 0;
  if (
    source.length < options.minBytes ||
    width < options.minWidth ||
    height === 0 ||
    (metadata.pages ?? 1) > 1
  ) {
    return null;
  }

  const sourceHash = createHash('sha256').update(source).digest('hex');
  const assetKey = createHash('sha256')
    .update(`${sourceHash}:${OPTIMIZER_VERSION}`)
    .digest('hex')
    .slice(0, 20);
  const extension = path.extname(artifactPath).toLocaleLowerCase('en-US');
  const largestWidth = Math.min(width, RESPONSIVE_WIDTHS.at(-1)!);
  const widths = [
    ...new Set([
      ...RESPONSIVE_WIDTHS.filter((candidate) => candidate < largestWidth),
      largestWidth,
    ]),
  ].toSorted((left, right) => left - right);
  const variants: ImageVariant[] = [];

  for (const format of outputFormats(extension)) {
    for (const requestedWidth of widths) {
      const cacheFile = path.join(
        options.cacheRoot,
        assetKey,
        `${requestedWidth}.${format}`,
      );
      const rendered = await renderVariant({
        cacheFile,
        extension,
        format,
        source,
        width: requestedWidth,
      });
      if (rendered.bytes >= source.length * 0.98) continue;

      const outputArtifact = `_optimized/${assetKey}/${rendered.width}.${format}`;
      const outputFile = path.join(
        options.distRoot,
        ...outputArtifact.split('/'),
      );
      await mkdir(path.dirname(outputFile), { recursive: true });
      await copyFile(cacheFile, outputFile);
      variants.push({
        artifactPath: outputArtifact,
        bytes: rendered.bytes,
        format,
        width: rendered.width,
      });
    }
  }

  return variants.length > 0
    ? {
        artifactPath,
        bytes: source.length,
        height,
        variants,
        width,
      }
    : null;
}

function imageSizes(image: ReturnType<ReturnType<typeof load>>): string {
  if (image.closest('.article__hero').length > 0) {
    return '(max-width: 66rem) calc(100vw - 2rem), 64rem';
  }

  if (image.closest('.photo-carousel').length > 0) {
    return '(max-width: 74rem) calc(100vw - 2rem), 72rem';
  }

  return '(max-width: 52rem) calc(100vw - 2rem), 50rem';
}

function variantUrl(artifactPath: string, basePath: string): string {
  const base = normalizeBase(basePath);
  return `${base}/${artifactPath.replace(/^\/+/, '')}`;
}

export async function optimizeBuiltImages(
  provided: ImageOptimizationOptions,
): Promise<ImageOptimizationSummary> {
  const options: Required<ImageOptimizationOptions> = {
    basePath: provided.basePath ?? '/',
    cacheRoot: provided.cacheRoot,
    concurrency: provided.concurrency ?? 4,
    distRoot: provided.distRoot,
    minBytes: provided.minBytes ?? 64 * 1024,
    minWidth: provided.minWidth ?? 480,
  };
  const allFiles = await walkFiles(options.distRoot);
  const htmlFiles = allFiles.filter((file) =>
    file.toLocaleLowerCase('en-US').endsWith('.html'),
  );
  const sourceArtifacts = new Set<string>();

  for (const htmlFile of htmlFiles) {
    const relative = artifactRelative(options.distRoot, htmlFile);
    if (relative.startsWith('web-stories/')) continue;
    const $ = load(await readFile(htmlFile, 'utf8'));
    $('main img[src]').each((_index, element) => {
      const source = $(element).attr('src');
      if (!source) return;
      const resolved = resolveLocalImageArtifact(
        relative,
        source,
        options.basePath,
      );
      if (resolved) sourceArtifacts.add(resolved);
    });
  }

  const optimizedResults = await mapLimited(
    [...sourceArtifacts].toSorted(),
    options.concurrency,
    (artifact) => optimizeSource(artifact, options),
  );
  const optimizedByPath = new Map(
    optimizedResults
      .filter((image): image is OptimizedImage => image !== null)
      .map((image) => [image.artifactPath, image]),
  );
  let htmlFilesChanged = 0;

  for (const htmlFile of htmlFiles) {
    const relative = artifactRelative(options.distRoot, htmlFile);
    if (relative.startsWith('web-stories/')) continue;
    const source = await readFile(htmlFile, 'utf8');
    const $ = load(source);
    let changed = false;

    $('main img[src]').each((_index, element) => {
      const image = $(element);
      if (image.parent('picture').length > 0) return;
      const imageSource = image.attr('src');
      if (!imageSource) return;
      const resolved = resolveLocalImageArtifact(
        relative,
        imageSource,
        options.basePath,
      );
      const optimized = resolved ? optimizedByPath.get(resolved) : undefined;
      if (!optimized) return;

      const declaredWidth = Number(image.attr('width'));
      const declaredHeight = Number(image.attr('height'));
      if (declaredWidth > 0) {
        image.attr('width', String(Math.round(declaredWidth)));
        image.attr(
          'height',
          String(
            Math.max(
              1,
              Math.round((declaredWidth * optimized.height) / optimized.width),
            ),
          ),
        );
      } else if (declaredHeight > 0) {
        image.attr('height', String(Math.round(declaredHeight)));
        image.attr(
          'width',
          String(
            Math.max(
              1,
              Math.round((declaredHeight * optimized.width) / optimized.height),
            ),
          ),
        );
      } else {
        image.attr('width', String(optimized.width));
        image.attr('height', String(optimized.height));
      }
      const sizes = imageSizes(image);
      image.attr('sizes', sizes);
      image.wrap('<picture data-responsive-image="true"></picture>');
      const picture = image.parent();

      for (const format of ['webp', 'avif'] as const) {
        const variants = optimized.variants
          .filter((variant) => variant.format === format)
          .toSorted((left, right) => left.width - right.width);
        if (variants.length === 0) continue;
        const sourceElement = $('<source>')
          .attr('type', `image/${format}`)
          .attr('sizes', sizes)
          .attr(
            'srcset',
            variants
              .map(
                (variant) =>
                  `${variantUrl(variant.artifactPath, options.basePath)} ${variant.width}w`,
              )
              .join(', '),
          );
        picture.prepend(sourceElement);
      }

      changed = true;
    });

    if (changed) {
      await writeFile(htmlFile, $.html(), 'utf8');
      htmlFilesChanged += 1;
    }
  }

  const optimizedImages = [...optimizedByPath.values()];
  const variants = optimizedImages.flatMap((image) => image.variants);
  const summary = {
    htmlFilesChanged,
    originalBytes: optimizedImages.reduce(
      (total, image) => total + image.bytes,
      0,
    ),
    sourceImages: optimizedImages.length,
    variantBytes: variants.reduce((total, variant) => total + variant.bytes, 0),
    variants: variants.length,
  };

  if (optimizedImages.length > 0) {
    const manifestPath = path.join(
      options.distRoot,
      '_optimized',
      'manifest.json',
    );
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(
      manifestPath,
      `${JSON.stringify(
        {
          version: OPTIMIZER_VERSION,
          images: optimizedImages,
          summary,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  return summary;
}

async function main(): Promise<void> {
  const root = process.cwd();
  const summary = await optimizeBuiltImages({
    basePath: process.env.BASE_PATH ?? '/',
    cacheRoot: path.join(root, '.tmp', 'responsive-image-cache'),
    distRoot: path.join(root, 'dist'),
  });
  const sourceMib = summary.originalBytes / (1024 * 1024);
  const variantMib = summary.variantBytes / (1024 * 1024);

  console.log(
    `[image-optimizer] PASS: ${summary.sourceImages} source images produced ${summary.variants} responsive variants across ${summary.htmlFilesChanged} HTML files (${sourceMib.toFixed(1)} MiB originals, ${variantMib.toFixed(1)} MiB variants).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[image-optimizer] FAILED: ${message}`);
    process.exitCode = 1;
  });
}
