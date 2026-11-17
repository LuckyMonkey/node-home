/* The "Try it" section: live :fridge: playground, copy buttons, transparent PNG export. Static, no network calls
   besides the page's own files. The page reads fine without it (the tools stay hidden). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var toast = $('toast'), timer;
  function notify(msg) { toast.textContent = msg; toast.hidden = false; clearTimeout(timer); timer = setTimeout(function () { toast.hidden = true; }, 2600); }
  function copy(text, done) {
    var fallback = function () { window.prompt('Copy this:', text); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { notify(done); }, fallback);
    else fallback();
  }

  /* PNG: the canonical SVG drawn on a transparent canvas at the chosen size. */
  function png(size) {
    return fetch('./concepts/classic-base.svg').then(function (r) { return r.text(); }).then(function (svg) {
      svg = svg.replace('<svg ', '<svg width="' + size + '" height="' + size + '" ');   // Firefox needs a size to rasterise
      return new Promise(function (ok, fail) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement('canvas');
          c.width = c.height = size;
          c.getContext('2d').drawImage(img, 0, 0, size, size);
          c.toBlob(function (b) { b ? ok(b) : fail(new Error('PNG export failed')); }, 'image/png');
        };
        img.onerror = function () { fail(new Error('could not draw the fridge')); };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
      });
    });
  }
  window.FridgeEmojiDemo = { png: png };

  function start() {
    var input = $('play-in'), out = $('play-out'), modeBox = $('play-mode');
    var mode = function () { var c = document.querySelector('input[name="play-mode"]:checked'); return c ? c.value : 'image'; };
    var queued = false;
    function draw() {
      queued = false;
      out.textContent = input.value;                         // text only: nothing typed is ever parsed as HTML
      if (window.FridgeEmoji) window.FridgeEmoji.render(out, { mode: mode() });
    }
    function later() { if (!queued) { queued = true; requestAnimationFrame(draw); } }
    input.addEventListener('input', later);
    modeBox.addEventListener('change', later);
    modeBox.hidden = false;
    draw();

    $('tools').hidden = false;
    $('copy-code').addEventListener('click', function () { copy(':fridge:', 'Copied :fridge:'); });
    $('copy-pua').addEventListener('click', function () {
      copy('', 'Copied U+E900. It only shows as a fridge where the font is.');
    });
    $('png').addEventListener('click', function () {
      var size = parseInt($('png-size').value, 10) || 128;
      png(size).then(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'fridge-emoji-' + size + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        notify('PNG saved (' + size + '×' + size + ', transparent)');
      }, function (e) { notify(String(e.message || e)); });
    });
    if (window.FridgeEmoji) window.FridgeEmoji.fontReady().then(function (ok) {
      $('font-status').textContent = ok ? 'Font loaded ✓' : 'The font didn\'t load here, so you may see a box.';
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
}());
