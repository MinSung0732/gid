import { prepareKakaoCard } from './kakao-card.js';

// Public browser JavaScript key; authorized origins are managed in Kakao Developers.
const JAVASCRIPT_KEY = '6716e83b61647bd3bd1977dd655aa93b';
let sdkPromise;
function loadKakao() {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = setTimeout(() => { script.remove(); reject(new Error('SDK timeout')); }, 15000);
    script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js';
    script.integrity = 'sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy';
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      clearTimeout(timeout);
      try {
        if (!window.Kakao.isInitialized()) window.Kakao.init(JAVASCRIPT_KEY);
        resolve(window.Kakao);
      } catch (error) { reject(error); }
    };
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('SDK unavailable')); };
    document.head.append(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}

export function setupKakaoShare({ button, status, getResult, canvas, loadSdk = loadKakao, prepare = prepareKakaoCard }) {
  let cached = null, busy = false;
  button.addEventListener('click', async () => {
    if (busy) return;
    const result = getResult();
    const fingerprint = JSON.stringify(result);
    try {
      if (cached?.fingerprint === fingerprint) {
        // Keep this call synchronous with the second click to avoid blocked popups.
        cached.sdk.Share.sendDefault(cached.payload);
        status.textContent = '카카오톡에서 공유할 대상을 선택해주세요.';
        return;
      }
      busy = true; button.disabled = true; button.textContent = '점수 카드 만드는 중…';
      status.textContent = '내 점수 이미지를 준비하고 있어요.';
      const sdk = await loadSdk();
      const payload = await prepare(sdk, result, canvas, window.location.href);
      if (JSON.stringify(getResult()) !== fingerprint) {
        button.textContent = '카카오톡으로 점수 자랑하기';
        status.textContent = ''; return;
      }
      cached = { fingerprint, sdk, payload };
      button.textContent = '카카오톡 열고 공유하기';
      status.textContent = '카드 완성! 위 버튼을 한 번 더 눌러주세요.';
    } catch {
      cached = null;
      button.textContent = '카카오톡 공유 다시 시도';
      status.textContent = '카카오톡 공유를 준비하지 못했어요. 다시 시도하거나 아래 링크 공유를 이용해주세요.';
    } finally { busy = false; button.disabled = false; }
  });
}
