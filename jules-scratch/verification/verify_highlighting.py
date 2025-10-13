import re
from playwright.sync_api import Page, expect

def test_template_highlighting(page: Page):
    """
    This test verifies that the "EXATAMENTE nesta ordem:" rule and the
    subsequent list are highlighted correctly on the briefing template page.
    """
    # 1. Arrange: Go to the briefing template page.
    page.goto("http://localhost:5179/briefing-template")

    # 2. Assert: Check for the highlighted elements.
    # The "EXATAMENTE nesta ordem:" text should be in a span with a yellow background.
    order_rule_locator = page.locator("span", has_text=re.compile(r"EXATAMENTE nesta ordem:", re.IGNORECASE))
    expect(order_rule_locator).to_have_css("background-color", "rgb(255, 255, 0)")
    expect(order_rule_locator).to_have_css("font-weight", "700")

    # The list of blocks following the rule should be in a span with a light green background.
    list_locator = page.locator("span", has_text=re.compile(r"Título da Missão", re.IGNORECASE))
    expect(list_locator).to_have_css("background-color", "rgb(144, 238, 144)")

    # 3. Screenshot: Capture the final result for visual verification.
    page.screenshot(path="jules-scratch/verification/verification.png")