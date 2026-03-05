I want to implement a View Composable module inside the Content Layer to handle translations through an agent LLM API.

The module is to be linked from the Content, Workbench, and the Nodes.

It should handle translations in bulk starting from an English locale, for example Then translating and finally returning a compatible structure that repopulates and updates all the translated texts.

There should also be the possibility at the field level to run a translation from uh another language to the current one.

See the /Users/radu/Projects/nuxt-apps/apps/bitvocation/server/api/career-compass/generate.post.ts as a reference implementation of an openai compatible endpoint call.

Keep all input parameters inside the Couch DB database as a document called "llm-translations". Include system prompt and other relevant sections that might be relevant in the context of translations.