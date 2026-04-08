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
        else:
            await route.continue_()

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        await context.add_cookies([{"name": "token", "value": "fake", "domain": "localhost", "path": "/"}])
        page = await context.new_page()
        await page.route("**/*", handle_route)

        print("Navigating...")
        await page.goto("http://localhost:5173/evaluations")
        await page.wait_for_timeout(5000)
        print("Taking screenshot...")
        await page.screenshot(path="debug_render.png", full_page=True)

        content = await page.content()
        with open("debug_content.html", "w") as f:
            f.write(content)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
