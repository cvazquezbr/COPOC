from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Verify briefing wizard
    page.goto("http://localhost:5173/briefings")
    page.wait_for_timeout(5000) # 5 seconds
    page.get_by_role("button", name="+ Novo").click()
    page.screenshot(path="jules-scratch/verification/briefing_wizard.png")

    # Verify AI setup on mobile
    page.goto("http://localhost:5173/settings")
    page.set_viewport_size({"width": 375, "height": 667})
    page.wait_for_load_state("networkidle")
    page.screenshot(path="jules-scratch/verification/ai_setup_mobile.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)