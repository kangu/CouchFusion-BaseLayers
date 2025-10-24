• Schema Gaps

  - types/content-page.ts:1-26 defines ContentPageDocument with title and seo.description,
    but it never carries the top-level description field that Nuxt Content’s page schema
    requires (src/utils/schema/definitions.ts:57-84 in the module). Lists, navigation, and
    search APIs that read document.description will be empty.
  - utils/page-documents.ts:21-28 derives stem from only the last path segment. Nuxt
    Content keeps the entire relative path as the stem (src/utils/content/transformers/
    path-meta.ts:78-91), so nested pages like /docs/getting-started/install should yield
    docs/getting-started/install, not just install. The truncated stem risks collisions and
    can confuse helpers that split stems to recover directory depth.
  - Both conversion helpers normalise navigation to a boolean (utils/page-documents.ts:73,
    server/utils/content-documents.ts:63). The schema also supports an object with title,
    description, and icon for custom sidebar labels (src/utils/schema/definitions.ts:94-
    122), so that metadata would currently be dropped.
  - During sanitisation, seo is collapsed to { title, description } in utils/page-
    documents.ts:66-69 and server/utils/content-documents.ts:32-46. Any extended SEO fields
    (e.g. meta, link) that the schema allows are lost.

  What Already Matches

  - Paths are normalised to a leading-slash format (utils/page-documents.ts:21-28, utils/
    page.ts:1-23).
  - Bodies are stored as { type: 'minimal', value: [...] }, which ContentRenderer handles
    via its Minimark pathway.
  - Meta is always cloned to a plain object before storing (utils/page-documents.ts:71,
    server/utils/content-documents.ts:47-55).

  Bringing this layer in line with the expected Nuxt Content schema means adding a first-
  class description, preserving the full stem from normalizePagePath, supporting object-
  shaped navigation, and keeping any extra SEO fields intact.