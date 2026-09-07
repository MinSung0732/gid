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
  { x: 93, y: 318, side: -1, shirt: '#8EB69B', hair: '#514237', pose: [[-13,9,-24,24,-12,31],[13,9,24,-5,13,-12]], label: '좋은 향…' },
  { x: 385, y: 322, side: 1, shirt: '#e8c77a', hair: '#333331', pose: [[-13,9,-25,-8,-16,-19],[13,9,24,-8,15,-19]], label: '킁킁' },
  { x: 42, y: 387, side: -1, shirt: '#d9b1bd', hair: '#765743', pose: [[-13,9,-22,23,-8,25],[13,9,24,19,32,7]], label: '은은해!' },
  { x: 434, y: 387, side: 1, shirt: '#9bbdc9', hair: '#4a4941', pose: [[-13,9,-24,-2,-28,-23],[13,9,23,22,12,29]], label: '여기였네' },
  { x: 122, y: 411, side: -1, shirt: '#b9b399', hair: '#333331', pose: [[-13,9,-23,4,-8,-8],[13,9,22,4,8,-8]], label: '향에 반했어' },
  { x: 357, y: 413, side: 1, shirt: '#b6a2c5', hair: '#615042', pose: [[-13,9,-30,14,-34,3],[13,9,22,-4,9,-9]] },
  { x: 38, y: 251, side: -1, shirt: '#d6b188', hair: '#3f4841', pose: [[-13,9,-21,-10,-29,-17],[13,9,28,1,34,-10]] },
  { x: 442, y: 248, side: 1, shirt: '#a9bda0', hair: '#715947', pose: [[-13,9,-26,18,-34,11],[13,9,25,27,6,25]] },
  { x: 111, y: 203, side: -1, shirt: '#d1a49d', hair: '#46403e', pose: [[-13,9,-29,-3,-35,7],[13,9,20,-17,11,-27]] },
  { x: 369, y: 199, side: 1, shirt: '#9fb4c5', hair: '#685a49', pose: [[-13,9,-22,0,-10,-17],[13,9,30,14,34,26]] },
];
export function createAtmosphere() {
  let heat = 0;
  let scentLevel = 0;
  const presence = guests.map(() => 0);
  const active = guests.map(() => false);
  const dialogue = guests.map(() => '');
  const speechClock = guests.map(() => 0);
  function chooseDialogue(i) {
    const candidates = dialogueTemplates.filter(text => !dialogue.includes(text));
    dialogue[i] = candidates[Math.floor(Math.random() * candidates.length)];
    speechClock[i] = 4 + Math.random() * 2;
  }
  return {
    reset() { heat = 0; scentLevel = 0; presence.fill(0); active.fill(false); dialogue.fill(''); speechClock.fill(0); },
    update(dt, combo, reducedMotion) {
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
        // Diffuse clouds bloom around the sides and base, leaving the target clear.
        for (let i = 0; i < Math.ceil(scentLevel); i++) {
          const visibility = Math.min(1, scentLevel - i);
          const progress = reducedMotion ? (i + .5) / 10 : (time * (.09 + i % 3 * .012) + i * .137) % 1;
          const angle = i * 2.39996;
          const spread = 85 + progress * 80;
          const x = 240 + Math.cos(angle) * spread + (reducedMotion ? 0 : Math.sin(time * .6 + i) * 10);
          const y = 323 + Math.sin(angle) * (42 + progress * 35) - progress * 35;
          const radius = 25 + progress * 23;
          // Stronger visible mist with a capped opacity budget at high combo.
          const alpha = Math.sin(progress * Math.PI) * visibility * .23 / Math.max(1, scentLevel / 6);
          for (let layer = 6; layer >= 1; layer--) {
            ctx.fillStyle = `rgba(142,182,155,${alpha / 6})`;
            ctx.beginPath(); ctx.ellipse(x, y, radius * (1 + layer * .11), radius * (.55 + layer * .05), 0, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      presence.forEach((value, i) => {
        if (value <= 0) return;
        const guest = guests[i], ease = 1 - Math.pow(1 - value, 3);
        ctx.save(); ctx.globalAlpha = value;
        ctx.translate(guest.x + guest.side * 190 * (1 - ease), guest.y);
        const bob = reducedMotion ? 0 : Math.sin(time * 1.5 + i) * 1.5;
        ctx.translate(0, bob); ctx.rotate(i === 0 ? .12 : i === 1 ? -.12 : 0);
        const line = (points, color, width) => {
          ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(points[0], points[1]);
          for (let j = 2; j < points.length; j += 2) ctx.lineTo(points[j], points[j + 1]);
          ctx.stroke();
        };
        line([-7,31,-9,48,-16,48], '#514c42', 7);
        line([7,31,10,48,17,48], '#514c42', 7);
        ctx.fillStyle = guest.shirt; ctx.beginPath(); ctx.roundRect(-15, 2, 30, 34, [10,10,5,5]); ctx.fill();
        guest.pose.forEach(arm => { line(arm, guest.shirt, 7); line(arm.slice(2), '#dfb993', 4); });
        ctx.fillStyle = guest.hair; ctx.beginPath(); ctx.ellipse(0,-16,15,17,0,0,Math.PI*2); ctx.fill();
        if (i === 2) { ctx.beginPath(); ctx.ellipse(-14,-7,7,16,-.2,0,Math.PI*2); ctx.fill(); }
        ctx.fillStyle = '#edc9a5'; ctx.beginPath(); ctx.ellipse(0,-12,12,13,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = guest.hair; ctx.beginPath(); ctx.ellipse(-3,-25,12,6,-.2,0,Math.PI*2); ctx.fill();
        // Closed eyes and a small smile suggest enjoying the fragrance.
        line([-8,-12,-5,-10,-2,-12], '#514237', 1.2);
        line([3,-12,6,-10,9,-12], '#514237', 1.2);
        line([-3,-4,0,-2,3,-4], '#95694e', 1.2);
        ctx.fillStyle = '#235347'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(dialogue[i], 0, -40);
        ctx.restore();
      });
      ctx.restore();
    },
  };
}
