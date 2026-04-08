
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate directly to the evaluations page
    page.goto("http://localhost:5173/avaliacoes")
    page.wait_for_timeout(2000)

    print(f"Page URL: {page.url}")
    print(f"Page Title: {page.title()}")

    # Check for "Gestão de Avaliações" heading
    heading = page.locator('h4').filter(has_text="Gestão de Avaliações")
    if heading.count() > 0:
        print("SUCCESS: Evaluations page reached")
    else:
        print("FAIL: Evaluations page heading not found")
        # Check if we were redirected to login
        if "login" in page.url:
            print("Redirected to LOGIN. Need to bypass auth.")

    # 1. Verify "Status do Sistema" is NOT there
    if page.get_by_text("Status do Sistema").is_visible():
        print("FAIL: Status do Sistema is still visible")
    else:
        print("SUCCESS: Status do Sistema is removed")

    # 2. Verify radio buttons for mode are NOT there
    if page.get_by_label("Individual").is_visible() or page.get_by_label("Agrupado").is_visible():
         print("FAIL: Mode radio buttons are still visible")
    else:
         print("SUCCESS: Mode radio buttons are removed")

    # 3. Check "Extrair Transcrição" button
    btn = page.locator('button').filter(has_text="Extrair Transcrição")
    if btn.is_visible():
        print("SUCCESS: 'Extrair Transcrição' button is visible")
    else:
        print("FAIL: 'Extrair Transcrição' button NOT visible")

    page.screenshot(path="/home/jules/verification/screenshots/verification_final_v3.png")

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
