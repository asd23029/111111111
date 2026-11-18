"use strict";
// Tonight, Where To Eat? - preference quiz (not direct restaurant elimination).
// The restaurant names are intentionally hidden until all photo and scenario swipes are complete.
const $=id=>document.getElementById(id);
const STORAGE_KEY="taichung-birthday-swipe-quiz-v1";
const IMPORT_LEGACY_KEY="taichung-birthday-swipe-v3";
const escapeHtml=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=x=>String(x??"").trim().slice(0,250);
const normalize=x=>clean(x).toLowerCase().replace(/[\s·．・－\-_()（）]/g,"");
const money=x=>Number(x||0).toLocaleString("zh-TW");
function safeUrl(input){try{const u=new URL(input);return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
function mapsUrl(r){return "https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(r.name+" "+(r.address||"台中市"));}
function recover(key){try{return JSON.parse(localStorage.getItem(key)||"{}")||{};}catch{return {};}}
const saved=recover(STORAGE_KEY),old=recover(IMPORT_LEGACY_KEY);
const state={
  base:[],social:[],referenceLists:[],
  imports:Array.isArray(saved.imports)?saved.imports:Array.isArray(old.imports)?old.imports:[],
  link:saved.link||old.link||"",
  answers:Array.isArray(saved.answers)?saved.answers:[],
  busy:false,tab:"explore",sharedTop:null
};
const dimensions={styles:"風格",foods:"料理",atmos:"氛圍",mains:"主食",features:"特色"};
// Each photograph is a real restaurant image from the researched Taichung database.
// The photo's source is linked; restaurant identity is withheld from the card title.
const PHOTO_QUESTIONS=[
  {id:"p-style-jp",group:"styles",value:"日式質感",photo:"umai-zhonggang",label:"風格照",title:"木質暖燈的日式空間",desc:"剛剛好的距離，適合慢慢吃一餐。"},
  {id:"p-style-french",group:"styles",value:"法式優雅",photo:"laffection",label:"風格照",title:"優雅、有點正式的法式感",desc:"生日值得穿漂亮一點，好好吃頓飯。"},
  {id:"p-style-glass",group:"styles",value:"浪漫玻璃屋",photo:"fore",label:"風格照",title:"有陽光、有綠意的玻璃屋",desc:"連環境本身都很適合拍一張紀念照。"},
  {id:"p-style-vintage",group:"styles",value:"老宅氛圍",photo:"jingcheng-yishan",label:"風格照",title:"有故事的老宅和庭院",desc:"比起制式裝潢，更喜歡有個性的空間。"},
  {id:"p-food-bbq",group:"foods",value:"燒肉",photo:"chaliu-gongyi",label:"料理照",title:"肉片在烤網上滋滋作響",desc:"生日就是想大口吃燒肉！"},
  {id:"p-food-steak",group:"foods",value:"牛排",photo:"meatgq",label:"料理照",title:"切開一份厚實多汁的牛排",desc:"想讓主餐當今晚的主角。"},
  {id:"p-food-hotpot",group:"foods",value:"火鍋",photo:"orange-taichung",label:"料理照",title:"精緻食材慢慢涮的鍋物",desc:"邊吃邊聊，一口一口暖心。"},
  {id:"p-food-french",group:"foods",value:"法式料理",photo:"gulu-dining",label:"料理照",title:"擺盤精緻的小巧料理",desc:"每道菜端上桌都像小驚喜。"},
  {id:"p-food-teppan",group:"foods",value:"鐵板燒",photo:"le-gout-chongde",label:"料理照",title:"坐在板前欣賞主廚料理",desc:"喜歡食材和料理過程的互動。"},
  {id:"p-env-date",group:"atmos",value:"安靜約會",photo:"gulu-dining",photoIndex:1,label:"環境照",title:"安安靜靜的兩人晚餐",desc:"燈光剛剛好，能專心陪彼此。"},
  {id:"p-env-gather",group:"atmos",value:"熱鬧聚會",photo:"umai-zhonggang",label:"環境照",title:"一群朋友一起開心大笑",desc:"喜歡生日桌上有熱鬧又自在的氣氛。"},
  {id:"p-env-photogenic",group:"atmos",value:"拍照美景",photo:"fore",photoIndex:1,label:"環境照",title:"隨手一拍都好看的空間",desc:"想把這個特別的夜晚留在相簿。"},
  {id:"p-main-beef",group:"mains",value:"牛肉",photo:"oomata",label:"主食照",title:"今天就是要吃厲害的牛肉",desc:"牛肉派，看到好肉就很開心。"},
  {id:"p-main-seafood",group:"mains",value:"海鮮",photo:"jingcheng-yishan",photoIndex:1,label:"主食照",title:"海鮮的鮮甜最讓人期待",desc:"蝦、魚、海鮮料理都可以。"},
  {id:"p-main-courses",group:"mains",value:"多道套餐",photo:"minsuizenraku",label:"主食照",title:"一整套慢慢品嚐的料理",desc:"希望整個用餐過程都充滿驚喜。"},
  {id:"p-feature-service",group:"features",value:"桌邊服務",photo:"oomata",photoIndex:1,label:"特色照",title:"專人桌邊料理的儀式感",desc:"生日想當個只需要享受的客人。"},
  {id:"p-feature-dessert",group:"features",value:"精緻甜點",photo:"le-gout-chongde",photoIndex:1,label:"特色照",title:"用一道漂亮甜點收尾",desc:"生日餐怎麼可以少了甜甜的結尾。"}
].map(q=>({...q,type:"photo",tags:[{group:q.group,values:[q.value],weight:3}]}));
const SCENARIOS=[
  {id:"s-date",type:"scenario",emoji:"💌",label:"約會情境",title:"這次生日想和另一半，安靜地聊一整晚。",desc:"不需要太多人，只想留給彼此時間。",tags:[{group:"atmos",values:["安靜約會"],weight:3},{group:"styles",values:["法式優雅","浪漫玻璃屋"],weight:1.5}]},
  {id:"s-friends",type:"scenario",emoji:"🎉",label:"聚會情境",title:"生日就是要一群朋友一起，越熱鬧越好！",desc:"邊吃、邊拍、邊聊天才有感覺。",tags:[{group:"atmos",values:["熱鬧聚會"],weight:3},{group:"foods",values:["燒肉"],weight:1.5}]},
  {id:"s-service",type:"scenario",emoji:"👩‍🍳",label:"服務情境",title:"希望有人幫忙料理，自己專心享受就好。",desc:"桌邊代烤或料理表演都讓我心動。",tags:[{group:"features",values:["桌邊服務"],weight:3},{group:"foods",values:["鐵板燒","燒肉"],weight:1}]},
  {id:"s-photos",type:"scenario",emoji:"📸",label:"氣氛情境",title:"今天的餐廳一定要好拍！",desc:"環境與燈光也是生日回憶的一部分。",tags:[{group:"atmos",values:["拍照美景"],weight:3},{group:"features",values:["景觀空間"],weight:2},{group:"styles",values:["浪漫玻璃屋","老宅氛圍"],weight:1}]},
  {id:"s-special",type:"scenario",emoji:"🎂",label:"儀式感情境",title:"希望生日有一點驚喜，感覺被好好慶祝。",desc:"想要漂亮收尾，或有值得記住的小細節。",tags:[{group:"features",values:["壽星驚喜","精緻甜點"],weight:2.5},{group:"mains",values:["多道套餐"],weight:1.5}]}
];
const QUESTIONS=[...PHOTO_QUESTIONS,...SCENARIOS];
function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({answers:state.answers,imports:state.imports.slice(0,500),link:state.link}));}catch{notify("儲存空間不足，可能無法保留操作紀錄");}}
function all(){return [...state.base,...state.imports];}
function verified(){return state.base.filter(r=>!r.imported&&r.images?.length&&r.budget?.[0]>=1000&&r.budget?.[0]<=3000);}
function qsById(id){return QUESTIONS.find(q=>q.id===id);}
function isDone(){return state.answers.length>=QUESTIONS.length;}
function getQuestion(){return QUESTIONS[state.answers.length];}
let toastTimer;
function notify(message){
 const el=$("toast");if(!el)return;
 el.textContent=message;el.classList.add("visible");
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),3200);
}

