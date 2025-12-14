// @ts-check
import { defineConfig } from 'astro/config';
import contentViewer from 'astro-content-viewer';

// https://astro.build/config
export default defineConfig({
  integrations: [contentViewer()],
  server: {
    allowedHosts: true,
    host: '0.0.0.0',
    port: 5000,
  },
});
