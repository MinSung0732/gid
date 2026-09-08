const stoneNames = {
  pink: "핑크 크리스탈",
  green: "그린 크리스탈",
  volcanic: "볼케닉",
};
export function createSocialCardFile(result, gameCanvas) {
  const card = document.createElement("canvas");
  card.width = card.height = 1080;
  const ctx = card.getContext("2d");
  ctx.fillStyle = "#FAFAF5";
  ctx.fillRect(0, 0, 1080, 1080);
  ctx.fillStyle = "#235347";
  ctx.fillRect(0, 0, 1080, 18);
  ctx.font = "bold 42px sans-serif";
  ctx.fillText("결이든 · 향을 담는 돌", 70, 100);
  ctx.font = "28px sans-serif";
  ctx.fillText("나의 향기 기록", 70, 175);
  ctx.font = "bold 92px sans-serif";
  ctx.fillText(`${result.score.toLocaleString("ko-KR")}점`, 70, 300);
  ctx.font = "30px sans-serif";
  ctx.fillText(`최고 ${result.combo}콤보 · 성공 ${result.hits}회`, 70, 365);
  ctx.font = "26px sans-serif";
  ctx.fillText(stoneNames[result.stone], 70, 420);
  ctx.fillStyle = "#fffefb";
  ctx.fillRect(490, 65, 540, 540);
  ctx.drawImage(gameCanvas, 490, 65, 540, 540);
  ctx.fillStyle = "#F8E29A";
  ctx.fillRect(70, 690, 940, 130);
  ctx.fillStyle = "#333331";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("당신의 향기 한 방울, 도전해보세요", 110, 770);
  ctx.fillStyle = "#235347";
  ctx.font = "25px sans-serif";
  ctx.fillText("GYEOLIDEUN  ·  VOLCANIC & CRYSTAL", 70, 965);
  const binary = atob(card.toDataURL("image/png").split(",")[1]),
    bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], "gyeolideun-score.png", { type: "image/png" });
}
function downloadFile(file) {
  const anchor = document.createElement("a"),
    url = URL.createObjectURL(file);
  anchor.href = url;
  anchor.download = file.name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function setupSocialShare({ imageButton, status, canvas, getResult }) {
  imageButton.addEventListener("click", () => {
    try {
      downloadFile(createSocialCardFile(getResult(), canvas));
      status.textContent = "기록 이미지를 저장했어요.";
    } catch {
      status.textContent = "이미지를 저장하지 못했어요. 다시 시도해 주세요.";
    }
  });
}
