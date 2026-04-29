'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUIStore } from '@/store/ui-store';
import { useCanvasStore } from '@/store/canvas-store';
import {
  Menu, FolderOpen, Save, Image as ImageIcon, Users,
  Command, Search, HelpCircle, Trash2, Code, Share2,
  MessageSquare, LogIn, Settings, Sun, Moon, Monitor,
  ChevronRight, Triangle
} from 'lucide-react';

export function MainMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);
  const deleteElements = useCanvasStore(state => state.deleteElements);
  const elements = useCanvasStore(state => state.elements);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleResetCanvas = () => {
    deleteElements(Object.keys(elements));
    setIsOpen(false);
  };

  const menuSection1 = [
    { icon: FolderOpen, label: 'Open', shortcut: 'Ctrl+O' },
    { icon: Save, label: 'Save to...' },
    { icon: ImageIcon, label: 'Export image...', shortcut: 'Ctrl+Shift+E' },
    { icon: Users, label: 'Live collaboration...' },
    { icon: Command, label: 'Command palette', shortcut: 'Ctrl+/', highlight: true },
    { icon: Search, label: 'Find on canvas', shortcut: 'Ctrl+F' },
    { icon: HelpCircle, label: 'Help', shortcut: '?' },
    { icon: Trash2, label: 'Reset the canvas', onClick: handleResetCanvas },
  ];

  const menuSection2 = [
    { icon: Triangle, label: 'Excalidraw+' },
    { icon: Code, label: 'GitHub' },
    { icon: Share2, label: 'Follow us' },
    { icon: MessageSquare, label: 'Discord chat' },
    { icon: LogIn, label: 'Sign up', highlight: true },
  ];

  return (
    <div className="fixed top-4 left-4 z-[100]" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 shadow-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        <Menu size={20} className="text-zinc-700 dark:text-zinc-300" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-[#1a1a1e] border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden flex flex-col py-2"
          >
            {/* Section 1 */}
            <div className="flex flex-col">
              {menuSection1.map((item, i) => (
                <button
                  key={i}
                  onClick={item.onClick}
                  className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors group ${item.highlight ? 'bg-foreground mx-2 rounded w-[calc(100%-16px)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className={item.highlight ? "text-background" : "text-foreground"} />
                    <span className={`text-sm ${item.highlight ? "text-background font-medium" : "text-foreground"}`}>
                      {item.label}
                    </span>
                  </div>
                  {item.shortcut && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">{item.shortcut}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800/60 my-2" />

            {/* Section 2 */}
            <div className="flex flex-col">
              {menuSection2.map((item, i) => (
                <button
                  key={i}
                  className={`flex items-center justify-between w-full px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors group ${item.highlight ? 'bg-foreground mx-2 rounded w-[calc(100%-16px)] mt-1' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={16} className={item.highlight ? "text-background" : "text-foreground"} />
                    <span className={`text-sm ${item.highlight ? "text-background font-medium" : "text-foreground"}`}>
                      {item.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            <div className="w-full h-px bg-zinc-200 dark:bg-zinc-800/60 my-2" />

            {/* Section 3: Preferences */}
            <div className="flex flex-col px-4 py-2 gap-3">
              <button className="flex items-center justify-between w-full group">
                <div className="flex items-center gap-3">
                  <Settings size={16} className="text-foreground" />
                  <span className="text-sm text-foreground">Preferences</span>
                </div>
                <ChevronRight size={14} className="text-zinc-400" />
              </button>

              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-foreground">Theme</span>
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5">
                  <button
                    onClick={() => setTheme('light')}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'light' ? 'bg-foreground text-background' : 'text-zinc-500 hover:text-foreground'}`}
                    title="Light theme"
                  >
                    <Sun size={14} />
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'dark' ? 'bg-foreground text-background' : 'text-zinc-500 hover:text-foreground'}`}
                    title="Dark theme"
                  >
                    <Moon size={14} />
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`p-1.5 rounded-md transition-colors ${theme === 'system' ? 'bg-foreground text-background' : 'text-zinc-500 hover:text-foreground'}`}
                    title="System theme"
                  >
                    <Monitor size={14} />
                  </button>
                </div>
              </div>

              {/* Language Dropdown Placeholder */}
              <button className="flex items-center justify-between w-full px-3 py-1.5 mt-1 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                <span className="text-sm text-foreground">English</span>
                <Triangle size={10} className="text-zinc-500 rotate-180" />
              </button>

              {/* Canvas Background Placeholder */}
              <div className="flex flex-col mt-2 gap-2">
                <span className="text-sm text-foreground">Canvas background</span>
                <div className="flex gap-2">
                  {/* Just some dummy colors based on image */}
                  <div className="w-6 h-6 rounded border-2 border-foreground bg-white dark:bg-[#121212]"></div>
                  <div className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-700 bg-[#f8f9fa] dark:bg-[#1e1e1e]"></div>
                  <div className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-700 bg-[#f1f3f5] dark:bg-[#252525]"></div>
                  <div className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-700 bg-[#fff3bf] dark:bg-[#332b00]"></div>
                  <div className="w-6 h-6 rounded border border-zinc-300 dark:border-zinc-700 bg-[#ffe8cc] dark:bg-[#331c00]"></div>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
