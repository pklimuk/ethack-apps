"use client";


import { useState } from "react";
import { UserBar } from "./components/UserBar";
export default function Home() {
  const [count, setCount] = useState(0);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-8">
      <UserBar />
      <h1 className="text-4xl font-bold mb-4">🚀 My Simple Next.js App</h1>
      <p className="text-lg mb-6 text-gray-700">This is a one-page app built with Next.js.</p>

      <button
        onClick={() => setCount(count + 1)}
        className="px-6 py-3 bg-blue-600 text-white rounded-2xl shadow-md hover:bg-blue-700 transition"
      >
        Clicked {count} times
      </button>
    </main>
  );
}
