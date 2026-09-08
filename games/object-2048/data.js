export const SIZE = 4;
export const tileInfo = Object.freeze({
  2:{name:'향기 방울'},4:{name:'핑크 크리스탈'},8:{name:'그린 크리스탈'},16:{name:'화이트 크리스탈'},
  32:{name:'볼케닉 스톤'},64:{name:'크리스탈 한 줌'},128:{name:'볼케닉 한 줌'},256:{name:'미니 퍼퓸 오브제'},
  512:{name:'크리스탈 오브제'},1024:{name:'볼케닉 오브제'},2048:{name:'결이든 시그니처 세트'},
});
export const emptyBoard = () => Array(SIZE * SIZE).fill(0);
export function addRandom(board, random=Math.random) {
  const empty=board.map((value,index)=>value?null:index).filter(index=>index!==null);
  if(!empty.length)return [...board];
  const next=[...board],index=empty[Math.floor(random()*empty.length)];next[index]=random()<.9?2:4;return next;
}
export function newGame(random=Math.random){return addRandom(addRandom(emptyBoard(),random),random);}
function collapse(line){
  const values=line.map((value,offset)=>({value,offset})).filter(item=>item.value),next=[],merged=[],transitions=[];let score=0;
  for(let i=0;i<values.length;i++){
    const target=next.length;
    if(values[i].value===values[i+1]?.value){const value=values[i].value*2;next.push(value);merged.push(target);transitions.push({from:[values[i].offset,values[i+1].offset],to:target});score+=value;i++;}
    else{next.push(values[i].value);transitions.push({from:[values[i].offset],to:target});}
  }
  while(next.length<SIZE)next.push(0);return{line:next,score,merged,transitions};
}
const indexAt=(line,offset,direction)=>direction==='left'?line*SIZE+offset:direction==='right'?line*SIZE+(SIZE-1-offset):direction==='up'?offset*SIZE+line:(SIZE-1-offset)*SIZE+line;
export function move(board,direction){
  const next=[...board],mergedIndexes=[],transitions=[];let score=0;
  for(let line=0;line<SIZE;line++){
    const source=Array.from({length:SIZE},(_,offset)=>board[indexAt(line,offset,direction)]),result=collapse(source);score+=result.score;
    result.line.forEach((value,offset)=>{const index=indexAt(line,offset,direction);next[index]=value;if(result.merged.includes(offset))mergedIndexes.push(index);});
    result.transitions.forEach(item=>transitions.push({from:item.from.map(offset=>indexAt(line,offset,direction)),to:indexAt(line,item.to,direction)}));
  }
  return{board:next,score,moved:next.some((value,index)=>value!==board[index]),merged:mergedIndexes,transitions};
}
export function canMove(board){if(board.includes(0))return true;return ['left','right','up','down'].some(direction=>move(board,direction).moved);}
export const highestTile=board=>Math.max(...board);
