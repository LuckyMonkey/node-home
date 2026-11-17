/* Fridge Emoji shim 0.1 — experimental. Portable shortcode :fridge: / :refrigerator:.
 * Uses authored SVG for color, private-use U+E900 WOFF2 fallback.
 * No analytics, no network calls except loading its own static CSS/SVG.
 * Opt-in on each site; cannot install a globally interoperable Unicode character.
 */
(function(global){
"use strict";
if(global.FridgeEmoji && global.FridgeEmoji.version) return;
var script=document.currentScript;
var base=script && script.src ? new URL("./",script.src).href : "https://fridge.run/emoji/";
var icon=new URL("assets/fridge-emoji.svg",base).href;
var css=new URL("assets/fridge-emoji.css",base).href;
var marker=/(:fridge:|:refrigerator:|\uE900)/g;
var probe=/:fridge:|:refrigerator:|\uE900/;
var exclude="script,style,textarea,input,select,option,pre,code,kbd,samp,svg,math,noscript,[contenteditable],.fe-emoji";
function stylesheet(){
 if(document.querySelector('link[data-fridge-emoji-css]')) return;
 var link=document.createElement("link");link.rel="stylesheet";link.href=css;link.dataset.fridgeEmojiCss="1";
 (document.head||document.documentElement).appendChild(link);
}
function make(){
 var s=document.createElement("span");s.className="fe-emoji";s.setAttribute("role","img");
 s.setAttribute("aria-label","refrigerator emoji");s.title="Experimental refrigerator emoji";
 var img=document.createElement("img");img.src=icon;img.alt="";img.loading="eager";img.decoding="async";
 img.addEventListener("error",function(){s.classList.add("fe-image-error")},{once:true});
 var fallback=document.createElement("span");fallback.className="fe-fallback";fallback.textContent="\uE900";fallback.setAttribute("aria-hidden","true");
 s.append(img,fallback);return s;
}
function text(node){
 if(!node || node.nodeType!==3 || !probe.test(node.nodeValue||""))return;
 var parent=node.parentElement;if(!parent||parent.closest(exclude))return;
 var str=node.nodeValue,frag=document.createDocumentFragment(),last=0,m;
 marker.lastIndex=0;
 while((m=marker.exec(str))){
   if(m.index>last) frag.appendChild(document.createTextNode(str.slice(last,m.index)));
   frag.appendChild(make());last=marker.lastIndex;
 }
 if(last<str.length)frag.appendChild(document.createTextNode(str.slice(last)));
 node.replaceWith(frag);
}
function render(root){
 if(!root)return;
 if(root.nodeType===3){text(root);return}
 if(root.nodeType!==1 && root.nodeType!==9 && root.nodeType!==11)return;
 if(root.nodeType===1 && root.matches(exclude))return;
 var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),nodes=[],n;
 while((n=walker.nextNode())){if(probe.test(n.nodeValue||""))nodes.push(n);}
 for(var i=0;i<nodes.length;i++)text(nodes[i]);
}
var observer;
function start(){
 stylesheet();render(document.body);
 if(observer||!document.body)return;
 observer=new MutationObserver(function(records){
  for(var i=0;i<records.length;i++){
   var r=records[i];
   if(r.type==="characterData")text(r.target);
   else for(var j=0;j<r.addedNodes.length;j++)render(r.addedNodes[j]);
  }
 });
 observer.observe(document.body,{subtree:true,childList:true,characterData:true});
}
global.FridgeEmoji={version:"0.1",codepoint:"U+E900",character:"\uE900",shortcode:":fridge:",render:render,createElement:make};
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
else start();
})(window);
