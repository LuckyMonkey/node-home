// ==UserScript==
// @name         Fridge Emoji (opt-in, experimental)
// @namespace    https://fridge.run/emoji/
// @version      0.1.0
// @description  Render :fridge: on websites you explicitly allow.
// @match        https://example.invalid/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

/* To opt in, REPLACE the example.invalid @match with a specific site
   you control or are authorized to customize. Do not wildcard every site. */
(function(){
  "use strict";
  if(window.FridgeEmoji)return;
  var script=document.createElement("script");
  script.src="https://fridge.run/emoji/fridge-shim.js";
  script.defer=true;
  (document.head||document.documentElement).appendChild(script);
})();
