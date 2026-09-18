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
        assert events.index("monster-death") < max(i for i, event in enumerate(events) if event == "save")

        driver.get(
            "http://127.0.0.1:5173/games/harmony/qa-feedback-regressions.html"
        )
        deadline = time.time() + 30
        full_result = None
        while time.time() < deadline:
            full_result = driver.execute_script(
                "return window.__fullQaResult || null"
            )
            if full_result:
                break
            time.sleep(0.1)
        if not full_result:
            print("FULL_QA_RESULT_MISSING", file=sys.stderr)
            sys.exit(3)
        print(
            "FULL_QA_RESULT="
            + json.dumps(full_result, ensure_ascii=False)
        )
        assert full_result["pass"] is True, full_result
        assert all(item["pass"] for item in full_result["results"]), full_result

        driver.get(
            "http://127.0.0.1:5173/games/harmony/qa-production-dot-victory.html"
        )
        deadline = time.time() + 30
        production_result = None
        while time.time() < deadline:
            production_result = driver.execute_script(
                "return window.__productionDotQaResult || null"
            )
            if production_result:
                break
            time.sleep(0.1)
        if not production_result:
            print("PRODUCTION_DOT_QA_RESULT_MISSING", file=sys.stderr)
            sys.exit(4)
        print(
            "PRODUCTION_DOT_QA_RESULT="
            + json.dumps(production_result, ensure_ascii=False)
        )

        seeded = production_result["seeded"]
        pre = production_result["preEnd"]
        final = production_result["final"]
        visible = production_result["visibleSample"]

        assert seeded["phase"] == "battle", production_result
        assert seeded["hp"] == 1, production_result
        assert seeded["enemyHp"] == 1, production_result
        assert seeded["enemyPoison"] == 1, production_result
        assert seeded["playerPoison"] == 1, production_result
        assert seeded["inventoryHasBattleEndHeal"] is True, production_result
        assert seeded["inventoryHasQaSurvivalTrait"] is True, production_result

        assert pre["battleExists"] is True, production_result
        assert pre["anchorExists"] is True, production_result
        assert pre["anchorConnected"] is True, production_result
        assert "health-stat" in pre["anchorClassName"], production_result
        assert pre["savedPhase"] == "battle", production_result
        assert pre["enemyHp"] == 1, production_result
        assert pre["enemyPoison"] == 1, production_result
        assert pre["playerPoison"] == 1, production_result
        assert pre["playerHp"] == 1, production_result

        round_resources = production_result["roundResources"]
        assert round_resources, production_result
        assert round_resources["healing"] == 2, production_result
        assert round_resources["waitForPresentation"] is True, production_result

        assert production_result["monsterDyingSeen"] is True, production_result
        assert production_result["deathBursts"] == 1, production_result
        assert production_result["monsterDeathSfxCount"] == 1, production_result
        assert production_result["healingNodes"] == 1, production_result
        assert production_result["healSfxCount"] == 1, production_result

        microtask = production_result["healingMicrotask"]
        first_raf = production_result["healingFirstRaf"]
        assert microtask and microtask["connected"] is True, production_result
        assert microtask["anchorConnected"] is True, production_result
        assert microtask["text"] == "+2", production_result
        assert first_raf and first_raf["connected"] is True, production_result
        assert first_raf["anchorConnected"] is True, production_result
        assert first_raf["text"] == "+2", production_result
        assert first_raf["rewardExists"] is False, production_result

        assert visible, production_result
        assert visible["text"] == "+2", production_result
        assert visible["connected"] is True, production_result
        assert visible["opacity"] > 0, production_result
        assert "healing-number" in visible["animationName"], production_result
        assert visible["width"] > 0 and visible["height"] > 0, production_result
        assert visible["battleExists"] is True, production_result
        assert visible["rewardExists"] is False, production_result

        assert production_result["monsterDyingAt"] < production_result["healingAddedAt"], production_result
        assert production_result["deathBurstAt"] < production_result["healingAddedAt"], production_result
        assert production_result["healingAddedAt"] < production_result["rewardAt"], production_result
        assert production_result["rewardAt"] - production_result["healingAddedAt"] >= 700, production_result
        assert production_result["healingRemovedAt"] <= production_result["rewardAt"], production_result

        dot_kill_log = next(
            (
                entry
                for entry in final["finalLog"]
                if seeded["enemyName"] in entry
                and "중독" in entry
                and "체력 1→0" in entry
            ),
            None,
        )
        assert dot_kill_log, production_result

        assert final["savedPhase"] == "reward", production_result
        assert final["enemyHp"] == 0, production_result
        assert final["playerHp"] > 0, production_result
        assert final["battleExists"] is False, production_result
        assert final["rewardExists"] is True, production_result
        assert final["healingDomCount"] == 0, production_result
        assert final["removedHealingUnique"] == 1, production_result
        assert final["elapsedEndToReward"] < 8000, production_result
finally:
    driver.quit()
