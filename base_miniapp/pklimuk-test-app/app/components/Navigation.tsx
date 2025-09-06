"use client";

import { useState, useEffect } from 'react';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Navigation({ activeTab, onTabChange }: NavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'explore', label: 'Explore' },
    { id: 'compare', label: 'Compare' },
    { id: 'roi', label: 'ROI Calculator' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'ai', label: 'Ask AI' },
  ];

  const activeTabLabel = tabs.find(tab => tab.id === activeTab)?.label || 'Menu';

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
    setIsMenuOpen(false); // Close mobile menu after selection
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMenuOpen && !target.closest('.mobile-nav-container')) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMenuOpen]);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="w-full max-w-7xl mx-auto px-4">
        {/* Desktop Navigation */}
        <nav className="hidden md:flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200`}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Mobile Navigation Header */}
        <div className="md:hidden mobile-nav-container">
          <div className="flex items-center justify-between py-4">
            <h1 className="text-lg font-semibold text-gray-900">{activeTabLabel}</h1>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Toggle navigation menu"
              aria-expanded={isMenuOpen}
            >
              <div className="w-6 h-6 flex flex-col justify-center space-y-1">
                <span
                  className={`block h-0.5 w-6 bg-current transform transition-transform duration-200 ${
                    isMenuOpen ? 'rotate-45 translate-y-1.5' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-6 bg-current transition-opacity duration-200 ${
                    isMenuOpen ? 'opacity-0' : ''
                  }`}
                />
                <span
                  className={`block h-0.5 w-6 bg-current transform transition-transform duration-200 ${
                    isMenuOpen ? '-rotate-45 -translate-y-1.5' : ''
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="fixed inset-0 bg-black bg-opacity-25 z-40"
                onClick={() => setIsMenuOpen(false)}
              />
              
              {/* Menu Panel */}
              <div className="absolute left-0 right-0 top-full bg-white border-b border-gray-200 shadow-lg z-50 animate-in slide-in-from-top-2 duration-200">
                <nav className="py-2" aria-label="Mobile navigation">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-600 border-r-2 border-blue-600'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      } block w-full text-left px-4 py-3 text-base font-medium transition-colors duration-150`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}