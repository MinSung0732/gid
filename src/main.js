import { judgeDrop, resultRank } from './rules.js';
import { resultLink, readResult } from './share.js';
import { createAtmosphere } from './atmosphere.js';
import { setupKakaoShare } from './kakao-share.js';
import { setupSocialShare } from './social-share.js';
const atmosphere = createAtmosphere();
const reducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
const $ = id => document.getElementById(id), canvas = $('game'), ctx = canvas.getContext('2d');
// 공식 원본을 이 경로에 추가하면 안내 캐릭터로 자동 표시합니다.
const mascot = document.createElement('img');
mascot.alt = '결이든 공식 마스코트'; mascot.className = 'mascot'; mascot.hidden = true;
mascot.addEventListener('load', () => { mascot.hidden = false; });
mascot.addEventListener('error', () => { mascot.hidden = true; });
mascot.src = './public/assets/mascot.png';
document.querySelector('.instructions').prepend(mascot);
const types = {
  pink: { name: '핑크 크리스탈', label: 'PINK CRYSTAL', colors: ['#e8bfc9','#f4dce1','#dca7b8','#fff0ed'] },
  green: { name: '그린 크리스탈', label: 'GREEN CRYSTAL', colors: ['#8EB69B','#cde1ce','#639780','#e1eee0'] },
  volcanic: { name: '볼케닉', label: 'VOLCANIC STONE', colors: ['#333331','#52534b','#292e2b','#66665b'] }
};
let selected='pink', phase='ready', remaining=30, score=0, combo=0, maxCombo=0, hits=0, elapsed=0, last=0, drop=null, particles=[], ripple=0, feedbackUntil=0, sound=true, audio=null, best=0;
let tutorialActive = false;
let frameRequest = 0;
function wakeAnimation() {
  if (frameRequest && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameRequest);
  last = performance.now();
  frameRequest = requestAnimationFrame(frame);
}
try { best=Math.max(0,Number(localStorage.getItem('gyeolideun-best'))||0); } catch {}
$('best').textContent=best;
let movementAngle = 0, movementTime = 0, speedMultiplier = 1;
const sourceX = () => {
  // Integrate the speed so a new multiplier does not jump to another position.
  movementAngle += (elapsed - movementTime) * 2.1 * speedMultiplier;
  movementTime = elapsed;
  return 240 + Math.sin(movementAngle) * 175;
};
function feedback(text, grade = '') {
  const element = $('feedback');
  element.textContent = text;
  element.setAttribute('data-grade', grade);
  if (grade && element.animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    element.getAnimations().forEach(animation => animation.cancel());
    element.animate([
      { transform: 'translateY(7px) scale(.9)', opacity: .4 },
      { transform: 'translateY(0) scale(1.06)', opacity: 1, offset: .55 },
      { transform: 'translateY(0) scale(1)', opacity: 1 },
    ], { duration: grade === 'PERFECT' ? 360 : 240, easing: 'ease-out' });
  }
  feedbackUntil = elapsed + 1.3;
}
function tone(perfect){if(!sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=perfect?880:587;g.gain.setValueAtTime(.06,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.3);}catch{}}
function fanfare(){if(!sound)return;try{audio ||= new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});[523,659,784,1047].forEach((frequency,index)=>{const o=audio.createOscillator(),g=audio.createGain(),start=audio.currentTime+index*.12;o.type='triangle';o.frequency.value=frequency;g.gain.setValueAtTime(.001,start);g.gain.linearRampToValueAtTime(.07,start+.025);g.gain.exponentialRampToValueAtTime(.001,start+.42);o.connect(g);g.connect(audio.destination);o.start(start);o.stop(start+.45);});}catch{}}
function updateComboGoal(){const next=Math.min(100,(Math.floor(combo/10)+1)*10),people=Math.min(10,Math.floor(combo/10));$('combo-goal').innerHTML=combo>=100?`<strong>${combo} COMBO</strong><span>손님 10명이 모두 모였어요!</span>`:`<strong>${combo} COMBO</strong><span>다음 손님까지 ${next-combo}콤보 · 현재 ${people}/10명</span>`;}
function sync(){$('score').textContent=score;$('time').textContent=Math.ceil(remaining);$('bar').style.width=`${Math.min(1, remaining/30)*100}%`;updateComboGoal();}
function showResult(){const rank=resultRank(score);$('rank').textContent=rank.name;$('total').textContent=`${score}점`;$('detail').textContent=`${types[selected].name} · 성공 ${hits}회 · 최고 ${maxCombo}콤보`;}
function start(){phase='playing';remaining=30;score=combo=maxCombo=hits=elapsed=0;drop=null;particles=[];ripple=0;$('result').hidden=true;$('share-status').textContent='';$('pause').hidden=false;$('pause').textContent='잠시 쉬기';$('action').textContent='향기 떨어뜨리기';$('hint').textContent='돌 중앙의 빛에 맞춰 터치 · 스페이스 키';document.querySelectorAll('[data-stone]').forEach(b=>b.disabled=true);try{tutorialActive=!localStorage.getItem('gyeolideun-guide-seen');localStorage.setItem('gyeolideun-guide-seen','1');}catch{tutorialActive=true;}$('first-guide').hidden=!tutorialActive;feedback(tutorialActive?'빛나는 중앙을 노려보세요!':'방울이 가운데에 오면 터치!');sync();}
function finish(){phase='result';drop=null;tutorialActive=false;atmosphere.settle(maxCombo);$('first-guide').hidden=true;$('result').hidden=false;$('pause').hidden=true;$('action').textContent='한 번 더 향기 담기';$('hint').textContent='다른 돌을 골라 다시 즐겨보세요';showResult();if(score>best){best=score;try{localStorage.setItem('gyeolideun-best',String(best));}catch{}}$('best').textContent=best;document.querySelectorAll('[data-stone]').forEach(b=>b.disabled=false);}
function action() {
  if (phase === 'ready' || phase === 'result') {
    movementAngle = movementTime = 0;
    speedMultiplier = 1;
    atmosphere.reset();
    start();
    wakeAnimation();
    return;
  }
  if (phase === 'paused') { pause(); wakeAnimation(); return; }
  if (!drop && remaining > 0) {
    drop = { x: sourceX(), y: 100 };
    // Each accepted drop selects an independent 0.5–1.5× horizontal speed.
    speedMultiplier = 0.5 + Math.random();
    wakeAnimation();
  }
}
function pause(){if(phase==='playing'){phase='paused';$('pause').textContent='계속하기';$('action').textContent='향기 담기 계속하기';feedback('잠시 쉬어가도 괜찮아요');}else if(phase==='paused'){phase='playing';$('pause').textContent='잠시 쉬기';$('action').textContent='향기 떨어뜨리기';feedback('다시, 향기 한 방울');wakeAnimation();}}
$('action').addEventListener('click',action);$('pause').addEventListener('click',pause);
canvas.addEventListener('pointerdown',e=>{if(phase==='playing'){e.preventDefault();action();}});
document.addEventListener('keydown', e => {
  if (e.code === 'Space') {
    const target = document.activeElement;
    const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
    // Also suppress native Space activation when the restart button has focus.
    if (!editable && (target === $('action') || !['BUTTON', 'A'].includes(target.tagName))) {
      e.preventDefault();
      if (!e.repeat && phase === 'playing') action();
    }
  }
  if (e.code === 'Escape' && !e.repeat) pause();
});
document.addEventListener('keyup', e => {
  if (e.code === 'Space' && document.activeElement === $('action')) e.preventDefault();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pause();});
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=sound?'소리 켜짐':'소리 꺼짐';$('sound').setAttribute('aria-pressed',String(sound));if(sound)tone(true);});
document.querySelectorAll('[data-stone]').forEach(button=>button.addEventListener('click',()=>{if(phase==='playing'||phase==='paused')return;selected=button.dataset.stone;document.querySelectorAll('[data-stone]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});$('label').textContent=types[selected].label;if(phase==='result'){phase='ready';$('result').hidden=true;$('action').textContent='향기 담기 시작';}feedback(`${types[selected].name}에 향기를 담아보세요`);}));
$('share').textContent = '내 기록 링크로 자랑하기';
setupKakaoShare({
  button: $('kakao-share'), status: $('share-status'), canvas,
  getResult: () => ({ stone: selected, score, combo: maxCombo, hits }),
});
setupSocialShare({
  imageButton: $('image-share'),
  status: $('share-status'), canvas,
  getResult: () => ({ stone: selected, score, combo: maxCombo, hits }),
});
$('share').addEventListener('click', async () => {
  const url = resultLink(window.location.href, { stone: selected, score, combo: maxCombo, hits });
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const note = local ? ' 현재는 이 컴퓨터에서만 열리는 주소예요.' : '';
  try {
    if (navigator.share) {
      await navigator.share({ url });
      $('share-status').textContent = '내 기록 링크를 공유했어요.' + note;
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      $('share-status').textContent = '링크를 복사했어요. 원하는 곳에 붙여넣어 주세요.' + note;
    } else {
      $('share-status').textContent = url + note;
    }
  } catch (error) {
    $('share-status').textContent = error.name === 'AbortError' ? '공유를 취소했어요.' : url + note;
  }
});
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function stone(x,y,size,index){ctx.save();ctx.translate(x,y);ctx.rotate(index*.7);ctx.beginPath();const count=selected==='volcanic'?11:6;for(let i=0;i<count;i++){const a=i/count*Math.PI*2,r=size*(1+Math.sin(i*7+index)*.13);ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r*.8);}ctx.closePath();ctx.fillStyle=types[selected].colors[index%4];ctx.fill();ctx.strokeStyle=selected==='volcanic'?'#92958455':'#ffffffa0';ctx.lineWidth=1.2;ctx.stroke();if(selected==='volcanic'){for(let j=0;j<9;j++)ellipse(Math.cos(j*2.4)*size*.56,Math.sin(j*2.4)*size*.5,3+j%3,2+j%2,'#11181470');}else{ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(0,-size*.3);ctx.lineTo(size*.7,size*.45);ctx.lineTo(0,size*.7);ctx.closePath();ctx.fillStyle='#ffffff35';ctx.fill();}ctx.restore();}
function draw(){ctx.clearRect(0,0,480,480);ellipse(240,386,115,14,'#2353470b');ctx.strokeStyle='#23534712';ctx.setLineDash([3,7]);ctx.beginPath();ctx.moveTo(240,115);ctx.lineTo(240,275);ctx.stroke();ctx.setLineDash([]);const volcanic=selected==='volcanic';ctx.fillStyle=volcanic?'#343831':'#dde4d733';ctx.strokeStyle=volcanic?'#626758':'#a8b5a980';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(155,308,170,70,[4,4,20,20]);ctx.fill();ctx.stroke();[[192,321,33],[237,331,37],[282,319,35],[205,283,35],[254,284,38],[233,252,30],[281,281,26]].forEach((s,i)=>stone(...s,i));ctx.fillStyle=volcanic?'#e6e7d8':'#23534788';ctx.font='12px sans-serif';ctx.textAlign='center';ctx.fillText('결이든',240,361);ellipse(240,244,25,6,'#F8E29A77');ellipse(240,244,8,3,'#F8E29A');if(ripple>0){ctx.strokeStyle=`rgba(142,182,155,${ripple})`;ctx.beginPath();ctx.ellipse(240,261-(1-ripple)*30,30+(1-ripple)*85,8+(1-ripple)*18,0,0,Math.PI*2);ctx.stroke();}const x=drop?drop.x:sourceX(),y=drop?drop.y:100;ctx.save();ctx.translate(x,y);ctx.fillStyle='#e5c771';ctx.beginPath();ctx.moveTo(0,-18);ctx.bezierCurveTo(-3,-7,-11,0,-10,7);ctx.bezierCurveTo(-8,20,9,20,10,7);ctx.bezierCurveTo(11,0,3,-7,0,-18);ctx.fill();ellipse(-3,5,2,4,'#fff9dc');ctx.restore();particles.forEach(p=>{ctx.globalAlpha=Math.max(0,p.life);ellipse(p.x,p.y,p.size,p.size,p.color);});ctx.globalAlpha=1;if(combo>1&&phase!=='result'){ctx.font='12px sans-serif';ctx.fillStyle='#235347';ctx.fillText(`${combo} COMBO`,240,420);}}
function frame(now) {
  const dt = Math.min((now - (last || now)) / 1000, .1);
  last = now;
  if (phase === 'playing') {
    elapsed += dt;
    if (tutorialActive && elapsed >= 2.2) { tutorialActive=false; $('first-guide').hidden=true; }
    remaining = Math.max(0, remaining - dt);
    // An expired round cannot be revived by an airborne drop.
    if (remaining === 0) { sync(); finish(); }
    if (drop) {
      drop.y += dt * 560;
      if (drop.y >= 235) {
        const previousCombo = combo;
        const r = judgeDrop(drop.x, combo);
        combo = r.combo; score += r.points;
        if (previousCombo < 100 && combo >= 100) fanfare();
        remaining = Math.max(0, remaining + r.timeDelta);
        const timeFeedback = r.timeDelta > 0 ? ` · +${r.timeDelta}초` : r.timeDelta < 0 ? ` · −${Math.abs(r.timeDelta)}초` : '';
        feedback(`${r.grade}${r.points ? ` +${r.points}` : ' · 다시 도전!'}${timeFeedback}`, r.grade);
        if (r.points) {
          hits++; maxCombo = Math.max(maxCombo, combo); ripple = 1; tone(r.perfect);
          for (let i = 0; i < 16; i++) particles.push({ x: drop.x, y: 245, vx: (Math.random() - .5) * 100, vy: -30 - Math.random() * 80, life: 1, size: 1 + Math.random() * 3, color: i % 2 ? '#8EB69B' : '#e5c771' });
        }
        drop = null;
      }
    }
    ripple = Math.max(0, ripple - dt * 1.4);
    particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; });
    particles = particles.filter(p => p.life > 0);
    if (elapsed > feedbackUntil) feedback('가운데에 향기 한 방울');
    sync(); if (remaining === 0) finish();
    atmosphere.update(dt, combo, reducedMotion());
  }
  draw();
  if (phase === 'playing' || phase === 'paused' || phase === 'result') atmosphere.draw(ctx, elapsed, reducedMotion());
  frameRequest = requestAnimationFrame(frame);
}
const shared = readResult(window.location.href);
if (shared) {
  selected = shared.stone; score = shared.score; maxCombo = shared.combo; hits = shared.hits;
  phase = 'result';
  atmosphere.settle(maxCombo);
  $('result').hidden = false;
  $('total').textContent = `${score}점`;
  showResult();
  $('action').textContent = '나도 도전하기 →';
  $('hint').textContent = '친구가 담은 향기, 이번에는 당신 차례예요';
  $('label').textContent = types[selected].label;
  document.querySelectorAll('[data-stone]').forEach(b => {
    b.classList.toggle('active', b.dataset.stone === selected);
    b.setAttribute('aria-pressed', String(b.dataset.stone === selected));
  });
  // 공유 기록은 방문자의 최고 기록에 저장하지 않습니다.
  const clean = new URL(window.location.href); clean.search = ''; clean.hash = '';
  window.history.replaceState(null, '', clean.href);
}
wakeAnimation();
