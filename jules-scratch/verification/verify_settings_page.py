from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()
    page.goto("http://localhost:5173")
    page.wait_for_timeout(5000) # 5 seconds
    page.get_by_label("Settings").click()
    page.screenshot(path="jules-scratch/verification/settings_page.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)