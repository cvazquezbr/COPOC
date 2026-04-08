
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Go to home page
    page.goto("http://localhost:5173")
    page.wait_for_timeout(1000)

    # Click on Gestão de Avaliações
    page.get_by_text("Gestão de Avaliações").click()
    page.wait_for_timeout(1000)

    # 1. Verify "Status do Sistema" is NOT there
    if page.get_by_text("Status do Sistema").is_visible():
        print("FAIL: Status do Sistema is still visible")
    else:
        print("SUCCESS: Status do Sistema is removed")

    # 2. Verify radio buttons for mode are NOT there
    if page.get_by_label("Individual").is_visible() or page.get_by_label("Agrupado").is_visible():
         print("FAIL: Mode radio buttons are still visible")
    else:
         print("SUCCESS: Mode radio buttons are removed")

    # 3. Check Briefing sorting
    # Click to open the select
    page.get_by_label("Briefing").click()
    page.wait_for_timeout(500)

    # Get all options from the listbox
    options = page.locator("role=option")
    count = options.count()
    texts = []
    for i in range(count):
        texts.append(options.nth(i).inner_text())

    print(f"Briefing options: {texts}")
    sorted_texts = sorted(texts)
    if texts == sorted_texts:
        print("SUCCESS: Briefings are sorted alphabetically")
    else:
        print(f"FAIL: Briefings NOT sorted. Expected {sorted_texts}, got {texts}")

    # Select one briefing to continue
    if count > 0:
        options.nth(0).click()
    page.wait_for_timeout(500)

    # 4. Test Transcription Extraction and Naming
    # Paste some content into the textarea
    # Content format: [TRANSCRIÇÃO DE ÁUDIO]: ...
    test_content = """
    ID do Desafio: CHALLENGE123
    Transcrição: [TRANSCRIÇÃO DE ÁUDIO]: This is a test transcription.
    """
    page.get_by_placeholder("Cole aqui o conteúdo da planilha").fill(test_content)
    page.wait_for_timeout(500)

    # Click "Extrair Transcrição"
    page.get_by_role("button", name="Extrair Transcrição").click()
    page.wait_for_timeout(500)

    # Check if transcription was extracted
    # It should show up in a list or table?
    # Actually it populates the `evaluations` state.

    # Let's take a screenshot to see the state
    page.screenshot(path="/home/jules/verification/screenshots/verification_final.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
