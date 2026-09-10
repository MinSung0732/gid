const PUBLIC_PAGE='https://minsung0732.github.io/gid/games/harmony/';
const KAKAO_KEY='6716e83b61647bd3bd1977dd655aa93b';
let kakaoPromise;

const messages={
  clear:['흩어진 향을 하나의 조화로 완성했어요.','끝까지 쌓아 올린 향기가 하나의 기록이 됐어요.','오늘의 조향은 오래 남을 잔향이 되었습니다.'],
  ended:['조향은 멈췄지만 새로운 조합의 단서를 남겼어요.','흩어진 향기 사이에서 다음 여정의 답을 찾았어요.','완성되지 않은 향도 다음 조향을 위한 기록이 됩니다.'],
};
const number=value=>Math.round(value).toLocaleString('ko-KR');
export function randomHarmonyMessage(record){const pool=record.cleared?messages.clear:messages.ended;return pool[Math.floor(Math.random()*pool.length)];}
export function harmonyShareText(record,message=randomHarmonyMessage(record)){const items=record.items.length?record.items.slice(0,4).map(item=>`${item.name}${item.count>1?` ×${item.count}`:''}`).join(', '):'획득 아이템 없음';return `${message}\n${number(record.score)}점 · ${record.loop?`심연 ${record.loop}`:'기본 여정'} · ${record.room}번째 방\n체력 ${record.hp}/${record.maxHp} · 공격 ${record.attack} · 방어 ${record.defense}\n아이템: ${items}`;}

function loadKakao(){if(window.Kakao)return Promise.resolve(window.Kakao);kakaoPromise||=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';script.integrity='sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';script.crossOrigin='anonymous';script.onload=()=>resolve(window.Kakao);script.onerror=()=>reject(new Error('Kakao SDK unavailable'));document.head.append(script);});return kakaoPromise;}
function wrapText(ctx,text,x,y,maxWidth,lineHeight,maxLines=2){const chars=[...text];let line='',lines=[];for(const char of chars){const next=line+char;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=char;}else line=next;}if(line)lines.push(line);if(lines.length>maxLines){lines=lines.slice(0,maxLines);lines[maxLines-1]=`${lines[maxLines-1].slice(0,-1)}…`;}lines.forEach((value,index)=>ctx.fillText(value,x,y+index*lineHeight));return y+lines.length*lineHeight;}
function toFile(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(new File([blob],'gyeolideun-harmony-result.png',{type:'image/png'})):reject(new Error('empty image')),'image/png'));}

export async function createHarmonyCard(record,message=randomHarmonyMessage(record)){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1080;const ctx=canvas.getContext('2d');
  const gradient=ctx.createLinearGradient(0,0,1080,1080);gradient.addColorStop(0,'#102d28');gradient.addColorStop(1,'#235347');ctx.fillStyle=gradient;ctx.fillRect(0,0,1080,1080);
  ctx.fillStyle='#f8e29a';ctx.fillRect(0,0,1080,18);ctx.font='700 30px sans-serif';ctx.fillText('GYEOLIDEUN · PROJECT HARMONY',70,92);
  ctx.fillStyle='#fafaf5';ctx.font='700 62px serif';ctx.fillText(record.cleared?'향기로 완성한 여정':'다음 조향을 위한 기록',70,180);
  ctx.fillStyle='#b9cdbf';ctx.font='28px sans-serif';wrapText(ctx,message,70,235,940,42,2);
  ctx.fillStyle='#f7f3e8';ctx.fillRect(70,330,940,250);ctx.fillStyle='#235347';ctx.font='700 80px sans-serif';ctx.fillText(`${number(record.score)}점`,110,445);ctx.font='700 29px sans-serif';ctx.fillText(`${record.loop?`심연 ${record.loop}`:'기본 여정'} · ${record.room}번째 방 · 최대 한 방 ${number(record.maxHit)}`,110,515);
  const stats=[['체력',`${record.hp} / ${record.maxHp}`],['공격력',record.attack],['방어력',record.defense],['덱',`${record.deckCount}장`]];stats.forEach(([label,value],index)=>{const x=70+index*235;ctx.fillStyle='#ffffff10';ctx.fillRect(x,620,215,125);ctx.fillStyle='#9fc0ae';ctx.font='24px sans-serif';ctx.fillText(label,x+20,662);ctx.fillStyle='#fafaf5';ctx.font='700 34px sans-serif';ctx.fillText(String(value),x+20,712);});
  ctx.fillStyle='#f8e29a';ctx.font='700 25px sans-serif';ctx.fillText('이번 여정의 특성 · 유물',70,810);ctx.fillStyle='#e9eee5';ctx.font='26px sans-serif';const itemLines=record.items.length?record.items.slice(0,6).map(item=>`${item.name}${item.count>1?` ×${item.count}`:''}`):['획득한 특성이나 유물이 없습니다.'];itemLines.forEach((item,index)=>ctx.fillText(`· ${item}`,70+(index%2)*470,860+Math.floor(index/2)*48));
  ctx.fillStyle='#9fc0ae';ctx.font='22px sans-serif';ctx.fillText('나만의 조합으로 향기의 여정을 완성해보세요.',70,1020);return toFile(canvas);
}
function download(file){const url=URL.createObjectURL(file),anchor=document.createElement('a');anchor.href=url;anchor.download=file.name;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function copyFallback(value){const area=document.createElement('textarea');area.value=value;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw new Error('copy failed');}
export async function shareHarmonyImage(record){const message=randomHarmonyMessage(record),file=await createHarmonyCard(record,message);download(file);return '공유용 결과 이미지를 저장했어요.';}
export async function shareHarmonyLink(record){const value=`${harmonyShareText(record)}\n${PUBLIC_PAGE}`;try{await navigator.clipboard.writeText(value);}catch{copyFallback(value);}return '여정 기록과 게임 링크를 복사했어요.';}
export async function shareHarmonyKakao(record){const message=randomHarmonyMessage(record),file=await createHarmonyCard(record,message),kakao=await loadKakao();if(!kakao.isInitialized())kakao.init(KAKAO_KEY);const transfer=new DataTransfer();transfer.items.add(file);const uploaded=await kakao.Share.uploadImage({file:transfer.files}),imageUrl=uploaded?.infos?.original?.url;if(!imageUrl)throw new Error('Kakao image upload failed');const link={mobileWebUrl:PUBLIC_PAGE,webUrl:PUBLIC_PAGE};kakao.Share.sendDefault({objectType:'feed',content:{title:record.cleared?'Project Harmony · 조향 완성':'Project Harmony · 여정 기록',description:harmonyShareText(record,message),imageUrl,link},buttons:[{title:'나도 조향 시작하기',link}]});return '카카오톡에서 공유할 대상을 선택해 주세요.';}
