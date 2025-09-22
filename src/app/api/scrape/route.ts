import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";
import { load } from "cheerio";
import { autoScroll } from "../../../utils/autoScroll";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116 Safari/537.36",
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 🔹 isBlocked check hata diya (403 issue avoid karne ke liye)

    await autoScroll(page);

    const content = await page.content();
    await browser.close();

    const $ = load(content);

    const ignoredTags = new Set([
      "script",
      "style",
      "meta",
      "noscript",
      "head",
      "svg",
      "canvas",
    ]);

    const dataByTag: Record<string, string[]> = {};

    $("body *").each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (ignoredTags.has(tag)) return;

      let value = "";
      if (["link"].includes(tag)) {
        value = $(el).attr("href") || "";
      } else if (["iframe", "img", "video", "audio", "source"].includes(tag)) {
        value = $(el).attr("src") || "";
      } else {
        value = $(el)
          .contents()
          .filter((_, node) => node.type === "text")
          .text()
          .trim()
          .replace(/\s+/g, " ");
      }

      if (!value) return;

      if (!dataByTag[tag]) dataByTag[tag] = [];
      dataByTag[tag].push(value);
    });

    // Build CSV multi-row
    const tags = Object.keys(dataByTag);
    const maxRows = Math.max(...Object.values(dataByTag).map((arr) => arr.length));

    // CSV headers
    const headers: string[] = tags;
    const csvRows: string[][] = [];
    csvRows.push(headers);

    // Build each row
    for (let i = 0; i < maxRows; i++) {
      const row: string[] = [];
      tags.forEach((tag) => {
        row.push(dataByTag[tag][i] || "");
      });
      csvRows.push(row);
    }

    const csv = csvRows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // Flatten JSON for UI
    const jsonForUI: string[] = [];
    Object.values(dataByTag).forEach((arr) => jsonForUI.push(...arr));

    return NextResponse.json({ jsonByTag: dataByTag, jsonForUI, csv });
  } catch (err: unknown) {
    console.error("Scraping Error:", err);
    let detail = "Unknown error";
    if (err instanceof Error) {
      detail = err.stack || err.message;
    }
    return NextResponse.json(
      { error: "Scraping failed", detail: detail },
      { status: 500 }
    );
  }
}
