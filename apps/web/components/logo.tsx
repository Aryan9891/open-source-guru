import Image from "next/image";
import markDark from "@/public/brand/osg-mark-dark.png";
import markLight from "@/public/brand/osg-mark-light.png";

/**
 * The Branch Sprout mark: a commit growing two leaves. Two PNGs, one per theme;
 * Fumadocs toggles the `.dark` class, which Tailwind's `dark:` variant follows.
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <>
      <Image src={markLight} alt="" width={size} height={size} className="dark:hidden" priority />
      <Image
        src={markDark}
        alt=""
        width={size}
        height={size}
        className="hidden dark:block"
        priority
      />
    </>
  );
}

/** Mark + wordmark, for the navigation bar. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark />
      <span className="font-display text-lg font-extrabold tracking-tight">
        Open source <span className="text-accent">guru</span>
      </span>
      <span className="sr-only">Open Source Guru</span>
    </span>
  );
}
