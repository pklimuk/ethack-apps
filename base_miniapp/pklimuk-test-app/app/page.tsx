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
import Navigation from "./components/Navigation";
import CompareTab from "./components/CompareTab";
import ROICalculator from "./components/ROICalculator";

export default function App() {
  const { setFrameReady, isFrameReady, context } = useMiniKit();
  const [frameAdded, setFrameAdded] = useState(false);
  const [activeTab, setActiveTab] = useState('explore');
  const [isChatOpen, setIsChatOpen] = useState(false);

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

  const handleTabChange = (tab: string) => {
    if (tab === 'ai') {
      setIsChatOpen(true);
      // Don't change the active tab, stay on current tab
    } else {
      setActiveTab(tab);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'explore':
        return <PoolsDashboard onSwitchToCompare={() => setActiveTab('compare')} />;
      case 'compare':
        return <CompareTab />;
      case 'roi':
        return <ROICalculator />;
      case 'notifications':
        return (
          <div className="p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">🔔 Notifications</h2>
            <div className="max-w-md mx-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Coming Soon!</h3>
                <p className="text-blue-700 text-sm">
                  We're working on smart notifications to alert you about:
                </p>
                <ul className="text-left text-blue-700 text-sm mt-3 space-y-1">
                  <li>• Significant APY changes</li>
                  <li>• New high-yield opportunities</li>
                  <li>• Pool risk alerts</li>
                  <li>• Market trend notifications</li>
                </ul>
              </div>
              <p className="text-gray-500 text-sm">
                Stay tuned for updates!
              </p>
            </div>
          </div>
        );
      default:
        return <PoolsDashboard onSwitchToCompare={() => setActiveTab('compare')} />;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Save Frame Button - Floating */}
      <div className="fixed top-4 right-4 z-50">
        {saveFrameButton}
      </div>

      {/* Navigation */}
      <Navigation activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Main Content */}
      <div className="w-full max-w-7xl mx-auto px-4 py-6">
        <main className="flex-1">
          {renderTabContent()}
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
      <ChatWidget 
        externalOpen={isChatOpen}
        onExternalOpenChange={setIsChatOpen}
      />
    </div>
  );
}
