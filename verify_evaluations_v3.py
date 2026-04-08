import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a larger viewport to see everything
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        page = await context.new_page()

        # Mock API responses
        async def handle_route(route):
            if "/api/auth/me" in route.request.url:
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='{"id": 1, "email": "test@example.com", "name": "Test User"}'
                )
            elif "/api/briefings" in route.request.url:
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    body='[{"id": 1, "name": "Briefing B"}, {"id": 2, "name": "Briefing A"}]'
                )
            else:
                await route.continue_()

        await page.route("**/api/**", handle_route)

        # Set the auth cookie so the frontend thinks we are logged in
        # Even though we mock /api/auth/me, some logic might check the cookie presence
        await context.add_cookies([{
            'name': 'auth_token',
            'value': 'mock-token',
            'domain': 'localhost',
            'path': '/'
        }])

        print("Navigating to dashboard...")
        await page.goto("http://localhost:5173/")
        await page.wait_for_timeout(2000)

        # Click on "Gestão de Avaliações"
        print("Clicking on Gestão de Avaliações...")
        await page.click("text=Gestão de Avaliações")
        await page.wait_for_timeout(2000)

        # Verify we are on the correct page
        heading = page.locator("h1:has-text('Gestão de Avaliações')")
        if await heading.is_visible():
            print("Successfully reached Evaluations page.")
        else:
            print(f"FAILURE: Could not reach Evaluations page. Current URL: {page.url}")
            await page.screenshot(path="debug_evaluations_v3_fail.png")
            await browser.close()
            return

        # 1. Check for absence of radio buttons for individual/grouped
        # Based on previous code, they were in a div with role="radiogroup" or similar
        radios = page.locator("input[type='radio']")
        radio_count = await radios.count()
        print(f"Number of radio buttons found: {radio_count}")
        if radio_count == 0:
            print("SUCCESS: Processing mode options removed.")
        else:
            print("FAILURE: Radio buttons still present.")

        # 2. Check for "Extrair Transcrição" button
        extract_btn = page.locator("button:has-text('Extrair Transcrição')")
        if await extract_btn.is_visible():
            print("SUCCESS: 'Extrair Transcrição' button found.")
        else:
            print("FAILURE: 'Extrair Transcrição' button not found.")
            # Check if 'Transcrever' is still there
            old_btn = page.locator("button:has-text('Transcrever')")
            if await old_btn.is_visible():
                print("FAILURE: Old 'Transcrever' button still present.")

        # 3. Check alphabetical order of briefings
        # In the mock we provided [B, A], it should be sorted to [A, B]
        briefing_options = page.locator("select >> option")
        options_count = await briefing_options.count()
        texts = []
        for i in range(options_count):
            text = await briefing_options.nth(i).inner_text()
            if text.strip() and "Selecione" not in text:
                texts.append(text.strip())

        print(f"Briefings found: {texts}")
        if texts == ["Briefing A", "Briefing B"]:
            print("SUCCESS: Briefings are sorted alphabetically.")
        else:
            print(f"FAILURE: Briefings are not sorted correctly. Expected ['Briefing A', 'Briefing B'], got {texts}")

        # 4. Check absence of "Status do Sistema"
        status_panel = page.locator("text=Status do Sistema")
        if await status_panel.is_hidden():
            print("SUCCESS: System Status panel removed.")
        else:
            print("FAILURE: System Status panel still visible.")

        await page.screenshot(path="evaluations_verification.png")
        print("Verification complete. Screenshot saved to evaluations_verification.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
