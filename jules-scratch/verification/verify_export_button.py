from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Arrange: Go to the homepage
        page.goto("http://localhost:5173/")

        # Wait for the main layout to load by looking for a known element
        expect(page.locator('header')).to_be_visible(timeout=60000)

        # 2. Act: Navigate to the Briefing Wizard
        page.get_by_role("button", name="Novo Briefing").click()

        page.get_by_role("button", name="Próximo").click()

        # On the review step, click the "Revisar com IA" button
        # We need to handle the loading state here.
        expect(page.get_by_role("button", name="Revisar com IA")).to_be_enabled(timeout=20000)
        page.get_by_role("button", name="Revisar com IA").click()

        # Wait for the revision to complete and the "Próximo" button to be enabled again
        expect(page.get_by_role("button", name="Próximo")).to_be_enabled(timeout=60000)
        page.get_by_role("button", name="Próximo").click()

        # 3. Assert: Verify we are on the finalization step and the "DOs & DON'Ts" tab is present
        expect(page.get_by_text("Finalização")).to_be_visible()

        # Click on the "DOs & DON'Ts" tab
        page.get_by_role("tab", name="DOs & DON'Ts").click()

        # Check if the export button is visible
        export_button = page.get_by_role("button", name="Exportar como PNG")
        expect(export_button).to_be_visible()

        # 4. Screenshot: Capture the final result for visual verification.
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)