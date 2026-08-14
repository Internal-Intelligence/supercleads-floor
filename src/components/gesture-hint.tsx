export function GestureHint() {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 py-3 md:hidden">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">On your phone</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        <li>
          <span className="font-medium">Draw</span>
          <span className="text-muted"> — one finger, two strokes. The pad will not scroll.</span>
        </li>
        <li>
          <span className="font-medium">Board</span>
          <span className="text-muted"> — swipe sideways for every rep. Tap + to hang an X.</span>
        </li>
        <li>
          <span className="font-medium">CRM</span>
          <span className="text-muted"> — tap a record. Change stage from the list or the file.</span>
        </li>
      </ul>
    </section>
  );
}
