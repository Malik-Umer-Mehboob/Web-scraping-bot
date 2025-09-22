import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { load } from "cheerio";
import { autoScroll } from "../../../utils/autoScroll";

export async function POST(req: NextRequest) {
  try {
    const { targetUrl, cookies, scrollUntilNoNewContent } = await req.json();

    if (!targetUrl) return NextResponse.json({ error: "Target URL is required" }, { status: 400 });
    if (!cookies || !Array.isArray(cookies)) return NextResponse.json({ error: "Cookies must be an array" }, { status: 400 });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();

    // Add cookies dynamically
    await context.addCookies(cookies);

    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle" });

    if (scrollUntilNoNewContent) {
      await autoScroll(page);
    }

    const content = await page.content();
    await browser.close();

    const $ = load(content);

    // Extract visible text
    const ignoredTags = new Set(["script", "style", "meta", "noscript", "head", "svg", "canvas"]);
    const visibleText: string[] = [];

    $("body *").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (ignoredTags.has(tag)) return;

      const directText = $(el)
        .contents()
        .filter((_, node) => node.type === "text")
        .text()
        .trim()
        .replace(/\s+/g, " ");

      if (directText) visibleText.push(directText);
    });

    return NextResponse.json({ text: visibleText });
  } catch (err: unknown) {
    console.error("Scraping Error:", err);
    let detail = "Unknown error";
    if (err instanceof Error) {
      detail = err.message;
    }
    return NextResponse.json({ error: "Scraping failed", detail: detail }, { status: 500 });
  }
}

