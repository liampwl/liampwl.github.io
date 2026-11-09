import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://liampwl.com',
  output: 'static',
  // Astro 7 defaults to JSX whitespace rules, which drop the space between text
  // and an inline element that starts on a new line. The markup here is written
  // as prose, so keep the lossless compression Astro 5 used.
  compressHTML: true,
  integrations: [sitemap({ filter: (page) => !page.includes('/rally') })],
});
