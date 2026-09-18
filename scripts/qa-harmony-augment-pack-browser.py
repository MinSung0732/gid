import json
import shutil
import sys
import time

from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--window-size=1600,1200")
options.set_capability("goog:loggingPrefs", {"browser": "ALL"})
binary = (
    shutil.which("google-chrome")
    or shutil.which("google-chrome-stable")
    or shutil.which("chromium")
)
if binary:
    options.binary_location = binary

driver = webdriver.Chrome(options=options)
try:
    driver.get("http://127.0.0.1:5173/games/harmony/qa-augment-pack-smoke.html")
    deadline = time.time() + 35
    result = None
    while time.time() < deadline:
        result = driver.execute_script("return window.__augmentPackBrowserSmoke || null")
        if result:
            break
        time.sleep(0.1)
    if not result:
        print("AUGMENT_BROWSER_SMOKE_RESULT_MISSING", file=sys.stderr)
        sys.exit(2)
    print("AUGMENT_BROWSER_SMOKE_RESULT=" + json.dumps(result, ensure_ascii=False, sort_keys=True))
    required = [
        "newCardCompact","newCardUpgrade","newCardDetail","temporaryApUi","temporaryApRuntime",
        "phaseLensUi","phaseLensRuntime","effectiveImpurityUi","effectiveImpurityRuntime",
        "discardAction","discardEffect","drawAction","drawEffect","zeroApTurn","zeroApFeedback",
        "spectralPlay","spectralHit","combatNotFrozen","labAcquireAction","labAcquireInventoryDiscovery",
        "mercuryAcquireAction","mercuryAcquireInventoryDiscovery","codexCard","codexItem","codexAcquisition",
        "saveAction","saveLoad","noNaN","noUndefined","noStuckDialog","noWindowErrors",
    ]
    checks = result.get("checks", {})
    missing = [name for name in required if checks.get(name) is not True]
    if result.get("pass") is not True or missing:
        raise AssertionError({"result": result, "missing_or_failed": missing})
    severe = []
    for entry in driver.get_log("browser"):
        if entry.get("level") == "SEVERE":
            message = entry.get("message", "")
            if "favicon" not in message.lower():
                severe.append(message)
    print("AUGMENT_BROWSER_CONSOLE_SEVERE=" + json.dumps(severe, ensure_ascii=False))
    if severe:
        raise AssertionError({"severe_console": severe})
finally:
    driver.quit()
