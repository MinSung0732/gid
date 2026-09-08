const PUBLIC_ROOT = "https://minsung0732.github.io/gid/";
export const PUBLIC_GAMES_PAGE = `${PUBLIC_ROOT}games/`;
const KAKAO_KEY = "6716e83b61647bd3bd1977dd655aa93b";
let kakaoPromise;

async function toFile(canvas, name) {
  let blob;
  try {
    blob = await new Promise((resolve, reject) => {
      try {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("empty blob"))),
          "image/png",
        );
      } catch (error) {
        reject(error);
      }
    });
  } catch {
    const response = await fetch(canvas.toDataURL("image/png"));
    blob = await response.blob();
  }
  if (!blob?.size) throw new Error("empty image");
  return typeof File === "function"
    ? new File([blob], name, { type: "image/png" })
    : Object.assign(blob, { name });
}

function loadKakao() {
  if (window.Kakao) return Promise.resolve(window.Kakao);
  kakaoPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js";
    script.integrity =
      "sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.Kakao);
    script.onerror = () => reject(new Error("Kakao SDK unavailable"));
    document.head.append(script);
  });
  return kakaoPromise;
}

export async function shareChallengeKakao(record) {
  const kakao = await loadKakao();
  if (!kakao.isInitialized()) kakao.init(KAKAO_KEY);
  const link = { mobileWebUrl: PUBLIC_GAMES_PAGE, webUrl: PUBLIC_GAMES_PAGE };
  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: "향기의 기억 챌린지",
      description: `최고 ${record.score.toLocaleString("ko-KR")}점 · LEVEL ${record.level}`,
      imageUrl: `${PUBLIC_ROOT}public/assets/memory/blossom-bouquet.png`,
      link,
    },
    buttons: [{ title: "다른 게임도 둘러보기", link }],
  });
}

export async function createChallengeCard(record) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const context = canvas.getContext("2d");
  context.fillStyle = "#FAFAF5";
  context.fillRect(0, 0, 1080, 1080);
  context.fillStyle = "#235347";
  context.fillRect(0, 0, 1080, 22);
  context.fillStyle = "#235347";
  context.font = "700 38px sans-serif";
  context.fillText("GYEOLIDEUN · SCENT MEMORY", 70, 115);
  context.fillStyle = "#333331";
  context.font = "700 64px serif";
  context.fillText("향기의 기억 챌린지", 70, 230);
  context.fillStyle = "#F3E9DC";
  context.fillRect(70, 310, 940, 430);
  context.fillStyle = "#235347";
  context.font = "28px sans-serif";
  context.fillText("최고 점수", 130, 410);
  context.font = "700 92px sans-serif";
  context.fillText(`${record.score.toLocaleString("ko-KR")}점`, 130, 530);
  context.fillStyle = "#BD4860";
  context.font = "28px sans-serif";
  context.fillText("최고 도달 레벨", 130, 625);
  context.font = "700 64px sans-serif";
  context.fillText(`LEVEL ${record.level}`, 130, 700);
  context.fillStyle = "#333331";
  context.font = "30px sans-serif";
  context.fillText("목숨 3개로 당신의 기억력에 도전해보세요.", 70, 855);
  context.fillStyle = "#235347";
  context.font = "24px sans-serif";
  context.fillText("향기는 사라져도 좋은 기억은 오래 머물러요.", 70, 970);
  return toFile(canvas, "gyeolideun-memory-challenge.png");
}

function download(file) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name || "gyeolideun-memory-challenge.png";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyText(value) {
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const copied = document.execCommand("copy");
  area.remove();
  if (!copied) throw new Error("copy failed");
}

export async function shareChallengeRecord(record) {
  const file = await createChallengeCard(record);
  download(file);
  return "최고 기록 이미지를 저장했어요.";
}

export async function shareChallengeLink(record) {
  const url = `${PUBLIC_ROOT}games/memory/`;
  const value = `결이든 향기의 기억 챌린지 · 최고 ${record.score.toLocaleString("ko-KR")}점 · LEVEL ${record.level}\n${url}`;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    copyText(value);
  }
  return "기록과 게임 링크를 복사했어요. 원하는 앱에 붙여넣어 주세요.";
}
