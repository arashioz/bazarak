"use client";

import { useEffect, useRef, useState } from "react";

const isApiRequest = (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : input.toString();
  return url.startsWith("/api/") || /\/api\//.test(url);
};

export default function ApiLoadingOverlay({ children }: { children: React.ReactNode }) {
  const activeRequests = useRef(0);
  const revealTimer = useRef<ReturnType<typeof setTimeout>>();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const nativeFetch = window.fetch.bind(window);
    const finish = () => {
      activeRequests.current -= 1;
      if (activeRequests.current > 0) return;
      activeRequests.current = 0;
      if (revealTimer.current) clearTimeout(revealTimer.current);
      revealTimer.current = undefined;
      setVisible(false);
    };
    const trackedFetch: typeof window.fetch = async (input, init) => {
      if (!isApiRequest(input)) return nativeFetch(input, init);
      activeRequests.current += 1;
      if (activeRequests.current === 1) revealTimer.current = setTimeout(() => setVisible(true), 140);
      try {
        return await nativeFetch(input, init);
      } finally {
        finish();
      }
    };
    window.fetch = trackedFetch;
    return () => {
      if (window.fetch === trackedFetch) window.fetch = nativeFetch;
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  return <>
    {children}
    <div aria-live="polite" aria-busy={visible} className={`api-loading-overlay ${visible ? "api-loading-overlay--visible" : ""}`}>
      <div className="api-loading-card">
        <div className="api-loading-orbit"><i /><i /><i /></div>
        <div><b>در حال همگام‌سازی</b><span>اطلاعات شما با خیال راحت ذخیره می‌شود</span></div>
      </div>
    </div>
  </>;
}
