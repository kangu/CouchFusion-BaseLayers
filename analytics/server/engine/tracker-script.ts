/**
 * Standalone tracker served at `/a.js` for non-Nuxt sites. Umami-compatible
 * attributes and API:
 *   <script defer src="https://host/a.js"></script>
 * All hits go to the app's single website, so no website id is needed (a
 * leftover data-website-id attribute is ignored).
 *   data-host-url, data-auto-track="false", data-domains="a.com,b.com",
 *   data-tag, data-exclude-search, data-exclude-hash, data-do-not-track,
 *   data-before-send="fnName"
 *   window.umami.track(name?, data?) / window.umami.identify(id?, data?)
 *   <a data-umami-event="cta" data-umami-event-plan="pro">  (also data-cfa-event)
 */
export const TRACKER_SCRIPT = `(function(){
  "use strict";
  var w = window, d = document, n = navigator, l = w.location;
  var s = d.currentScript;
  if (!s) return;
  var attr = function(k){ return s.getAttribute(k); };
  var host = (attr("data-host-url") || s.src.split("/").slice(0, 3).join("/")).replace(/\\/$/, "");
  var endpoint = host + "/api/stats";
  var autoTrack = attr("data-auto-track") !== "false";
  var excludeSearch = attr("data-exclude-search") === "true";
  var excludeHash = attr("data-exclude-hash") === "true";
  var dnt = attr("data-do-not-track") === "true";
  var tag = attr("data-tag");
  var domains = (attr("data-domains") || "").split(",").map(function(x){ return x.trim(); }).filter(Boolean);
  var beforeSend = attr("data-before-send");
  var distinctId = null;
  var disabled = function(){
    if (dnt && (n.doNotTrack === "1" || w.doNotTrack === "1" || n.globalPrivacyControl)) return true;
    if (domains.length && domains.indexOf(l.hostname) === -1) return true;
    try { if (localStorage.getItem("umami.disabled") || localStorage.getItem("cfa.disabled")) return true; } catch (e) {}
    return false;
  };
  var currentUrl = function(){
    var u = l.pathname + (excludeSearch ? "" : l.search) + (excludeHash ? "" : l.hash);
    return u;
  };
  var lastUrl = null, lastRef = d.referrer || "";
  var base = function(){
    var p = { hostname: l.hostname, screen: (w.screen ? w.screen.width + "x" + w.screen.height : ""),
      language: n.language, title: d.title, url: currentUrl(), referrer: lastRef };
    if (tag) p.tag = tag;
    if (distinctId) p.id = distinctId;
    return p;
  };
  var send = function(payload, type){
    if (disabled()) return;
    if (beforeSend && typeof w[beforeSend] === "function") { payload = w[beforeSend](type || "event", payload); if (!payload) return; }
    var body = JSON.stringify({ type: type || "event", payload: payload });
    try {
      if (n.sendBeacon && n.sendBeacon(endpoint, new Blob([body], { type: "text/plain" }))) return;
    } catch (e) {}
    try { fetch(endpoint, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) {}
  };
  var track = function(name, data){
    if (typeof name === "function") return send(name(base()));
    if (name && typeof name === "object") return send(Object.assign(base(), name));
    if (!name) return send(base());
    var p = base(); p.name = String(name); if (data) p.data = data; send(p);
  };
  var identify = function(id, data){
    if (id && typeof id === "object") { data = id; id = null; }
    if (id) distinctId = String(id);
    var p = base(); if (data) p.data = data; send(p, "identify");
  };
  var pageview = function(){
    var u = currentUrl();
    if (u === lastUrl) return;
    if (lastUrl !== null) lastRef = l.origin + lastUrl;
    lastUrl = u;
    send(base());
  };
  var hook = function(method){
    var orig = history[method];
    history[method] = function(){ var r = orig.apply(this, arguments); setTimeout(pageview, 0); return r; };
  };
  d.addEventListener("click", function(e){
    var el = e.target && e.target.closest ? e.target.closest("[data-umami-event],[data-cfa-event]") : null;
    if (!el) return;
    var name = el.getAttribute("data-umami-event") || el.getAttribute("data-cfa-event");
    var data = {};
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i].name, m = a.match(/^data-(?:umami|cfa)-event-(.+)$/);
      if (m) data[m[1]] = el.attributes[i].value;
    }
    track(name, data);
  }, true);
  w.umami = w.umami || { track: track, identify: identify };
  w.cfa = { track: track, identify: identify };
  if (autoTrack) {
    hook("pushState"); hook("replaceState");
    w.addEventListener("popstate", pageview);
    if (d.readyState === "complete") pageview(); else w.addEventListener("load", pageview);
  }
})();
`;
