/** Model text with `inline code` shown as code. Nothing else is interpreted. */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.length > 2 && p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className="rounded bg-raised-2 px-1 py-px font-mono text-[0.88em] text-fg">
            {p.slice(1, -1)}
          </code>
        ) : (
          p
        ),
      )}
    </>
  );
}
