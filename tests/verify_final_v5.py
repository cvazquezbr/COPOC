
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle")

    print(f"Page Title: {page.title()}")
    print("Page Content Snippet:")
    print(page.content()[:1000])

    # Try to find the button by its heading text
    button = page.locator('button').filter(has_text="Gestão de Avaliações")
    if button.count() > 0:
        print("Found Gestão de Avaliações button")
        button.click()
    else:
        print("COULD NOT FIND Gestão de Avaliações button. Printing all buttons:")
        buttons = page.locator('button').all()
        for i, b in enumerate(buttons):
            print(f"Button {i}: {b.inner_text()}")

        # Fallback: maybe it's just text
        page.get_by_text("Gestão de Avaliações").click()

    page.wait_for_timeout(2000)

    # ... rest of the verification ...
    if page.get_by_text("Status do Sistema").is_visible():
        print("FAIL: Status do Sistema is still visible")
    else:
        print("SUCCESS: Status do Sistema is removed")

    if page.get_by_label("Individual").is_visible() or page.get_by_label("Agrupado").is_visible():
         print("FAIL: Mode radio buttons are still visible")
    else:
         print("SUCCESS: Mode radio buttons are removed")

    page.screenshot(path="/home/jules/verification/screenshots/verification_final_v2.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
