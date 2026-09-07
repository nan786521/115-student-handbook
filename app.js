// 標題、冊別、目錄熱區來自 config.json；各冊頁數來自 build 時產生的 pages.json
let books={},commonToc={},bookToc={},book='A',page=1;
const normalize=(value,total)=>{const n=Math.max(1,Math.min(total,Number(value)||1));if(n===1)return 1;return n%2===0?n:n-1};
let autoTimer=null,audioCtx=null,musicTimer=null,masterGain=null,touchX=0,wheelLock=false;
const $=id=>document.getElementById(id);
const leftPage=$('leftPage'),rightPage=$('rightPage'),leftLoading=$('leftLoading'),rightLoading=$('rightLoading');
const pageInput=$('pageInput'),pageTotal=$('pageTotal'),progressBar=$('progressBar');

function fileFor(b,p){return `./assets/pages/${b}/page-${String(p).padStart(3,'0')}.jpg`}
function preload(p){if(p>=1&&p<=books[book].pages){const i=new Image();i.src=fileFor(book,p)}}
function renderToc(container,pageNumber){
  const items=(commonToc[pageNumber]||(bookToc[book]||{})[pageNumber]||[]);container.replaceChildren();container.hidden=!items.length;
  items.forEach(item=>{const button=document.createElement('button');button.className='toc-hit';button.type='button';button.title=`${item.label}：前往第 ${item.page} 頁`;button.setAttribute('aria-label',button.title);button.style.cssText=`left:${item.x}%;top:${item.y}%;width:${item.w}%;height:${item.h}%`;button.onclick=e=>{e.stopPropagation();go(item.page)};container.append(button)});
}
function loadPage(img,loading,p,direction){
  if(p<1||p>books[book].pages){img.hidden=true;loading.hidden=true;return}
  img.hidden=false;loading.hidden=false;loading.textContent='頁面載入中…';
  img.classList.remove('ready','flip-next','flip-prev');img.alt=`手冊 ${book} 冊第 ${p} 頁`;
  img.onload=()=>{loading.hidden=true;void img.offsetWidth;img.classList.add('ready',direction==='prev'?'flip-prev':'flip-next')};
  img.onerror=()=>{loading.hidden=false;loading.textContent='頁面載入失敗'};img.src=fileFor(book,p);
}
function render(direction='next'){
  const leftNumber=page===1?0:page;const rightNumber=page===1?1:page+1;
  loadPage(leftPage,leftLoading,leftNumber,direction);loadPage(rightPage,rightLoading,rightNumber,direction);
  renderToc($('leftToc'),leftNumber);renderToc($('rightToc'),rightNumber);
  pageInput.value=page;pageInput.max=books[book].pages;pageTotal.textContent=`／${books[book].pages}`;
  progressBar.style.width=`${Math.min(rightNumber,books[book].pages)/books[book].pages*100}%`;
  $('spreadLabel').textContent=page===1?'目前顯示封面第 1 頁・封面置於右側':`目前顯示第 ${leftNumber}–${Math.min(rightNumber,books[book].pages)} 頁・可使用方向鍵、滾輪或左右滑動翻閱跨頁`;
  $('prevBtn').disabled=page===1;$('nextBtn').disabled=page>=books[book].pages-1;
  localStorage.setItem('handbookBook',book);localStorage.setItem(`handbookPage${book}`,page);
  preload(page===1?2:page+2);preload(page===1?3:page+3);preload(page-1);
}
function go(target){const old=page;page=normalize(target,books[book].pages);render(page<old?'prev':'next')}
function nextSpread(){go(page===1?2:page+2)}function prevSpread(){go(page===2?1:page-2)}
function changeBook(next){book=next;page=normalize(localStorage.getItem(`handbookPage${book}`)||1,books[book].pages);document.querySelectorAll('.tab').forEach(t=>{const on=t.dataset.book===book;t.classList.toggle('active',on);t.setAttribute('aria-selected',String(on))});render()}

