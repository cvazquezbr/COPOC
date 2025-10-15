import re
import os
from playwright.sync_api import Page, expect

def test_briefing_creation(page: Page):
    print("Starting verification script...")
    # 1. Arrange: Go to the application's homepage.
    page.goto("http://localhost:5173")
    print("Navigated to homepage.")

    # 2. Act: Click the "Novo Briefing" button to open the wizard.
    # Wait for the template to load by checking if the button is enabled.
    new_briefing_button = page.get_by_role("button", name="Novo Briefing")
    expect(new_briefing_button).to_be_enabled(timeout=30000)  # Increase timeout for template loading
    new_briefing_button.click()
    print("Clicked 'Novo Briefing' button.")

    # 3. Assert: Check that the wizard is open and the base text is correctly formatted.
    # We expect the "Edição" step to be active.
    expect(page.get_by_text("Edição")).to_be_visible()
    print("Wizard is open.")

    # Check for the presence of an H3 tag for a known block title.
    # This verifies that the HTML structure is being generated.
    expect(page.locator("h3", has_text="Contexto")).to_be_visible()
    print("H3 tag with 'Contexto' is visible.")

    page.pause()

    # 4. Screenshot: Capture the initial state of the wizard for visual verification.
    screenshot_dir = "jules-scratch/verification"
    screenshot_path = os.path.join(screenshot_dir, "verification.png")
    print(f"Attempting to save screenshot to: {screenshot_path}")
    try:
        os.makedirs(screenshot_dir, exist_ok=True)
        page.screenshot(path=screenshot_path)
        print("Screenshot saved successfully.")
    except Exception as e:
        print(f"Error saving screenshot: {e}")