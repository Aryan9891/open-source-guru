"use client";

import { useEffect, useState } from "react";
import { buttonClasses } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

/** The README badge, with its Markdown to copy. */
export function BadgeSnippet({ login }: { login: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => setOrigin(window.location.origin), []);

  const profile = `${origin}${ROUTES.profile(login)}`;
  const badge = `${profile}/badge.svg`;
  const markdown = `[![Open Source Contributions](${badge})](${profile})`;

  async function copy() {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="font-semibold">README badge</span>
        <span className="text-sm text-muted">
          Your Open Source Contributions of the last 12 months and your current streak, linking to
          your profile. Updated every hour.
        </span>
      </div>
      {origin && (
        // biome-ignore lint/performance/noImgElement: the SVG badge itself, as READMEs show it
        <img src={badge} alt="Open Source Contributions badge" height={20} className="h-5 w-fit" />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-md bg-surface-muted px-3 py-2.5 font-mono text-xs">
          {markdown}
        </code>
        <button type="button" onClick={() => void copy()} className={buttonClasses()}>
          {copied ? "Copied" : "Copy Markdown"}
        </button>
      </div>
    </div>
  );
}
