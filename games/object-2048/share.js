export const PUBLIC_OBJECT_PAGE =
  "https://minsung0732.github.io/gid/games/object-2048/";
export const PUBLIC_GAMES_PAGE = "https://minsung0732.github.io/gid/games/";
const PUBLIC_ROOT = "https://minsung0732.github.io/gid/",
  KAKAO_KEY = "6716e83b61647bd3bd1977dd655aa93b";
let kakaoPromise;
export const objectShareText = (record) =>
  `결이든 오브제 2048\n${record.score.toLocaleString("ko-KR")}점 · 최고 오브제 ${record.tile}`;
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
export async function shareObjectKakao(record) {
  const kakao = await loadKakao();
  if (!kakao.isInitialized()) kakao.init(KAKAO_KEY);
  const link = { mobileWebUrl: PUBLIC_GAMES_PAGE, webUrl: PUBLIC_GAMES_PAGE };
  kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: "결이든 오브제 2048",
      description: `${record.score.toLocaleString("ko-KR")}점 · 최고 오브제 ${record.tile}`,
      imageUrl: `${PUBLIC_ROOT}public/assets/object-2048/2048.png`,
      link,
    },
    buttons: [{ title: "다른 게임도 둘러보기", link }],
  });
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
async function toFile(canvas) {
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("empty image"))),
      "image/png",
    ),
  );
  return new File([blob], "gyeolideun-object-2048.png", { type: "image/png" });
}
export async function createObjectCard(record) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext("2d"),
    image = await loadImage(
      `../../public/assets/object-2048/${Math.min(record.tile, 2048)}.png`,
    );
  ctx.fillStyle = "#FAFAF5";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#235347";
  ctx.fillRect(0, 0, 1080, 20);
  ctx.font = "700 38px sans-serif";
  ctx.fillText("GYEOLIDEUN · OBJECT PUZZLE", 70, 105);
  ctx.fillStyle = "#333331";
  ctx.font = "700 66px serif";
  ctx.fillText("결이든 오브제 2048", 70, 210);
  ctx.fillStyle = "#F3EFE3";
  ctx.fillRect(70, 275, 940, 530);
  ctx.drawImage(image, 525, 305, 450, 450);
  ctx.fillStyle = "#235347";
  ctx.font = "28px sans-serif";
  ctx.fillText("나의 향기 기록", 120, 390);
  ctx.font = "700 86px sans-serif";
  ctx.fillText(`${record.score.toLocaleString("ko-KR")}점`, 120, 510, 390);
  ctx.fillStyle = "#A77F15";
  ctx.font = "26px sans-serif";
  ctx.fillText("최고 오브제", 120, 625);
  ctx.font = "700 62px sans-serif";
  ctx.fillText(String(record.tile), 120, 710);
  ctx.fillStyle = "#333331";
  ctx.font = "30px sans-serif";
  ctx.fillText("볼케닉과 크리스탈을 합쳐", 70, 900);
  ctx.fillText("시그니처 오브제를 완성해보세요.", 70, 946);
  ctx.fillStyle = "#235347";
  ctx.font = "23px sans-serif";
  ctx.fillText("GYEOLIDEUN · VOLCANIC & CRYSTAL", 70, 1020);
  return toFile(canvas);
}
function download(file) {
  const url = URL.createObjectURL(file),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function copyFallback(value) {
  const area = document.createElement("textarea");
  area.value = value;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.append(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  if (!ok) throw new Error("copy failed");
}
export async function shareObjectImage(record) {
  download(await createObjectCard(record));
  return "공유용 기록 이미지를 저장했어요.";
}
export async function shareObjectLink(record) {
  const value = `${objectShareText(record)}\n${PUBLIC_OBJECT_PAGE}`;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    copyFallback(value);
  }
  return "기록과 게임 링크를 복사했어요. 원하는 앱에 붙여넣어 주세요.";
}
