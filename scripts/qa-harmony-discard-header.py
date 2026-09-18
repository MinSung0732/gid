import json, os, shutil, sys, time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
binary = shutil.which("google-chrome") or shutil.which("google-chrome-stable") or shutil.which("chromium")
if binary:
    options.binary_location = binary

driver = webdriver.Chrome(options=options)
try:
    driver.set_window_size(1600, 900)
    driver.get("http://127.0.0.1:5173/games/harmony/qa-discard-card-header.html")
    deadline = time.time() + 20
    result = None
    while time.time() < deadline:
        result = driver.execute_script("return window.__discardHeaderQa || null")
        if result:
            break
        time.sleep(0.1)
    if not result:
        print("DISCARD_HEADER_QA_RESULT_MISSING", file=sys.stderr)
        sys.exit(2)
    print("DISCARD_HEADER_QA_RESULT=" + json.dumps(result, ensure_ascii=False))
    assert result["pass"] is True, result
    checks = result["checks"]
    required = [
        "allDiscardText",
        "sameActionLeft",
        "sameActionWidth",
        "sameActionHeight",
        "sameMetaRight",
        "sameTopHeight",
        "sameBodyStart",
        "noActionMetaOverlap",
        "noActionNextOverlap",
        "noHorizontalOverflow",
        "nextPresent",
        "baseT1",
        "baseT2",
        "middleT1",
        "middleT3",
        "middleT4",
        "disabledKeepsSameLabelAndSize",
        "brickColor",
        "fixedSize",
    ]
    assert all(checks[name] for name in required), result
finally:
    driver.quit()
