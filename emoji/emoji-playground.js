/* Refrigerator emoji lab — no backend, no analytics. */
(function(){
"use strict";
function ready(){
 var field=document.getElementById("emoji-input"),preview=document.getElementById("emoji-preview");
 if(!field||!preview)return;
 function draw(){
   preview.textContent=field.value;
   if(window.FridgeEmoji)window.FridgeEmoji.render(preview);
 }
 field.addEventListener("input",draw);
 draw();
 var toast=document.getElementById("toast");var timer;
 function notify(msg){if(!toast)return;toast.textContent=msg;toast.hidden=false;clearTimeout(timer);timer=setTimeout(function(){toast.hidden=true},2600);}
 async function copy(value,confirmation){
  try{if(!navigator.clipboard||!navigator.clipboard.writeText)throw Error("Clipboard unavailable");await navigator.clipboard.writeText(value);notify(confirmation);}
  catch(err){window.prompt("Copy this:",value);}
 }
 document.getElementById("copy-shortcode")?.addEventListener("click",function(){copy(":fridge:","PORTABLE :FRIDGE: COPIED");});
 document.getElementById("copy-glyph")?.addEventListener("click",function(){copy("\uE900","PRIVATE-USE U+E900 COPIED (REQUIRES FONT)");});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();