The following minimark section

[
  "key-message-section",
  {
    "buttonLink": "https://bitvocation.substack.com/",
    "buttonText": "Get the Free Guide",
    "icon": "lets-icons:search-alt"
  },
  [
    "template",
    {"v-slot:title": ""},
    [
      "p", {},
      "You don't need to apply to 100 jobs. You just have to be ",
      ["strong", {}, "findable"],
      " by the right one."
    ]
  ],
  [
    "template",
    {"v-slot:description": ""},
    ["p", {}, "Struggling to make into the Bitcoin space?"],
    ["p", {}, "Not sure how to stand out on LinkedIn?"],
    ["p", {}, "Wondering how to prove you're the real deal?"]
  ]
]

does not render correctly using the new <Content> component (that replaced ContentRenderer). It
looks like the template v-slot elements are not correctly parsed.

Have a look at the /Users/radu/Projects/nuxt-content-raw for the full working implementation and
see what is missing in the runtime/content component from content layer to make it work.

Use the "bitvocation" app running at http://localhost:3012/ to make sure the content is rendered correctly. Check the console for errors using playwright mcp server.

## Progress
- [x] Reviewed the Nuxt Content reference implementation to understand template / slot handling.
- [x] Updated `app/components/runtime/content/Content.vue` to translate `<template v-slot:*>` nodes into named slots when rendering.
- [ ] Confirm rendering on `bitvocation` dev instance (`http://localhost:3012/`) once backend content data is available (currently blocked by missing page payload in local environment).
