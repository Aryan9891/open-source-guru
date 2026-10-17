"use client";

import { Toaster as HotToaster } from "react-hot-toast";
import { useMobile } from "@/hooks/use-mobile";

/**
 * App-wide toasts, drawn with the theme tokens (app/globals.css). The tokens are CSS
 * variables that switch with the `.dark` class, so toasts follow light and dark on their own.
 */
export function Toaster() {
  const { isMobile } = useMobile();

  return (
    <HotToaster
      position={isMobile ? "top-center" : "top-right"}
      toastOptions={{
        duration: 3000,
        style: {
          background: "var(--osg-surface)",
          color: "var(--osg-foreground)",
          border: "1px solid var(--osg-border)",
          borderRadius: "var(--radius-md)",
          fontFamily: "var(--font-sans)",
          boxShadow: "0 8px 24px -8px rgb(31 2 76 / 0.25)",
        },
        success: {
          iconTheme: { primary: "var(--osg-primary)", secondary: "var(--osg-primary-foreground)" },
        },
        error: {
          iconTheme: { primary: "var(--osg-danger)", secondary: "var(--osg-danger-foreground)" },
        },
        loading: {
          iconTheme: { primary: "var(--osg-accent)", secondary: "var(--osg-border)" },
        },
      }}
    />
  );
}
