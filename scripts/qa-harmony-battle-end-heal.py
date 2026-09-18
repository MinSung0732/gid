import json, os, shutil, sys, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

url = "http://127.0.0.1:5173/games/harmony/qa-battle-end-heal.html"
options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--autoplay-policy=no-user-gesture-required")
binary = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium")
if binary:
    options.binary_location = binary

driver = webdriver.Chrome(options=options)
try:
    driver.get(url)
    deadline = time.time() + 30
    result = None
    while time.time() < deadline:
        result = driver.execute_script("return window.__qaResult || null")
        if result:
            break
        time.sleep(0.1)
    if not result:
        print("QA_RESULT_MISSING", file=sys.stderr)
        sys.exit(2)
    print("QA_RESULT=" + json.dumps(result, ensure_ascii=False))
    expect_fixed = os.getenv("QA_EXPECT_FIXED", "0") == "1"
    if expect_fixed:
        before = next((x for x in result["logs"] if x["type"] == "before-heal"), None)
        after = next((x for x in result["logs"] if x["type"] == "after-append"), None)
        micro = next((x for x in result["logs"] if x["type"] == "microtask"), None)
        raf = next((x for x in result["logs"] if x["type"] == "raf"), None)
        visible = next((x for x in result["logs"] if x["type"] == "visible-sample"), None)
        reward_render = next(
            (
                x
                for x in result["logs"]
                if x["type"] == "render-after" and x.get("phase") == "reward"
            ),
            None,
        )
        assert before and before["amount"] == 2
        assert before["battleExists"] is True
        assert before["anchorExists"] is True
        assert before["anchorConnected"] is True
        assert before["anchorClassName"] == "run-hud-health-slot"
        assert after and after["exists"] is True and after["nodeConnected"] is True
        assert after["text"] == "+2"
        assert after["returnedThenable"] is True
        assert micro and micro["nodeConnected"] is True
        assert raf and raf["nodeConnected"] is True, raf
        assert visible and visible["nodeConnected"] is True, visible
        assert visible["text"] == "+2", visible
        assert visible["opacity"] > 0, visible
        assert visible["animationName"] == "healing-number", visible
        assert visible["width"] > 0 and visible["height"] > 0, visible
        assert result["addedHealingUnique"] == 1, result
        assert result["removedHealingUnique"] == 1, result
        assert result["healSfxCount"] == 1, result
        assert result["rewardVisible"] is True, result
        assert result["phase"] == "reward", result
        assert result["finalHealingCount"] == 0, result
        assert reward_render, result
        assert reward_render["at"] - before["at"] < 1600, result
        events = result["events"]
        assert "monster-death" in events
        assert events.index("monster-death") < events.index("save")
finally:
    driver.quit()
