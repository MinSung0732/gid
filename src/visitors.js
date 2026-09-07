// Elbows remain below shoulders; hands gesture toward the object or chest.
export const poses = [
  {name:'손 모으기',arms:[[-13,9,-17,24,-2,20],[13,9,17,24,2,20]],tilt:0},
  {name:'가슴에 손',arms:[[-13,9,-18,25,-14,32],[13,9,17,20,-2,10]],tilt:.08},
  {name:'턱 괴기',arms:[[-13,9,-17,26,5,24],[13,9,16,19,4,-2]],tilt:.12},
  {name:'두 손 하트',arms:[[-13,9,-16,19,-2,10],[13,9,16,19,2,10]],tilt:0},
  {name:'수줍게',arms:[[-13,9,-11,31,-1,33],[13,9,11,31,1,33]],tilt:.1},
  {name:'손바닥 소개',arms:[[-13,9,-17,27,-12,32],[13,9,22,22,30,18]],tilt:.06},
  {name:'향 음미',arms:[[-13,9,-18,23,-8,27],[13,9,17,17,6,-5]],tilt:.12},
  {name:'작은 박수',arms:[[-13,9,-16,22,-2,15],[13,9,16,22,2,16]],tilt:-.06},
  {name:'편안한 쉼',arms:[[-13,9,-18,24,-17,34],[13,9,18,24,17,34]],tilt:.04},
  {name:'팔짱 감상',arms:[[-13,9,-15,23,9,19],[13,9,15,26,-8,22]],tilt:-.08},
  {name:'볼에 손',arms:[[-13,9,-17,25,-8,30],[13,9,18,18,10,-7]],tilt:.14},
  {name:'고개 끄덕',arms:[[-13,9,-13,28,-7,32],[13,9,16,27,7,30]],tilt:-.1},
];
export const expressions = ['smile','delighted','curious','wink','peaceful','grin','blush','wonder'];
const shirts=['#8EB69B','#e8c77a','#d9b1bd','#9bbdc9','#b9b399','#b6a2c5','#d6b188','#a9bda0','#d1a49d','#9fb4c5'];
export function makeVisitor(index, seed) {
  return {pose:poses[(index+seed)%poses.length],expression:expressions[(index+seed)%expressions.length],hair:['#514237','#333331','#765743','#80766a'][(index+seed)%4],hairStyle:(index+seed)%5,skin:['#edc9a5','#d7a17a','#b9825f','#f3d8bf'][(index+seed)%4],shirt:shirts[(index+seed)%shirts.length],glasses:(index+seed)%4===0};
}
export function drawVisitor(ctx, guest, facing) {
  const line=(p,c,w)=>{ctx.strokeStyle=c;ctx.lineWidth=w;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)ctx.lineTo(p[i],p[i+1]);ctx.stroke();};
  const oval=(x,y,rx,ry,c)=>{ctx.fillStyle=c;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
  ctx.save();ctx.scale(facing,1);ctx.rotate(guest.pose.tilt);
  line([-7,31,-9,48,-16,48],'#514c42',7);line([7,31,10,48,17,48],'#514c42',7);
  ctx.fillStyle=guest.shirt;ctx.beginPath();ctx.roundRect(-15,2,30,34,[10,10,5,5]);ctx.fill();
  guest.pose.arms.forEach(arm=>{line(arm,guest.shirt,7);line(arm.slice(2),guest.skin,4);});
  oval(0,-16,15,17,guest.hair);
  if(guest.hairStyle===1)oval(-13,-4,7,17,guest.hair);
  if(guest.hairStyle===2)oval(0,-33,8,7,guest.hair);
  if(guest.hairStyle===3)for(let i=0;i<5;i++)oval(-12+i*6,-27+(i%2)*2,5,6,guest.hair);
  oval(0,-12,12,13,guest.skin);oval(-3,-25,12,6,guest.hair);
  if(guest.hairStyle===4)line([-12,-22,12,-22],'#F8E29A',3);
  const e=guest.expression;
  if(['curious','grin','wonder'].includes(e)){oval(-5,-12,1.8,e==='wonder'?3:2.3,'#514237');oval(6,-12,1.8,e==='wonder'?3:2.3,'#514237');}
  else {line([-8,-12,-5,e==='delighted'?-14:-10,-2,-12],'#514237',1.2);if(e==='wink')oval(6,-12,1.8,2.2,'#514237');else line([3,-12,6,e==='delighted'?-14:-10,9,-12],'#514237',1.2);}
  if(e==='wonder')oval(0,-3,2,3,'#95694e');
  else if(['grin','delighted'].includes(e)){oval(0,-3,4,3,'#95694e');line([-3,-4,3,-4],'#fff5e9',1.5);}
  else line([-3,-4,0,e==='peaceful'?-3:-2,3,-4],'#95694e',1.2);
  if(['blush','delighted','wink'].includes(e)){oval(-9,-6,3,1.8,'#d99b90');oval(9,-6,3,1.8,'#d99b90');}
  if(guest.glasses){ctx.strokeStyle='#756a56';ctx.lineWidth=.8;for(const x of [-5,6]){ctx.beginPath();ctx.ellipse(x,-12,4,4,0,0,Math.PI*2);ctx.stroke();}line([-1,-12,2,-12],'#756a56',1);}
  ctx.restore();
}
