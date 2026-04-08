import asyncio
from playwright.async_api import async_playwright
import json

async def run():
    async def handle_route(route):
        url = route.request.url
        if "/api/auth/me" in url:
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps({
                    "id": 1,
                    "name": "Test User",
                    "email": "test@example.com",
                    "role": "admin"
                })
            )
        elif "/api/briefings" in url:
            await route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps([
                    {"id": 1, "name": "Zebra Briefing"},
                    {"id": 2, "name": "Alpha Briefing"},
                    {"id": 3, "name": "Mamba Briefing"}
                ])
            )
        else:
            await route.continue_()

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()

        # Set a dummy token to bypass front-end checks if any
        await context.add_cookies([{
            "name": "token",
            "value": "fake-jwt-token",
            "domain": "localhost",
            "path": "/"
        }])

        page = await context.new_page()
        await page.route("**/*", handle_route)

        # Navigate to the page
        await page.goto("http://localhost:5173/evaluations")

        # Wait for some time to ensure JS is loaded
        await page.wait_for_timeout(2000)

        # Check for radio buttons
        radios = await page.query_selector_all('input[type="radio"]')
        print(f"Radio buttons found: {len(radios)}")

        # Check for 'Extrair Transcrição' button
        # Based on the code: <button ...>Extrair Transcrição</button>
        extract_btn = await page.get_by_role("button", name="Extrair Transcrição").is_visible()
        print(f"Extrair Transcrição button visible: {extract_btn}")

        # Check for System Status panel
        system_status = await page.get_by_text("Status do Sistema").is_visible()
        print(f"System Status visible: {system_status}")

        # Check Briefing sorting
        # First click the select to open it
        await page.click("text=Selecionar Briefing")
        await page.wait_for_timeout(500)

        # In a standard HTML select, we'd look at options.
        # But this looks like a custom component (based on the screenshot 'v' arrow).
        # Let's see what's in the DOM for briefings.
        briefing_options = await page.query_selector_all('[role="option"], .briefing-option, select option')
        options_text = []
        for opt in briefing_options:
            text = await opt.inner_text()
            if text:
                options_text.append(text.strip())

        print(f"Briefing options found: {options_text}")

        await page.screenshot(path="evaluations_verification_v4.png", full_page=True)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
