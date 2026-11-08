"use client";

import { useEffect, useState } from "react";

/** A numeric input that only commits finite values, so a half-typed entry never zeroes the model. */
function NumericInput({
  value,
  onChange,
  scale = 1,
  prefix,
  suffix,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  scale?: number;
  prefix?: string;
  suffix?: string;
  id: string;
}) {
  const shown = Number((value * scale).toFixed(4));
  const display = () => (scale === 1 ? shown.toLocaleString("en-US") : String(shown));
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  // Follow outside changes, but never rewrite what the user is mid-way through typing.
  useEffect(() => {
    if (!focused) setText(display());
  }, [shown, focused]);

  return (
    <div className="input-affix">
      {prefix && <span aria-hidden>{prefix}</span>}
      <input
        id={id}
        inputMode="decimal"
        type="text"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const raw = e.target.value.replace(/[,\s]/g, "");
          const n = Number(raw);
          if (raw !== "" && Number.isFinite(n)) onChange(n / scale);
        }}
        onFocus={() => {
          setFocused(true);
          setText(String(shown));
        }}
        onBlur={() => setFocused(false)}
      />
      {suffix && <span aria-hidden>{suffix}</span>}
    </div>
  );
}

export function MoneyField({
  label,
  value,
  onChange,
  estimated,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  estimated?: boolean;
  hint?: string;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {estimated && <span className="est-tag">estimated</span>}
      </label>
      <NumericInput id={id} value={value} onChange={onChange} prefix="$" />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

export function PercentField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
}) {
  const id = `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <NumericInput id={id} value={value} onChange={onChange} scale={100} suffix="%" />
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