$('prevBtn').onclick=$('prevMobile').onclick=prevSpread;$('nextBtn').onclick=$('nextMobile').onclick=nextSpread;
$('tocBtn').onclick=()=>go(2);
$('firstBtn').onclick=()=>go(1);$('lastBtn').onclick=()=>go(books[book].pages);
pageInput.addEventListener('change',()=>go(pageInput.value));pageInput.addEventListener('keydown',e=>{if(e.key==='Enter'){go(pageInput.value);pageInput.blur()}});
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>changeBook(t.dataset.book));
document.addEventListener('keydown',e=>{if(document.activeElement===pageInput)return;if(e.key==='ArrowLeft')prevSpread();if(e.key==='ArrowRight'||e.key===' ')nextSpread()});
$('pageWrap').addEventListener('touchstart',e=>touchX=e.changedTouches[0].clientX,{passive:true});
$('pageWrap').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-touchX;if(Math.abs(dx)>45)(dx<0?nextSpread:prevSpread)()},{passive:true});
$('pageWrap').addEventListener('wheel',e=>{if(wheelLock||Math.abs(e.deltaY)<20)return;wheelLock=true;(e.deltaY>0?nextSpread:prevSpread)();setTimeout(()=>wheelLock=false,650)},{passive:true});

$('autoSelect').addEventListener('change',e=>{clearInterval(autoTimer);autoTimer=null;const seconds=Number(e.target.value);if(seconds){autoTimer=setInterval(()=>{if(page<books[book].pages-1)nextSpread();else{clearInterval(autoTimer);autoTimer=null;$('autoSelect').value='0'}},seconds*1000)}});
function tone(freq,start,duration,gain=.05){const osc=audioCtx.createOscillator(),g=audioCtx.createGain();osc.type='sine';osc.frequency.value=freq;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(gain,start+.08);g.gain.exponentialRampToValueAtTime(.001,start+duration);osc.connect(g).connect(masterGain);osc.start(start);osc.stop(start+duration)}
function musicPhrase(){if(!audioCtx)return;const now=audioCtx.currentTime+.05;const melody=[261.63,329.63,392,523.25,440,349.23,392,293.66];melody.forEach((n,i)=>tone(n,now+i*.55,.8,.045))}
async function toggleMusic(){const btn=$('musicBtn');if(!audioCtx){audioCtx=new(window.AudioContext||window.webkitAudioContext)();masterGain=audioCtx.createGain();masterGain.gain.value=.7;masterGain.connect(audioCtx.destination)}await audioCtx.resume();if(musicTimer){clearInterval(musicTimer);musicTimer=null;masterGain.gain.setTargetAtTime(0,audioCtx.currentTime,.05);btn.innerHTML='<span aria-hidden="true">♪</span> 音樂：關';btn.setAttribute('aria-pressed','false')}else{masterGain.gain.setTargetAtTime(.7,audioCtx.currentTime,.05);musicPhrase();musicTimer=setInterval(musicPhrase,4600);btn.innerHTML='<span aria-hidden="true">♫</span> 音樂：開';btn.setAttribute('aria-pressed','true')}}
$('musicBtn').onclick=toggleMusic;$('fullscreenBtn').onclick=()=>{if(!document.fullscreenElement)document.documentElement.requestFullscreen?.();else document.exitFullscreen?.()};

async function init(){
  const [config,pages]=await Promise.all([
    fetch('./config.json',{cache:'no-cache'}).then(r=>r.json()),
    fetch('./pages.json',{cache:'no-cache'}).then(r=>r.json())
  ]);
  document.title=config.pageTitle||document.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content',config.description||'');
  document.querySelector('.brand .year').textContent=config.year;
  document.querySelector('.brand h1').textContent=config.title;
  document.querySelector('.brand p').textContent=config.subtitle;
  commonToc=config.tocCommon||{};bookToc=config.tocByBook||{};
  const tabs=document.querySelector('.volume-tabs');tabs.replaceChildren();
  Object.entries(config.books).forEach(([key,info])=>{
    books[key]={pages:pages[key]||0};
    const b=document.createElement('button');b.className='tab';b.dataset.book=key;b.setAttribute('role','tab');b.textContent=info.label||`${key} 冊`;b.onclick=()=>changeBook(key);tabs.append(b);
  });
  const saved=localStorage.getItem('handbookBook');
  changeBook(books[saved]?saved:Object.keys(books)[0]);
}
init().catch(err=>{console.error(err);$('spreadLabel').textContent='設定檔載入失敗，請確認 config.json 與 pages.json 存在'});