// Secondary, source-linked restaurant photos for hosts that block direct image embedding.
// Each candidate retains the actual restaurant/photo publisher attribution.
const PHOTO_ALTERNATES={
 "p-style-vintage":[
  {url:"https://pimg.1px.tw/bear31409/1742308217-2894672635-g.jpg",source:"https://bear31409.pixnet.net/blog/posts/10358261527"},
  {url:"https://live.staticflickr.com/65535/55190046520_b05821023a_b.jpg",source:"https://orange-dog.com/13yakinuku/"}
 ],
 "p-food-steak":[
  {url:"https://obs.line-scdn.net/0hYj0let48BkUNFS9s6R95EjRDCjQ-cRNDY20eJC5ACCVyJl1AZCYcPy0SXCU8dUVDZm9BIiAWDyEpchQaMHQ",source:"https://buy.line.me/u/article/175423"}
 ],
 "p-food-french":[
  {url:"https://v3-statics.mirrormedia.mg/images/20230103171324-5d21f8bac1d2d16ee309f49254c650ce-w1600.jpg",source:"https://www.mirrormedia.mg/story/20230103food002"},
  {url:"https://pimg.1px.tw/jennieschen/1742199462-615466110-g.jpg",source:"https://jennieschen.pixnet.net/blog/posts/49578772"}
 ],
 "p-food-teppan":[
  {url:"https://img.fun-life.com.tw/restaurant/le-gout/DSC06798.jpg",source:"https://shin.tw/le-gout/"},
  {url:"https://media.vogue.com.tw/photos/635bbfeb7440a0a03bd06aa9/master/w_1600%2Cc_limit/IMG-8548.jpg",source:"https://www.vogue.com.tw/lifestyle/article/%E6%A8%82%E8%91%B5%E9%90%B5%E6%9D%BF%E7%87%92-%E6%96%B0%E5%A4%A9%E5%9C%B0-le-gout-%E5%8F%B0%E4%B8%AD"}
 ],
 "p-env-date":[
  {url:"https://archsunny.com/wp-content/uploads/2020/12/1F-2-16-scaled.jpg",source:"https://archsunny.com/%E6%B3%95%E6%A3%AE%E5%B0%8F%E9%A4%A8%E6%B3%95%E5%BC%8F%E9%A4%90%E5%BB%B3/"}
 ],
 "p-env-photogenic":[
  {url:"https://www.fore-restaurant.com/archive/image/uploads/fore-restaurant-6-ufnd0z.jpg",source:"https://www.fore-restaurant.com/article_d.php?id=122&lang=tw&tb=4"},
  {url:"https://cc.tvbs.com.tw/img/program/upload/2024/08/14/20240814182200-a30c2646.jpg",source:"https://supertaste.tvbs.com.tw/food/350770"}
 ],
 "p-main-beef":[
  {url:"https://media.lyes.tw/photo/90/90pey88k4zeaw0-9/o.jpg",source:"https://lyes.tw/hocom-%E5%A4%A7%E8%82%A1%E7%86%9F%E6%88%90%E7%87%92%E8%82%89%E5%B0%88%E9%96%80/"},
  {url:"https://s.yimg.com/os/creatr-uploaded-images/2022-01/ecf56c40-76e8-11ec-9c6f-36dbe341de7c",source:"https://autos.yahoo.com.tw/%E5%8F%B0%E4%B8%AD%E3%80%8C%E5%A4%A7%E8%82%A1%E7%86%9F%E6%88%90%E7%87%92%E8%82%89%E5%B0%88%E9%96%80%E3%80%8D-30-%E7%A8%AE%E6%B8%85%E9%85%92%E8%87%AA%E5%8B%95%E8%B2%A9%E8%B3%A3%E6%A9%9F%E5%A5%BD%E5%96%9D%E5%A5%BD%E7%8E%A9%EF%BC%81%E5%85%A8%E7%A8%8B%E4%BB%A3%E7%83%A4%E8%BC%95%E9%AC%86%E5%90%83-164022701.html"}
 ],
 "p-main-seafood":[
  {url:"https://cdn.walkerland.com.tw/images/upload/poi/p136806/m18300/d14c412eeb46b05d5ae679fa4fa493c961c0cbec.jpg",source:"https://www.walkerland.com.tw/article/view/416271"},
  {url:"https://live.staticflickr.com/65535/55190046520_b05821023a_b.jpg",source:"https://orange-dog.com/13yakinuku/"}
 ],
 "p-feature-service":[
  {url:"https://media.lyes.tw/photo/90/90pey88k4zeaw0-9/o.jpg",source:"https://lyes.tw/hocom-%E5%A4%A7%E8%82%A1%E7%86%9F%E6%88%90%E7%87%92%E8%82%89%E5%B0%88%E9%96%80/"},
  {url:"https://img.fun-life.com.tw/restaurant/le-gout/DSC06798.jpg",source:"https://shin.tw/le-gout/"}
 ],
 "p-feature-dessert":[
  {url:"https://megapx-assets.dcard.tw/images/dd909b00-071b-4d1b-ba7c-abfb85967bc9/1280.jpeg",source:"https://www.dcard.tw/f/food/p/255337771"},
  {url:"https://pimg.1px.tw/mi0424/1690339478-3528632257-g.jpg",source:"https://mi0424.pixnet.net/blog/posts/7122022128"}
 ]
};

