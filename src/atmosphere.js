import { makeVisitor, drawVisitor } from './visitors.js';
export const visitorCount = combo => Math.min(10, Math.floor(Math.max(0, combo) / 10));
export const scentCount = combo => Math.min(10, Math.floor(Math.max(0, combo) / 5));
export const dialogueTemplates = Object.freeze([
  '좋은 향이네', '여기서 나는 향?', '살짝 쉬어갈까', '기분 좋은 향',
  '은은해서 좋아', '향 따라 왔어', '한 번 더 킁킁', '마음이 편안해',
  '이 향, 내 취향', '잠깐 머물래', '공기가 달라져', '돌도 예쁘네',
  '우리 집에도!', '향이 포근해', '작은 쉼표 같아', '계속 맡고 싶어',
  '가까이 가볼까', '여기 참 좋다', '향에 반했어', '결이든이구나',
]);

// Ten guests surround the object without entering the falling-drop corridor.
const guests = [
  { x: 93, y: 318, side: -1 },
  { x: 385, y: 322, side: 1 },
  { x: 42, y: 387, side: -1 },
  { x: 434, y: 387, side: 1 },
  { x: 122, y: 411, side: -1 },
  { x: 357, y: 413, side: 1 },
  { x: 38, y: 251, side: -1 },
  { x: 442, y: 248, side: 1 },
  { x: 111, y: 203, side: -1 },
  { x: 369, y: 199, side: 1 },
];
export function createAtmosphere() {
  let heat = 0;
  let scentLevel = 0;
  let celebration = 0;
  let previousCombo = 0;
  const presence = guests.map(() => 0);
  const active = guests.map(() => false);
  const dialogue = guests.map(() => '');
  const speechClock = guests.map(() => 0);
  let visitorSeed = Math.floor(Math.random()*120);
  const appearances = guests.map((_, i) => makeVisitor(i, visitorSeed));
  function chooseDialogue(i) {
    const candidates = dialogueTemplates.filter(text => !dialogue.includes(text));
    dialogue[i] = candidates[Math.floor(Math.random() * candidates.length)];
    speechClock[i] = 4 + Math.random() * 2;
  }
  return {
    reset() { heat = 0; scentLevel = 0; celebration = 0; previousCombo = 0; presence.fill(0); active.fill(false); dialogue.fill(''); speechClock.fill(0); visitorSeed = (visitorSeed + 1 + Math.floor(Math.random()*119)) % 120; appearances.forEach((_,i)=>{appearances[i]=makeVisitor(i,visitorSeed);}); },
    settle(combo) {
      const count = visitorCount(combo);
      heat = Math.min(Math.max(combo, 0) / 30, 1);
      scentLevel = scentCount(combo);
      celebration = 0;
      previousCombo = combo;
      presence.forEach((_, i) => {
        const visible = i < count;
        presence[i] = visible ? 1 : 0;
        active[i] = visible;
        if (visible && !dialogue[i]) chooseDialogue(i);
      });
    },
    isCelebrating() { return celebration > 0; },
    update(dt, combo, reducedMotion) {
      if (previousCombo < 100 && combo >= 100) celebration = 5.5;
      celebration = Math.max(0, celebration - dt);
      previousCombo = combo;
      const target = Math.min(Math.max(combo, 0) / 30, 1);
      heat += (target - heat) * Math.min(1, dt * 3);
      scentLevel += (scentCount(combo) - scentLevel) * Math.min(1, dt * 3);
      const count = visitorCount(combo);
      presence.forEach((value, i) => {
        const goal = i < count ? 1 : 0;
        if (goal) {
          speechClock[i] -= dt;
          if (!active[i] || speechClock[i] <= 0) chooseDialogue(i);
        }
        active[i] = Boolean(goal);
        presence[i] = reducedMotion ? goal : Math.max(0, Math.min(1, value + (goal ? 1 : -1) * dt / .8));
      });
    },
    draw(ctx, time, reducedMotion) {
      ctx.save();
      if (celebration > 0) {
        const strength = Math.min(1, celebration * 2);
        ctx.save(); ctx.globalAlpha = strength;
        ctx.fillStyle = '#235347'; ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif';
        ctx.fillText('손님 10명 모두 모였어요!', 240, 68);
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#a37b19'; ctx.fillText('SCENT PARTY!', 240, 88);
        const colors = ['#235347','#8EB69B','#F8E29A','#e4b7c3','#9fb4c5'];
        // Powdery fireworks burst from the background instead of falling in rows.
        const celebrationAge = 5.5 - celebration;
        const bursts = [
          { x: 86, y: 130, delay: 0 },
          { x: 398, y: 145, delay: .35 },
          { x: 244, y: 118, delay: .75 },
          { x: 55, y: 245, delay: 1.25 },
          { x: 425, y: 255, delay: 1.6 },
        ];
        for (let b = 0; b < bursts.length; b++) {
          const burst = bursts[b];
          const age = reducedMotion ? .65 : celebrationAge - burst.delay;
          if (age < 0 || age > 2.5) continue;
          const travel = Math.min(age, 1.35);
          const fade = Math.max(0, 1 - age / 2.5);
          for (let i = 0; i < 24; i++) {
            const angle = i / 24 * Math.PI * 2 + b * .73;
            const speed = 34 + (i * 17 % 42);
            const distance = reducedMotion ? speed * .62 : speed * travel;
            const x = burst.x + Math.cos(angle) * distance;
            const y = burst.y + Math.sin(angle) * distance + (reducedMotion ? 7 : 15 * age * age);
            ctx.save();
            ctx.globalAlpha = strength * fade * (.35 + (i % 4) * .12);
            ctx.fillStyle = colors[(i + b * 2) % colors.length];
            ctx.translate(x, y);
            ctx.rotate(angle + age * (i % 2 ? 1.8 : -1.4));
            if (i % 3 === 0) {
              ctx.beginPath(); ctx.arc(0, 0, 1.5 + i % 2, 0, Math.PI * 2); ctx.fill();
            } else {
              ctx.fillRect(-2.5, -1, 5, 2);
            }
            ctx.restore();
          }
        }
        ctx.restore();
      }
      // Long tapered peripheral rays leave the central drop and target clear.
      if (heat > .005) {
        for (let i = 0; i < 36; i++) {
          const a = i / 36 * Math.PI * 2 + Math.sin(i * 9) * .025;
          if (Math.sin(a) < -.7 || Math.sin(a) > .85) continue;
          const pulse = reducedMotion ? .5 : (Math.sin(time * 1.8 + i * 1.7) + 1) / 2;
          const inner = 140 + (i % 4) * 13 + pulse * 12;
          const outer = 260 + (i % 5) * 19;
          const width = .002 + (i % 3) * .0015;
          ctx.fillStyle = `rgba(35,83,71,${heat * (.07 + pulse * .09)})`;
          ctx.beginPath();
          ctx.moveTo(240 + Math.cos(a) * inner, 285 + Math.sin(a) * inner);
          ctx.lineTo(240 + Math.cos(a - width) * outer, 285 + Math.sin(a - width) * outer);
          ctx.lineTo(240 + Math.cos(a + width) * outer, 285 + Math.sin(a + width) * outer);
          ctx.closePath(); ctx.fill();
        }
        // Confine scent to the stone crown, away from all visitor bodies.
        ctx.save(); ctx.beginPath(); ctx.rect(176,145,128,190); ctx.clip();
        for(let layer=8;layer>=1;layer--){
          ctx.fillStyle=`rgba(248,226,154,${Math.min(scentLevel,5)*.006})`;
          ctx.beginPath();ctx.ellipse(240,282,24+layer*4,25+layer*3,0,0,Math.PI*2);ctx.fill();
        }
        for (let i = 0; i < Math.ceil(scentLevel); i++) {
          const visibility = Math.min(1, scentLevel - i);
          const progress = reducedMotion ? (i + .5) / 10 : (time * (.09 + i % 3 * .012) + i * .137) % 1;
          const x = 240 + Math.sin(i*2.4)*(18+progress*28) + (reducedMotion?0:Math.sin(time+i)*4);
          const y = 264 - progress*103;
          const alpha = Math.sin(progress*Math.PI)*visibility;
          ctx.fillStyle=`rgba(248,226,154,${alpha*.15})`;
          ctx.beginPath();ctx.ellipse(x,y,5,5,0,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle=`rgba(191,151,64,${alpha*.75})`;ctx.lineWidth=1.2;
          const size=1.5+(i%3)*.6;
          ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();
        }
        ctx.restore();
      }
      presence.forEach((value, i) => {
        if (value <= 0) return;
        const guest = guests[i], ease = 1 - Math.pow(1 - value, 3);
        ctx.save(); ctx.globalAlpha = value;
        ctx.translate(guest.x + guest.side * 190 * (1 - ease), guest.y);
        const dancing = celebration > 0 && !reducedMotion;
        const bob = reducedMotion ? 0 : dancing ? Math.abs(Math.sin(time*6+i))*-9 : Math.sin(time * 1.5 + i) * 1.5;
        ctx.translate(dancing ? Math.sin(time*4+i)*3 : 0, bob);
        if (dancing) ctx.rotate(Math.sin(time*5+i)*.13);
        drawVisitor(ctx, appearances[i], guest.side === -1 ? 1 : -1);
        ctx.fillStyle = '#235347'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(dialogue[i], 0, -40);
        ctx.restore();
      });
      ctx.restore();
    },
  };
}
