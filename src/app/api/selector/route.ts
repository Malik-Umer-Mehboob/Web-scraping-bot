import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { z } from "zod";
import Papa from "papaparse";
import { autoScroll } from "../../../utils/autoScroll";
import { chromium } from "playwright";


const bodySchema = z.object({
  url: z.string().url(),
  selector: z.string().min(1, "CSS selector is required"),
  dynamic: z.boolean().optional().default(true), // Always use dynamic for this route
  attributes: z.array(z.string()).optional().default(["href", "src", "title", "alt"]),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

function sanitizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "_") // non-word -> _
    .replace(/^_+|_+$/g, ""); // trim underscores
}

async function getHtmlWithFetch(url: string) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
      "Accept-Language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Fetch failed with status ${res.status}`);
  return await res.text();
}

async function getHtmlWithPlaywright(url: string) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    await autoScroll(page);

    const html = await page.content();
    return html;
  } finally {
    await browser.close();
  }
}

function extract($: cheerio.CheerioAPI, selector: string, attributes: string[]) {
  const records: Record<string, string>[] = [];

  $(selector).each((_, el) => {
    if (el.type === 'tag') { // Type guard for Element
      const node = $(el);

      const base: Record<string, string> = {
        tag_name: node.prop('tagName')?.toLowerCase() ?? "node",
        text_content: node.text().trim(),
      };

      for (const attr of attributes) {
        const val = node.attr(attr) ?? "";
        base[attr] = val;
      }

      const dataAttrs = Object.keys(el.attribs || {}).filter(a => a.startsWith("data-"));
      for (const da of dataAttrs) {
        if (!(da in base)) base[da] = node.attr(da) ?? "";
      }

      const sanitized: Record<string, string> = {};
      for (const [k, v] of Object.entries(base)) {
        sanitized[sanitizeKey(k)] = (v ?? "").toString().trim();
      }

      records.push(sanitized);
    }
  });

  return records;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { url, selector, dynamic, attributes, format } = bodySchema.parse(json);

    const html = dynamic
      ? await getHtmlWithPlaywright(url)
      : await getHtmlWithFetch(url);
    const $ = cheerio.load(html);

    const rows = extract($, selector, attributes);

    if (rows.length === 0) {
      return NextResponse.json({ message: "No matches found", count: 0, rows: [] }, { status: 200 });
    }

    if (format === "csv") {
      const allCols = Array.from(
        rows.reduce((set, row) => {
          Object.keys(row).forEach(k => set.add(k));
          return set;
        }, new Set<string>())
      );

      const csv = Papa.unparse(rows, { columns: allCols });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="selector_mode_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { message: "OK", count: rows.length, rows },
      { status: 200 }
    );
  } catch (err: unknown) {
    console.error(err);
    let errorMessage = "Unknown error";
    if (err instanceof Error) {
      errorMessage = err.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 400 });
  }
}

