import { chromium } from "playwright";
const assert=(v,m)=>{if(!v)throw new Error(m)};
const browser=await chromium.launch({headless:true});
try{
  for(const viewport of [{width:1440,height:900},{width:1366,height:768}]){
    const context=await browser.newContext({viewport});
    const page=await context.newPage();
    const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));
    await page.goto("http://127.0.0.1:5173/games/harmony/",{waitUntil:"domcontentloaded"});
    await page.locator('[data-action="new"]').click();
    await page.locator("#starting-deck-builder").waitFor({state:"visible"});
    await page.locator('[data-builder-action="preset"]').click();
    await page.locator("#builder-start").click();
    await page.locator(".player-core-stats").waitFor({state:"visible"});
    const state=await page.evaluate(()=>{
      const rows=[...document.querySelectorAll(".player-core-stat")];
      const row=rows.find(r=>r.querySelector(":scope > span")?.textContent?.trim()==="덱 한도");
      const label=row?.querySelector(":scope > span");
      const value=row?.querySelector(":scope > b");
      return {
        labels:rows.map(r=>r.querySelector(":scope > span")?.textContent?.trim()),
        exists:Boolean(row),
        value:value?.textContent?.trim()||"",
        clipped:label ? label.scrollWidth>label.clientWidth+1 : true,
        fontSize:label ? getComputedStyle(label).fontSize : "",
        title:row?.dataset.playerHelpTitle||"",
        overflow:document.documentElement.scrollWidth-window.innerWidth,
      };
    });
    assert(state.exists,"덱 한도 row missing");
    assert(!state.clipped,"덱 한도 label clipped");
    assert(state.fontSize==="12px","덱 한도 should use normal 12px stat label size: "+state.fontSize);
    assert(state.title==="덱 한도","tooltip title mismatch");
    assert(/^\d+ \/ \d+장$/.test(state.value),"deck limit value format mismatch: "+state.value);
    assert(state.labels.includes("손패 한도"),"hand limit regressed");
    assert(state.overflow<=2,"horizontal overflow");
    assert(errors.length===0,"page errors: "+errors.join(" | "));
    console.log(JSON.stringify({viewport,state}));
    await context.close();
  }
} finally { await browser.close(); }