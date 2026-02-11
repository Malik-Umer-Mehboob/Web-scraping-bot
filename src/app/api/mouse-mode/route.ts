import { NextRequest, NextResponse } from "next/server";
import { Browser, BrowserContext, Page } from "playwright-core";
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Force Node.js runtime (Vercel serverless functions)
export const runtime = "nodejs";

// Extended data structure for selected elements
interface ScrapedElement {
  text: string;
  tag: string;
  id: string;
  className: string;
  attributes: Record<string, string>;
  innerHTML: string;
}

// Extend Window interface for custom properties in the browser context
interface CustomWindow extends Window {
  geminiLastHighlighted: HTMLElement | null;
  geminiOriginalBorder: string | null;
  geminiOriginalCursor: string | null;
  geminiSelectedElements: ScrapedElement[];
  onMouseOver?: (e: MouseEvent) => void;
  onMouseOut?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  sendSelectedData: (elements: ScrapedElement[]) => void;
  setKeypressHandled: () => void;
}

/**
 * Reusable function to launch the browser based on the environment.
 */
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    console.log("Environment: Vercel / Production - Using playwright-core + @sparticuz/chromium");
    
    const chromium = await import("@sparticuz/chromium").then(mod => mod.default);
    const { chromium: playwright } = await import("playwright-core");

    const executablePath = await chromium.executablePath();
    return await playwright.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-web-security",
      ],
      executablePath,
      headless: true,
    });
  } else {
    console.log("Environment: Local Development - Using playwright (native)");
    const { chromium } = await import("playwright");
    return await chromium.launch({
      headless: false,
      args: ["--no-sandbox"],
    });
  }
}

// Helper to normalize URLs
function normalizeUrl(url: string, baseUrl?: string): string {
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/") && baseUrl) {
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      console.error("Failed to construct absolute URL:", e);
      return url; 
    }
  }
  return url;
}

