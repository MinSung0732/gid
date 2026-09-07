import { resultLink } from './share.js';
import { PUBLIC_GAME_URL } from './kakao-card.js';

const stoneNames = { pink: '핑크 크리스탈', green: '그린 크리스탈', volcanic: '볼케닉' };
export const scoreShareText = result => `결이든 · 향을 담는 돌 ${result.score.toLocaleString('ko-KR')}점\n최고 ${result.combo}콤보 · ${stoneNames[result.stone]}`;
export const scoreResultUrl = result => resultLink(PUBLIC_GAME_URL, result);
export function threadsShareUrl(result) {
  const intent = new URL('https://www.threads.com/intent/post');
  intent.searchParams.set('text', `${scoreShareText(result)}\n\n#결이든 #향을담는돌`);
  intent.searchParams.set('url', scoreResultUrl(result));
  return intent.href;
}
export function createSocialCardFile(result, gameCanvas) {
  const card = document.createElement('canvas'); card.width = card.height = 1080;
  const ctx = card.getContext('2d');
  ctx.fillStyle='#FAFAF5';ctx.fillRect(0,0,1080,1080);ctx.fillStyle='#235347';ctx.fillRect(0,0,1080,18);
  ctx.font='bold 42px sans-serif';ctx.fillText('결이든 · 향을 담는 돌',70,100);ctx.font='28px sans-serif';ctx.fillText('나의 향기 기록',70,175);
  ctx.font='bold 92px sans-serif';ctx.fillText(`${result.score.toLocaleString('ko-KR')}점`,70,300);ctx.font='30px sans-serif';ctx.fillText(`최고 ${result.combo}콤보 · 성공 ${result.hits}회`,70,365);ctx.font='26px sans-serif';ctx.fillText(stoneNames[result.stone],70,420);
  ctx.fillStyle='#fffefb';ctx.fillRect(490,65,540,540);ctx.drawImage(gameCanvas,490,65,540,540);
  ctx.fillStyle='#F8E29A';ctx.fillRect(70,690,940,130);ctx.fillStyle='#333331';ctx.font='bold 34px sans-serif';ctx.fillText('당신의 향기 한 방울, 도전해보세요',110,770);
  ctx.fillStyle='#235347';ctx.font='25px sans-serif';ctx.fillText('GYEOLIDEUN  ·  VOLCANIC & CRYSTAL',70,965);
  const binary=atob(card.toDataURL('image/png').split(',')[1]),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return new File([bytes],'gyeolideun-score.png',{type:'image/png'});
}
function downloadFile(file){const anchor=document.createElement('a'),url=URL.createObjectURL(file);anchor.href=url;anchor.download=file.name;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function setupSocialShare({instagramButton,threadsButton,appsButton,status,canvas,getResult}) {
  instagramButton.addEventListener('click',async()=>{try{const file=createSocialCardFile(getResult(),canvas);if(navigator.share&&navigator.canShare?.({files:[file]})){status.textContent='공유 목록에서 Instagram을 선택해 주세요.';await navigator.share({files:[file],title:'결이든 향기 기록'});status.textContent='점수 카드를 공유했어요.';}else{downloadFile(file);status.textContent='인스타그램용 점수 카드를 저장했어요. 인스타그램에서 사진을 선택해 올려주세요.';}}catch(error){status.textContent=error.name==='AbortError'?'공유를 취소했어요.':'점수 카드를 만들지 못했어요. 다시 시도해 주세요.';}});
  threadsButton.addEventListener('click',()=>{window.open(threadsShareUrl(getResult()),'_blank','noopener,noreferrer');status.textContent='스레드 작성 화면을 열었어요. 열리지 않으면 팝업 허용을 확인해 주세요.';});
  appsButton.addEventListener('click',async()=>{const result=getResult(),url=scoreResultUrl(result);try{const file=createSocialCardFile(result,canvas);if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'결이든 향기 기록',text:`${scoreShareText(result)}\n${url}`});}else if(navigator.share){await navigator.share({title:'결이든 향기 기록',text:scoreShareText(result),url});}else if(navigator.clipboard){await navigator.clipboard.writeText(`${scoreShareText(result)}\n${url}`);status.textContent='점수와 게임 링크를 복사했어요.';return;}else{status.textContent=url;return;}status.textContent='점수 기록을 공유했어요.';}catch(error){status.textContent=error.name==='AbortError'?'공유를 취소했어요.':'공유하지 못했어요. 다시 시도해 주세요.';}});
}
