const board = document.querySelector('#board');
const shell = document.querySelector('.game-shell');
let scheduled = 0;
function fitBoard() {
  scheduled = 0;
  const count = board.children.length;
  if (!count) return;
  const style = getComputedStyle(board);
  const gap = parseFloat(style.gap) || 6;
  const width = board.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const height = board.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const landscape = width > height * 1.3;
  const columns = count === 6 ? 3 : count === 20 && landscape ? 5 : 4;
  const rows = Math.ceil(count / columns);
  const cardWidth = Math.max(1, Math.min(94, (width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows * 0.88));
  board.style.setProperty('--columns', columns);
  board.style.setProperty('--card-width', `${cardWidth}px`);
  board.style.setProperty('--card-height', `${cardWidth / 0.88}px`);
}
function schedule() {
  if (!scheduled) scheduled = requestAnimationFrame(fitBoard);
}
new ResizeObserver(schedule).observe(board);
new MutationObserver(schedule).observe(board, { childList: true });
new MutationObserver(schedule).observe(shell, { attributes: true, attributeFilter: ['class'] });
schedule();
