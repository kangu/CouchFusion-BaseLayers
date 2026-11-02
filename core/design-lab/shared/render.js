// CF Cloud design lab: shells and pages, rendered from window.CF for the variant in window.VARIANT.
(() => {
  const D = window.CF, V = window.VARIANT, PAGE = document.body.dataset.page
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
  const nf = new Intl.NumberFormat('en-GB')
  const n = (v) => nf.format(v)
  const mb = (v) => `${v.toFixed(2)}<small> MB</small>`
  const gb = (v) => `${(v / 1000).toFixed(2)}<small> GB</small>`
  const eur = (v) => `€${nf.format(v)}`
  const pct = (v, d = 1) => `${(v * 100).toFixed(d)}%`
  const MINUS = '−'

  // ---------- icons: one outline set, 16px, 1.5 stroke ----------
  const P = {
    overview: '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="9" y="2.5" width="4.5" height="4.5" rx="1"/><rect x="2.5" y="9" width="4.5" height="4.5" rx="1"/><rect x="9" y="9" width="4.5" height="4.5" rx="1"/>',
    databases: '<ellipse cx="8" cy="3.8" rx="5" ry="1.8"/><path d="M3 3.8v8.4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3.8"/><path d="M3 8c0 1 2.2 1.8 5 1.8s5-.8 5-1.8"/>',
    users: '<circle cx="6" cy="5.5" r="2.5"/><path d="M1.8 13.5c.5-2.3 2.2-3.6 4.2-3.6s3.7 1.3 4.2 3.6"/><path d="M10.5 3.2a2.4 2.4 0 0 1 0 4.6M12 9.9c1.2.4 2 1.6 2.3 3.6"/>',
    content: '<rect x="2.5" y="2" width="11" height="12" rx="1.5"/><path d="M5 5.5h6M5 8h6M5 10.5h3.5"/>',
    orders: '<path d="M3.5 1.8h9v12.4l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z"/><path d="M6 5.5h4M6 8h4"/>',
    analytics: '<path d="M2.5 13.5h11"/><path d="M3.5 10.5 6.5 7l2.5 2 4-5"/>',
    settings: '<circle cx="8" cy="8" r="2"/><path d="M8 1.8v1.6M8 12.6v1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M1.8 8h1.6M12.6 8h1.6M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1"/>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/>',
    chevron: '<path d="m4.5 6.5 3.5 3.5 3.5-3.5"/>',
    menu: '<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/>',
    close: '<path d="m4 4 8 8M12 4l-8 8"/>',
    copy: '<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.8c0-.7-.6-1.3-1.3-1.3H3.8c-.7 0-1.3.6-1.3 1.3v5.4c0 .7.6 1.3 1.3 1.3h1.7"/>',
    more: '<circle cx="8" cy="3.5" r=".9"/><circle cx="8" cy="8" r=".9"/><circle cx="8" cy="12.5" r=".9"/>',
    help: '<circle cx="8" cy="8" r="6"/><path d="M6.4 6.2a1.7 1.7 0 0 1 3.2.6c0 1.2-1.6 1.4-1.6 2.6M8 11.4v.1"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    arrow: '<path d="M3.5 8h9M9 4.5 12.5 8 9 11.5"/>',
    refresh: '<path d="M13 4.5V2.5M13 4.5h-2M12.6 4.4A5.5 5.5 0 1 0 13.5 8"/>',
    alert: '<path d="M8 2 14 13H2z"/><path d="M8 6.5v3M8 11.3v.1"/>',
    external: '<path d="M9.5 2.5h4v4M13.5 2.5 8 8M11.5 9.5v3c0 .6-.4 1-1 1h-7c-.6 0-1-.4-1-1v-7c0-.6.4-1 1-1h3"/>',
    grip: '<circle cx="6" cy="4" r=".8"/><circle cx="10" cy="4" r=".8"/><circle cx="6" cy="8" r=".8"/><circle cx="10" cy="8" r=".8"/><circle cx="6" cy="12" r=".8"/><circle cx="10" cy="12" r=".8"/>',
    page: '<path d="M4 1.8h5.5L12.5 5v9.2H4z"/><path d="M9.5 1.8V5h3"/>',
    folder: '<path d="M2 4.2c0-.6.5-1 1-1h3.3l1.5 1.6H13c.6 0 1 .4 1 1v6.4c0 .6-.4 1-1 1H3c-.5 0-1-.4-1-1z"/>',
  }
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]}</svg>`
  // The CouchFusion mark: a couch seen from the front, drawn for this product.
  const mark = `<svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="9" width="4" height="9" rx="1.6" fill="var(--brand)"/><rect x="18" y="9" width="4" height="9" rx="1.6" fill="var(--brand)"/><rect x="5" y="5" width="14" height="8" rx="2" fill="var(--brand)" opacity=".55"/><rect x="5" y="12" width="14" height="5" rx="1.2" fill="var(--brand)"/><rect x="4" y="18" width="2" height="2.5" fill="var(--brand)"/><rect x="18" y="18" width="2" height="2.5" fill="var(--brand)"/></svg>`

  // ---------- small parts ----------
  const pill = (kind, text) => `<span class="pill ${kind}">${esc(text)}</span>`
  const id = (v, len = 10) => `<code class="id" title="${esc(v)}">${esc(v.length > len ? v.slice(0, len) + '…' : v)}</code>`
  const btn = (label, { kind = '', ic = null, attrs = '' } = {}) => `<button type="button" class="btn ${kind}" ${attrs}>${ic ? icon(ic) : ''}<span>${esc(label)}</span></button>`
  const link = (href, label) => `<a class="card-link" href="${href}">${esc(label)}</a>`
  const panel = (title, body, { meta = '', action = '', cls = '', tag = 'section', hid = '' } = {}) =>
    `<${tag} class="panel ${cls}"${hid ? ` aria-labelledby="${hid}"` : ''}><header><div class="ph"><h2${hid ? ` id="${hid}"` : ''}>${title}</h2>${meta ? `<span class="meta">${meta}</span>` : ''}</div>${action}</header>${body}</${tag}>`
  // the compaction gap: live data inside the file, the reclaimable part as the track that is left
  const gap = (d) => `<span class="gapbar" style="--file:100%;--live:${(d.active / d.file) * 100}%" role="img" aria-label="${Math.round((d.active / d.file) * 100)}% of the file is live data" title="${d.active.toFixed(2)} MB live of ${d.file.toFixed(2)} MB on disk"><i></i></span>`
  const stateOf = (r) => ({ crashing: ['neg', 'Failing'], running: ['pos', 'Running'], completed: ['', 'Completed'], pending: ['warn', 'Queued'] })[r.state]
  const people = ['#e8eef7', '#f6e9e4', '#e6f2ea', '#f3eadf', '#ece8f5', '#e4f0f3', '#f5e6ee', '#eef0e2']
  const avatar = (u, i) => `<span class="avatar" style="--tint:${people[i % people.length]}">${esc((u.display || u.name)[0])}</span>`
  const kpis = (cells, { tabs = false, lead = -1 } = {}) => `<div class="kpis"${tabs ? ' role="tablist" aria-label="Metric"' : ''}>${cells.map((c, i) => `<div class="kpi${i === lead ? ' kpi-lead' : ''}"${tabs ? ` role="tab" tabindex="${i === 0 ? 0 : -1}" aria-selected="${i === 0}" data-metric="${c.key || ''}"` : ''}><div class="kpi-label">${c.label}</div><div class="kpi-value num">${c.value}</div>${c.delta ? `<div class="delta">${c.delta}</div>` : ''}</div>`).join('')}</div>`
  const table = (cols, rows, { cls = '', caption = '' } = {}) =>
    `<div class="table-wrap"><table class="${cls}">${caption ? `<caption class="sr">${esc(caption)}</caption>` : ''}<thead><tr>${cols.map((c) => `<th class="${c.n ? 'n' : ''} ${c.cls || ''}" scope="col">${c.label}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
  const tabsRow = (items, current) => `<div class="tabs" role="tablist">${items.map(([key, label, count]) => `<a href="#${key}" role="tab" data-tab="${key}" aria-selected="${key === current}">${esc(label)}${count != null ? ` <span class="count num">${n(count)}</span>` : ''}</a>`).join('')}</div>`

  const T = D.totals, F = D.failing
  const maxFile = Math.max(...D.databases.map((d) => d.file))
  const healthy = D.replications.filter((r) => r.state === 'running' || r.state === 'completed').length

  // ---------- pages ----------
  const pages = {}

  pages.overview = () => {
    const sitesSorted = [...D.sites].sort((a, b) => b.file - a.file)
    const backupOf = (s) => {
      const jobs = D.replications.filter((r) => s.databases.some((d) => d.name === r.source) && r.target.startsWith('backup-01'))
      if (!jobs.length) return '<span class="dash">—</span>'
      const bad = jobs.find((j) => j.state === 'crashing')
      return bad ? pill('neg', 'Failing') : jobs.some((j) => j.state === 'pending') ? pill('warn', 'Queued') : pill('pos', 'Backed up')
    }
    const siteRows = sitesSorted.slice(0, 5).map((s) => `<tr><td><a class="name" href="databases.html">${esc(s.name)}</a><span class="sub">${esc(s.domain)}</span></td><td class="n num">${s.databases.length}</td><td class="n num">${n(s.docs)}</td><td class="n num">${mb(s.active)}</td><td class="n num">${mb(s.file)}</td><td class="n num">${esc(s.databases.map((d) => d.lastWrite).sort().reverse().find((t) => /:/.test(t)) || s.databases[0].lastWrite)}</td><td>${backupOf(s)}</td></tr>`)
    const siteTable = table([{ label: 'Site' }, { label: 'Databases', n: 1 }, { label: 'Documents', n: 1 }, { label: 'Live data', n: 1 }, { label: 'On disk', n: 1 }, { label: 'Last write', n: 1 }, { label: 'Backup' }], siteRows, { caption: 'Sites' })
    const jobRows = D.replications.map((r) => { const [k, l] = stateOf(r); return `<li class="job ${r.state}"><div><span class="src">${esc(r.source)}</span><span class="sub">→ ${esc(r.target)}</span></div><div class="right"><span class="num">${r.pending ? n(r.pending) : '0'}<small> pending</small></span>${pill(k, l)}</div></li>` })
    const finding = `<b>indux-orders</b> has not reached the backup since ${F.since}: <span class="num">${n(F.pending)}</span> changes are waiting.`
    const spike = D.writes[D.writesNote.at]
    const usualHour = [...D.writes].sort((a, b) => a - b)[Math.floor(D.writes.length / 2)]
    const spikeParts = [['indux-stock', 1840], ['indux-products', 870], ['Everything else', spike - 2710]]
    if (V.id === 'a') {
      return {
        title: 'Overview', sub: finding,
        actions: btn('View job', { attrs: 'data-href="database.html"' }) + btn('Retry replication', { kind: 'primary', ic: 'refresh' }),
        body: `
<section class="block" aria-labelledby="att"><div class="block-head"><h2 id="att">Needs attention</h2><span class="meta"><i class="dot neg"></i>Checked ${D.NOW.time}</span></div>
  <div class="strip">
    <a class="cell" href="database.html"><b>Backup failing</b><span>indux-orders → backup-01 since ${F.since}. ${esc(F.error.split(':')[0])}.</span>${icon('arrow', 'go')}</a>
    <a class="cell" href="databases.html#compaction"><b>${D.needsCompaction.length} databases to compact</b><span><span class="num">${mb(+(D.needsCompaction.reduce((a, d) => a + d.gap, 0)).toFixed(2))}</span> can be reclaimed.</span>${icon('arrow', 'go')}</a>
    <a class="cell" href="databases.html#snapshots"><b>${D.snapshots.length} old price lists</b><span>Superseded Indux imports use <span class="num">${mb(D.snapshotMB)}</span>.</span>${icon('arrow', 'go')}</a>
    <a class="cell" href="users.html#none"><b>${D.userCounts.invited} invitations open</b><span>Dana Ilie and Paul Neagu have not signed in yet.</span>${icon('arrow', 'go')}</a>
  </div></section>
<section class="block" aria-labelledby="usage"><div class="block-head"><h2 id="usage">Usage</h2><span class="meta">Last 24 hours</span></div>
  <div class="tray">
    ${kpis([
      { key: 'writes', label: 'Writes', value: `${n(D.writesTotal)}<small> docs</small>` },
      { key: 'live', label: 'Live data', value: gb(T.active) },
      { key: 'disk', label: 'On disk', value: gb(T.file) },
      { key: 'reclaim', label: 'Reclaimable', value: mb(T.reclaimable) },
      { key: 'jobs', label: 'Replication', value: `${healthy}<small> of ${D.replications.length} healthy</small>` },
    ])}
    <div class="grid top tray-row">
      <div class="panel span-8"><div class="chart-head"><h3>Documents written per hour</h3><span class="meta">${D.hours[0]} yesterday – ${D.hours.at(-1)} today</span></div><div class="chart" id="chart-writes"></div></div>
      <div class="panel span-4"><div class="chart-head"><h3>Replication jobs</h3>${link('database.html', 'Open')}</div><ul class="jobs">${jobRows.slice(0, 5).join('')}</ul></div>
    </div>
  </div></section>
<section class="block" aria-labelledby="sites"><div class="block-head"><h2 id="sites">Sites</h2><span class="meta">${D.sites.length} sites on ${D.SERVER.name}</span>${link('databases.html', `View all ${D.sites.length}`)}</div>${siteTable}</section>` }
    }
    if (V.id === 'b') {
      const ledgerRows = sitesSorted.slice(0, 8).map((s) => `<li><span class="site-name">${esc(s.name)}</span><span class="gapcell">${gap({ file: s.file, active: s.active })}</span><span class="num">${mb(s.active)}</span><span class="num muted">${mb(s.file)}</span></li>`)
      return {
        title: 'Overview', sub: finding,
        actions: btn('Retry replication', { kind: 'primary', ic: 'refresh' }),
        body: `
${kpis([
  { label: 'Live data', value: gb(T.active), delta: `of ${(T.file / 1000).toFixed(2)} GB on disk` },
  { label: 'Documents', value: n(T.docs), delta: `in ${T.databases} databases` },
  { label: 'Writes, last 24 h', value: n(D.writesTotal), delta: `peak ${n(spike)} at ${D.hours[D.writesNote.at]}` },
  { label: 'Backups', value: `${healthy}<small> of ${D.replications.length}</small>`, delta: `<span class="down">1 failing since ${F.since}</span>` },
], { lead: 0 })}
<div class="grid top">
  ${panel('Storage by site', `<ul class="ledger"><li class="lh"><span>Site</span><span>Live share of the file on disk</span><span>Live</span><span>On disk</span></li>${ledgerRows.join('')}</ul>`, { cls: 'span-8', hid: 'h-storage', meta: `${mb(T.reclaimable)} reclaimable by compaction`, action: link('databases.html', `All ${D.sites.length} sites`) })}
  ${panel('Backups', `<ul class="jobs">${jobRows.join('')}</ul>`, { cls: 'span-4', hid: 'h-backups', action: link('database.html', 'Open failing job') })}
</div>
<div class="grid top">
  ${panel('Documents written per hour', '<div class="chart" id="chart-writes"></div>', { cls: 'span-8', hid: 'h-writes', meta: `${D.hours[0]} yesterday – ${D.hours.at(-1)} today` })}
  ${panel('Clean-up', `<dl class="kv"><div><dt>Old Indux price lists</dt><dd class="num">${mb(D.snapshotMB)}</dd></div><div><dt>Databases to compact</dt><dd class="num">${D.needsCompaction.length}</dd></div><div><dt>Reclaimable by compaction</dt><dd class="num">${mb(T.reclaimable)}</dd></div></dl><p class="note">${D.snapshots.length} superseded supplier imports. The newest list per supplier stays.</p>`, { cls: 'span-4', hid: 'h-clean', action: link('databases.html#snapshots', 'Review') })}
</div>` }
    }
    // c: the failing job leads
    const jobsTable = table([{ label: 'Job' }, { label: 'Source → target' }, { label: 'State' }, { label: 'Pending', n: 1 }, { label: 'Written', n: 1 }, { label: 'Checkpoint', n: 1 }, { label: '' }],
      D.replications.map((r) => { const [k, l] = stateOf(r); return `<tr><td>${id(r.id, 8)}</td><td><span class="name">${esc(r.source)}</span><span class="sub">→ ${esc(r.target)}</span></td><td>${pill(k, l)}</td><td class="n num">${n(r.pending)}</td><td class="n num">${n(r.written)}</td><td class="n num">${esc(r.checkpoint)}</td><td class="act">${r.state === 'crashing' ? btn('Retry', { kind: 'sm' }) : r.state === 'pending' ? '<span class="muted sm">Waiting for a slot</span>' : ''}</td></tr>` }), { caption: 'Replication jobs' })
    return {
      crumbs: ['CouchFusion', 'Production'], title: D.SERVER.name, titlePill: pill('warn', 'Degraded'),
      sub: `CouchDB ${D.SERVER.version} · ${D.SERVER.url} · ${T.databases} databases for ${T.sites} sites · updated ${D.NOW.time}`,
      actions: btn('View logs') + btn('Retry replication', { kind: 'primary', ic: 'refresh' }),
      body: `
<section class="panel lead" aria-labelledby="h-lead"><div class="lead-main"><span class="meta">Backup failing since ${F.since}</span><h2 id="h-lead">indux-orders → ${esc(F.target)}</h2><p>${esc(F.error)}. Every order written since then exists only on ${D.SERVER.name}.</p></div>
  <dl class="facts"><div><dt>Pending changes</dt><dd class="num">${n(F.pending)}</dd></div><div><dt>Last checkpoint</dt><dd class="num">${F.checkpoint}</dd></div><div><dt>Written so far</dt><dd class="num">${n(F.written)}</dd></div><div><dt>Job</dt><dd>${id(F.id, 10)}</dd></div></dl></section>
${kpis([
  { label: 'Live data', value: gb(T.active), delta: `of ${(T.file / 1000).toFixed(2)} GB on disk` },
  { label: 'Documents', value: n(T.docs), delta: `in ${T.databases} databases` },
  { label: 'Writes, last 24 h', value: n(D.writesTotal), delta: `peak ${n(spike)} at ${D.hours[D.writesNote.at]}` },
  { label: 'Replication', value: `${healthy}/${D.replications.length}`, delta: `<span class="down">1 failing, 1 queued</span>` },
])}
<div class="grid top">
  ${panel('Documents written per hour', '<div class="chart" id="chart-writes"></div>', { cls: 'span-8', hid: 'h-writes', meta: 'Last 24 hours' })}
  ${panel(`The ${D.hours[D.writesNote.at]} spike`, `<p class="note first">${esc(D.writesNote.label)} wrote <span class="num">${n(spike)}</span> documents in one hour, ${Math.round(spike / usualHour)}× the median hour (${n(usualHour)}).</p><ul class="parts">${spikeParts.map(([k, v]) => `<li><span>${esc(k)}</span><span class="num">${n(v)}</span><span class="bar" style="--w:${(v / spike) * 100}%"></span></li>`).join('')}</ul>`, { cls: 'span-4', hid: 'h-spike' })}
</div>
${panel('Replication jobs', jobsTable, { hid: 'h-jobs', meta: `${D.replications.length} jobs · 4 replicator slots` })}` }
  }

  pages.databases = () => {
    const rowsOf = (list) => list.map((d) => `<tr data-name="${esc(d.name)}"><td><a class="name mono-name" href="database.html">${esc(d.name)}</a><span class="sub">${esc(d.siteName || 'Indux')}</span></td><td class="n num">${n(d.docs)}</td><td class="n num">${d.deleted != null ? n(d.deleted) : '<span class="dash">—</span>'}</td><td class="gapcol">${gap(d)}</td><td class="n num">${mb(d.active)}</td><td class="n num">${mb(d.file)}</td><td class="n num">${esc(d.lastWrite || '—')}</td><td class="act">${icon('more')}</td></tr>`)
    const all = [...D.databases].sort((a, b) => b.file - a.file)
    const snaps = D.snapshots.map((s) => ({ ...s, siteName: 'Indux · superseded', deleted: 0, lastWrite: s.name.slice(-19, -9).replace(/-/g, '-') }))
    const cols = [{ label: 'Database' }, { label: 'Documents', n: 1 }, { label: 'Deleted', n: 1 }, { label: 'Live share of file', cls: 'gapcol' }, { label: 'Live', n: 1 }, { label: 'On disk', n: 1 }, { label: 'Last write', n: 1 }, { label: '<span class="sr">Actions</span>' }]
    window.__dbViews = { all: rowsOf(all), compaction: rowsOf(D.needsCompaction), snapshots: rowsOf(snaps) }
    return {
      title: 'Databases', sub: `${T.databases} databases for ${T.sites} sites hold ${gb(T.active)} of live data in ${gb(T.file)} on disk.`,
      actions: btn(`Compact ${D.needsCompaction.length}`) + btn('Create database', { kind: 'primary', ic: 'plus' }),
      body: `${tabsRow([['all', 'All', all.length], ['compaction', 'Needs compaction', D.needsCompaction.length], ['snapshots', 'Old price lists', snaps.length]], 'all')}
<div class="toolbar"><label class="search">${icon('search')}<span class="sr">Search databases</span><input class="input" type="search" placeholder="Search by name" data-filter></label><select class="input sel" aria-label="Site"><option>All sites</option>${D.sites.map((s) => `<option>${esc(s.name)}</option>`).join('')}</select><span class="spacer"></span><span class="meta" data-count>${all.length} databases</span><span class="meta">Sorted by size on disk</span></div>
<div class="list-frame">${table(cols, window.__dbViews.all, { cls: 'db-table', caption: 'Databases' })}</div>` }
  }

  pages.database = () => {
    const d = D.ordersDb
    const designRows = D.designDocs.map((x) => `<tr><td><span class="name mono-name">${esc(x.name)}</span><span class="sub">${x.views.length ? esc(x.views.join(' · ')) : esc(x.note)}</span></td><td class="n num">${x.views.length}</td><td class="n num">${x.index ? mb(x.index) : '<span class="dash">—</span>'}</td><td class="n num">${esc(x.updated)}</td></tr>`)
    const changeRows = D.changes.map((c) => `<tr><td class="n num">${n(c.seq)}</td><td><span class="mono-name">${esc(c.id)}</span></td><td>${id(c.rev, 12)}</td><td>${esc(c.by)}</td><td class="n num">${c.time}</td></tr>`)
    return {
      crumbs: ['Databases', 'Indux'], title: d.name, mono: true, titlePill: pill('neg', 'Backup failing'),
      sub: `Indux orders · last write ${d.lastWrite} today by mihai.dobre`,
      actions: btn('Compact') + btn('Retry replication', { kind: 'primary', ic: 'refresh' }),
      body: `
${kpis([
  { label: 'Documents', value: n(d.docs) },
  { label: 'Deleted', value: n(d.deleted) },
  { label: 'Live data', value: mb(d.active), delta: `of ${d.file.toFixed(2)} MB on disk` },
  { label: 'Update sequence', value: n(D.changes[0].seq) },
])}
<div class="grid top">
  ${panel('Documents written per day', '<div class="chart" id="chart-docs"></div>', { cls: 'span-8', hid: 'h-docs', meta: '29 Sept – 28 Oct' })}
  ${panel('Replication', `<dl class="kv"><div><dt>Target</dt><dd>${esc(F.target)}</dd></div><div><dt>State</dt><dd>${pill('neg', 'Failing')}</dd></div><div><dt>Since</dt><dd class="num">${F.since}</dd></div><div><dt>Pending changes</dt><dd class="num">${n(F.pending)}</dd></div></dl><p class="note">${esc(F.error)}.</p>`, { cls: 'span-4', hid: 'h-rep', action: btn('Retry', { kind: 'sm' }) })}
</div>
<div class="grid top">
  ${panel('Design documents', table([{ label: 'Document' }, { label: 'Views', n: 1 }, { label: 'Index', n: 1 }, { label: 'Built', n: 1 }], designRows), { cls: 'span-7', hid: 'h-design' })}
  ${panel('Security', `<dl class="kv"><div><dt>Admin roles</dt><dd>${D.security.admins.roles.map((r) => pill('', r)).join(' ')}</dd></div><div><dt>Admin names</dt><dd><span class="dash">—</span></dd></div><div><dt>Member roles</dt><dd>${D.security.members.roles.map((r) => pill('', r)).join(' ')}</dd></div><div><dt>Member names</dt><dd><code class="id">${esc(D.security.members.names[0])}</code></dd></div><div><dt>Anonymous readers</dt><dd>No access</dd></div><div><dt>Writes checked by</dt><dd><code class="id">_design/validation</code></dd></div></dl>`, { cls: 'span-5', hid: 'h-sec', action: link('#', 'Edit') })}
</div>
${panel('Recent changes', table([{ label: 'Seq', n: 1 }, { label: 'Document' }, { label: 'Revision' }, { label: 'By' }, { label: 'Time', n: 1 }], changeRows), { hid: 'h-changes', meta: 'From the _changes feed', action: link('#', 'Open feed') })}` }
  }

  pages.users = () => {
    const rowOf = (u, i) => `<tr data-roles="${u.roles.length ? (u.roles.includes('admin') ? 'admin' : 'site') : 'none'}"><td><div class="person">${avatar(u, i)}<div><span class="name">${esc(u.display)}</span><span class="sub"><code class="id plain">${esc(u.name)}</code></span></div></div></td><td>${u.roles.length ? u.roles.map((r) => pill(r === 'admin' ? 'ink' : '', r)).join(' ') : u.state === 'invited' ? pill('warn', 'Invited') : '<span class="dash">No role</span>'}</td><td>${esc(u.sites)}</td><td class="n num">${esc(u.last)}</td><td class="n num">${u.sessions}</td><td class="act">${u.state === 'invited' ? btn('Resend', { kind: 'sm ghost' }) : icon('more')}</td></tr>`
    window.__userRows = D.users.map(rowOf)
    return {
      title: 'Users', sub: `${D.userCounts.all} people can sign in. ${D.userCounts.signedIn} sessions are open now; ${D.userCounts.invited} invitations are not accepted yet.`,
      actions: btn('Invite user', { kind: 'primary', ic: 'plus' }),
      body: `${tabsRow([['all', 'All', D.userCounts.all], ['admin', 'Admins', D.userCounts.admins], ['site', 'Site roles', D.userCounts.all - D.userCounts.admins - D.userCounts.noRole], ['none', 'No role', D.userCounts.noRole]], 'all')}
<div class="toolbar"><label class="search">${icon('search')}<span class="sr">Search people</span><input class="input" type="search" placeholder="Search by name or username" data-filter></label><span class="spacer"></span><span class="meta" data-count>${D.userCounts.all} people</span></div>
<div class="list-frame">${table([{ label: 'Person' }, { label: 'Roles' }, { label: 'Sites' }, { label: 'Last sign-in', n: 1 }, { label: 'Sessions', n: 1 }, { label: '<span class="sr">Actions</span>' }], window.__userRows, { cls: 'user-table', caption: 'Users' })}</div>
<p class="foot-note">Roles come from <code class="id plain">_users</code>. The server role <code class="id plain">_admin</code> is separate and never grants the admin workspace.</p>` }
  }

  pages.content = () => {
    const tree = (nodes, depth = 0) => `<ul class="tree${depth ? ' sub' : ''}">${nodes.map((p) => `<li><a href="#" class="${p.selected ? 'on' : ''}" ${p.selected ? 'aria-current="page"' : ''}>${icon(p.children ? 'folder' : 'page')}<span>${esc(p.title)}</span>${p.status === 'draft' ? `<span class="draft" title="${p.changes} unpublished change${p.changes > 1 ? 's' : ''}">${p.changes}</span>` : ''}</a>${p.children ? tree(p.children, depth + 1) : ''}</li>`).join('')}</ul>`
    const preview = {
      HeroSplit: `<div class="pv hero"><div><h3>Indux</h3><p>A builder’s marketplace for Norway: price lists from eleven suppliers, one basket, delivered to the site.</p><span class="pv-btn">Read the case</span></div><div class="pv-img"><span>Configurator, step 2</span></div></div>`,
      ProjectFacts: `<dl class="pv facts3"><div><dt>Role</dt><dd>Product &amp; engineering</dd></div><div><dt>Stack</dt><dd>Nuxt, CouchDB, Bun</dd></div><div><dt>Years</dt><dd>2021 – now</dd></div></dl>`,
      Gallery: `<div class="pv gal"><div class="pv-img"><span>Price list import</span></div><div class="pv-img"><span>Basket</span></div><div class="pv-img"><span>3D wall builder</span></div></div>`,
      Quote: `<blockquote class="pv quote">“We ship price lists the same day a supplier sends them.”<cite>Indux operations</cite></blockquote>`,
      CallToAction: `<div class="pv cta"><b>Building something similar?</b><span class="pv-btn">Start a project</span></div>`,
    }
    const canvas = D.blocks.map((b) => `<div class="block-frame${b.selected ? ' on' : ''}" tabindex="0"><span class="block-tag">${icon('grip')}${esc(b.type)}</span>${preview[b.type]}</div>`).join('')
    return {
      crumbs: ['Content', 'Radu Stanciu', 'Projects'], title: 'Indux', sub: 'Draft · 3 unpublished changes · last published 26 Oct, 18:02 by radu',
      actions: btn('Preview', { ic: 'external' }) + btn('Publish', { kind: 'primary' }), wide: true,
      body: `<div class="builder">
  <nav class="pane pages" aria-label="Pages"><div class="pane-head"><h2>Pages</h2>${btn('New', { kind: 'sm ghost', ic: 'plus' })}</div>${tree(D.pagesTree)}<dl class="kv page-kv"><div><dt>Path</dt><dd><code class="id plain">/projects/indux</code></dd></div><div><dt>Status</dt><dd>${pill('warn', 'Draft')}</dd></div><div><dt>Published</dt><dd class="num">26 Oct, 18:02</dd></div><div><dt>Database</dt><dd><code class="id plain">rs--content</code></dd></div></dl></nav>
  <section class="pane canvas-pane" aria-label="Page"><div class="pane-head"><h2>Blocks</h2><span class="meta">${D.blocks.length} blocks · /projects/indux</span></div><div class="page-canvas">${canvas}<button type="button" class="add-block">${icon('plus')}Add block</button></div></section>
  <aside class="pane props" aria-label="Block properties"><div class="pane-head"><h2>Hero</h2><span class="meta">HeroSplit</span></div>
    <div class="field"><label for="f-h">Heading</label><input id="f-h" class="input" value="Indux"></div>
    <div class="field"><label for="f-s">Text</label><textarea id="f-s" class="input" rows="4">A builder’s marketplace for Norway: price lists from eleven suppliers, one basket, delivered to the site.</textarea></div>
    <div class="field"><label for="f-l">Image side</label><select id="f-l" class="input"><option>Right</option><option>Left</option></select></div>
    <div class="field"><label for="f-g">Background</label><select id="f-g" class="input"><option>Page</option><option>Tinted</option><option>Ink</option></select></div>
    <div class="switch-row"><label for="f-b">Show button</label><input id="f-b" class="switch" type="checkbox" checked></div>
    <div class="field"><label for="f-u">Button link</label><input id="f-u" class="input" value="/projects/indux/case"></div>
    <p class="pane-foot">Options come from the component’s builderFieldMeta.</p>
  </aside></div>` }
  }

  pages.orders = () => {
    const S = { paid: ['pos', 'Paid'], awaiting: ['warn', 'Awaiting payment'], fulfilled: ['', 'Fulfilled'], refunded: ['', 'Refunded'], expired: ['', 'Invoice expired'] }
    const oldestPaid = D.orders.filter((o) => o.status === 'paid').at(-1)
    window.__orderRows = D.orders.map((o) => `<tr data-status="${o.status}"><td>${id(o.id, 12)}<span class="sub num">${o.placed.slice(8)} Oct, ${o.time}</span></td><td>${esc(o.customer)}</td><td class="truncate-cell"><span class="truncate">${esc(o.item)}</span></td><td>${esc(o.method)}</td><td class="n num">${eur(o.eur)}<span class="sub">${o.method === 'Lightning' ? `${n(o.sats)} sats` : '&nbsp;'}</span></td><td>${pill(...S[o.status])}</td><td class="act">${o.status === 'paid' ? btn('Mark fulfilled', { kind: 'sm' }) : ''}</td></tr>`)
    return {
      crumbs: ['Bitvocation'], title: 'Orders', sub: `${D.orderCounts.toFulfil} paid orders wait to be fulfilled; the oldest was paid ${oldestPaid.placed.slice(8)} Oct at ${oldestPaid.time}.`,
      actions: btn('Export CSV') + btn(`Fulfil ${D.orderCounts.toFulfil} paid`, { kind: 'primary' }),
      body: `${kpis([
  { label: 'Paid, last 7 days', value: eur(D.revenue7d), delta: `${D.orders.filter((o) => ['paid', 'fulfilled'].includes(o.status)).length} orders` },
  { label: 'Paid over Lightning', value: pct(D.lightningShare, 0), delta: `at ${n(D.SATS_PER_EUR)} sats per euro` },
  { label: 'Awaiting payment', value: n(D.orderCounts.awaiting), delta: 'invoice expires in 41 min' },
])}
${tabsRow([['paid', 'To fulfil', D.orderCounts.toFulfil], ['awaiting', 'Awaiting payment', D.orderCounts.awaiting], ['fulfilled', 'Fulfilled', D.orderCounts.fulfilled], ['closed', 'Refunded or expired', D.orderCounts.closed], ['all', 'All', D.orderCounts.all]], 'all')}
<div class="list-frame">${table([{ label: 'Order' }, { label: 'Customer' }, { label: 'Item' }, { label: 'Paid with' }, { label: 'Amount', n: 1 }, { label: 'Status' }, { label: '<span class="sr">Action</span>' }], window.__orderRows, { cls: 'order-table', caption: 'Orders' })}</div>` }
  }

  pages.analytics = () => {
    const A = D.analytics
    const browsers = [['Chrome', 431], ['Safari', 268], ['Firefox', 142], ['Edge', 61], ['Brave', 44], ['Other', 31]]
    console.assert(browsers.reduce((a, [, v]) => a + v, 0) === A.total, 'browsers sum to visitors')
    const share = (title, rows, total, unit) => { const max = Math.max(...rows.map((r) => r[1])); return `<section class="share" aria-label="${esc(title)} by ${esc(unit.toLowerCase())}"><div class="share-row lh"><span>${esc(title)}</span><span class="n">Share</span><span class="n">${esc(unit)}</span></div><ul>${rows.map(([k, v]) => `<li class="share-row"><span class="fill" style="width:${(v / max) * 100}%"></span><span class="truncate">${esc(k)}</span><span class="n num muted">${pct(v / total)}</span><span class="n num">${n(v)}</span></li>`).join('')}</ul></section>` }
    const delta = A.total - A.prevTotal
    return {
      crumbs: [A.site], title: 'Analytics', sub: `Visitors rose by ${n(delta)} against the 30 days before; ${n(A.visitors[A.spikeDay])} of them came on ${A.days[A.spikeDay]} from Hacker News.`,
      actions: `<select class="input sel" aria-label="Site"><option>radustanciu.ro</option><option>kangu.ro</option><option>smartlead.ro</option></select><select class="input sel" aria-label="Range"><option>Last 30 days</option><option>Last 7 days</option><option>This year</option></select>`,
      body: `${kpis([
  { label: 'Visitors', value: n(A.total), delta: `<span class="up">+${n(delta)}</span> vs the 30 days before` },
  { label: 'Pageviews', value: n(A.pageviews), delta: `${(A.pageviews / A.total).toFixed(2)} per visitor` },
  { label: 'Time on site', value: A.avgTime, delta: 'median visit' },
  { label: 'Left after one page', value: pct(A.bounce, 0), delta: '<span class="dash">—</span>' },
], { lead: 0 })}
${panel('Visitors per day', '<div class="chart" id="chart-visits"></div>', { hid: 'h-visits', meta: `${A.days[0]} – ${A.days.at(-1)}` , cls: 'chart-panel' })}
<div class="shares">${share('Page', A.pages, A.pageviews, 'Views')}${share('Referrer', A.referrers, A.total, 'Visitors')}${share('Country', A.countries, A.total, 'Visitors')}${share('Browser', browsers, A.total, 'Visitors')}</div>` }
  }

  pages.settings = () => {
    const S = D.settings
    const row = (title, desc, inner, aside = '') => `<section class="set-row"><div class="set-label"><h2>${title}</h2><p>${desc}</p>${aside}</div><div class="set-panel">${inner}</div></section>`
    const f = (lid, label, value, { hint = '', type = 'text' } = {}) => `<div class="field"><label for="${lid}">${label}</label><input id="${lid}" class="input" type="${type}" value="${esc(value)}"${hint ? ` aria-describedby="${lid}-h"` : ''}>${hint ? `<span class="hint" id="${lid}-h">${hint}</span>` : ''}</div>`
    const admins = D.users.filter((u) => u.roles.includes('admin'))
    return {
      title: 'Settings', sub: `Runtime settings in <code class="id plain">${S.section}</code>. Workers read them when they start; these were started at ${S.workersStarted}.`,
      actions: '', narrow: true,
      body: `
${row('Branding', 'Names shown in the sidebar, the login page and the browser tab.', `${f('s-brand', 'Brand name', S.admin_brand_name)}${f('s-site', 'Site name', S.admin_site_name)}${f('s-foot', 'Footer text', S.admin_footer_text, { hint: 'Empty hides the footer line.' })}<div class="field"><label for="s-theme">Theme</label><select id="s-theme" class="input"><option>Ledger</option><option>Classic</option></select></div><div class="panel-foot">${btn('Save branding', { kind: 'primary' })}</div>`,
  `<div class="preview" aria-label="Sidebar preview"><span class="pv-brand">${mark}<span><b>${esc(S.admin_brand_name)}</b><span>${esc(S.admin_site_name)}</span></span></span></div>`)}
${row('Sign-in', 'What people see before they reach the workspace, and how long a session lasts.', `${f('s-head', 'Login heading', S.auth_heading)}${f('s-redir', 'After sign-in, go to', S.auth_redirect_path, { hint: 'A path on this site, starting with /.' })}${f('s-age', 'Session length', S.auth_session_max_age_seconds / 60, { type: 'number', hint: 'Minutes, 1 to 1,440. CouchDB’s own timeout still applies if it is shorter.' })}
  <div class="switch-row"><div><b>Password</b><span>Native CouchDB users sign in with their password.</span></div><input class="switch" type="checkbox" checked aria-label="Password sign-in"></div>
  <div class="switch-row off"><div><b>Email code</b> ${pill('', 'Not installed')}<span>Turn on <code class="id plain">auth.email</code> in nuxt.config.ts to offer it.</span></div><input class="switch" type="checkbox" disabled aria-label="Email sign-in"></div>
  <div class="panel-foot">${btn('Save sign-in', { kind: 'primary' })}</div>`,
  `<div class="preview login" aria-label="Login preview"><span class="pv-eyebrow">${esc(S.admin_brand_name)}</span><b>${esc(S.auth_heading)}</b><span class="pv-field"></span><span class="pv-field"></span><span class="pv-btn">Sign in</span></div>`)}
${row('Access', 'Who may open the admin workspace.', `<div class="field"><label for="s-roles">Admin roles</label><div class="chips" id="s-roles">${S.admin_roles.map((r) => `<span class="pill ink">${esc(r)} <button type="button" aria-label="Remove ${esc(r)}">${icon('close')}</button></span>`).join('')}<input class="chip-input" placeholder="Add a role" aria-label="Add a role"></div><span class="hint">Anyone with one of these roles is an admin. The server role _admin is never added for you.</span></div><div class="panel-foot">${btn('Save access', { kind: 'primary' })}</div>`,
  `<p class="set-sum"><span class="num">${admins.length}</span> people have the admin role: ${admins.map((u) => esc(u.display)).join(', ')}.</p>`)}
${row('Workers', 'Saved settings take effect when the workers restart.', `<div class="restart"><div><b>Restart workers</b><span>Signed-in people stay signed in. Requests during the restart wait up to 3 seconds.</span></div>${btn('Restart', { ic: 'refresh' })}</div>`)}` }
  }

  // ---------- shell ----------
  const NAV = [
    ['Platform', [['overview', 'Overview'], ['databases', 'Databases']]],
    ['Modules', [['content', 'Content'], ['orders', 'Orders'], ['analytics', 'Analytics']]],
    ['Access', [['users', 'Users']]],
  ]
  const current = PAGE === 'database' ? 'databases' : PAGE
  const navItem = ([key, label]) => `<a class="nav-item" href="${key}.html"${key === current ? ' aria-current="page"' : ''}>${icon(key)}<span>${label}</span></a>`
  const navHtml = NAV.map(([g, items]) => `<div class="nav-group"><div class="group-label">${g}</div>${items.map(navItem).join('')}</div>`).join('')
  const switcher = `<button type="button" class="switcher" aria-label="Switch server"><span class="sw-dot"></span><span class="sw-text"><b>Production</b><span>${D.SERVER.name} · ${D.SERVER.url}</span></span>${icon('chevron')}</button>`
  const brand = `<a class="brand" href="overview.html">${mark}<span>CF Cloud</span></a>`
  const userRow = `<div class="user-row"><span class="avatar" style="--tint:${people[0]}">R</span><span class="u"><b>radu</b><span>admin</span></span><button type="button" class="icon-btn" aria-label="Sign out">${icon('external')}</button></div>`
  const search = `<label class="top-search">${icon('search')}<span class="sr">Search</span><input type="search" placeholder="Search databases, documents, people"><kbd>⌘K</kbd></label>`

  const p = pages[PAGE]()
  document.title = `${p.title} · CF Cloud`
  const crumbs = p.crumbs ? `<nav class="crumbs" aria-label="Breadcrumb">${p.crumbs.map((c) => `<span>${esc(c)}</span>`).join('')}</nav>` : ''
  const titleRow = `<div class="title-row"><div class="tt">${crumbs}<div class="h1row"><h1 class="${p.mono ? 'mono-title' : ''}">${esc(p.title)}</h1>${p.titlePill || ''}</div>${p.sub ? `<p class="sub">${p.sub}</p>` : ''}</div>${p.actions ? `<div class="actions">${p.actions}</div>` : ''}</div>`
  const main = `<main class="canvas ${p.wide ? 'wide' : ''} ${p.narrow ? 'narrow' : ''}" id="main">${titleRow}<div class="body">${p.body}</div></main>`
  const phoneBar = `<div class="phone-bar"><button type="button" class="icon-btn menu-toggle" aria-label="Open menu" aria-expanded="false">${icon('menu')}</button><a class="pb-title" href="overview.html">${mark}<span>CF Cloud</span></a><span class="pb-scope">${D.SERVER.name}</span></div>`
  const closeBtn = `<button type="button" class="icon-btn menu-close" aria-label="Close menu">${icon('close')}</button>`
  const settingsItem = navItem(['settings', 'Settings'])

  let html
  if (V.shell === 'frame') {
    html = `<div class="app frame">${phoneBar}<aside class="sidebar" id="nav">${closeBtn}${brand}${switcher}<nav aria-label="Main">${navHtml}</nav><div class="bottom">${settingsItem}${userRow}</div></aside><header class="topbar">${search}<div class="tb-right"><button type="button" class="icon-btn" aria-label="Help">${icon('help')}</button><span class="avatar" style="--tint:${people[0]}">R</span></div></header>${main}</div>`
  } else if (V.shell === 'plane') {
    html = `<div class="app plane">${phoneBar}<aside class="sidebar" id="nav">${closeBtn}${brand}${switcher}<label class="side-search">${icon('search')}<span class="sr">Search</span><input type="search" placeholder="Search"><kbd>⌘K</kbd></label><nav aria-label="Main">${navHtml}</nav><div class="bottom">${settingsItem}${userRow}</div></aside>${main}</div>`
  } else {
    html = `<div class="app tframe">${phoneBar}<header class="topbar">${brand}${search}<div class="tb-right"><button type="button" class="icon-btn" aria-label="Help">${icon('help')}</button>${switcher}</div></header><aside class="sidebar" id="nav">${closeBtn}<nav aria-label="Main">${navHtml}</nav><div class="bottom">${settingsItem}${userRow}</div></aside>${main}</div>`
  }
  document.body.insertAdjacentHTML('afterbegin', html)

  // ---------- behaviour ----------
  const nav = document.getElementById('nav'), toggle = document.querySelector('.menu-toggle')
  const setMenu = (open) => { nav.classList.toggle('open', open); toggle.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('menu-open', open) }
  toggle.addEventListener('click', () => setMenu(true))
  document.querySelector('.menu-close').addEventListener('click', () => setMenu(false))
  document.querySelectorAll('[data-href]').forEach((b) => b.addEventListener('click', () => (location.href = b.dataset.href)))

  // tabs that filter a table
  const tabs = document.querySelectorAll('.tabs [data-tab]')
  const applyTab = (key) => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === key)))
    const tbody = document.querySelector('.list-frame tbody'), count = document.querySelector('[data-count]')
    if (!tbody) return
    if (PAGE === 'databases') { tbody.innerHTML = window.__dbViews[key].join(''); if (count) count.textContent = `${window.__dbViews[key].length} databases` }
    else {
      const attr = PAGE === 'users' ? 'roles' : 'status'
      const match = (tr) => key === 'all' || tr.dataset[attr] === key || (key === 'closed' && ['refunded', 'expired'].includes(tr.dataset[attr]))
      let shown = 0; tbody.querySelectorAll('tr').forEach((tr) => { const on = match(tr); tr.hidden = !on; shown += on })
      if (count) count.textContent = `${shown} ${PAGE === 'users' ? 'people' : 'orders'}`
    }
  }
  tabs.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); history.replaceState(null, '', '#' + t.dataset.tab); applyTab(t.dataset.tab) }))
  const fromHash = location.hash.slice(1)
  if (fromHash && [...tabs].some((t) => t.dataset.tab === fromHash)) applyTab(fromHash)
  else if (PAGE === 'orders') applyTab('paid')
  const filter = document.querySelector('[data-filter]')
  if (filter) filter.addEventListener('input', () => { const q = filter.value.toLowerCase(); document.querySelectorAll('.list-frame tbody tr').forEach((tr) => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none' }) })

  // KPI tabs switch the overview chart (variant a)
  const chartData = {
    writes: { title: 'Documents written per hour', labels: D.hours, values: D.writes, format: Charts.fmt.int },
  }
  const drawWrites = () => {
    const el = document.getElementById('chart-writes'); if (!el) return
    el.innerHTML = ''
    Charts.bars(el, { labels: D.hours, values: D.writes, highlight: D.writesNote.at, height: { a: 284, b: 162, c: 156, d: 156 }[V.id], annotations: [D.writesNote] })
  }
  drawWrites()
  document.querySelectorAll('.kpis[role="tablist"] .kpi').forEach((k) => k.addEventListener('click', () => {
    k.parentElement.querySelectorAll('.kpi').forEach((x) => { x.setAttribute('aria-selected', String(x === k)); x.tabIndex = x === k ? 0 : -1 })
  }))
  const docs = document.getElementById('chart-docs')
  if (docs) Charts.bars(docs, { labels: D.analytics.days, values: D.docsPerDay, highlight: D.docsPerDay.length - 1, height: 199 })
  const visits = document.getElementById('chart-visits')
  if (visits) Charts.line(visits, { labels: D.analytics.days, series: [{ name: 'Visitors', values: D.analytics.visitors }], height: 220, max: 120, annotations: [D.analytics.spikeNote] })
})()
