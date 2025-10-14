import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate directly to the template page to bypass login
        page.goto("http://localhost:5173/briefing-template", timeout=60000)

        # 2. Wait for the main heading to be visible, indicating the page has loaded
        heading = page.get_by_role("heading", name="Editor de Modelo de Briefing")
        expect(heading).to_be_visible(timeout=30000)

        # 3. Find the general rules editor
        general_rules_paper = page.locator("div.MuiPaper-root:has-text('Regras Gerais para a IA')").nth(1)
        expect(general_rules_paper).to_be_visible()

        # 3. Click to open the editor dialog
        general_rules_paper.click()

        # 4. Get the editor and modify the text
        editor_dialog = page.get_by_role("dialog", name="Editar Regras Gerais")
        expect(editor_dialog).to_be_visible()

        text_editor = editor_dialog.locator(".monaco-editor textarea").first
        expect(text_editor).to_be_visible()

        # Get current text
        initial_text = text_editor.input_value()

        # Define the new block and the modified text
        new_block_title = "Bloco de Teste Automatizado"
        modified_text = initial_text.replace(
            "Próximos Passos",
            f"Próximos Passos\n- {new_block_title}"
        )

        # Monaco editor needs focus and specific key presses
        text_editor.focus()
        # Select all and delete
        page.keyboard.press("Control+A")
        page.keyboard.press("Delete")
        # Type the new text
        text_editor.type(modified_text, delay=50) # Add delay to ensure typing is stable

        # 5. Close the dialog
        editor_dialog.get_by_role("button", name="Fechar").click()

        # 6. Verify the new block has appeared in the UI
        new_block_accordion = page.get_by_role("button", name=re.compile(new_block_title, re.I))

        # Scroll to the element to make sure it's in view
        new_block_accordion.scroll_into_view_if_needed()

        expect(new_block_accordion).to_be_visible(timeout=10000)

        # 7. Take a screenshot for visual confirmation
        page.screenshot(path="jules-scratch/verification/verification.png")

        print("Verification script completed successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        browser.close()

with sync_playwright() as p:
    run(p)