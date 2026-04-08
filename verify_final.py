import asyncio
from playwright.async_api import async_playwright
import json
import os

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

        await context.add_cookies([{
            "name": "token",
            "value": "fake-jwt-token",
            "domain": "localhost",
            "path": "/"
        }])

        page = await context.new_page()
        await page.route("**/*", handle_route)

        try:
            await page.goto("http://localhost:5173/evaluations", timeout=60000)
            await page.wait_for_selector("text=Gestão de Avaliações", timeout=10000)

            # 1. Verify no Radio buttons for mode selection
            radios = await page.query_selector_all('input[type="radio"]')
            print(f"Radio buttons found: {len(radios)}")

            # 2. Verify 'Extrair Transcrição' button exists
            # It might not be visible if the page hasn't finished rendering or if it's hidden.
            # Let's use a more general selector.
            extract_btn = page.locator("button:has-text('Extrair Transcrição')")
            exists = await extract_btn.count() > 0
            visible = await extract_btn.is_visible() if exists else False
            print(f"Extrair Transcrição button exists: {exists}, visible: {visible}")

            # 3. Verify System Status panel is gone
            system_status = page.locator("text=Status do Sistema")
            ss_visible = await system_status.is_visible()
            print(f"System Status visible: {ss_visible}")

            # 4. Verify Briefing sorting
            # Click to open
            briefing_select = page.locator("label:has-text('Selecionar Briefing') + div")
            if await briefing_select.count() > 0:
                await briefing_select.click()
                await page.wait_for_timeout(1000)

                options = page.locator("li[role='option']")
                count = await options.count()
                texts = []
                for i in range(count):
                    texts.append(await options.nth(i).inner_text())

                # Filter out 'Nenhum'
                briefing_names = [t.strip() for t in texts if t.strip() and t.strip() != 'Nenhum']
                print(f"Briefing options found: {briefing_names}")

                sorted_names = sorted(briefing_names)
                is_sorted = briefing_names == sorted_names
                print(f"Briefings are sorted alphabetically: {is_sorted}")
            else:
                print("Briefing select not found")

            await page.screenshot(path="final_verification.png", full_page=True)

        except Exception as e:
            print(f"Error during verification: {e}")
            await page.screenshot(path="error_verification.png", full_page=True)
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
