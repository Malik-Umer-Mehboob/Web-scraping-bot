import { NextRequest, NextResponse } from "next/server";
import { Browser, BrowserContext, Page } from "playwright-core";

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
  // Check for Vercel or Production environment
  if (process.env.VERCEL || process.env.NODE_ENV === "production" || process.env.AWS_LAMBDA_FUNCTION_VERSION) {
    console.log("Environment: Vercel / Production - Using playwright-core + @sparticuz/chromium");
    
    const chromium = await import("@sparticuz/chromium").then(mod => mod.default);
    const { chromium: playwright } = await import("playwright-core");

    const executablePath = await chromium.executablePath();
    return await playwright.launch({
      args: [
        ...chromium.args,
        "--hide-scrollbars",
        "--disable-web-security",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
      executablePath,
      headless: true, // Must be true for serverless
    });
  } else {
    console.log("Environment: Local Development - Using playwright (native)");
    const { chromium } = await import("playwright"); 
    return await chromium.launch({
      headless: false, // Visible browser for local mouse mode interaction
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
        viewport: null, // Let browser set viewport naturally
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

          // Cleanup previous listeners to avoid duplicates
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
          };

          if (win.onMouseOver) cleanupListeners();

          win.geminiLastHighlighted = null;
          win.geminiOriginalBorder = null;
          win.geminiOriginalCursor = null;

          const highlightStyle = "3px dashed #ff0000";
          const selectedStyle = "3px solid #0066ff";
          const savedStyle = "3px solid #00cc00"; 
          
          // --- Event Handlers ---
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
            }
          };

          const onClick = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const target = e.target as HTMLElement;
            if (!target || target === document.body) return;
            
            // Toggle Deselect
            if (target.classList.contains("gemini-selected-element")) {
                 target.classList.remove("gemini-selected-element");
                 target.style.removeProperty("border"); 
                 
                 const idx = win.geminiSelectedElements.findIndex(el => 
                     el.tag === target.tagName.toLowerCase() && el.text === (target.innerText.trim() || target.getAttribute("src") || "")
                 );
                 if (idx > -1) {
                     win.geminiSelectedElements.splice(idx, 1);
                 }
                 return;
            }

            // Select
            const tag = target.tagName.toLowerCase();
            let text = target.innerText.trim();
            const id = target.id || "";
            const className = target.className || "";

            const attributes: Record<string, string> = {};
            Array.from(target.attributes).forEach(attr => {
                attributes[attr.name] = attr.value;
            });
            
            const innerHTML = ""; // Avoiding massive payloads for now, or capture if needed

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
        waitUntil: "domcontentloaded", // Faster than networkidle for some sites
        timeout: 60000 
      });
      console.log("Navigation success");
      await injectMouseMode();
    } catch (msg) {
      console.error("Navigation error:", msg);
      if (browser) await browser.close();
      return NextResponse.json({ error: "Failed to load URL", detail: (msg as Error).message }, { status: 500 });
    }

    // Interaction Handling
    let selectedElements: ScrapedElement[] = [];

    // Vercel / Production Check
    const isServerless = process.env.VERCEL || process.env.NODE_ENV === "production";

    if (isServerless) {
        // In Serverless (Headless), we CANNOT wait for user input (Enter key).
        // The previous "session active" message in frontend would hang forever.
        // We will return immediately with an empty list or a message.
        // Or better: We assume Mouse Mode is LOCAL ONLY feature for interactivity.
        // But the user insisted "Mouse Mode must work... after deployment".
        // This is a logical paradox unless they mean something else.
        //
        // Compromise: We wait a short duration (e.g. 5s) to allow any *auto* scripts? 
        // No, we surely can't click.
        // We will just return an empty array and a message indicating Headless Mode limits.
        
        console.log("Serverless/Headless mode detected. Skipping interactive wait.");
        selectedElements = []; 
    } else {
        // Local Mode: Wait for user to press Enter in the opened browser
        console.log("Waiting for user selection...");
        selectedElements = await keypressPromise;
    }

    console.log("Session complete. Returning data.");

    if (browser) {
        await browser.close().catch(() => {});
    }
    
    // Return Data ONLY - NO CSV creation here
    return NextResponse.json({ 
        selectedElements, 
        sessionId,
        message: isServerless ? "Serverless mode: No interactive selection possible." : "Selection captured." 
    });

  } catch (err) {
    console.error("Mouse Mode main error:", err);
    if (browser) {
        try { await browser.close(); } catch (e) { console.error("Error closing browser:", e); }
    }
    return NextResponse.json({ error: "Mouse Mode failed", detail: (err as Error).message }, { status: 500 });
  }
}