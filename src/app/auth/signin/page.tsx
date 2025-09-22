"use client";

import { getProviders, signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { ClientSafeProvider } from "next-auth/react";

interface Providers {
  [key: string]: ClientSafeProvider;
}

export default function SignIn() {
  const [providers, setProviders] = useState<Providers | null>(null);
  const [error, setError] = useState<string | null>(null); // Add error state

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
    };
    fetchProviders();
  }, []);

  const handleSignIn = async (providerId: string) => {
    setError(null); // Clear previous errors
    const result = await signIn(providerId, { callbackUrl: '/' }); // Explicitly set callbackUrl
    if (result?.error) {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 transform transition-all duration-300 hover:scale-105">
        <h2 className="text-3xl font-extrabold mb-6 text-center text-gray-800">Sign In</h2>
        {error && <p className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 text-center text-sm">{error}</p>}
        {providers ? (
          <div className="space-y-4">
            {Object.values(providers).map((provider) => {
              // Exclude the credentials provider from social login buttons
              if (provider.id === "credentials") {
                return null;
              }
              return (
                <button
                  key={provider.name}
                  onClick={() => handleSignIn(provider.id)}
                  className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200"
                >
                  Sign in with {provider.name}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-gray-600">Loading providers...</p>
        )}
        <div className="mt-6 text-center text-sm">
          <p className="text-gray-600">Or sign in with your email and password:</p>
          <button
            onClick={() => handleSignIn("credentials")}
            className="mt-2 w-full flex items-center justify-center px-4 py-3 bg-blue-500 text-white font-bold rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-200"
          >
            Sign in with Email and Password
          </button>
        </div>
      </div>
    </div>
  );
}
