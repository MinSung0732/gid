const PUBLIC_ROOT = "https://minsung0732.github.io/gid/";
const PUBLIC_PAGE = `${PUBLIC_ROOT}games/daily-scent/`;
export const PUBLIC_GAMES_PAGE = `${PUBLIC_ROOT}games/`;
const KAKAO_KEY = "6716e83b61647bd3bd1977dd655aa93b";
let kakaoPromise;

export const shareText = (scent, message) =>
  `오늘의 향기 · ${scent.name}\n“${message}”`;

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

export async function shareKakao(scentId, scent, message) {
  const kakao = await loadKakao();
  if (!kakao.isInitialized()) kakao.init(KAKAO_KEY);
  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `오늘의 향기 · ${scent.name}`,
      description: message,
      imageUrl: `${PUBLIC_ROOT}public/assets/daily-scent/${scentId}.png`,
      link: { mobileWebUrl: PUBLIC_GAMES_PAGE, webUrl: PUBLIC_GAMES_PAGE },
    },
    buttons: [
      {
        title: "다른 게임도 둘러보기",
        link: { mobileWebUrl: PUBLIC_GAMES_PAGE, webUrl: PUBLIC_GAMES_PAGE },
      },
    ],
  });
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const characters = [...text];
  let line = "";
  for (const character of characters) {
    const next = line + character;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, y);
      line = character;
      y += lineHeight;
    } else line = next;
  }
  context.fillText(line, x, y);
}

export async function createCardFile(scent, message, imageSource) {
  await imageSource.decode?.();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const context = canvas.getContext("2d");
  context.fillStyle = "#FAFAF5";
  context.fillRect(0, 0, 1080, 1080);
  const cropHeight = (imageSource.naturalWidth * 650) / 1080;
  const cropTop = Math.max(0, (imageSource.naturalHeight - cropHeight) / 2);
  context.drawImage(
    imageSource,
    0,
    cropTop,
    imageSource.naturalWidth,
    Math.min(cropHeight, imageSource.naturalHeight),
    0,
    0,
    1080,
    650,
  );
  const fade = context.createLinearGradient(0, 480, 0, 700);
  fade.addColorStop(0, "#FAFAF500");
  fade.addColorStop(1, "#FAFAF5");
  context.fillStyle = fade;
  context.fillRect(0, 480, 1080, 220);
  context.fillStyle = "#235347";
  context.font = "bold 30px sans-serif";
  context.fillText("GYEOLIDEUN · TODAY’S SCENT", 70, 710);
  context.fillStyle = scent.color;
  context.font = "bold 54px sans-serif";
  context.fillText(scent.name, 70, 790);
  context.fillStyle = "#333331";
  context.font = "36px serif";
  wrapText(context, `“${message}”`, 70, 870, 940, 56);
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  return new File([blob], "gyeolideun-daily-scent.png", { type: "image/png" });
}

export async function shareImage(scent, message, imageSource) {
  const file = await createCardFile(scent, message, imageSource);
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "향기 이미지를 저장했어요.";
}

export function threadsUrl(scent, message) {
  const url = new URL("https://www.threads.com/intent/post");
  url.searchParams.set(
    "text",
    `${shareText(scent, message)}\n\n#결이든 #오늘의향기`,
  );
  url.searchParams.set("url", PUBLIC_PAGE);
  return url.href;
}
