import type { Signal } from "@/lib/signals";

const ICON = { opportunity: "↗", watch: "◐", risk: "!" } as const;

export function SignalChip({ signal }: { signal: Signal }) {
  return (
    <span className={`chip chip-${signal.tone}`} title={signal.detail}>
      <span aria-hidden>{ICON[signal.tone]}</span> {signal.title}
    </span>
  );
}
