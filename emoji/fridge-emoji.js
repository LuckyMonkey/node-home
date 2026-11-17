/*!
 * fridge-emoji.js: turns :fridge: (and :refrigerator:) into a refrigerator on pages that choose to load it.
 * https://fridge.run/emoji/ · MIT licence · no dependencies, no network calls besides the icon/font, no cookies, no tracking.
 *
 *   <link rel="stylesheet" href="https://fridge.run/emoji/fridge-emoji.css">
 *   <script src="https://fridge.run/emoji/fridge-emoji.js"></script>
 *   <script>FridgeEmoji.render(document.querySelector('#chat'));</script>
 *
 * Or add data-fridge-emoji="auto" to the script tag to render the whole page and keep up with new text.
 *
 *   FridgeEmoji.render(el, {mode})   replace shortcodes in el's text; returns how many. mode: "image" (default,
 *                                    full-colour SVG) or "font" (the Fridge Emoji glyph, U+E900, falls back to image)
 *   FridgeEmoji.observe(el, {mode})  render now and whenever text is added later; returns a stop() function
 *   FridgeEmoji.text(str)            the same string with shortcodes replaced by U+E900 (for copying)
 *   FridgeEmoji.fontReady()          Promise<boolean>: did the web font load?
 *
 * It never touches form fields, contenteditable regions, <code>/<pre>/<kbd>/<samp>, scripts or styles, or anything
 * inside [data-fridge-emoji="off"]. It builds DOM nodes; it never parses HTML. U+E900 is a Private Use code point,
 * this project's convention, not an official Unicode emoji.
 */
(function (root) {
  'use strict';
  if (root.FridgeEmoji) return;
  var CODEPOINT = '';
  var RE = /:(fridge|refrigerator):/g;
  var HAS = /:(fridge|refrigerator):/;              // no g flag: test() keeps no state
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 1, OPTION: 1,
    CODE: 1, PRE: 1, KBD: 1, SAMP: 1, IFRAME: 1, SVG: 1, MATH: 1, CANVAS: 1 };
  var script = document.currentScript;
  var BASE = (function () {
    try { return new URL('.', script && script.src ? script.src : location.href).href; } catch (e) { return './'; }
  }());
  var fontState = null;

  function fontReady() {
    if (fontState) return fontState;
    if (!document.fonts || !document.fonts.load) return (fontState = Promise.resolve(false));
    fontState = document.fonts.load('1em "Fridge Emoji"', CODEPOINT)
      .then(function (list) { return list.length > 0; }, function () { return false; });
    return fontState;
  }

  function skipEl(el) {
    if (SKIP[el.nodeName.toUpperCase()]) return true;
    if (el.isContentEditable) return true;
    if (el.classList && el.classList.contains('fridge-emoji')) return true;
    var off = el.getAttribute && el.getAttribute('data-fridge-emoji');
    return off === 'off';
  }

  function image(name) {
    var img = document.createElement('img');
    img.className = 'fridge-emoji';
    img.src = BASE + 'concepts/classic-base.svg';
    img.alt = ':' + name + ':';                         // shows, and copies, as the shortcode if the image fails
    img.setAttribute('aria-label', 'Refrigerator');
    img.title = ':' + name + ':';
    img.draggable = false;
    img.decoding = 'async';
    img.width = img.height = 20;
    return img;
  }

  function glyph(name) {
    var s = document.createElement('span');
    s.className = 'fridge-emoji fridge-glyph';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Refrigerator');
    s.title = ':' + name + ':';
    s.textContent = CODEPOINT;
    fontReady().then(function (ok) {                    // no font: swap to the picture instead of an empty box
      if (!ok && s.parentNode) s.parentNode.replaceChild(image(name), s);
    });
    return s;
  }

  function inSkipped(node, stop) {
    for (var el = node.parentNode; el && el !== stop && el.nodeType === 1; el = el.parentNode) {
      if (skipEl(el)) return true;
    }
    return !!(el && el.nodeType === 1 && el !== stop && skipEl(el));
  }

  function replaceText(node, mode) {
    var text = node.nodeValue;
    RE.lastIndex = 0;
    var m, last = 0, frag = null, n = 0;
    while ((m = RE.exec(text))) {
      frag = frag || document.createDocumentFragment();
      if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
      frag.appendChild(mode === 'font' ? glyph(m[1]) : image(m[1]));
      last = RE.lastIndex;
      n++;
    }
    if (!frag) return 0;
    if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
    node.parentNode.replaceChild(frag, node);
    return n;
  }

  function render(el, opts) {
    el = el || document.body;
    var mode = opts && opts.mode === 'font' ? 'font' : 'image';
    if (!el) return 0;
    if (el.nodeType === 3) {
      return el.nodeValue.indexOf(':') === -1 || inSkipped(el, null) ? 0 : replaceText(el, mode);
    }
    if (el.nodeType !== 1 && el.nodeType !== 11) return 0;
    if (el.nodeType === 1 && (skipEl(el) || inSkipped(el, null))) return 0;
    var found = [];
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (node.nodeType === 1) return skipEl(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_SKIP;
        return node.nodeValue.indexOf(':') !== -1 && HAS.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    for (var t = walker.nextNode(); t; t = walker.nextNode()) found.push(t);
    var n = 0;
    for (var i = 0; i < found.length; i++) n += replaceText(found[i], mode);  // change the tree after walking it
    return n;
  }

  function observe(el, opts) {
    el = el || document.body;
    render(el, opts);
    if (!root.MutationObserver) return function () {};
    var queue = [], pending = false;
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var r = records[i];
        if (r.type === 'characterData') queue.push(r.target);
        else for (var j = 0; j < r.addedNodes.length; j++) queue.push(r.addedNodes[j]);
      }
      if (pending) return;
      pending = true;
      (root.requestAnimationFrame || setTimeout)(function () {     // batch: one pass per frame, however much changed
        pending = false;
        var q = queue; queue = [];
        for (var k = 0; k < q.length; k++) if (q[k].isConnected !== false && el.contains(q[k])) render(q[k], opts);
      });
    });
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return function stop() { mo.disconnect(); };
  }

  root.FridgeEmoji = {
    version: '1.0.0', codepoint: 0xE900, shortcodes: [':fridge:', ':refrigerator:'], base: BASE,
    render: render, observe: observe, fontReady: fontReady,
    text: function (s) { return String(s).replace(RE, CODEPOINT); }
  };

  if (script && script.getAttribute('data-fridge-emoji') === 'auto') {
    var start = function () { observe(document.body, { mode: script.getAttribute('data-mode') || 'image' }); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  }
}(window));