function photoSource(question){
 const r=state.base.find(x=>x.id===question.photo);
 const pics=(r?.images||[]).filter(safeUrl);
 const idx=question.photoIndex||0;
 const basePics=[...pics.slice(idx,idx+1),...pics.filter((url,i)=>i!==idx)];
 const alt=(PHOTO_ALTERNATES[question.id]||[]).filter(x=>safeUrl(x.url));
 const source=safeUrl(r?.source)||"";
 // Prefer a confirmed semantic match and then try the researched picture's original URLs.
 const first=(alt[0]||{url:basePics[0],source});
 const sequence=[...alt.map(x=>({url:x.url,source:x.source})),...basePics.map(url=>({url,source}))];
 return {src:safeUrl(first.url),source:safeUrl(first.source)||source,
         candidates:sequence.filter((o,i,arr)=>o.url&&arr.findIndex(x=>x.url===o.url)===i)};
}
function photoCard(question){
 const image=photoSource(question);
 const visual=image.src?'<img class="quiz-photo" src="'+escapeHtml(image.src)+'" alt="台中餐廳實景照片：'+escapeHtml(question.title)+'" draggable="false">':'<div class="quiz-image-fallback">✿<small>圖片暫時無法顯示，請依描述判斷</small></div>';
 return '<article class="preference-card photo-preference" aria-label="'+escapeHtml(question.title)+'"><div class="preference-visual">'+visual+
 '<div class="preference-vignette"></div><span class="preference-category">✦ '+escapeHtml(question.label)+'</span>'+
 (image.source?'<a class="preference-credit" href="'+escapeHtml(image.source)+'" target="_blank" rel="noopener noreferrer" aria-label="開啟照片來源">照片來源 ↗</a>':"")+
 '<div class="photo-label"><small>DOES THIS FEEL RIGHT?</small><h3>'+escapeHtml(question.title)+'</h3><p>'+escapeHtml(question.desc)+'</p></div></div>'+
 '<div class="preference-card-footer"><span>你對這種'+escapeHtml(dimensions[question.group])+'有感覺嗎？</span><span class="small-heart">♡</span></div></article>';
}
function scenarioCard(question){
 return '<article class="preference-card scenario-preference" aria-label="'+escapeHtml(question.title)+'"><div class="scenario-decor decor-a">✳</div><div class="scenario-decor decor-b">✦</div>'+
 '<div class="scenario-inner"><span class="scenario-label">✦ '+escapeHtml(question.label)+' · THIS OR THAT?</span><div class="scenario-illustration" aria-hidden="true"><span class="scenario-emoji">'+escapeHtml(question.emoji)+'</span><i>✧</i></div>'+
 '<p class="scenario-number">生日小劇場</p><h3>'+escapeHtml(question.title)+'</h3><p>'+escapeHtml(question.desc)+'</p>'+
 '<span class="scenario-remind">右滑「有！我想要」 · 左滑「不太需要」</span></div></article>';
}
function updateJourney(){
 const step=state.answers.length,phase=isDone()?"results":getQuestion().type==="scenario"?"scenario":"photo";
 document.querySelectorAll(".journey-item").forEach(el=>{
  const p=el.dataset.phase;
  el.classList.toggle("current",p===phase);
  el.classList.toggle("complete",phase==="results"&&p!=="results"||phase==="scenario"&&p==="photo");
 });
}
function renderQuiz(){
 updateJourney();
 const step=state.answers.length,q=getQuestion(),total=QUESTIONS.length;
 $("verifiedCount").textContent=verified().length+" 間";
 $("quizCount").textContent=String(Math.min(step+1,total)).padStart(2,"0")+" / "+String(total).padStart(2,"0");
 $("quizProgressFill").style.width=(step/total*100)+"%";
 $("undoBtn").disabled=step===0;
 $("rejectBtn").disabled=$("likeBtn").disabled=isDone();
 const deck=$("quizDeck");
 if(!q){
  $("quizPhaseLabel").textContent="ALL DONE · REVEAL TIME";
  $("quizStageTitle").textContent="你的答案已經收集完成 ♡";
  deck.innerHTML='<div class="quiz-end-card"><span>✿</span><h3>準備揭曉結果！</h3><p>看看哪幾間餐廳最符合你喜歡的風格、食物和慶生氛圍。</p><button class="primary-btn" id="revealNow" type="button">揭曉我的餐廳 ♡</button></div>';
  $("revealNow").onclick=()=>selectTab("results");
  return;
 }
 $("quizPhaseLabel").textContent=q.type==="scenario"?"STEP 02 · BIRTHDAY SCENARIOS":"STEP 01 · "+({"styles":"RESTAURANT STYLE","foods":"FOOD VIBES","atmos":"AMBIENCE","mains":"MAIN DISH","features":"SPECIAL DETAILS"}[q.group]);
 $("quizStageTitle").textContent=q.type==="scenario"?"如果是你，會想要嗎？":"這種感覺，你喜歡嗎？";
 deck.innerHTML=q.type==="photo"?photoCard(q):scenarioCard(q);
 const current=deck.querySelector(".preference-card");
 if(q.type==="photo"){
  const image=photoSource(q),img=current.querySelector("img"),sourceLink=current.querySelector(".preference-credit");
  let idx=0;
  if(img)img.onerror=()=>{
   idx++;
   const next=image.candidates[idx];
   if(next){
    img.src=next.url;
    if(sourceLink&&safeUrl(next.source))sourceLink.href=next.source;
    return;
   }
   const parent=img.parentElement;img.remove();
   const fallback=document.createElement("div");fallback.className="quiz-image-fallback";
   fallback.innerHTML="✿<small>照片暫時無法顯示，可以依描述作答</small>";
   parent.prepend(fallback);
  };
 }

 bindSwipe(current);
}
function resetStamps(){[$("stampNo"),$("stampYes")].forEach(el=>el.style.opacity="0");}
function bindSwipe(card){
 let start=null,dx=0,dy=0,dragging=false;
 card.addEventListener("pointerdown",e=>{
  if(state.busy||e.target.closest("a,button")||(e.pointerType==="mouse"&&e.button!==0))return;
  start={x:e.clientX,y:e.clientY};dx=dy=0;dragging=true;
  card.style.transition="none";
  try{card.setPointerCapture(e.pointerId);}catch{}
 });
 card.addEventListener("pointermove",e=>{
  if(!dragging||!start)return;
  dx=e.clientX-start.x;dy=e.clientY-start.y;
  if(Math.abs(dy)>Math.abs(dx)*1.5)return;
  card.style.transform="translate("+dx+"px,"+(dy*.12)+"px) rotate("+(dx/22)+"deg)";
  $("stampNo").style.opacity=dx<0?Math.min(1,-dx/110):0;
  $("stampYes").style.opacity=dx>0?Math.min(1,dx/110):0;
 });
 function release(){
  if(!dragging)return;dragging=false;resetStamps();
  const swipe=Math.abs(dx)>85&&Math.abs(dx)>Math.abs(dy)*1.1;
  if(swipe){answer(dx>0?"yes":"no");return;}
  card.style.transition="transform .23s ease, opacity .23s ease";
  card.style.transform="";
  start=null;
 }
 card.addEventListener("pointerup",release);
 card.addEventListener("pointercancel",()=>{dragging=false;resetStamps();card.style.transition="transform .23s";card.style.transform="";});
}
function answer(yesNo){
 if(state.busy||isDone())return;
 const q=getQuestion();if(!q)return;
 state.busy=true;
 const card=$("quizDeck").querySelector(".preference-card");
 if(card){card.style.transition="transform .25s ease,opacity .25s ease";card.style.transform="translateX("+(yesNo==="yes"?"110%":"-110%")+") rotate("+(yesNo==="yes"?17:-17)+"deg)";card.style.opacity="0";}
 $("rejectBtn").disabled=$("likeBtn").disabled=true;
 setTimeout(()=>{
  state.answers.push({id:q.id,yes:yesNo==="yes"});
  persist();state.busy=false;
  renderQuiz();
  if(isDone()){selectTab("results");notify("✿ 生日餐廳配對完成！");}
 },250);
}
function undo(){
 if(state.busy||!state.answers.length)return;
 state.answers.pop();state.sharedTop=null;persist();
 selectTab("explore");
 renderQuiz();
 notify("已回到上一題");
}
function resetQuiz(){
 if(state.busy)return;
 if(state.answers.length&&!confirm("要重新回答所有照片與情境題嗎？Google 地圖收藏與匯入資料會保留。"))return;
 state.answers=[];state.sharedTop=null;persist();
 selectTab("explore");renderQuiz();
}
function calculateResults(){
 const candidates=verified();
 const rows=candidates.map(r=>{
  let score=0,matches=[],avoided=0;
  for(const answer of state.answers){
   const q=qsById(answer.id);if(!q)continue;
   for(const tag of q.tags){
    if(!Array.isArray(r[tag.group]))continue;
    const doesMatch=tag.values.some(v=>r[tag.group].includes(v));
    if(!doesMatch)continue;
    if(answer.yes){
     score+=tag.weight;
     matches.push({text:tag.values.find(v=>r[tag.group].includes(v)),group:tag.group,weight:tag.weight});
    }else{score-=tag.weight*.68;avoided++;}
   }
  }
  // Stable ordering without fake scores or opaque percentages.
  const unique=[...new Map(matches.sort((a,b)=>b.weight-a.weight).map(m=>[m.text,m])).values()];
  return {r,score,matched:unique,avoided};
 });
 return rows.sort((a,b)=>b.score-a.score||b.matched.length-a.matched.length||a.r.name.localeCompare(b.r.name,"zh-Hant")).slice(0,3);
}
function featuredRankings(){
 if(state.sharedTop?.length){
  return state.sharedTop.map(id=>verified().find(r=>r.id===id)).filter(Boolean).slice(0,3).map(r=>({r,matched:[],score:0,avoided:0}));
 }
 return calculateResults();
}
function resultCard(item,index){
 const r=item.r,photo=(r.images||[]).find(safeUrl),isFirst=index===0;
 const why=item.matched.slice(0,4).map(x=>x.text).filter(Boolean);
 let reason=why.length?
  "你對「"+why.slice(0,3).join("」、「")+"」有好感，這間餐廳的標籤剛好符合。":
  "從目前的選擇中，這間餐廳是相對接近的候選之一；也可以查看其他推薦。";
 if(state.sharedTop)reason="這是朋友分享的餐廳清單。可以點開詳細資訊，或自己重新玩一次配對。";
 const img=photo?'<img loading="'+(index===0?"eager":"lazy")+'" src="'+escapeHtml(photo)+'" alt="'+escapeHtml(r.name)+'餐廳實景照片">':'<div class="result-no-image">✿<small>餐廳照片待補</small></div>';
 return '<article class="recommend-card '+(isFirst?"winner":"runner")+'">'+
 '<div class="recommend-image">'+img+'<span class="rank-badge">'+(index===0?"♡ 最心動的那間":index===1?"第 2 個推薦":"第 3 個推薦")+'</span></div>'+
 '<div class="recommend-info"><div class="recommend-caption">'+escapeHtml(r.area)+" · "+escapeHtml(r.cuisine)+'</div><h2>'+escapeHtml(r.name)+'</h2><div class="recommend-price">人均參考 NT$'+money(r.budget?.[0])+'–'+money(r.budget?.[1])+'</div>'+
 '<p>'+escapeHtml(reason)+'</p>'+
 (why.length&&!state.sharedTop?'<div class="match-tags">'+why.map(x=>'<span>✦ '+escapeHtml(x)+'</span>').join("")+'</div>':"")+
 '<div class="recommend-buttons"><button type="button" data-details="'+escapeHtml(r.id)+'" class="result-detail">看看推薦理由與細節 →</button><a href="'+escapeHtml(mapsUrl(r))+'" target="_blank" rel="noopener noreferrer">Google 地圖 ↗</a></div></div></article>';
}
function renderResults(){
 const grid=$("resultsList"),done=isDone()||Boolean(state.sharedTop);
 const badge=$("navHeartCount");badge.hidden=!done;badge.textContent="✦";
 if(!done){
  $("resultSubtitle").textContent="餐廳名稱會等你完成照片與情境題後才揭曉。";
  grid.innerHTML='<div class="result-locked"><span>🔒</span><h3>先跟著直覺，滑完照片和情境題吧</h3><p>目前完成 '+state.answers.length+' / '+QUESTIONS.length+' 題。最後才會依照你的偏好推薦餐廳。</p><button type="button" id="goPlay" class="primary-btn">繼續滑卡 ♡</button></div>';
  $("goPlay").onclick=()=>selectTab("explore");
  $("shareResults").disabled=$("editLastBtn").disabled=true;
  $("uncategorizedImports").innerHTML="";
  return;
 }
 $("shareResults").disabled=false;
 $("editLastBtn").disabled=!state.answers.length;
 const ranked=featuredRankings();
 $("resultSubtitle").textContent=state.sharedTop?"朋友挑出的台中慶生餐廳，看看你也喜不喜歡。":"從 "+state.base.length+" 間台中慶生餐廳中，依照你喜歡的照片與情境，配對出以下推薦。";
 grid.innerHTML=ranked.length?ranked.map(resultCard).join(""):'<div class="result-locked"><h3>暫時找不到可推薦的餐廳</h3><p>可以稍後重新載入，或從自己的收藏清單裡找尋。</p></div>';
 grid.querySelectorAll("[data-details]").forEach(b=>b.onclick=()=>showDetails(b.dataset.details));
 grid.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{img.replaceWith(Object.assign(document.createElement("div"),{className:"result-no-image",textContent:"✿ 餐廳圖片暫無法載入"}));}));
 const count=state.imports.length;
 $("uncategorizedImports").innerHTML=count?'<div class="unverified-notice"><strong>你還有 '+count+' 間自行匯入的口袋名單 ♡</strong><p>由於 Google 地圖收藏不一定包含料理類型、慶生預算或照片，這些店暫未參與配對排序，避免產生不可靠的結果。</p><button id="checkImports" type="button">查看我的口袋名單 ↗</button></div>':"";
 if(count)$("checkImports").onclick=()=>selectTab("import");
}
function showDetails(id){
 const r=all().find(r=>r.id===id);if(!r)return;
 const src=(r.images||[]).find(safeUrl);
 const mentions=[...(r.social||[]),...state.social.filter(x=>x.restaurants?.includes(r.id))];
 const unique=new Map(mentions.filter(x=>safeUrl(x.url)).map(x=>[safeUrl(x.url),x]));
 $("dialogRoot").innerHTML='<div class="dialog-backdrop"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><button type="button" class="dialog-close" aria-label="關閉">×</button>'+
 (src?'<img class="dialog-hero" src="'+escapeHtml(src)+'" alt="'+escapeHtml(r.name)+'的照片">':'<div class="dialog-hero fav-fallback">✿</div>')+
 '<div class="dialog-content"><span class="section-kicker">RESTAURANT DETAILS</span><h2 id="modalTitle">'+escapeHtml(r.name)+'</h2><p>'+escapeHtml(r.desc||r.tagline||"")+'</p>'+
 '<div class="dialog-grid"><div><strong>預算／人</strong><span>NT$'+money(r.budget?.[0])+'–'+money(r.budget?.[1])+'</span></div>'+
 '<div><strong>區域</strong><span>'+escapeHtml(r.area||"待確認")+'</span></div>'+
 '<div><strong>料理</strong><span>'+escapeHtml(r.cuisine||"待確認")+'</span></div>'+
 '<div><strong>特色</strong><span>'+escapeHtml((r.features||[]).join(" · ")||"待確認")+'</span></div></div>'+
 '<p>'+escapeHtml(r.priceNote||"自訂餐廳的價格與特色仍需確認。")+'</p><div class="dialog-actions">'+
 '<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(mapsUrl(r))+'">查看 Google 地圖 ↗</a>'+
 (safeUrl(r.more)?'<a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(r.more)+'">餐廳資訊 ↗</a>':"")+'</div>'+
 (unique.size?'<p class="small-caption">相關公開推薦／討論線索</p>'+[...unique.values()].slice(0,6).map(x=>'<p><a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(safeUrl(x.url))+'" style="color:#c87869;text-decoration:underline">'+escapeHtml(x.platform||"公開討論")+' ↗</a> · '+escapeHtml(x.note||x.title||"相關討論")+'</p>').join(""):"")+
 '<p class="photo-credits">圖片來源：'+escapeHtml(r.credit||"待確認")+(safeUrl(r.source)?' <a target="_blank" rel="noopener noreferrer" href="'+escapeHtml(r.source)+'">查看來源 ↗</a>':"")+'</p></div></div></div>';
 const bg=$("dialogRoot").querySelector(".dialog-backdrop");
 bg.addEventListener("click",e=>{if(e.target===bg)closeDetails();});
 $("dialogRoot").querySelector(".dialog-close").onclick=closeDetails;
}
function closeDetails(){$("dialogRoot").innerHTML="";}
function selectTab(tab){
 if(!["explore","results","import"].includes(tab))return;
 state.tab=tab;
 document.querySelectorAll(".page").forEach(el=>el.classList.toggle("is-active",el.id===tab));
 document.querySelectorAll(".nav-tab").forEach(el=>el.classList.toggle("active",el.dataset.tab===tab));
 if(tab==="explore")renderQuiz();
 if(tab==="results")renderResults();
 if(tab==="import"){renderReferenceLists();renderImported();}
 window.scrollTo({top:0,behavior:"smooth"});
}
function renderReferenceLists(){
 const el=$("referenceResults");if(!el)return;
 const lists=state.referenceLists||[],count=lists.reduce((sum,list)=>sum+(list.items||[]).length,0);
 $("referenceCount").textContent=count;
 if(!count){el.innerHTML='<p class="reference-loading">目前無法取得清單地點，仍可開啟原始 Google 地圖。</p>';return;}
 el.innerHTML=lists.map(list=>{
  const rows=(list.items||[]).map(item=>{
   const match=all().find(r=>normalize(r.name)===normalize(item.name)||(r.id==="meatgq"&&/meatgq/i.test(item.name)));
   return '<div class="reference-item"><div><b>'+escapeHtml(item.name)+'</b><small>'+escapeHtml(item.type||"餐廳")+' · Google 地圖收藏</small></div>'+
    (match?'<span class="ref-present">✓ 已有紀錄</span>':'<button class="reference-add" type="button" data-refname="'+escapeHtml(item.name)+'">+ 加入候選</button>')+'</div>';
  }).join("");
  return '<details class="reference-set"><summary><span><strong>'+escapeHtml(list.name)+'</strong><small>已讀取 '+(list.items||[]).length+" / "+(list.reportedTotal||"?")+' 個地點</small></span><span class="reference-chevron">⌄</span></summary><div class="reference-list-body">'+rows+'</div></details>';
 }).join("");
 el.querySelectorAll(".reference-add").forEach(b=>b.onclick=()=>{
  const name=b.dataset.refname;
  const item=lists.flatMap(l=>l.items||[]).find(x=>x.name===name);if(!item)return;
  const r=importOne({name,area:"待確認"});
  if(!r){notify("這個地點已有紀錄");return;}
  r.cuisine=item.type||"待確認";
  r.tagline="來自 Google 地圖的個人口袋名單";
  r.desc="這是你從 Google 地圖收藏加入的候選地點。請自行確認慶生預算、地址與菜單。";
  r.source=mapsUrl(r);r.more=mapsUrl(r);
  state.imports.push(r);persist();renderReferenceLists();renderImported();notify("已加入候選："+name);
 });
}
function renderImported(){
 $("importCount").textContent=state.imports.length;
 const e=$("importedList");
 e.innerHTML=state.imports.length?state.imports.map(r=>'<div class="import-row"><div><strong>'+escapeHtml(r.name)+'</strong><small>'+escapeHtml(r.address||"地址待補")+' · '+escapeHtml(r.budgetLabel||"預算待確認")+'</small></div><button type="button" data-del="'+escapeHtml(r.id)+'" aria-label="移除'+escapeHtml(r.name)+'">✕</button></div>').join(""):'<div class="empty-state"><span class="empty-symbol">↥</span><h3>還沒匯入餐廳</h3><p>上傳 Google Takeout 檔案，或直接貼上餐廳名稱。</p></div>';
 e.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{
  state.imports=state.imports.filter(r=>r.id!==b.dataset.del);persist();renderImported();renderReferenceLists();
 });
 const link=safeUrl(state.link);$("savedMapLink").innerHTML=link?'<a class="saved-link" target="_blank" rel="noopener noreferrer" href="'+escapeHtml(link)+'">已儲存的 Google 地圖清單連結 ↗</a>':"";
}
function importOne(entry){
 const n=clean(entry.name||entry.title||entry.Name||entry.Title||entry.place_name||entry["名稱"]||entry["標題"]);
 if(!n||n.length>120||all().some(r=>normalize(r.name)===normalize(n)))return null;
 const address=clean(entry.address||entry.Address||entry["地址"]||entry.location?.address||entry.formatted_address||"");
 const url=safeUrl(entry.url||entry.URL||entry["Google Maps URL"]||entry.google_maps_url||entry.googleMapsUrl||"");
 const district=clean(entry.area||entry.district||"");
 const nums=String(entry.budget||entry.price||"").match(/\d[\d,]*/g)||[];
 const a=nums.length?Number(nums[0].replaceAll(",","")):1000;
 const b=nums.length>1?Number(nums[1].replaceAll(",","")):3000;
 const id="import-"+(globalThis.crypto?.randomUUID?.()||Date.now()+"-"+Math.random().toString(36).slice(2));
 return {id,name:n,address,area:district||((address.match(/[臺台]中市.{1,4}區/)||[])[0]?.replace(/[臺台]中市/,"")||"待確認"),cuisine:"自訂餐廳",budget:[a,Math.max(a,b)],budgetLabel:nums.length?"依匯入資料（未驗證）":"預算待確認（網站預設顯示 1,000–3,000）",tagline:"從個人口袋名單加入",desc:"自行匯入的餐廳。料理、價格、地點與照片尚未核對。",styles:[],foods:[],atmos:[],mains:[],features:[],images:[],imported:true,source:url,more:url,priceNote:"此餐廳尚未完成資料驗證，請以店家官方資訊為準。"};
}
function importEntries(entries){
 if(!Array.isArray(entries))throw Error("檔案中找不到餐廳清單");
 let n=0,skips=0;
 for(const entry of entries.slice(0,3000)){
  if(!entry||typeof entry!=="object")continue;
  const addr=clean(entry.address||entry.Address||entry["地址"]||"");
  if(addr&&/[臺台]北市|新北市|桃園市|新竹市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|嘉義市|[臺台]南市|高雄市|屏東縣|花蓮縣|宜蘭縣|基隆市/.test(addr)&&!/[臺台]中市/.test(addr)){skips++;continue;}
  const r=importOne(entry);
  if(r){state.imports.push(r);n++;}
 }
 persist();renderImported();renderReferenceLists();
 notify("已加入 "+n+" 間候選餐廳"+(skips?"，略過 "+skips+" 間外縣市地點":"")+(n===0?"（可能重複或缺少名稱）":""));
 return n;
}
function csvRows(text){
 let row=[],field="",quote=false,rows=[];
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quote){
   if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quote=false;else field+=c;
  }else if(c==='"')quote=true;
  else if(c===","){row.push(field);field="";}
  else if(c==="\n"){row.push(field);rows.push(row);row=[];field="";}
  else if(c!=="\r")field+=c;
 }
 if(field||row.length){row.push(field);rows.push(row);}return rows;
}
function parseImport(text,ext){
 if(ext==="csv"){const rows=csvRows(text),head=(rows.shift()||[]).map(s=>s.trim().replace(/^\ufeff/,""));return rows.map(row=>Object.fromEntries(head.map((h,i)=>[h,row[i]||""])));}
 if(ext==="txt")return text.split(/\r?\n/).filter(Boolean).map(line=>{const [name,area,price]=line.split(/[｜|]/);return {name,area,price};});
 if(ext==="kml"){
  const doc=new DOMParser().parseFromString(text,"text/xml");if(doc.querySelector("parsererror"))throw Error("KML 格式不正確");
  return [...doc.getElementsByTagName("Placemark")].map(n=>({name:n.getElementsByTagName("name")[0]?.textContent,address:n.getElementsByTagName("address")[0]?.textContent||n.getElementsByTagName("description")[0]?.textContent}));
 }
 const data=JSON.parse(text);
 if(Array.isArray(data))return data;
 if(Array.isArray(data.features))return data.features.map(f=>{const p=f.properties||{},l=p.Location||p.location||{};return {...p,name:p.name||p.title||p.Name||p["Business Name"]||l["Business Name"],address:p.address||l.Address||l.address,url:p["Google Maps URL"]||p.url||l["Google Maps URL"]};});
 for(const key of ["places","items","locations","savedPlaces","restaurants","list"]){if(Array.isArray(data[key]))return data[key].map(x=>({...x,name:x.name||x.title||x.properties?.name||x.properties?.title}));}
 if(data.title||data.name)return [data];
 throw Error("找不到可辨識的清單，請使用 Google Takeout 的 JSON、CSV、KML 或 GeoJSON。");
}
async function importFile(file){
 if(!file)return;
 if(file.size>10*1024*1024){notify("單檔大小上限 10MB");return;}
 try{
  const ext=(file.name.split(".").pop()||"").toLowerCase();
  if(!["json","csv","kml","geojson","txt"].includes(ext))throw Error("請選擇 CSV、JSON、KML、GeoJSON 或 TXT");
  importEntries(parseImport(await file.text(),ext));
 }catch(e){notify("匯入失敗："+e.message);}
}
function importPasted(){
 const value=$("pasteNames").value;if(!value.trim()){notify("請先貼上餐廳名稱");return;}
 const count=importEntries(parseImport(value,"txt"));if(count)$("pasteNames").value="";
}
async function shareUrl(url,title,text){
 try{
  if(navigator.share)await navigator.share({title,text,url});
  else if(navigator.clipboard){await navigator.clipboard.writeText(url);notify("連結已複製，可以傳給朋友了 ♡");}
  else prompt("複製連結",url);
 }catch(e){if(e.name!=="AbortError")prompt("複製連結",url);}
}
function inviteFriends(){shareUrl(location.origin+location.pathname,"今晚，吃哪間？台中慶生餐廳偏好測驗","滑照片＋回答情境題，看看你生日適合哪間餐廳！");}
function shareResults(){
 if(!isDone()&&!state.sharedTop)return;
 const ids=featuredRankings().map(v=>v.r.id).join(",");
 const u=new URL(location.origin+location.pathname);u.searchParams.set("top",ids);
 shareUrl(u.toString(),"我的台中生日餐廳推薦","我用左右滑找到了這幾間台中慶生餐廳，你也來看看！");
}
function readShared(){
 const p=new URLSearchParams(location.search),ids=(p.get("top")||"").split(",").slice(0,3).filter(Boolean);
 if(ids.length&&ids.every(id=>state.base.some(r=>r.id===id))){
  state.sharedTop=ids;
  history.replaceState({},document.title,location.pathname);
  selectTab("results");notify("已打開朋友的推薦清單 ♡");
 }
}
function init(){
 document.querySelectorAll(".nav-tab").forEach(b=>b.onclick=()=>selectTab(b.dataset.tab));
 $("rejectBtn").onclick=()=>answer("no");$("likeBtn").onclick=()=>answer("yes");$("undoBtn").onclick=undo;
 $("resetQuiz").onclick=resetQuiz;$("againBtn").onclick=resetQuiz;
 $("editLastBtn").onclick=undo;$("shareResults").onclick=shareResults;
 $("inviteBtn").onclick=inviteFriends;$("jumpImport").onclick=()=>selectTab("import");
 $("fileInput").onchange=async e=>{for(const file of [...e.target.files].slice(0,30))await importFile(file);e.target.value="";};
 $("pasteImport").onclick=importPasted;
 $("saveMapUrl").onclick=()=>{
  const url=safeUrl($("googleMapUrl").value);const h=url?new URL(url).hostname.toLowerCase():"";
  if(!url||!(h==="maps.app.goo.gl"||h==="goo.gl"||h==="google.com"||h.endsWith(".google.com"))){notify("請貼上有效的 Google 地圖清單網址");return;}
  state.link=url;persist();renderImported();notify("已保存清單連結，尚未自動擷取地點");
 };
 $("clearImported").onclick=()=>{
  if(!state.imports.length){notify("目前沒有匯入資料");return;}
  const b=$("clearImported");
  if(!b.dataset.confirm){b.dataset.confirm="yes";b.textContent="確認刪除全部？";setTimeout(()=>{b.dataset.confirm="";b.textContent="清空匯入";},4500);return;}
  state.imports=[];persist();renderImported();renderReferenceLists();b.dataset.confirm="";b.textContent="清空匯入";notify("已清空自己匯入的餐廳");
 };
 const drop=$("fileDrop");
 drop.ondragover=e=>{e.preventDefault();drop.classList.add("dragover");};
 drop.ondragleave=()=>drop.classList.remove("dragover");
 drop.ondrop=e=>{e.preventDefault();drop.classList.remove("dragover");for(const f of [...e.dataTransfer.files].slice(0,30))importFile(f);};
 document.addEventListener("keydown",e=>{
  if(e.key==="Escape")closeDetails();
  if(state.tab!=="explore"||e.target.closest("input,textarea,button,a")||$("dialogRoot").firstElementChild)return;
  if(e.key==="ArrowLeft")answer("no");
  if(e.key==="ArrowRight")answer("yes");
  if(e.key==="Backspace"){e.preventDefault();undo();}
 });
 // Drop stale/invalid answers after a future question-list update.
 state.answers=state.answers.filter((a,i)=>QUESTIONS[i]?.id===a.id).slice(0,QUESTIONS.length);
 selectTab("explore");
 readShared();
}
async function main(){
 try{
  const r=await fetch("data/restaurants.json",{cache:"no-store"});
  if(!r.ok)throw Error("餐廳資料無法取得");
  state.base=await r.json();if(!Array.isArray(state.base))throw Error("餐廳資料格式不正確");
  try{const social=await fetch("data/social_signals.json",{cache:"no-store"});if(social.ok)state.social=await social.json();}catch{}
  try{const refs=await fetch("data/reference_lists.json",{cache:"no-store"});if(refs.ok)state.referenceLists=(await refs.json()).lists||[];}catch{}
  init();
 }catch(e){$("quizDeck").innerHTML='<div class="result-locked"><h3>載入遇到問題</h3><p>'+escapeHtml(e.message)+'</p><button type="button" class="primary-btn" onclick="location.reload()">重新載入</button></div>';notify("資料載入失敗");}
}
main();
