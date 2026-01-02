import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Navigation + history extraction
 *
 * This hook exists to keep browser navigation behavior (pushState, popstate,
 * and internal <a> clicks) in one place, so App.tsx can focus on auth/routing flow.
 *
 * Runtime behavior is intentionally identical to the prior inline implementation.
 */
export function useNavigation() {
  // Track full URL (path + query) so querystring changes re-render.
  const [currentUrl, setCurrentUrl] = useState(
    window.location.pathname + window.location.search
  );

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, "", path);
    setCurrentUrl(window.location.pathname + window.location.search);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentUrl(window.location.pathname + window.location.search);
    };
    window.addEventListener("popstate", handlePopState);

    // Optional: support <a href="/path"> links as SPA navigation.
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (!link) return;

      // Only intercept internal links.
      if (link.href.startsWith(window.location.origin)) {
        e.preventDefault();
        const url = new URL(link.href);
        navigate(url.pathname + url.search);
      }
    };

    document.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleClick);
    };
  }, [navigate]);

  const url = useMemo(() => new URL(currentUrl, window.location.origin), [currentUrl]);
  const pathname = useMemo(() => url.pathname, [url]);
  const searchParams = useMemo(() => url.searchParams, [url]);

  return { navigate, pathname, searchParams };
}
