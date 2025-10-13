import json
import time
from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173", wait_until="networkidle")
        page.wait_for_selector("body")

        # Create user data and serialize it to a valid JSON string
        user_data = {
            "uid": "test-user-id",
            "email": "test@example.com",
            "emailVerified": True,
            "stsTokenManager": {
                "refreshToken": "test-refresh-token",
                "accessToken": "test-access-token",
                "expirationTime": int(time.time() * 1000 + 3600000)
            }
        }
        user_data_json = json.dumps(user_data)

        # Pass the JSON string to localStorage
        page.evaluate(f"localStorage.setItem('user', '{user_data_json}')")

        page.reload(wait_until="networkidle")

        try:
            # Attempt to find and click the settings button
            # Based on MUI standards, an icon button with a label is a good bet.
            settings_button = page.get_by_role("button", name="open settings")
            expect(settings_button).to_be_visible(timeout=5000)
            settings_button.click()

            # Wait for the dialog/modal to appear
            modal_content = page.locator('div[role="dialog"]')
            expect(modal_content).to_be_visible()

            # Screenshot the modal specifically
            modal_content.screenshot(path="jules-scratch/verification/verification.png")
            print("Successfully took screenshot of the settings modal.")

        except Exception as e:
            print(f"Could not open settings modal, taking screenshot of main page. Error: {e}")
            page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)