import * as astroPlugin from 'prettier-plugin-astro';

export default {
  plugins: [astroPlugin],
  singleQuote: true,
  trailingComma: 'all',
  overrides: [
    {
      files: '*.astro',
      options: { parser: 'astro' },
    },
  ],
};
