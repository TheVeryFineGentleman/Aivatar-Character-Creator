/**
 * useIsMobile — true when viewport is below the md breakpoint (768px).
 */
import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  return isMobile;
}

export function useBreakpoint(px: number) {
  const [under, setUnder] = useState<boolean>(() => typeof window !== "undefined" && window.innerWidth < px);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${px - 1}px)`);
    const onChange = () => setUnder(window.innerWidth < px);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [px]);
  return under;
}
