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
        await context.add_cookies([{"name": "token", "value": "fake", "domain": "localhost", "path": "/"}])
        page = await context.new_page()
        await page.route("**/*", handle_route)

        await page.goto("http://localhost:5173/evaluations")
        await page.wait_for_timeout(3000)

        # 1. No radio buttons
        radios = await page.query_selector_all('input[type="radio"]')
        print(f"Radio buttons: {len(radios)}")

        # 2. No System Status
        ss = await page.get_by_text("Status do Sistema").is_visible()
        print(f"System Status visible: {ss}")

        # 3. Check for "Extrair Transcrição" button - search by text anywhere
        btn = page.get_by_text("Extrair Transcrição")
        print(f"Extrair Transcrição visible: {await btn.is_visible()}")

        # 4. Check for Briefing select and sort
        # Open select
        await page.click("text=Selecionar Briefing")
        await page.wait_for_timeout(1000)
        options = await page.query_selector_all('li[role="option"]')
        texts = []
        for opt in options:
            t = await opt.inner_text()
            if t.strip() and t.strip() != 'Nenhum':
                texts.append(t.strip())
        print(f"Briefings: {texts}")

        await page.screenshot(path="final_check.png", full_page=True)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
