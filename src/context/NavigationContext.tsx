import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';

type BackHandler = () => boolean | void;

interface NavigationContextType {
  registerBackHandler: (id: string, handler: BackHandler, priority?: number) => () => void;
  navigateBack: () => void;
  showExitPrompt: boolean;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Map of registered back handlers: { id, handler, priority }
  const handlersRef = useRef<Array<{ id: string; handler: BackHandler; priority: number }>>([]);
  const [showExitPrompt, setShowExitPrompt] = useState(false);
  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const allowExitUntilRef = useRef<number>(0);

  // Register a back handler. Higher priority runs first.
  const registerBackHandler = useCallback((id: string, handler: BackHandler, priority = 10) => {
    // Remove if already exists
    handlersRef.current = handlersRef.current.filter((item) => item.id !== id);
    // Insert sorted by priority descending
    handlersRef.current.push({ id, handler, priority });
    handlersRef.current.sort((a, b) => b.priority - a.priority);

    // Push state into browser history to ensure popstate is captured
    try {
      window.history.pushState({ pwaLayer: id, timestamp: Date.now() }, '');
    } catch {
      // ignore in environments without history
    }

    return () => {
      handlersRef.current = handlersRef.current.filter((item) => item.id !== id);
    };
  }, []);

  // Programmatic back trigger (invoked by header back button or system popstate)
  const navigateBack = useCallback(() => {
    // Find the highest priority handler
    if (handlersRef.current.length > 0) {
      const top = handlersRef.current[0];
      const handled = top.handler();
      // If handler didn't explicitly return false, we consider it handled
      if (handled !== false) {
        handlersRef.current = handlersRef.current.filter((item) => item.id !== top.id);
        return;
      }
    }

    // If no handlers left, check double-back to exit
    const now = Date.now();
    if (now < allowExitUntilRef.current) {
      // Allow exit (close app / go back in real history)
      window.history.back();
    } else {
      // First back on root screen: show toast and push dummy state back
      allowExitUntilRef.current = now + 2500;
      setShowExitPrompt(true);

      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => {
        setShowExitPrompt(false);
        allowExitUntilRef.current = 0;
      }, 2500);

      try {
        window.history.pushState({ pwaLayer: 'root', timestamp: Date.now() }, '');
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    // Seed initial history state so we always have a buffer to pop from
    try {
      window.history.replaceState({ pwaLayer: 'root-base' }, '');
      window.history.pushState({ pwaLayer: 'root-active' }, '');
    } catch {
      // ignore
    }

    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      navigateBack();
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, [navigateBack]);

  return (
    <NavigationContext.Provider value={{ registerBackHandler, navigateBack, showExitPrompt }}>
      {children}
      {/* Toast Notifikasi Bertingkat: Tekan Sekali Lagi Untuk Keluar */}
      {showExitPrompt && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-slate-900/95 text-white text-xs font-semibold px-4 py-2.5 rounded-full shadow-2xl border border-slate-700/60 backdrop-blur-md flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Tekan sekali lagi untuk keluar dari aplikasi
          </div>
        </div>
      )}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
};

/**
 * Convenient hook to register a back action whenever enabled is true.
 * Automatically cleans up on unmount or when enabled becomes false.
 */
export const useBackHandler = (id: string, handler: BackHandler, enabled: boolean, priority = 10) => {
  const { registerBackHandler } = useNavigation();

  useEffect(() => {
    if (!enabled) return;
    const unregister = registerBackHandler(id, handler, priority);
    return () => {
      unregister();
    };
  }, [id, enabled, priority, registerBackHandler]);
};
