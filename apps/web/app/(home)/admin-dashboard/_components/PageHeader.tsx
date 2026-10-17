/** Title and one-line description at the top of each admin page. */
export function PageHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <header className="flex flex-col gap-1">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-subtle">{children}</p>
    </header>
  );
}
