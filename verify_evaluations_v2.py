
import asyncio
from playwright.async_api import async_playwright
import jwt
import time

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a mobile-like viewport to see everything clearly if needed, or standard
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})

        page = await context.new_page()

        # Mock the /api/auth/me endpoint to bypass DB check
        await page.route("**/api/auth/me", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"id": 1, "name": "Test User", "email": "test@example.com", "gemini_api_key": "fake-key"}'
        ))

        # Mock briefings endpoint
        await page.route("**/api/briefings", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='[{"id": "1", "name": "Z Briefing"}, {"id": "2", "name": "A Briefing"}]'
        ))

        # Set the cookie
        token = jwt.encode(
            {"sub": "user-uuid", "userId": 1, "email": "test@example.com", "name": "Test User"},
            "a-secure-default-secret-for-development",
            algorithm="HS256"
        )
        await context.add_cookies([{
            'name': 'auth_token',
            'value': token,
            'domain': 'localhost',
            'path': '/',
        }])

        print("Navigating to Evaluations page...")
        await page.goto("http://localhost:5173/evaluations")

        # Wait for content
        try:
            await page.wait_for_selector("h4:has-text('Gestão de Avaliações')", timeout=5000)
            print("Successfully reached Evaluations page.")
        except:
            print("FAILURE: Could not reach Evaluations page or heading not found.")
            print("Current URL:", page.url)
            await page.screenshot(path="debug_evaluations_fail.png")
            await browser.close()
            return

        # Check for removed elements
        radio = await page.query_selector("input[type='radio']")
        if radio:
            print("FAILURE: Radio buttons (Processing Mode) still present.")
        else:
            print("SUCCESS: Processing Mode radio buttons removed.")

        # Check for removed system status
        status_panel = await page.query_selector("text=Status do Sistema")
        if status_panel:
            print("FAILURE: System Status panel still present.")
        else:
            print("SUCCESS: System Status panel removed.")

        # Check button text
        btn = await page.query_selector("button:has-text('Extrair Transcrição')")
        if btn:
            print("SUCCESS: Button text updated to 'Extrair Transcrição'.")
        else:
            print("FAILURE: Button 'Extrair Transcrição' not found.")

        # Check alphabetical sorting of briefings
        await page.click("label:has-text('Selecionar Briefing') + div") # Open select
        items = await page.query_selector_all("li.MuiMenuItem-root")
        item_texts = [await item.inner_text() for item in items if await item.inner_text() != 'Nenhum']
        print(f"Briefing items: {item_texts}")
        if item_texts == sorted(item_texts):
            print("SUCCESS: Briefings are sorted alphabetically.")
        else:
            print("FAILURE: Briefings are NOT sorted alphabetically.")

        await page.screenshot(path="evaluations_verified.png")
        print("Verification complete. Screenshot saved as evaluations_verified.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
