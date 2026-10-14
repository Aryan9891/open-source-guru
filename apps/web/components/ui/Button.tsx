type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground",
  secondary: "border border-border bg-surface text-primary hover:bg-surface-muted",
  ghost: "text-foreground hover:bg-surface-muted",
  /** Destructive actions, after a confirmation. */
  danger: "bg-danger text-danger-foreground hover:opacity-90",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-6 text-base",
};

/** Classes for a button or a link that looks like one (pill-shaped, from the visual identity). */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return `${base} ${variants[variant]} ${sizes[size]} ${className}`.trim();
}
