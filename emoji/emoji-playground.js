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
 document.getElementById("export-png")?.addEventListener("click",function(){
   var img=new Image();
   img.onload=function(){
     var canvas=document.createElement("canvas");canvas.width=256;canvas.height=256;
     var ctx=canvas.getContext("2d");
     if(!ctx){notify("IMAGE EXPORT NOT SUPPORTED");return;}
     ctx.clearRect(0,0,256,256);
     ctx.drawImage(img,0,0,256,256);
     canvas.toBlob(function(blob){
       if(!blob){notify("IMAGE EXPORT FAILED");return;}
       var url=URL.createObjectURL(blob),a=document.createElement("a");
       a.href=url;a.download="fridge-emoji-unofficial.png";
       document.body.appendChild(a);a.click();a.remove();
       setTimeout(function(){URL.revokeObjectURL(url)},10000);
       notify("256PX ICON EXPORTED");
     },"image/png");
   };
   img.onerror=function(){notify("ICON FAILED TO LOAD");};
   img.src="./assets/fridge-emoji.svg";
 });

}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",ready,{once:true});else ready();
})();