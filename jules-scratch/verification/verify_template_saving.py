
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    page = browser.new_page()
    page.goto("http://localhost:5173/template")

    # Wait for the main content to load
    page.wait_for_selector('text="Editor de Modelo de Briefing"')

    # Click on the general rules to open the editor
    page.click('text="Clique para definir as regras gerais e a ordem dos blocos..."')

    # Type something in the editor to trigger a change
    page.locator('.ql-editor').fill("adding a new line to trigger save")

    # Wait for the "Salvando..." chip to appear
    page.wait_for_selector('text="Salvando..."')

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/verification.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
