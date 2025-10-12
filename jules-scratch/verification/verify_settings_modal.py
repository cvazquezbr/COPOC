from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Mock the /api/auth/me endpoint
        page.route(
            "**/api/auth/me",
            lambda route: route.fulfill(
                status=200,
                json={"id": 1, "name": "Test User", "email": "test@example.com"},
            ),
        )

        # Mock the /api/settings endpoint
        page.route(
            "**/api/user/settings",
            lambda route: route.fulfill(
                status=200,
                json={},
            ),
        )

        page.goto("http://localhost:5173")

        # Open the settings modal
        page.get_by_label("Settings").click()

        # Wait for the modal to be visible
        page.wait_for_selector("text=API Gemini")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)