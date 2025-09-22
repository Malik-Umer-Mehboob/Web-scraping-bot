import type { Page } from "playwright";

const COMMON_LOAD_MORE_SELECTORS = [
  'button:has-text("Load More")',
  'button:has-text("Show More")',
  'a:has-text("Load More")',
  'a:has-text("Show More")',
  '[class*="load-more"]'
];

function randomDelay(min = 500, max = 2000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Automatically scrolls a page down to load all content.
 * It can handle both infinite scroll (by checking for page height changes)
 * and "load more" buttons.
 *
 * @param page The Playwright page object.
 * @param options Configuration for the scrolling behavior.
 * @param options.maxScrolls The maximum number of scrolls to prevent infinite loops.
 */
export async function autoScroll(
  page: Page,
  options: {
    maxScrolls?: number;
  } = {}
): Promise<void> {
  const {
    maxScrolls = 100,
  } = options;

  let lastHeight = await page.evaluate("document.body.scrollHeight");
  let scrolls = 0;

  while (scrolls < maxScrolls) {
    // Try to find and click a "load more" button
    let clickedButton = false;
    for (const selector of COMMON_LOAD_MORE_SELECTORS) {
      const loadMoreButton = await page.locator(selector).first();
      if (await loadMoreButton.isVisible()) {
        try {
          await page.waitForTimeout(randomDelay());
          await loadMoreButton.click({ timeout: 1000 });
          clickedButton = true;
          break; // Exit after clicking one button
        } catch (e) {
          // Button might be gone or not clickable
        }
      }
    }

    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(randomDelay());

    const newHeight = await page.evaluate("document.body.scrollHeight");
    if (newHeight === lastHeight && !clickedButton) {
      // If height hasn't changed and we didn't click a button, try one more time
      await page.waitForTimeout(randomDelay(2000, 4000));
      const finalHeight = await page.evaluate("document.body.scrollHeight");
      if (finalHeight === lastHeight) {
        break;
      }
    }
    lastHeight = newHeight;
    scrolls++;
  }
}
