import { NextRequest, NextResponse } from "next/server";
import { chromium } from "playwright";

// In-memory store for session data (replace with Redis in production)
const sessionData: { [sessionId: string]: { text: string; tag: string }[] } = {};

// Extend Window interface for custom properties
interface CustomWindow extends Window {
  geminiLastHighlighted: HTMLElement | null;
  geminiOriginalBorder: string | null;
  geminiOriginalCursor: string | null;
  onMouseOver?: (e: MouseEvent) => void;
  onMouseOut?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  sendSelectedData: (elements: { text: string; tag: string }[]) => void;
  setEscapePressed: () => void;
  setEnterPressed: () => void;
}

export async function POST(req: NextRequest) {
  let browser: import("playwright").Browser | null = null;
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const validatedUrl = url.startsWith("http") ? url : `https://${url}`;
    const sessionId = Date.now().toString();
    console.log(`Attempting to launch browser and navigate to: ${validatedUrl}, sessionId: ${sessionId}`);

    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    sessionData[sessionId] = [];

    // ---
    // Expose functions for communication. This is done only once.
    // We use a promise-based approach to await for key presses.
    let resolveKeypressPromise: (value: unknown) => void;
    const keypressPromise = new Promise((resolve) => {
      resolveKeypressPromise = resolve;
    });

    await page.exposeFunction("sendSelectedData", async (elements: { text: string; tag: string }[]) => {
      console.log("Received elements:", elements);
      sessionData[sessionId] = [...sessionData[sessionId], ...elements];
      console.log("Current sessionData:", sessionData[sessionId]);
    });

    await page.exposeFunction("setKeypressHandled", () => {
      resolveKeypressPromise(null);
    });

    // ---
    // Function to inject the mouse mode script.
    // This is called initially and on navigation.
    
   // 👇 Sabse pehle interface define karo
interface CustomWindow extends Window {
  geminiLastHighlighted: HTMLElement | null;
  geminiOriginalBorder: string | null;
  geminiOriginalCursor: string | null;
  onMouseOver?: (e: MouseEvent) => void;
  onMouseOut?: (e: MouseEvent) => void;
  onClick?: (e: MouseEvent) => void;
  onKeyDown?: (e: KeyboardEvent) => void;
  sendSelectedData: (data: { text: string; tag: string }[]) => void;
  setKeypressHandled: () => void;
}

// 👇 Ab tumhara function
const injectMouseMode = async () => {
  await page.evaluate(() => {
    const win = window as unknown as CustomWindow;

    const cleanup = (preserveSelected: boolean = true) => {
      if (win.onMouseOver) document.removeEventListener("mouseover", win.onMouseOver);
      if (win.onMouseOut) document.removeEventListener("mouseout", win.onMouseOut);
      if (win.onClick) document.removeEventListener("click", win.onClick);
      if (win.onKeyDown) document.removeEventListener("keydown", win.onKeyDown);

      if (!preserveSelected) {
        document.querySelectorAll(".gemini-selected-element").forEach(el => {
          (el as HTMLElement).style.removeProperty("border");
          el.classList.remove("gemini-selected-element");
        });
      }

      if (win.geminiLastHighlighted) {
        if (win.geminiOriginalBorder)
          win.geminiLastHighlighted.style.border = win.geminiOriginalBorder;
        else win.geminiLastHighlighted.style.removeProperty("border");

        if (win.geminiOriginalCursor)
          win.geminiLastHighlighted.style.cursor = win.geminiOriginalCursor;
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

    if (win.onMouseOver) cleanup(true);

    win.geminiLastHighlighted = null;
    win.geminiOriginalBorder = null;
    win.geminiOriginalCursor = null;

    const highlightStyle = "3px dashed #ff0000";
    const selectedStyle = "3px solid #0066ff";

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
      if (!target || target === document.body || target.classList.contains("gemini-selected-element")) return;

      const tag = target.tagName.toLowerCase();
      let text = target.innerText.trim();

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

      win.sendSelectedData([{ text, tag }]);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === "Escape") {
        cleanup(false);
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

    const observer = new MutationObserver(() => {
      cleanup(true);
      win.onMouseOver = onMouseOver;
      win.onMouseOut = onMouseOut;
      win.onClick = onClick;
      win.onKeyDown = onKeyDown;

      document.addEventListener("mouseover", onMouseOver);
      document.addEventListener("mouseout", onMouseOut);
      document.addEventListener("click", onClick);
      document.addEventListener("keydown", onKeyDown);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  });
};


    // ---
    // Navigate and handle events.
    try {
      await page.goto(validatedUrl, { waitUntil: "load", timeout: 30000 });
      await injectMouseMode();
    } catch (err) {
      console.error("Navigation failed:", err);
      if (browser) await browser.close();
      return NextResponse.json({ error: "Failed to load URL", detail: (err as Error).message }, { status: 500 });
    }

    page.on("framenavigated", async (frame) => {
      const frameUrl = frame.url();
      if (frameUrl.includes("about:blank") || frameUrl.startsWith("file://")) {
        console.log(`Skipping irrelevant navigation to ${frameUrl}`);
        return;
      }

      try {
        await injectMouseMode();
      } catch (err) {
        console.error(`Error during navigation handling to ${frameUrl}:`, err);
      }
    });

    // Wait for the promise to resolve, which happens when a key is pressed.
    await keypressPromise;

    console.log("Session ended, final sessionData:", sessionData[sessionId]);
    const selectedElements = sessionData[sessionId];
    delete sessionData[sessionId];
    await browser.close();
    return NextResponse.json({ selectedElements, sessionId });

  } catch (err) {
    console.error("Mouse Mode failed:", err);
    if (browser) await browser.close();
    return NextResponse.json({ error: "Mouse Mode failed", detail: (err as Error).message }, { status: 500 });
  }
}

// ---

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId") || "default";
    const selectedElements = sessionData[sessionId] || [];
    console.log(`Returning sessionData for sessionId ${sessionId}:`, selectedElements);
    return NextResponse.json({ selectedElements });
  } catch (err) {
    console.error("Mouse Mode update failed:", err);
    return NextResponse.json({ error: "Failed to fetch updates", detail: (err as Error).message }, { status: 500 });
  }
}