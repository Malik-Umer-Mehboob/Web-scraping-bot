"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();
  const [url, setUrl] = useState("");
  const [data, setData] = useState<Record<string, string[]>>({});
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const handleScrape = async () => {
    if (!url) return alert("Please enter a URL");
    setLoading(true);
    setData({});
    setCsv("");
    setError("");
    setShowResults(false);

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          errorData.error || `Scraping failed with status: ${res.status}`
        );
      }
      const result = await res.json();
      setData(result.jsonByTag || {});
      setCsv(result.csv || "");
      setShowResults(true);
      setShowNotification(true);
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      }
    }

    setLoading(false);
  };

  const downloadCsv = () => {
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "scraped-data.csv";
    link.click();
  };

  // CSV preview (first 5 rows)
  const csvPreview = csv
    ? csv.split("\n").slice(0, 6) // header + first 5 rows
    : [];

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-xl font-semibold">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-800">
        <h1 className="text-4xl font-bold mb-4">Welcome to Web Scraper</h1>
        <p className="text-lg mb-8 text-center max-w-md">
          Please log in or register to access the web scraping tools.
        </p>
        <div className="flex space-x-4">
          <Link
            href="/login"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            Register
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-white text-gray-800 font-sans">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white/60 backdrop-blur-xl shadow-2xl rounded-2xl p-8 mb-10 border border-white/20">
            <h1 className="text-4xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">
              Instant Web Scraper
            </h1>
            <p className="text-center text-gray-600 mb-8 text-lg">
              Paste a URL and get the data you need in seconds.
            </p>
            <div className="relative flex flex-col sm:flex-row items-center gap-4">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.536a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
              />
              <button
                onClick={handleScrape}
                disabled={loading}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Scraping...</span>
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l-3-3m0 0l3-3m-3 3h6"
                      />
                    </svg>
                    <span>Scrape</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div
            className={`transition-all duration-500 ${
              showResults
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-10"
            }`}
          >
            {error && (
              <div
                className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-xl relative mb-6 shadow-md"
                role="alert"
              >
                <p className="font-bold">Error</p>
                <p>{error}</p>
              </div>
            )}

            {(csv || Object.keys(data).length > 0) && (
              <div className="bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl p-8 border border-white/20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                  <h2 className="text-3xl font-bold text-gray-800 mb-4 sm:mb-0">
                    Results
                  </h2>
                  {csv && (
                    <button
                      onClick={downloadCsv}
                      className="bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-all duration-300 flex items-center gap-2"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>Download CSV</span>
                    </button>
                  )}
                </div>

                {csv && (
                  <div className="bg-gray-50/80 p-6 rounded-xl mb-6 border border-gray-200/50">
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">
                      CSV Preview
                    </h3>
                    <pre className="text-sm overflow-auto bg-white p-4 rounded-lg">
                      {csvPreview.join("\n")}
                    </pre>
                  </div>
                )}

                {Object.keys(data).length > 0 && (
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-gray-700">
                      Data by Tags
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {Object.keys(data).map((tag) => (
                        <div
                          key={tag}
                          className="bg-gray-50/80 p-6 rounded-xl border border-gray-200/50"
                        >
                          <h4 className="text-lg font-bold mb-3 text-gray-800">
                            {tag.toUpperCase()}
                          </h4>
                          <ul className="space-y-2 text-gray-600 max-h-64 overflow-y-auto">
                            {data[tag].map((text, idx) => (
                              <li key={idx} className="text-sm">
                                {text}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
      {showNotification && (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300">
          Data scraped successfully!
        </div>
      )}
    </div>
  );
}
