import asyncio
from playwright.async_api import async_playwright, expect
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()

        # Get the token from the environment variable
        token = os.environ.get("TOKEN")
        if not token:
            raise ValueError("TOKEN environment variable not set")

        # Set the authentication cookie
        await context.add_cookies([{
            "name": "auth_token",
            "value": token,
            "url": "http://localhost:5173"
        }])

        page = await context.new_page()

        try:
            await page.goto("http://localhost:5173", timeout=60000)

            # Click the "Novo Briefing" button
            novo_briefing_button = page.get_by_role("button", name="Novo Briefing")
            await expect(novo_briefing_button).to_be_visible(timeout=60000)
            await novo_briefing_button.click()

            # Select the "Seções" creation mode
            secoes_button = page.get_by_role("button", name="Seções")
            await expect(secoes_button).to_be_visible(timeout=60000)
            await secoes_button.click()

            # Click the "Sugerir" button on an empty section
            sugerir_button = page.get_by_role("button", name="Sugerir").first
            await expect(sugerir_button).to_be_visible(timeout=60000)
            await sugerir_button.click()

            # Wait for the editor to be visible
            editor_locator = page.get_by_role("textbox")
            await expect(editor_locator).to_be_visible(timeout=60000)

            # Take a screenshot
            await page.screenshot(path="jules-scratch/verification/verification.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    # Generate the token and set it as an environment variable
    token = os.popen("node jules-scratch/verification/generate_token.cjs").read().strip()
    os.environ["TOKEN"] = token
    # Create the directory if it doesn't exist
    if not os.path.exists("jules-scratch/verification"):
        os.makedirs("jules-scratch/verification")
    asyncio.run(main())