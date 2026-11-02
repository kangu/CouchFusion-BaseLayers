// Dev-only module preload (see utils/dev-module-preload.ts).
// Inlined at the top of <head> by `nuxt dev`. It asks the dev server which module URLs this
// kind of page loaded last time and adds a <link rel="modulepreload"> for each, so the
// browser fetches the whole graph at once instead of one import level per round trip.
// After the page has settled it reports what it loaded, so the list keeps itself current.
// The modules, their URLs, source maps and HMR are unchanged: this only changes when the
// browser starts fetching them. Add `?cf-preload=off` to a URL to skip it for one load,
// `?cf-preload=reset` to skip it and record a fresh list.
(function (opts) {
  var prefix = opts.prefix; // buildAssetsDir with baseURL, e.g. "/_nuxt/"
  var endpoint = prefix + "__cf_dev_preload";
  var params = new URLSearchParams(location.search);
  var mode = params.get("cf-preload");
  if (mode === "off") return;

  var rest = location.pathname.slice(opts.base.length);
  var key = (rest.split("/")[0] || "root").toLowerCase().replace(/[^a-z0-9_.-]/g, "_").slice(0, 64);
  if (params.has("inline-preview")) key += "~inline";
  var query = "?key=" + encodeURIComponent(key);

  try {
    performance.setResourceTimingBufferSize(10000);
  } catch (e) {}

  var ours = new Set(); // absolute URLs this script preloaded
  if (mode !== "reset") {
    fetch(endpoint + query, { cache: "no-store", credentials: "same-origin" })
      .then(function (r) {
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        var urls = data && Array.isArray(data.urls) ? data.urls : [];
        var frag = document.createDocumentFragment();
        urls.forEach(function (u) {
          if (typeof u !== "string" || u.indexOf(prefix) !== 0) return;
          var link = document.createElement("link");
          link.rel = "modulepreload";
          link.href = u;
          frag.appendChild(link);
          ours.add(link.href);
        });
        document.head.appendChild(frag);
      })
      .catch(function () {});
  }

  var notModule = /\.(woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|svg|ico|mp4|webm|map)$/i;

  // Module URLs fetched by this load, in fetch order. A preloaded URL whose path was also
  // imported under another query (new `?v=` after re-optimization, `?t=` after HMR) is stale
  // and dropped.
  function collect() {
    var picked = [];
    var importedPaths = new Set();
    performance.getEntriesByType("resource").forEach(function (e) {
      var url;
      try {
        url = new URL(e.name);
      } catch (err) {
        return;
      }
      if (url.origin !== location.origin || url.pathname.indexOf(prefix) !== 0) return;
      if (url.pathname === endpoint || notModule.test(url.pathname)) return;
      if (e.responseStatus >= 400) return;
      var t = e.initiatorType;
      var preloaded = t === "link" && ours.has(e.name);
      if (!preloaded && t !== "script" && t !== "other") return;
      var rel = url.pathname + url.search;
      if (!preloaded) importedPaths.add(url.pathname);
      picked.push({ rel: rel, path: url.pathname, preloaded: preloaded });
    });
    var seen = new Set();
    var out = [];
    picked.forEach(function (p) {
      if (seen.has(p.rel) || (p.preloaded && importedPaths.has(p.path))) return;
      seen.add(p.rel);
      out.push(p.rel);
    });
    return out;
  }

  function report(urls) {
    fetch(endpoint + query, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ urls: urls }),
    }).catch(function () {});
  }

  // Report once no new module has arrived for 3 s, and again whenever more arrive later
  // (slow requests, lazy panels), until 60 s after load.
  window.addEventListener("load", function () {
    var reported = 0;
    var lastCount = -1;
    var quiet = 0;
    var waited = 0;
    var timer = setInterval(function () {
      waited += 1000;
      var urls = collect();
      if (urls.length === lastCount) quiet += 1000;
      else {
        quiet = 0;
        lastCount = urls.length;
      }
      if (quiet >= 3000 && urls.length && urls.length !== reported) {
        reported = urls.length;
        report(urls);
      }
      if (waited >= 60000) clearInterval(timer);
    }, 1000);
  });
})(__CF_DEV_PRELOAD_OPTIONS__);
