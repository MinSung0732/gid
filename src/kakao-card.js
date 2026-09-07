import { resultLink } from './share.js';
export const PUBLIC_GAME_URL = 'https://minsung0732.github.io/gid/';

// Called only after the player requests Kakao sharing; never uploads automatically.
export async function prepareKakaoCard(kakao, result, gameCanvas, baseUrl) {
  const card = document.createElement('canvas');
  card.width = 1000; card.height = 600;
  const ctx = card.getContext('2d');
  ctx.fillStyle = '#FAFAF5'; ctx.fillRect(0, 0, 1000, 600);
  ctx.fillStyle = '#235347'; ctx.fillRect(0, 0, 1000, 12);
  ctx.font = 'bold 30px sans-serif'; ctx.fillText('결이든 · 향을 담는 돌', 60, 90);
  ctx.font = '22px sans-serif'; ctx.fillText('나의 향기 기록', 60, 170);
  ctx.font = 'bold 66px sans-serif'; ctx.fillText(`${result.score.toLocaleString('ko-KR')}점`, 60, 275, 520);
  ctx.font = '24px sans-serif'; ctx.fillText(`최고 ${result.combo}콤보 · 성공 ${result.hits}회`, 60, 335, 520);
  const names = { pink: '핑크 크리스탈', green: '그린 크리스탈', volcanic: '볼케닉' };
  ctx.font = '22px sans-serif'; ctx.fillText(names[result.stone], 60, 385);
  ctx.drawImage(gameCanvas, 590, 100, 380, 380);
  ctx.fillStyle = '#F8E29A'; ctx.fillRect(60, 450, 470, 70);
  ctx.fillStyle = '#333331'; ctx.font = '24px sans-serif'; ctx.fillText('당신도 향기 한 방울, 도전해보세요', 80, 495, 430);
  const blob = await new Promise((resolve, reject) => card.toBlob(value => value ? resolve(value) : reject(new Error('카드 생성 실패')), 'image/png'));
  const file = new File([blob], 'gyeolideun-score.png', { type: 'image/png' });
  const uploaded = await kakao.Share.uploadImage({ file: [file] });
  return kakaoCardPayload(result, baseUrl, uploaded.infos.original.url);
}

export function kakaoCardPayload(result, baseUrl, imageUrl) {
  // Kakao only accepts registered public domains, even when played locally.
  const url = resultLink(PUBLIC_GAME_URL, result);
  const link = { mobileWebUrl: url, webUrl: url };
  return {
    objectType: 'feed',
    content: {
      title: `결이든 향을 담는 돌 · ${result.score.toLocaleString('ko-KR')}점`,
      description: `최고 ${result.combo}콤보! 내 기록에 도전해보세요.`,
      imageUrl, imageWidth: 1000, imageHeight: 600, link,
    },
    buttons: [{ title: '기록 보고 도전하기', link }],
  };
}
