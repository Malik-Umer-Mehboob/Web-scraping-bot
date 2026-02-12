"use client";
import { useState, useEffect } from "react";

// Define the structure of the data we receive from the API
interface ScrapedElement {
  text: string;
  tag: string;
  id?: string;
  className?: string;
  attributes?: Record<string, string>;
  innerHTML?: string;
}

// Local CSV generator to ensure we handle the ScrapedElement structure correctly
// without relying on potentially unsafe backend utils
const generateCSV = (data: ScrapedElement[]) => {
  if (!data || data.length === 0) return "";
  
  // Headers
  const headers = ["Tag", "Text", "ID", "Class", "Attributes"];
  const csvRows = [headers.join(",")];

  // Rows
  for (const row of data) {
    const values = [
      row.tag,
      `"${(row.text || "").replace(/"/g, '""')}"`, // Escape quotes
      `"${(row.id || "").replace(/"/g, '""')}"`,
      `"${(row.className || "").replace(/"/g, '""')}"`,
      `"${JSON.stringify(row.attributes || {}).replace(/"/g, '""')}"`
    ];
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
};

export default function MouseModePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedData, setSelectedData] = useState<ScrapedElement[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  const handleMouseMode = async () => {
    if (!url) return alert("Please enter a URL to activate Mouse Mode");
    if (sessionActive) {
      return alert(
        "Mouse Mode is already active. Please finish the current session by pressing Enter in the browser."
      );
    }

    setLoading(true);
    setSessionActive(true); 
    setError("");
    setShowResults(false);
    setSelectedData([]);

    try {
      const res = await fetch("/api/mouse-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Mouse Mode failed with status: ${res.status}`);
      }

      const result = await res.json();
      const rawElements: ScrapedElement[] = result.selectedElements || [];

      // Filter duplicates: same tag + same text
      const uniqueElements = rawElements.filter((item, index, self) =>
        index === self.findIndex((t) => (
          t.tag === item.tag && t.text === item.text
        ))
      ).filter(item => item.text && item.text.trim().length > 0); // Remove empty text items

      setSelectedData(uniqueElements);

      if (uniqueElements.length > 0) {
        setShowResults(true);
        setShowNotification(true);
      } else {
        if (rawElements.length === 0) {
             setError("No elements were selected (or session timed out/headless mode).");
        } else {
             setError("Selected elements were empty or duplicates.");
        }
      }
    } catch (err) {
      console.error(err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("An unknown error occurred in Mouse Mode.");
      }
    } finally {
      setLoading(false);
      setSessionActive(false);
    }
  };

  const downloadCsv = () => {
    if (selectedData.length === 0) return;

    const csvContent = generateCSV(selectedData);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "mouse_mode_data.csv");
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-white text-gray-800 font-sans">
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-white/60 backdrop-blur-xl shadow-2xl rounded-2xl p-8 mb-10 border border-white/20">
            <h1 className="text-4xl font-bold mb-4 text-center text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-700">
              Mouse Mode Selector
            </h1>
            <p className="text-center text-gray-600 mb-8 text-lg">
              Enter a URL, activate mouse mode, hover to highlight, click to select elements,
              press <strong>Enter</strong> to save selections, or <strong>Escape</strong> to cancel.
            </p>
            <div className="relative flex flex-col sm:flex-row items-center gap-4">
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={sessionActive}
                className="w-full pl-4 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300 disabled:bg-gray-100"
              />
              <button
                onClick={handleMouseMode}
                disabled={loading || sessionActive}
                className={`w-full sm:w-auto px-8 py-4 rounded-xl text-white font-semibold shadow-lg transform transition-all duration-300 ${
                  sessionActive 
                    ? "bg-gray-500 cursor-not-allowed" 
                    : "bg-gradient-to-r from-green-500 to-teal-600 hover:-translate-y-1 hover:shadow-xl"
                }`}
              >
                {sessionActive ? "Session Active..." : "Activate Mouse Mode"}
              </button>
            </div>
            {error && (
              <div className="mt-4 p-4 bg-red-100 text-red-700 rounded-xl border border-red-200">
                {error}
              </div>
            )}
          </div>

          {showResults && selectedData.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl p-8 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Selected Data</h2>
                <button
                  onClick={downloadCsv}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 transition-all duration-300 shadow-md hover:shadow-lg flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download CSV
                </button>
              </div>
              <div className="overflow-y-auto max-h-96 pr-2 custom-scrollbar">
                <ul className="space-y-3">
                  {selectedData.map((item, idx) => (
                    <li key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex items-start gap-3">
                      <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase tracking-wide shrink-0">
                        {item.tag}
                      </span>
                      <span className="text-gray-700 text-sm break-all font-medium">
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </main>
      {showNotification && (
        <div className="fixed bottom-5 right-5 bg-green-600 text-white px-6 py-4 rounded-xl shadow-2xl animate-fade-in-up z-50 flex items-center gap-3">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
           </svg>
           <div>
             <p className="font-bold">Success!</p>
             <p className="text-sm">Data captured successfully.</p>
           </div>
        </div>
      )}
    </div>
  );
}
