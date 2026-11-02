// CF Cloud design lab: sample data.
// Database names, document counts and sizes are real (local CouchDB, 2026-10-28). Replication jobs, people,
// orders, visits and changes are SAMPLE data written for the prototype; replace them with live API data.
// Every total on screen is computed here from the rows, and the figures that must agree are asserted.
(() => {
  const NOW = { date: '2026-10-28', time: '16:40', label: 'Wed 28 Oct, 16:40' }
  const SERVER = { name: 'couchdb-01', version: '3.5.2', url: 'localhost:5984' }

  // [name, docs, deleted, fileMB, activeMB, lastWrite]
  const sites = [
    { id: 'indux', name: 'Indux', domain: 'indux.no', prefix: 'indux-', modules: ['Content', 'Orders', 'Products'],
      dbs: [
        ['indux', 14018, 15, 27.93, 19.42, '16:31'], ['indux-products', 11802, 0, 11.64, 8.16, '16:02'],
        ['indux-orders', 2038, 6, 2.83, 1.90, '16:38'], ['indux-stock', 3529, 1, 2.37, 2.22, '16:02'],
        ['indux-3d-walls', 426, 25, 4.15, 2.27, '14:47'], ['indux-health', 111, 3, 1.32, 0.87, '12:10'],
        ['indux-events', 74, 378, 1.05, 0.15, '15:56'], ['indux-email-delivery', 31, 461, 1.09, 0.21, '16:20'],
        ['indux-companies', 333, 36, 0.49, 0.17, '11:05'], ['indux-pages', 20, 7, 0.10, 0.01, '27 Oct'],
      ] },
    { id: 'paleologu', name: 'Paleologu', domain: 'paleologu.ro', prefix: 'paleologu', modules: ['Members'],
      dbs: [['paleologu_users', 8796, 772, 372.84, 360.87, '16:12'], ['paleologu', 48445, 2613, 151.44, 141.17, '16:35']] },
    { id: 'bitvocation', name: 'Bitvocation', domain: 'bitvocation.com', prefix: 'bv--', modules: ['Content', 'Events', 'Orders', 'Jobs'],
      dbs: [
        ['bv--content', 69, 346, 1.94, 0.89, '15:12'], ['bv--orders', 22, 354, 1.56, 0.42, '16:36'],
        ['bv--events', 101, 5, 0.52, 0.10, '14:03'], ['bv--logins', 32, 0, 0.45, 0.02, '16:29'],
        ['bv--meetups', 43, 16, 0.39, 0.03, '26 Oct'], ['bv--jobs', 234, 276, 0.18, 0.14, '16:00'],
        ['bv--surveys', 21, 2, 0.19, 0.10, '22 Oct'], ['bv--freshjobs', 234, 0, 0.13, 0.10, '16:00'],
      ] },
    { id: 'radustanciu', name: 'Radu Stanciu', domain: 'radustanciu.ro', prefix: 'rs--', modules: ['Content', 'Analytics'],
      dbs: [['rs--content', 134, 719, 3.22, 2.19, '13:44'], ['analytics_radustanciu_raw_2026_10', 247, 0, 0.67, 0.12, '16:39'], ['analytics_radustanciu', 5, 0, 0.24, 0.04, '16:00']] },
    { id: 'kangu', name: 'Kangu', domain: 'kangu.ro', prefix: 'kangu--', modules: ['Content', 'Orders', 'Analytics'],
      dbs: [['analytics_kangu', 9, 9, 0.51, 0.05, '16:00'], ['analytics_kangu_raw_2026_10', 24, 455, 0.46, 0.12, '16:33'], ['kangu--content', 5, 0, 0.23, 0.03, '19 Oct'], ['kangu--orders', 6, 2, 0.11, 0.01, '24 Oct']] },
    { id: 'smartlead', name: 'Smart Lead', domain: 'smartlead.ro', prefix: 'slg--', modules: ['Content', 'Analytics'],
      dbs: [['slg--content', 20, 14, 1.27, 0.31, '25 Oct'], ['analytics_smart_lead_raw_2026_10', 31, 0, 0.14, 0.01, '16:21']] },
    { id: 'couchfusion', name: 'CouchFusion', domain: 'couchfusion.com', prefix: 'couchfusion-com--', modules: ['Content', 'Orders'],
      dbs: [['couchfusion-com--content', 14, 94, 0.65, 0.25, '27 Oct'], ['couchfusion-com--orders', 2, 51, 0.40, 0.02, '21 Oct'], ['couchfusion-com--developers-hub', 4, 2, 0.12, 0.01, '18 Oct']] },
    { id: 'gas', name: 'Gas Maintenance', domain: 'gas-service.ro', prefix: 'gas--', modules: ['Maintenance'],
      dbs: [['gas--maintenance', 27, 98, 0.95, 0.07, '16:05']] },
    { id: 'mindarchy', name: 'Mindarchy', domain: 'mindarchy.app', prefix: 'mindarchy-', modules: ['Content'],
      dbs: [['mindarchy-content', 12, 186, 0.61, 0.33, '24 Oct']] },
    { id: 'ylemreef', name: 'Ylemreef', domain: 'ylemreef.com', prefix: 'yl-', modules: ['Content'],
      dbs: [['yl-content', 7, 0, 0.25, 0.03, '9 Oct'], ['ylemreef', 8, 0, 0.06, 0.01, '9 Oct']] },
  ]
  for (const s of sites) {
    s.databases = s.dbs.map(([name, docs, deleted, file, active, lastWrite]) => ({ name, site: s.id, siteName: s.name, docs, deleted, file, active, lastWrite, gap: +(file - active).toFixed(2) }))
    s.docs = s.databases.reduce((a, d) => a + d.docs, 0)
    s.file = +s.databases.reduce((a, d) => a + d.file, 0).toFixed(2)
    s.active = +s.databases.reduce((a, d) => a + d.active, 0).toFixed(2)
  }

  // Superseded price-list imports (real): every snapshot of a supplier except its newest one.
  const snapshots = [
    ['indux-pricelist-ahlsell-2025-03-10-10-06-06', 289104, 287.36, 199.10], ['indux-pricelist-ahlsell-2025-03-11-11-51-17', 70000, 58.09, 48.71],
    ['indux-pricelist-hewi-2025-03-05-10-53-30', 15482, 18.77, 18.75], ['indux-pricelist-hewi-2024-08-23-10-54-16', 122, 0.11, 0.09],
    ['indux-pricelist-randi-2024-08-23-10-41-52', 3024, 1.66, 1.64], ['indux-pricelist-randi-2024-09-10-07-54-23', 3024, 1.66, 1.64],
    ['indux-pricelist-randi-2024-09-11-08-19-24', 3024, 1.66, 1.63], ['indux-pricelist-randi-2024-09-11-08-20-55', 3024, 1.66, 1.63],
    ['indux-pricelist-randi-2024-09-11-08-37-15', 3024, 1.67, 1.65], ['indux-pricelist-randi-2025-02-12-10-23-07', 3187, 1.73, 1.71],
    ['indux-pricelist-randi-2025-02-12-10-25-13', 3187, 1.64, 1.62], ['indux-pricelist-randi-2025-02-12-10-25-48', 3187, 1.70, 1.68],
    ['indux-pricelist-randi-2025-02-12-10-26-56', 3187, 1.73, 1.71], ['indux-pricelist-deko-2025-03-25-13-59-29', 71, 0.06, 0.04],
    ['indux-pricelist-deko-2025-04-08-07-05-39', 516, 1.79, 0.25], ['indux-pricelist-deko-2025-04-10-06-33-53', 516, 0.30, 0.28],
    ['indux-pricelist-deko-2025-04-10-06-39-38', 516, 0.30, 0.28], ['indux-pricelist-deko-2025-04-10-06-43-18', 1, 0.02, 0.00],
    ['indux-pricelist-deko-2025-04-10-06-49-44', 516, 0.30, 0.28],
  ].map(([name, docs, file, active]) => ({ name, docs, file, active }))
  const snapshotMB = +snapshots.reduce((a, s) => a + s.file, 0).toFixed(2)

  const databases = sites.flatMap((s) => s.databases)
  const totals = {
    sites: sites.length,
    databases: databases.length,
    docs: databases.reduce((a, d) => a + d.docs, 0),
    file: +databases.reduce((a, d) => a + d.file, 0).toFixed(2),
    active: +databases.reduce((a, d) => a + d.active, 0).toFixed(2),
  }
  totals.reclaimable = +(totals.file - totals.active).toFixed(2)
  const needsCompaction = databases.filter((d) => d.file >= 0.3 && d.gap / d.file >= 0.4).sort((a, b) => b.gap - a.gap)

  // SAMPLE replication jobs (continuous jobs from each site's main databases to the backup node).
  const replications = [
    { id: 'b81f3c0a9e', source: 'indux-orders', target: 'backup-01/indux-orders', state: 'crashing', since: '09:14', pending: 3412, written: 118402, error: '401 Unauthorized: backup credentials were rotated at 09:12', checkpoint: '09:13' },
    { id: '4c09ad21f7', source: 'paleologu_users', target: 'backup-01/paleologu_users', state: 'running', since: '2 Oct', pending: 0, written: 9572, checkpoint: '16:38' },
    { id: 'e2d6b7713c', source: 'paleologu', target: 'backup-01/paleologu', state: 'running', since: '2 Oct', pending: 18, written: 51045, checkpoint: '16:39' },
    { id: '91aa0e4d52', source: 'indux', target: 'backup-01/indux', state: 'running', since: '14 Oct', pending: 6, written: 14974, checkpoint: '16:39' },
    { id: '07fb2c88e1', source: 'bv--orders', target: 'backup-01/bv--orders', state: 'running', since: '14 Oct', pending: 0, written: 1229, checkpoint: '16:36' },
    { id: 'c3e5f9b604', source: 'bv--content', target: 'bv-staging--content', state: 'completed', since: '26 Oct', pending: 0, written: 1215, checkpoint: '26 Oct 18:02' },
    { id: 'a75d1e0b39', source: 'rs--content', target: 'backup-01/rs--content', state: 'pending', since: '16:22', pending: 41, written: 2242, checkpoint: '16:21', error: 'Waiting for a free replicator slot (4 of 4 in use)' },
  ]
  const failing = replications.find((r) => r.state === 'crashing')

  // SAMPLE document writes per hour, last 24 hours, across all sites (17:00 yesterday → 16:00 today).
  const hours = Array.from({ length: 24 }, (_, i) => `${String((17 + i) % 24).padStart(2, '0')}:00`)
  const writes = [212, 188, 164, 120, 96, 71, 44, 38, 35, 41, 58, 102, 236, 418, 2860, 640, 512, 488, 530, 471, 455, 502, 478, 396]
  const writesTotal = writes.reduce((a, b) => a + b, 0)
  const writesPeakAt = writes.indexOf(Math.max(...writes))
  const writesNote = { at: writesPeakAt, label: 'Indux stock sync', short: 'Stock sync' }

  // SAMPLE people. Two real test accounts (cfcloud-qa-*) are included because they exist on this server.
  const users = [
    { name: 'radu', display: 'Radu Stanciu', roles: ['admin'], sites: 'All sites', last: 'Today, 16:31', sessions: 2, state: 'active' },
    { name: 'ioana.matei', display: 'Ioana Matei', roles: ['admin'], sites: 'All sites', last: 'Today, 11:08', sessions: 1, state: 'active' },
    { name: 'mihai.dobre', display: 'Mihai Dobre', roles: ['editor:indux', 'orders:indux'], sites: 'Indux', last: 'Today, 15:52', sessions: 1, state: 'active' },
    { name: 'elena.voicu', display: 'Elena Voicu', roles: ['editor:bitvocation'], sites: 'Bitvocation', last: 'Yesterday, 18:40', sessions: 0, state: 'active' },
    { name: 'andrei.pana', display: 'Andrei Pană', roles: ['orders:bitvocation'], sites: 'Bitvocation', last: '24 Oct', sessions: 0, state: 'active' },
    { name: 'sorina.lazar', display: 'Sorina Lazăr', roles: ['editor:radustanciu'], sites: 'Radu Stanciu', last: '21 Oct', sessions: 0, state: 'active' },
    { name: 'tudor.ene', display: 'Tudor Ene', roles: ['admin'], sites: 'All sites', last: '9 Oct', sessions: 0, state: 'active' },
    { name: 'bianca.roman', display: 'Bianca Roman', roles: ['editor:kangu', 'orders:kangu'], sites: 'Kangu', last: '2 Oct', sessions: 0, state: 'active' },
    { name: 'vlad.cretu', display: 'Vlad Crețu', roles: ['members:paleologu'], sites: 'Paleologu', last: 'Today, 09:02', sessions: 1, state: 'active' },
    { name: 'cfcloud-qa-admin', display: 'QA admin', roles: ['admin'], sites: 'All sites', last: 'Today, 16:14', sessions: 0, state: 'active' },
    { name: 'cfcloud-qa-viewer', display: 'QA viewer', roles: [], sites: '—', last: 'Today, 16:09', sessions: 0, state: 'no-role' },
    { name: 'dana.ilie', display: 'Dana Ilie', roles: [], sites: '—', last: 'Never', sessions: 0, state: 'invited' },
    { name: 'paul.neagu', display: 'Paul Neagu', roles: [], sites: '—', last: 'Never', sessions: 0, state: 'invited' },
  ]
  const userCounts = {
    all: users.length,
    admins: users.filter((u) => u.roles.includes('admin')).length,
    noRole: users.filter((u) => !u.roles.length).length,
    invited: users.filter((u) => u.state === 'invited').length,
    signedIn: users.reduce((a, u) => a + u.sessions, 0),
  }

  // SAMPLE orders for Bitvocation. One rate converts every sats figure.
  const SATS_PER_EUR = 1052
  const orders = [
    { id: 'ord_7f3a91c2', placed: '2026-10-28', time: '16:12', customer: 'Cristina Pop', item: 'Ticket · Bucharest Bitcoin Meetup #43', method: 'Lightning', eur: 15, status: 'paid' },
    { id: 'ord_6e21b0d4', placed: '2026-10-28', time: '14:55', customer: 'Lucian Avram', item: 'Job post · 30 days', method: 'Card', eur: 79, status: 'paid' },
    { id: 'ord_5d90e3a7', placed: '2026-10-28', time: '11:20', customer: 'Raluca Toma', item: 'Workshop · Lightning node basics', method: 'Lightning', eur: 45, status: 'paid' },
    { id: 'ord_4c8f12e9', placed: '2026-10-27', time: '19:41', customer: 'Victor Badea', item: 'Ticket · Bucharest Bitcoin Meetup #43', method: 'Lightning', eur: 15, status: 'paid' },
    { id: 'ord_3b7e44f0', placed: '2026-10-27', time: '17:03', customer: 'Ana Munteanu', item: 'Job post · 30 days', method: 'Lightning', eur: 79, status: 'awaiting' },
    { id: 'ord_2a6d5b18', placed: '2026-10-27', time: '10:16', customer: 'Sergiu Moldovan', item: 'Workshop · Lightning node basics', method: 'Card', eur: 45, status: 'fulfilled' },
    { id: 'ord_19c06e3d', placed: '2026-10-26', time: '21:30', customer: 'Irina Zamfir', item: 'Ticket · Bucharest Bitcoin Meetup #43', method: 'Lightning', eur: 15, status: 'fulfilled' },
    { id: 'ord_08b17f52', placed: '2026-10-26', time: '12:47', customer: 'Dragoș Stoica', item: 'Job post · 30 days', method: 'Card', eur: 79, status: 'refunded' },
    { id: 'ord_f7a28c61', placed: '2026-10-25', time: '09:58', customer: 'Monica Barbu', item: 'Ticket · Bucharest Bitcoin Meetup #43', method: 'Lightning', eur: 15, status: 'expired' },
    { id: 'ord_e6930d74', placed: '2026-10-25', time: '08:15', customer: 'George Ilie', item: 'Workshop · Lightning node basics', method: 'Lightning', eur: 45, status: 'fulfilled' },
  ].map((o) => ({ ...o, sats: o.eur * SATS_PER_EUR }))
  const orderCounts = {
    all: orders.length,
    toFulfil: orders.filter((o) => o.status === 'paid').length,
    awaiting: orders.filter((o) => o.status === 'awaiting').length,
    fulfilled: orders.filter((o) => o.status === 'fulfilled').length,
    closed: orders.filter((o) => ['refunded', 'expired'].includes(o.status)).length,
  }
  const paidStatuses = ['paid', 'fulfilled']
  const revenue7d = orders.filter((o) => paidStatuses.includes(o.status)).reduce((a, o) => a + o.eur, 0)
  const lightningShare = orders.filter((o) => paidStatuses.includes(o.status) && o.method === 'Lightning').reduce((a, o) => a + o.eur, 0) / revenue7d

  // SAMPLE analytics for radustanciu.ro, 30 days ending today.
  const days = Array.from({ length: 30 }, (_, i) => { const d = new Date(Date.UTC(2026, 8, 29 + i)); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }) })
  const visitors = [18, 22, 15, 9, 11, 24, 27, 21, 19, 26, 14, 10, 23, 25, 31, 22, 20, 12, 9, 28, 24, 26, 312, 64, 37, 18, 21, 29, 33, 27]
  const spikeDay = visitors.indexOf(Math.max(...visitors))
  const pages = [['/', 612], ['/blog/couchdb-native-sessions', 488], ['/projects/indux', 126], ['/blog/nuxt-layers-in-practice', 94], ['/projects/bitvocation', 71], ['/about', 58]]
  const referrers = [['news.ycombinator.com', 341], ['google.com', 214], ['Direct', 196], ['github.com', 88], ['linkedin.com', 61], ['x.com', 27]]
  const countries = [['Romania', 288], ['United States', 241], ['Germany', 96], ['Norway', 74], ['United Kingdom', 66], ['Netherlands', 41]]
  const analytics = {
    site: 'radustanciu.ro', days, visitors, spikeDay,
    spikeNote: { at: spikeDay, label: 'Hacker News: “CouchDB sessions in Nuxt”', short: 'Hacker News' },
    total: visitors.reduce((a, b) => a + b, 0),
    pageviews: 1812, avgTime: '1 m 52 s', bounce: 0.61,
    prevTotal: 507, // the 30 days before
    pages, referrers, countries,
  }

  // SAMPLE content pages for rs--content.
  const pagesTree = [
    { title: 'Home', path: '/', status: 'published' },
    { title: 'Projects', path: '/projects', status: 'published', children: [
      { title: 'Indux', path: '/projects/indux', status: 'draft', changes: 3, selected: true },
      { title: 'Bitvocation', path: '/projects/bitvocation', status: 'published' },
      { title: 'Kangu', path: '/projects/kangu', status: 'published' },
    ] },
    { title: 'Blog', path: '/blog', status: 'published', children: [
      { title: 'CouchDB native sessions in Nuxt', path: '/blog/couchdb-native-sessions', status: 'published' },
      { title: 'Nuxt layers in practice', path: '/blog/nuxt-layers-in-practice', status: 'published' },
      { title: 'Replication you can reason about', path: '/blog/replication', status: 'draft', changes: 1 },
    ] },
    { title: 'About', path: '/about', status: 'published' },
    { title: 'Contact', path: '/contact', status: 'published' },
  ]
  const blocks = [
    { type: 'HeroSplit', label: 'Hero', summary: 'Indux · A builder’s marketplace for Norway', selected: true },
    { type: 'ProjectFacts', label: 'Facts', summary: 'Role · Stack · Years' },
    { type: 'Gallery', label: 'Gallery', summary: '3 images' },
    { type: 'Quote', label: 'Quote', summary: '“We ship price lists the same day.”' },
    { type: 'CallToAction', label: 'Call to action', summary: 'Start a project' },
  ]

  // Runtime settings for this app (cf_env_cf-cloud): real keys and values.
  const settings = {
    section: 'cf_env_cf-cloud',
    admin_brand_name: 'CF Cloud', admin_site_name: 'Cloud administration', admin_footer_text: '', admin_theme: 'ledger',
    auth_heading: 'Sign in to CF Cloud', auth_redirect_path: '/admin', admin_roles: ['admin'],
    auth_session_max_age_seconds: 600, workersStarted: '14:52',
  }

  // SAMPLE recent changes for indux-orders.
  const changes = [
    { seq: 12335, id: 'order:2026-10-28-0412', rev: '4-9c1e0a7f3b', time: '16:38', by: 'mihai.dobre' },
    { seq: 12334, id: 'order:2026-10-28-0411', rev: '1-7a2d93e01c', time: '16:31', by: 'checkout' },
    { seq: 12333, id: 'stock-hold:EL-50-120', rev: '6-2f8b41c9de', time: '16:31', by: 'checkout' },
    { seq: 12332, id: 'order:2026-10-28-0405', rev: '3-b40e6d2a91', time: '15:47', by: 'mihai.dobre' },
    { seq: 12331, id: 'order:2026-10-27-0398', rev: '5-0d3c7f81aa', time: '15:02', by: 'invoice-bot' },
  ]
  const ordersDb = databases.find((d) => d.name === 'indux-orders')
  const docsPerDay = [41, 38, 52, 47, 12, 9, 44, 49, 53, 58, 51, 14, 11, 56, 62, 59, 64, 57, 16, 10, 61, 66, 63, 71, 68, 18, 13, 69, 72, 54]
  const designDocs = [
    { name: '_design/orders', views: ['by_status', 'by_customer', 'by_date'], index: 0.41, updated: '16:38' },
    { name: '_design/reports', views: ['revenue_by_month'], index: 0.12, updated: '06:00' },
    { name: '_design/validation', views: [], index: 0, updated: '14 Oct', note: 'validate_doc_update' },
  ]
  const security = { admins: { roles: ['admin'], names: [] }, members: { roles: ['orders:indux'], names: ['invoice-bot'] } }

  // ---- checks: figures shown in more than one place must agree ----
  console.assert(ordersDb && ordersDb.docs === 2038, 'indux-orders doc count')
  console.assert(failing.source === ordersDb.name, 'the failing job is the database on the detail page')
  console.assert(orderCounts.toFulfil + orderCounts.awaiting + orderCounts.fulfilled + orderCounts.closed === orderCounts.all, 'order tabs add up')
  console.assert(userCounts.admins + users.filter((u) => u.roles.length && !u.roles.includes('admin')).length + userCounts.noRole === userCounts.all, 'user tabs add up')
  console.assert(analytics.pages.reduce((a, [, v]) => a + v, 0) <= analytics.pageviews, 'top pages within pageviews')
  console.assert(analytics.referrers.reduce((a, [, v]) => a + v, 0) <= analytics.total, 'referrers within visitors')
  console.assert(analytics.countries.reduce((a, [, v]) => a + v, 0) <= analytics.total, 'countries within visitors')
  console.assert(Math.abs(totals.file - sites.reduce((a, s) => a + s.file, 0)) < 0.05, 'site sizes sum to the platform')

  window.CF = { NOW, SERVER, sites, databases, totals, needsCompaction, snapshots, snapshotMB, replications, failing, hours, writes, writesTotal, writesNote,
    users, userCounts, orders, orderCounts, revenue7d, lightningShare, SATS_PER_EUR, analytics, pagesTree, blocks, settings, changes, ordersDb, docsPerDay, designDocs, security }
})()
