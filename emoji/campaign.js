/* Set this to your new Change.org petition URL to activate every SIGN button. */
const PETITION_URL = "";
const CAMPAIGN_URL = "https://fridge.run/emoji/";
(function(){
 const signIds=["sign","sign-bottom"];
 if(PETITION_URL && /^https:\/\/www\.change\.org\//.test(PETITION_URL)){
   for(const id of signIds){const el=document.getElementById(id);if(el){el.href=PETITION_URL;el.hidden=false;}}
   document.getElementById("pending").hidden=true;
 }
 const toast=document.getElementById("toast");
 let timer;
 function notify(msg){toast.textContent=msg;toast.hidden=false;clearTimeout(timer);timer=setTimeout(()=>toast.hidden=true,2400);}
 async function share(){
   const data={title:"Let's get a refrigerator emoji!",text:"It's free. It's cool. Takes a second. 🧊",url:CAMPAIGN_URL};
   if(navigator.share){try{await navigator.share(data);return;}catch(e){if(e.name==="AbortError")return;}}
   try{await navigator.clipboard.writeText(CAMPAIGN_URL);notify("LINK COPIED!");}
   catch(e){window.prompt("Copy the campaign link:",CAMPAIGN_URL);}
 }
 for(const id of ["share","share-bottom"]){document.getElementById(id)?.addEventListener("click",share);}
})();