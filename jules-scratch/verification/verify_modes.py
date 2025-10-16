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

        otp_input = page.get_by_label("Código OTP")
        expect(otp_input).to_be_visible()
        otp_input.fill("123456")

        page.get_by_role("button", name="Verificar OTP").click()
        expect(page).to_have_url("http://localhost:5173/briefings", timeout=10000)

        # Test "Texto" mode
        page.get_by_role("button", name="Novo Briefing").click()
        page.get_by_role("button", name="Usar Texto").click()
        expect(page.get_by_role("heading", name="Novo Briefing (Texto)")).to_be_visible()

        page.locator(".tiptap").fill("This is a test briefing.")
        page.get_by_role("button", name="Próximo").click()
        page.get_by_role("button", name_contains="Revisar com IA").click()
        expect(page.get_by_role("heading", name="Briefing Revisado (Editável)")).to_be_visible()
        page.get_by_role("button", name="Próximo").click()
        expect(page.get_by_role("heading", name="Finalização")).to_be_visible()

        page.get_by_role("button", name="Salvar Briefing").click()
        expect(page.get_by_role("heading", name="Salvar Novo Briefing")).to_be_visible()
        page.get_by_label("Nome do Briefing").fill("Test Briefing - Texto")
        page.get_by_role("button", name="Salvar").click()
        expect(page.get_by_text("Test Briefing - Texto")).to_be_visible()


        # Test "Seções" mode
        page.get_by_role("button", name="Novo Briefing").click()
        page.get_by_role("button", name="Usar Seções").click()
        expect(page.get_by_role("heading", name="Novo Briefing (Seções)")).to_be_visible()

        page.get_by_role("button", name="Próximo").click()
        page.get_by_role("button", name_contains="Revisar com IA").click()
        expect(page.get_by_role("heading", name="Briefing Revisado (Editável)")).to_be_visible()
        page.get_by_role("button", name="Próximo").click()
        expect(page.get_by_role("heading", name="Finalização")).to_be_visible()

        page.get_by_role("button", name="Salvar Briefing").click()
        expect(page.get_by_role("heading", name="Salvar Novo Briefing")).to_be_visible()
        page.get_by_label("Nome do Briefing").fill("Test Briefing - Seções")

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")

        page.get_by_role("button", name="Salvar").click()
        expect(page.get_by_text("Test Briefing - Seções")).to_be_visible()

    finally:
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)