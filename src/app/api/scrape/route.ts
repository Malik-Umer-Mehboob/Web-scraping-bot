import { NextRequest, NextResponse } from "next/server";
import chromium from "@sparticuz/chromium";
import { chromium as playwright } from "playwright-core";

import { autoScroll } from "../../../utils/autoScroll";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let browser;
    
    // Check if running on Vercel or in production environment
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      // Configuration for Vercel / AWS Lambda
      browser = await playwright.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: true,
      });
    } else {
      // Local development configuration
      // Uses locally installed Chrome to avoid need for full playwright binary download
      browser = await playwright.launch({
        channel: 'chrome',
        headless: true
      });
    }

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116 Safari/537.36",
    });
    const page = await context.newPage();
    
    // Allow more time for heavy pages
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }); // Reduced timeout slightly to fit within 60s maxDuration if needed, but keeping high for safety

    await autoScroll(page);

    // Evaluate in browser context to check visibility and computed styles
    const scrapedData = await page.evaluate(() => {
      const ignoredTags = new Set([
        "SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG", "CANVAS", 
        "META", "LINK", "HEAD", "NAV", "FOOTER", "HEADER", "BUTTON", "INPUT", "SELECT", "TEXTAREA"
      ]);

      const ignoredKeywords = new Set([
        "LOGIN", "SIGNUP", "SIGN IN", "REGISTER", "CART", "CHECKOUT", "MENU", 
        "SHOP MEN", "SHOP WOMEN", "ACCOUNT", "PROFILE", "WISHLIST", "SEARCH"
      ]);

      const createUniqueSet = new Set<string>();
      const structuredData: Record<string, string[]> = {};

      // Prioritize main content containers
      const selectors = ["main", "#content", ".product-grid", ".product-card", ".review", "article", "body"];
      let rootElement = document.body;
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          rootElement = el as HTMLElement;
          break;
        }
      }

      function traverse(node: Node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const tagName = element.tagName;

          if (ignoredTags.has(tagName)) return;

          // Check visibility
          const style = window.getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

          // Handle specific tags with attributes
          if (tagName === 'IMG') {
             const src = (element as HTMLImageElement).src;
             if (src && !createUniqueSet.has(src)) {
                createUniqueSet.add(src);
                if (!structuredData['img']) structuredData['img'] = [];
                structuredData['img'].push(src);
             }
             return;
          }
           if (tagName === 'A') {
             const href = (element as HTMLAnchorElement).href;
               if (href && !href.startsWith('javascript:') && !createUniqueSet.has(href)) {
                createUniqueSet.add(href);
                if (!structuredData['link']) structuredData['link'] = [];
                structuredData['link'].push(href);
             }
          }
        }

        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || "").trim();
          
          if (text.length >= 3 && !createUniqueSet.has(text)) {
            const upperText = text.toUpperCase();
            // Filter out navigation keywords
            if (![...ignoredKeywords].some(keyword => upperText.includes(keyword))) {
                 createUniqueSet.add(text);
                 
                 const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : 'text';
                 if (!structuredData[parentTag]) structuredData[parentTag] = [];
                 structuredData[parentTag].push(text);
            }
          }
        }

        // Recursively traverse children
        node.childNodes.forEach(child => traverse(child));
      }

      traverse(rootElement);

      return structuredData;
    });

    await browser.close();

    // Flatten JSON for UI
    const jsonForUI: string[] = [];
    Object.values(scrapedData).forEach((arr) => jsonForUI.push(...arr));

    const tags = Object.keys(scrapedData);
    const maxRows = Math.max(0, ...Object.values(scrapedData).map((arr) => arr.length));
    
    const headers = tags;
    const csvRows = [headers];

    for (let i = 0; i < maxRows; i++) {
        const row = tags.map(tag => scrapedData[tag][i] || "");
        csvRows.push(row);
    }
    
    const csv = csvRows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    return NextResponse.json({ jsonByTag: scrapedData, jsonForUI, csv });

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
