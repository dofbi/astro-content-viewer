import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
// import { nocodbCollections } from 'astro-nocodb/loaders';
// import { sampleConfig } from './collections/sample/config';

// const API_URL = import.meta.env.API_URL || process.env.API_URL;
// const API_TOKEN = import.meta.env.API_TOKEN || process.env.API_TOKEN;

const blog = defineCollection({
  // Load Markdown and MDX files in the `src/content/blog/` directory.
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  // Type-check frontmatter using a schema
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      description: z.string(),
      // Transform string to Date object
      pubDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      heroImage: image().optional(),
    }),
});

// const data = nocodbCollections({
//   baseUrl: API_URL,
//   apiKey: API_TOKEN,
//   tables: {
//     sample: sampleConfig,
//     // Add other collections here (ressources, elections, etc.)
//   },
// });

export const collections = { 
  blog, 
  // ...data
};