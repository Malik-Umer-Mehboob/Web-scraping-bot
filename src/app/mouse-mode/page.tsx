"use client";
import { useState, useEffect } from "react";
import { jsonToCsv } from "../../utils/jsonToCsv";

interface SelectedData {
  text: string;
  tag: string;
}

export default function MouseModePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedData, setSelectedData] = useState<SelectedData[]>([]);
  const [showNotification, setShowNotification] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (showNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showNotification]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (sessionActive && sessionId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/mouse-mode-update?sessionId=${sessionId}`);
          if (res.ok) {
            const { selectedElements } = await res.json();
            setSelectedData(selectedElements);
            if (selectedElements.length > 0) {
              setShowResults(true);
              setShowNotification(true);
            }
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [sessionActive, sessionId]);

  const handleMouseMode = async () => {
    if (!url) return alert("Please enter a URL to activate Mouse Mode");
    if (sessionActive) {
      return alert(
        "Mouse Mode is already active. Select elements, press Enter to reset styles, and Escape to finalize."
      );
    }

    setLoading(true);
    setError("");

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
      setSelectedData(result.selectedElements);
      setSessionId(result.sessionId);
      setSessionActive(true); // ✅ ab sirf success pe active hoga

      if (result.selectedElements.length > 0) {
        setShowResults(true);
        setShowNotification(true);
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
    }
  };

 function downloadCsv() {
  if (selectedData.length > 0) {
    // ✅ convert to Record<string, unknown>
    const csv = jsonToCsv(
      selectedData.map((item) => ({
        tag: item.tag,
        text: item.text,
      }))
    );

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "mouse_mode_data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}


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
              press Enter to reset styles, and Escape to finalize.
            </p>
            <div className="relative flex flex-col sm:flex-row items-center gap-4">
              <input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full pl-4 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-300"
              />
              <button
                onClick={handleMouseMode}
                disabled={loading || sessionActive}
                className="w-full sm:w-auto bg-gradient-to-r from-green-500 to-teal-600 text-white px-8 py-4 rounded-xl hover:shadow-lg transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? "Activating..." : sessionActive ? "Session Active" : "Activate Mouse Mode"}
              </button>
            </div>
          </div>

          {showResults && selectedData.length > 0 && (
            <div className="bg-white/60 backdrop-blur-xl shadow-lg rounded-2xl p-8 border border-white/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">Selected Data</h2>
                <button
                  onClick={downloadCsv}
                  className="bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 transition-all duration-300"
                >
                  Download CSV
                </button>
              </div>
              <ul className="list-disc pl-5 space-y-2">
                {selectedData.map((item, idx) => (
                  <li key={idx} className="text-sm text-gray-700 break-words">
                    <span className="font-semibold text-blue-700">{`<${item.tag}>`}</span>: {item.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </main>
      {showNotification && (
        <div className="fixed bottom-5 right-5 bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg transition-all duration-300">
          Data updated in UI! Press Enter to reset styles, Escape to finalize.
        </div>
      )}
    </div>
  );
}
