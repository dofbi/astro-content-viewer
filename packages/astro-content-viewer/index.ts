import type { AstroIntegration } from 'astro';

const APP_ID = 'content-viewer';

// All possible paths where Astro content config may exist
const CANDIDATE_PATHS = [
  "/src/content/config.ts",
  "/src/content/config.mjs",
  "/src/content/config.js",
  "/src/content.config.ts",
  "/src/content.config.mjs",
  "/src/content.config.js",
];

/**
 * Determine whether an object looks like an Astro collections object.
 */
function looksLikeCollections(obj: any): boolean {
  if (!obj || typeof obj !== "object") return false;

  return Object.values(obj).some((item: any) => {
    if (!item || typeof item !== "object") return false;

    return (
      "schema" in item ||
      "loader" in item ||
      "type" in item
    );
  });
}

/**
 * Auto-detect content config file by trying all candidate paths.
 */
async function findContentConfig(server: any) {
  for (const p of CANDIDATE_PATHS) {
    try {
      const mod = await server.ssrLoadModule(p);

      if (
        mod &&
        (
          looksLikeCollections(mod.collections) ||
          looksLikeCollections(mod.default)
        )
      ) {
        return { path: p, module: mod };
      }

    } catch (_) {
      // continue search
    }
  }
  return null;
}

/**
 * Extract collections from any export format.
 */
function extractCollections(mod: Record<string, any>) {
  // Named export: collections
  if (mod.collections && looksLikeCollections(mod.collections)) {
    return mod.collections;
  }

  // Default export contains { collections }
  if (mod.default && typeof mod.default === "object") {
    if (mod.default.collections && looksLikeCollections(mod.default.collections)) {
      return mod.default.collections;
    }

    // Default export is the collections object
    if (looksLikeCollections(mod.default)) {
      return mod.default;
    }
  }

  // Any named export that looks like collections (ex: export { data })
  for (const [key, value] of Object.entries(mod)) {
    if (key === "default") continue;

    if (looksLikeCollections(value)) {
      return value;
    }
  }

  return null;
}

/**
 * Infer schema from actual entry data.
 */
function inferType(value: any): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  if (value instanceof Date) return 'date';

  const type = typeof value;

  if (type === 'string') {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    if (/^https?:\/\//.test(value)) return 'url';
  }

  return type;
}

function inferSchema(entries: { id: string; data: Record<string, any> }[]) {
  const schema: Record<string, { type: string; examples: any[] }> = {};

  for (const entry of entries) {
    for (const [key, value] of Object.entries(entry.data)) {
      if (!schema[key]) {
        schema[key] = {
          type: inferType(value),
          examples: [],
        };
      }

      if (schema[key].examples.length < 3 && value !== undefined && value !== '') {
        schema[key].examples.push(value);
      }
    }
  }

  return schema;
}

export default function contentViewer(options = {}): AstroIntegration {
  return {
    name: 'astro-content-viewer',

    hooks: {
      'astro:config:setup': ({ addDevToolbarApp }) => {
        addDevToolbarApp({
          id: APP_ID,
          name: 'Content Viewer',
          icon: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" viewBox="0 0 24 24"><defs><linearGradient id="a" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="#D83333"/><stop offset="100%" stop-color="#F041FF"/></linearGradient></defs><rect width="18" height="16" x="3" y="4" rx="2"/><circle cx="8" cy="10" r="1.2" fill="url(#a)" stroke="none"/><circle cx="8" cy="14" r="1.2" fill="url(#a)" stroke="none"/><path d="M11 10h6M11 14h6"/></svg>',
          entrypoint: new URL('./app.ts', import.meta.url),
        });
      },

      'astro:server:setup': ({ server, toolbar }) => {

        toolbar.on('content-viewer:get-collections', async () => {
          const found = await findContentConfig(server);

          if (!found) {
            toolbar.send('content-viewer:collections-data', {
              collections: [],
              error: "Content config not found (checked config.ts/js/mjs variants)",
            });
            return;
          }

          const collections = extractCollections(found.module);

          if (!collections) {
            toolbar.send('content-viewer:collections-data', {
              collections: [],
              error: "No collections object found in the configuration file",
            });
            return;
          }

          toolbar.send('content-viewer:collections-data', {
            collections: Object.keys(collections)
          });
        });

        toolbar.on('content-viewer:get-collection-entries', async (data: any) => {
          try {
            const astroContent = await server.ssrLoadModule('astro:content');

            const entries = await astroContent.getCollection(data.collection);

            const entriesData = entries.map((entry: any) => ({
              id: entry.id || entry.slug || 'unknown',
              data: entry.data || {},
            }));

            toolbar.send('content-viewer:collection-entries', {
              collection: data.collection,
              entries: entriesData,
              schema: inferSchema(entriesData),
            });

          } catch (error) {
            toolbar.send('content-viewer:collection-entries', {
              collection: data.collection,
              entries: [],
              schema: {},
              error: String(error),
            });
          }
        });
      },
    },
  };
}
