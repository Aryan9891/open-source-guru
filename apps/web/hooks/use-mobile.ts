"use client";

import { useSyncExternalStore } from "react";

// Matches Tailwind's `md` breakpoint (48rem), so `isMobile` agrees with `md:` classes.
const MOBILE_QUERY = "(max-width: 47.99rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches;
}

// The server can't know the viewport, so it renders the desktop layout. The client updates
// right after hydration.
function getServerSnapshot() {
  return false;
}

/** Whether the viewport is narrower than Tailwind's `md` breakpoint. Updates on resize. */
export function useMobile() {
  const isMobile = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { isMobile };
}
