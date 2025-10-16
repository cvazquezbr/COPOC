from playwright.sync_api import sync_playwright, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        base_url="http://localhost:5173",
        color_scheme="dark",
    )
    page = context.new_page()

    try:
        # 1. Sign up a new user
        page.goto("/signup")
        page.get_by_label("Nome Completo").fill("Test User")
        page.get_by_label("Endereço de Email").fill("test@example.com")
        page.get_by_role("button", name="Cadastrar").click()

        # Wait for navigation to the login page
        page.wait_for_url("**/login", timeout=10000)

        # 2. Login with the new user
        page.get_by_label("Endereço de Email").fill("test@example.com")
        page.get_by_role("button", name="Enviar Código de Acesso").click()

        # Wait for the OTP field to appear
        otp_input = page.get_by_label("Código de Acesso")
        expect(otp_input).to_be_visible()
        otp_input.fill("123456")

        page.get_by_role("button", name="Login").click()
        expect(page).to_have_url("/", timeout=10000)

        # 3. Navigate to template page
        page.goto("/briefing-template")

        # 3. Wait for the page to load and expand the first accordion
        expect(page.get_by_text("Editor de Modelo de Briefing")).to_be_visible()
        page.locator(".MuiAccordionSummary-root").first.click()

        # 4. Take a screenshot
        page.screenshot(path="jules-scratch/verification/dark_mode_fix.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)