// Advanced CSV generator for rich data
function jsonToCsv(jsonData: ScrapedElement[]): string {
  if (!jsonData || jsonData.length === 0) return "";
  
  // Define columns manually to ensure order and handling of complex objects
  const columns: (keyof ScrapedElement)[] = ["tag", "text", "id", "className", "attributes", "innerHTML"];
  
  const header = columns.join(',');
  const rows = jsonData.map(row => {
    return columns.map(key => {
      let value = row[key];
      
      if (key === 'attributes' && typeof value === 'object') {
        // Convert attributes object to a string representation
        value = JSON.stringify(value).replace(/"/g, '""'); 
      } else if (typeof value === 'string') {
        value = value.replace(/"/g, '""').replace(/\n/g, ' '); // Clean newlines
      }
      
      return `"${value}"`;
    }).join(',');
  });
  
  return [header, ...rows].join('\n');
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;

  try {
    let body;
    try {
      body = await req.json();
    } catch {
       return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    
    let { url } = body;
    if (!url) return NextResponse.json({ error: "URL is required" }, { status: 400 });

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `https://${url}`;
    }

    try {
      browser = await launchBrowser();
    } catch (launchError) {
      console.error("Failed to launch browser:", launchError);
      return NextResponse.json({ error: "Browser launch failed", detail: (launchError as Error).message }, { status: 500 });
    }

    try {
      context = await browser.newContext({
        viewport: null,
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36",
      });
      page = await context.newPage();
    } catch (contextError) {
      console.error("Failed to create page context:", contextError);
      if (browser) await browser.close();
      return NextResponse.json({ error: "Browser context creation failed", detail: (contextError as Error).message }, { status: 500 });
    }

    const sessionId = Date.now().toString();
    
    let resolveKeypressPromise: (value: ScrapedElement[]) => void;
    
    const keypressPromise = new Promise<ScrapedElement[]>((resolve) => {
      resolveKeypressPromise = resolve;
    });

    await page.exposeFunction("sendSelectedData", async (elements: ScrapedElement[]) => {
      console.log(`Received ${elements.length} elements from client.`);
      resolveKeypressPromise(elements);
    });

    await page.exposeFunction("setKeypressHandled", () => {
      console.log("Keypress handled in browser.");
    });

    const injectMouseMode = async () => {
      if (!page || page.isClosed()) return;
      
      try {
        await page.evaluate(() => {
          const win = window as unknown as CustomWindow;

          if (!win.geminiSelectedElements) {
             win.geminiSelectedElements = [];
          }

          const cleanupListeners = () => {
            if (win.onMouseOver) document.removeEventListener("mouseover", win.onMouseOver);
            if (win.onMouseOut) document.removeEventListener("mouseout", win.onMouseOut);
            if (win.onClick) document.removeEventListener("click", win.onClick);
            if (win.onKeyDown) document.removeEventListener("keydown", win.onKeyDown);
          };

          const fullCleanup = () => {
             cleanupListeners();
             document.querySelectorAll(".gemini-selected-element").forEach(el => {
              (el as HTMLElement).style.removeProperty("border");
              el.classList.remove("gemini-selected-element");
            });

            if (win.geminiLastHighlighted) {
              if (win.geminiOriginalBorder) win.geminiLastHighlighted.style.border = win.geminiOriginalBorder;
              else win.geminiLastHighlighted.style.removeProperty("border");

              if (win.geminiOriginalCursor) win.geminiLastHighlighted.style.cursor = win.geminiOriginalCursor;
              else win.geminiLastHighlighted.style.removeProperty("cursor");
            }

            win.geminiLastHighlighted = null;
            win.geminiOriginalBorder = null;
            win.geminiOriginalCursor = null;
            win.onMouseOver = undefined;
            win.onMouseOut = undefined;
            win.onClick = undefined;
            win.onKeyDown = undefined;
          };

          if (win.onMouseOver) cleanupListeners();

          win.geminiLastHighlighted = null;
          win.geminiOriginalBorder = null;
          win.geminiOriginalCursor = null;

          const highlightStyle = "3px dashed #ff0000";
          const selectedStyle = "3px solid #0066ff";
          const savedStyle = "3px solid #00cc00"; 

          const onMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target || target === document.body || target.classList.contains("gemini-selected-element")) return;

            if (win.geminiLastHighlighted && win.geminiLastHighlighted !== target) {
              if (win.geminiOriginalBorder) win.geminiLastHighlighted.style.border = win.geminiOriginalBorder;
              else win.geminiLastHighlighted.style.removeProperty("border");

              if (win.geminiOriginalCursor) win.geminiLastHighlighted.style.cursor = win.geminiOriginalCursor;
              else win.geminiLastHighlighted.style.removeProperty("cursor");
            }

            win.geminiLastHighlighted = target;
            win.geminiOriginalBorder = target.style.border;
            win.geminiOriginalCursor = target.style.cursor;
            target.style.border = highlightStyle;
            target.style.cursor = "crosshair";
          };

          const onMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target === win.geminiLastHighlighted && !target.classList.contains("gemini-selected-element")) {
              if (win.geminiOriginalBorder) target.style.border = win.geminiOriginalBorder;
              else target.style.removeProperty("border");

              if (win.geminiOriginalCursor) target.style.cursor = win.geminiOriginalCursor;
              else target.style.removeProperty("cursor");

              win.geminiLastHighlighted = null;
              win.geminiOriginalBorder = null;
              win.geminiOriginalCursor = null;
            }
          };

          const onClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target as HTMLElement;
            if (!target || target === document.body) return;
            
            if (target.classList.contains("gemini-selected-element")) {
                 target.classList.remove("gemini-selected-element");
                 target.style.removeProperty("border"); 
                 
                 const idx = win.geminiSelectedElements.findIndex(el => 
                     el.tag === target.tagName.toLowerCase() && el.text === (target.innerText.trim() || target.getAttribute("src") || target.getAttribute("href") || "")
                 );
                 if (idx > -1) {
                     win.geminiSelectedElements.splice(idx, 1);
                 }
                 return;
            }

            const tag = target.tagName.toLowerCase();
            let text = target.innerText.trim();
            const id = target.id || "";
            const className = target.className || "";

            // Capture attributes
            const attributes: Record<string, string> = {};
            Array.from(target.attributes).forEach(attr => {
                attributes[attr.name] = attr.value;
            });

            // Capture innerHTML (be careful with size)
            const innerHTML = target.innerHTML;

            if (tag === "img") {
              text = target.getAttribute("src") || "";
            } else if (tag === "a") {
              text = target.getAttribute("href") || text;
            }

            target.style.border = selectedStyle;
            target.classList.add("gemini-selected-element");

            if (win.geminiLastHighlighted === target) {
              win.geminiLastHighlighted = null;
              win.geminiOriginalBorder = null;
              win.geminiOriginalCursor = null;
            }

            win.geminiSelectedElements.push({ text, tag, id, className, attributes, innerHTML });
          };

          const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              cleanupListeners();
              
              const selected = document.querySelectorAll(".gemini-selected-element");
              selected.forEach(el => {
                (el as HTMLElement).style.border = savedStyle;
              });
              
              win.sendSelectedData(win.geminiSelectedElements);
              win.setKeypressHandled();
            } else if (e.key === "Escape") {
               fullCleanup();
               win.sendSelectedData([]); 
               win.setKeypressHandled();
            }
          };

          win.onMouseOver = onMouseOver;
          win.onMouseOut = onMouseOut;
          win.onClick = onClick;
          win.onKeyDown = onKeyDown;

          document.addEventListener("mouseover", onMouseOver);
          document.addEventListener("mouseout", onMouseOut);
          document.addEventListener("click", onClick);
          document.addEventListener("keydown", onKeyDown);
        });
      } catch (evaluateError) {
        console.error("Error evaluating script:", evaluateError);
      }
    };

    try {
      console.log(`Navigating to ${url}...`);
      const normalizedNavUrl = normalizeUrl(url); 
      
      await page.goto(normalizedNavUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000 
      });
      console.log("Navigation success");
      await injectMouseMode();
    } catch (msg) {
      console.error("Navigation error:", msg);
      if (browser) await browser.close();
      return NextResponse.json({ error: "Failed to load URL", detail: (msg as Error).message }, { status: 500 });
    }

    page.on("framenavigated", async (frame) => {
      if (!page || page.isClosed()) return;
      if (frame !== page.mainFrame()) return;
      const frameUrl = frame.url();
      if (frameUrl.includes("about:blank") || frameUrl.startsWith("file://")) return;
      try {
        await page.waitForLoadState("domcontentloaded");
        await injectMouseMode();
      } catch (err) {
        console.error(`Error injection on nav to ${frameUrl}:`, err);
      }
    });

    const selectedElements = await keypressPromise;
    console.log("Session complete. Processing data...");

    let csvPath = "";
    if (selectedElements.length > 0) {
        const csvContent = jsonToCsv(selectedElements);
        const tempDir = os.tmpdir();
        const fileName = `mouse-mode-results-${sessionId}.csv`;
        csvPath = path.join(tempDir, fileName);
        
        try {
            fs.writeFileSync(csvPath, csvContent);
        } catch (fileErr) {
            console.error("Failed to write CSV file:", fileErr);
        }

        if (!process.env.VERCEL) {
             try {
                const localPath = path.join(process.cwd(), fileName);
                fs.writeFileSync(localPath, csvContent);
            } catch (ignored) {}
        }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    if (browser) {
        const pages = context?.pages() || [];
        await Promise.all(pages.map(p => p.close().catch(() => {})));
        await context?.close().catch(() => {});
        await browser.close().catch(() => {});
    }
    
    return NextResponse.json({ selectedElements, sessionId, csvPath });

  } catch (err) {
    console.error("Mouse Mode main error:", err);
    if (browser) {
        try { await browser.close(); } catch (e) { console.error("Error closing browser:", e); }
    }
    return NextResponse.json({ error: "Mouse Mode failed", detail: (err as Error).message }, { status: 500 });
  }
}