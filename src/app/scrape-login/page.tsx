"use client";

import { useState } from "react";

export default function ScrapeWithCookies() {
  const [targetUrl, setTargetUrl] = useState("");
  const [cookiesJson, setCookiesJson] = useState(""); // Paste JSON from browser
  const [loading, setLoading] = useState(false);
  const [pageText, setPageText] = useState("");
  const [error, setError] = useState("");

  async function handleScrape() {
    setLoading(true);
    setPageText("");
    setError("");

    try {
      const res = await fetch("/api/scrape-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUrl,
          cookies: JSON.parse(cookiesJson),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      setPageText(data.text.join("\n"));
    } catch (err: unknown) {
      console.error("Scraping failed", err);
      let errorMessage = "An unknown error occurred.";
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#1F2937]">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white shadow-lg rounded-xl p-8 mb-8">
            <h1 className="text-3xl font-bold mb-6 text-center text-[#1F2937]">
              Scrape behind a login
            </h1>
            <p className="text-center text-gray-500 mb-8">
              Provide a target URL and cookies to scrape pages that require authentication.
            </p>
            <div className="space-y-6">
              <input
                type="url"
                placeholder="Target URL"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              <textarea
                placeholder='Paste cookies JSON here, e.g. [{"name":"_gh_sess","value":"abc123","domain":".github.com","path":"/"}]'
                value={cookiesJson}
                onChange={(e) => setCookiesJson(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 border border-[#E5E7EB] rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
              />
              <button
                onClick={handleScrape}
                disabled={loading}
                className="w-full bg-[#3B82F6] text-white px-8 py-3 rounded-lg hover:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Scraping...
                  </div>
                ) : (
                  "Scrape Text"
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-[#FEE2E2] border border-[#F87171] text-[#B91C1C] px-4 py-3 rounded-xl relative mb-6" role="alert">
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          {pageText && (
            <div className="bg-white shadow-lg rounded-xl p-8">
              <h2 className="text-2xl font-bold mb-6 text-[#1F2937]">Scraped Page Text</h2>
              <pre className="text-sm bg-[#F9FAFB] p-6 rounded-lg border border-[#E5E7EB] overflow-auto whitespace-pre-wrap">{pageText}</pre>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
