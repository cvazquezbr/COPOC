from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Log in
        page.goto("http://localhost:5173/login")
        page.wait_for_load_state()
        page.get_by_label("Endereço de Email").fill("test@example.com")
        page.get_by_role("button", name="Enviar Código OTP").click()

        # Wait for OTP field and fill it
        otp_input = page.get_by_label("Código OTP")
        expect(otp_input).to_be_visible()
        otp_input.fill("123456") # Assuming a test OTP

        page.get_by_role("button", name="Verificar OTP").click()
        expect(page).to_have_url("http://localhost:5173/briefings", timeout=10000)

        # Open the briefing wizard
        page.get_by_role("button", name="Novo Briefing").click()
        page.get_by_role("button", name="Usar Texto").click()
        expect(page.get_by_role("heading", name="Novo Briefing (Texto)")).to_be_visible()

        # Fill in some data and move to the review step
        page.locator(".tiptap").fill("This is a test briefing.")
        page.get_by_role("button", name="Próximo").click()

        # Click the revise button
        page.get_by_role("button", name="Revisar com IA").click()

        # Wait for the revision to complete
        expect(page.get_by_role("heading", name="Briefing Revisado (Editável)")).to_be_visible()

        # Verify the new buttons are visible
        expect(page.get_by_role("button", name="Exportar para Word")).to_be_visible()
        expect(page.get_by_role("button", name="Edição Focada")).to_be_visible()

        # Open the save modal
        page.get_by_role("button", name="Salvar Briefing").click()
        expect(page.get_by_role("heading", name="Salvar Novo Briefing")).to_be_visible()

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)