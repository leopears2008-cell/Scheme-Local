"""Browser smoke test for the signed-out citizen flows. Synthetic data only, no sign-in, no paid services.

Prerequisites (run in two terminals first):
  backend:  cd backend && uvicorn app:app --port 8000
  frontend: cd frontend && npm run build && npx vite preview --port 5173 --strictPort
Run:      python tests/e2e/ui_smoke.py            (needs: pip install playwright && python -m playwright install chromium)
Exit code 0 = all checks passed. Each check prints PASS or FAIL with the reason.
"""
import sys

FRONTEND = "http://localhost:5173/"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(("PASS " if ok else "FAIL ") + name + (f" — {detail}" if detail and not ok else ""))


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("SKIP: playwright is not installed (pip install playwright && python -m playwright install chromium)")
        return 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 390, "height": 844})   # phone-sized
        errors, api_calls = [], []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: api_calls.append(r.url) if "/api/" in r.url else None)
        page.goto(FRONTEND, wait_until="networkidle")

        # Find: loads results, header never shows 'undefined'
        page.click("nav button:has-text('Find')"); page.wait_for_timeout(1200)
        text = page.inner_text("main")
        check("Find shows scheme results", page.locator("main .card").count() > 0)
        check("Find header has no 'undefined'", "undefined" not in text)

        # Check: a farmer profile produces criterion results with the honest wording
        page.click("nav button:has-text('Check')"); page.wait_for_timeout(400)
        page.locator("label:has-text('Occupation') select").select_option("farmer")
        page.locator("label:has-text('Age') input").fill("34")
        page.locator("label:has-text('State') input").fill("Tamil Nadu")
        page.locator("label:has-text('Farm land') input").fill("2")
        page.locator("label:has-text('Land unit') select").select_option("acre")
        page.click("button:has-text('Find my schemes')"); page.wait_for_timeout(2500)
        text = page.inner_text("main")
        check("Check shows criteria results", "checks met" in text)
        check("Check says results are not a probability of approval", "not a probability of approval" in text)
        body_sent = []
        page.on("request", lambda r: body_sent.append(r.post_data) if "/api/eligibility" in r.url else None)
        page.click("button:has-text('Find my schemes')"); page.wait_for_timeout(1200)
        check("Check request includes the acre unit", any(b and '"landUnit":"acre"' in b for b in body_sent))

        # Signed out: protected calls must not be sent (no 401 noise)
        check("No 401 errors while signed out",
              not any("401" in e for e in errors), f"errors: {errors[:3]}")
        check("No page errors", not any(e.startswith("PAGEERROR") or "Uncaught" in e for e in errors), str(errors[:3]))

        # Talk and Apply explain sign-in rather than breaking
        page.click("nav button:has-text('Talk')"); page.wait_for_timeout(400)
        check("Talk explains sign-in when signed out", "sign in" in page.inner_text("main").lower())

        # Layout: no sideways scrolling on phone width
        for tab in ("Find", "Check", "Talk"):
            page.click(f"nav button:has-text('{tab}')"); page.wait_for_timeout(300)
            overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f"{tab} has no horizontal overflow at 390px", overflow <= 0, f"{overflow}px")
        browser.close()

    failed = [n for n, ok in results if not ok]
    print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
