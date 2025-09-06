"use client";

import {
  useAddFrame,
  useMiniKit,
  useOpenUrl,
} from "@coinbase/onchainkit/minikit";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Icon } from "./components/DemoComponents";
import PoolsDashboard from "./components/PoolsDashboard";
import ChatWidget from "./components/ChatWidget";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);

  const addFrame = useAddFrame();
  const openUrl = useOpenUrl();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const handleAddFrame = useCallback(async () => {
    const frameAdded = await addFrame();
    setFrameAdded(Boolean(frameAdded));
  }, [addFrame]);

  const saveFrameButton = useMemo(() => {
    if (context && !context.client.added) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleAddFrame}
          className="text-[var(--app-accent)] p-4"
          icon={<Icon name="plus" size="sm" />}
        >
          Save Frame
        </Button>
      );
    }

    if (frameAdded) {
      return (
        <div className="flex items-center space-x-1 text-sm font-medium text-[#0052FF] animate-fade-out">
          <Icon name="check" size="sm" className="text-[#0052FF]" />
          <span>Saved</span>
        </div>
      );
    }

    return null;
  }, [context, frameAdded, handleAddFrame]);

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <div className="w-full max-w-7xl mx-auto px-4 py-4">
        {/* <header className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200"> */}
          {/* <div>
            <h1 className="text-xl font-semibold text-gray-900">DeFi Pools Monitoring</h1>
          </div> */}
          <div>{saveFrameButton}</div>
        {/* </header> */}

        <main className="flex-1">
          <PoolsDashboard />
        </main>

        <footer className="mt-8 pt-4 border-t border-gray-200 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500 text-xs"
            onClick={() => openUrl("https://base.org/builders/minikit")}
          >
            Built on Base with MiniKit
          </Button>
        </footer>
      </div>
      
      {/* Floating AI Chat Widget */}
      <ChatWidget />
    </div>
  );
}
