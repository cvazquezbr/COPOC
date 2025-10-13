from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context()
    page = context.new_page()

    # Navigate to the briefing templates page
    page.goto("http://localhost:5173/briefing-template")

    # Wait for the page to load and take a screenshot
    expect(page.get_by_text("Editor de Modelo de Briefing")).to_be_visible()
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)