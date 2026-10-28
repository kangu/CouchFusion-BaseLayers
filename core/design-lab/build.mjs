// Writes the design-lab pages: one HTML file per variant per page, plus index.html to compare them.
// Run: node design-lab/build.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const pages = [
  ['overview', 'Overview', 'Is every site’s data where it should be?'],
  ['databases', 'Databases', 'Which databases need compaction or clean-up?'],
  ['database', 'Database detail', 'Is indux-orders healthy and backed up?'],
  ['users', 'Users', 'Who can sign in, and with which roles?'],
  ['content', 'Content builder', 'What changes on this page before it is published?'],
  ['orders', 'Orders', 'Which paid orders still need fulfilling?'],
  ['analytics', 'Analytics', 'Where did this month’s visitors come from?'],
  ['settings', 'Settings', 'How is this workspace branded, signed into and guarded?'],
]
const variants = [
  { id: 'a', dir: 'a-sheet', css: ['a-sheet.css'], shell: 'frame', name: 'Framed sheet', theme: 'light',
    fonts: 'family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500',
    move: 'A stone-tinted frame holds the navigation and a 48px search bar; the work sits on one white sheet with a hairline edge. Database names, IDs and revisions are set in IBM Plex Mono.' },
  { id: 'b', dir: 'b-ledger', css: ['b-ledger.css'], shell: 'plane', name: 'Ledger', theme: 'light',
    fonts: 'family=Geist:wght@400;500;700&family=Geist+Mono:wght@400;500',
    move: 'No colour in the chrome: white cards on a blue-grey ground, a near-black primary, and one blue on the main data, such as the live data inside each database file.' },
  { id: 'c', dir: 'c-terminal', css: ['c-terminal.css'], shell: 'tframe', name: 'Terminal', theme: 'dark',
    fonts: 'family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
    move: 'A dark control room for long sessions: every selection is a 1px line in CouchFusion orange, every figure sits in a monospace, and the failing job leads the overview.' },
  { id: 'd', dir: 'd-terminal-light', css: ['c-terminal.css', 'd-terminal-light.css'], shell: 'tframe', name: 'Terminal light', theme: 'light',
    fonts: 'family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500',
    move: 'The Terminal layout in daylight: the same ruled top bar, 1px orange selection lines and monospace figures, on white cards with a hairline edge and no shadows.' },
]

const head = (title, fonts, extra = '') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?${fonts}&display=swap" rel="stylesheet">
${extra}
</head>`

for (const v of variants) {
  const dir = join(root, v.dir)
  mkdirSync(dir, { recursive: true })
  for (const [key, label] of pages) {
    writeFileSync(join(dir, `${key}.html`), `${head(`${label} · CF Cloud`, v.fonts, `<link rel="stylesheet" href="../shared/base.css">\n${v.css.map((c) => `<link rel="stylesheet" href="../variants/${c}">`).join('\n')}`)}
<body data-page="${key}">
<script>window.VARIANT = ${JSON.stringify({ id: v.id, shell: v.shell, name: v.name })}</script>
<script src="../shared/data.js"></script>
<script src="../shared/charts.js"></script>
<script src="../shared/render.js"></script>
</body>
</html>
`)
  }
}

const card = (v) => `<section class="variant" aria-labelledby="v-${v.id}">
  <div class="v-head"><h2 id="v-${v.id}">${v.name}</h2><span class="tag">${v.theme}</span></div>
  <p>${v.move}</p>
  <a class="shot" href="${v.dir}/overview.html" aria-label="Open the ${v.name} overview"><iframe src="${v.dir}/overview.html" title="${v.name} overview" loading="lazy" tabindex="-1"></iframe></a>
  <ul class="links">${pages.map(([k, l]) => `<li><a href="${v.dir}/${k}.html">${l}</a></li>`).join('')}</ul>
</section>`

writeFileSync(join(root, 'index.html'), `${head('CF Cloud design lab', 'family=IBM+Plex+Sans:wght@400;500;600', `<style>
:root { --ground: #f5f5f2; --surface: #fff; --text: #131416; --muted: #5d5f60; --border: #e3e4e0; }
* { box-sizing: border-box; } body { margin: 0; background: var(--ground); color: var(--text); font: 15px/22px "IBM Plex Sans", system-ui, sans-serif; }
main { max-width: 1400px; margin: 0 auto; padding: 40px 24px 64px; }
h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; } .lede { margin: 8px 0 0; max-width: 70ch; color: var(--muted); }
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; margin-top: 32px; }
.variant { display: grid; gap: 14px; align-content: start; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
.v-head { display: flex; align-items: baseline; gap: 10px; } h2 { margin: 0; font-size: 20px; } .tag { font-size: 13px; color: var(--muted); }
.variant p { margin: 0; color: var(--muted); min-height: 88px; }
.shot { display: block; position: relative; aspect-ratio: 1440 / 900; overflow: hidden; border-radius: 8px; border: 1px solid var(--border); }
.shot iframe { position: absolute; top: 0; left: 0; width: 1440px; height: 900px; border: 0; transform-origin: 0 0; pointer-events: none; }
.links { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2px 16px; }
.links a { display: block; padding: 6px 0; text-decoration: none; color: var(--text); font-weight: 500; }
.links a:hover { text-decoration: underline; text-underline-offset: 3px; }
.compare { margin-top: 40px; } .compare h2 { font-size: 18px; } .compare table { width: 100%; border-collapse: collapse; margin-top: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
.compare th, .compare td { text-align: left; padding: 10px 16px; border-bottom: 1px solid #efefec; } .compare th { font-weight: 400; font-size: 13px; color: var(--muted); }
.compare td a { color: var(--text); } .compare td.q { color: var(--muted); }
@media (max-width: 1000px) { .grid { grid-template-columns: 1fr; } .variant p { min-height: 0; } .compare .q { display: none; } }
</style>`)}
<body>
<main>
<h1>CF Cloud admin, four directions</h1>
<p class="lede">The same eight screens in four styles, built from one sample dataset. Database names and sizes are real; people, orders, visits and replication jobs are sample data. Pick a direction, or pick parts of several.</p>
<div class="grid">${variants.map(card).join('')}</div>
<section class="compare" aria-labelledby="cmp"><h2 id="cmp">Compare one screen</h2>
<table><thead><tr><th>Screen</th><th class="q">Its question</th>${variants.map((v) => `<th>${v.name}</th>`).join('')}</tr></thead><tbody>
${pages.map(([k, l, q]) => `<tr><td>${l}</td><td class="q">${q}</td>${variants.map((v) => `<td><a href="${v.dir}/${k}.html">Open</a></td>`).join('')}</tr>`).join('\n')}
</tbody></table></section>
</main>
<script>
const fit = () => document.querySelectorAll('.shot').forEach((s) => { s.querySelector('iframe').style.transform = 'scale(' + s.clientWidth / 1440 + ')' })
addEventListener('resize', fit); fit()
</script>
</body>
</html>
`)
console.log(`Wrote ${variants.length * pages.length} pages and index.html`)
