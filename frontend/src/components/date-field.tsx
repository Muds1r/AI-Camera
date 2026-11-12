'use client';

import { useRef } from 'react';
import { fieldClass } from '@/components/page-frame';

type DateFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
  'aria-label'?: string;
};

/** Native date input with visible placeholder and calendar picker on click. */
export function DateField({
  value,
  onChange,
  placeholder,
  required,
  className,
  id,
  name,
  min,
  max,
  'aria-label': ariaLabel,
}: DateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
    }
  }

  return (
    <div className={`relative ${className ?? ''}`}>
      {!value ? (
        <span className="text-mute pointer-events-none absolute inset-y-0 left-3 z-[1] flex items-center text-sm">
          {placeholder}
        </span>
      ) : null}
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="date"
        required={required}
        min={min}
        max={max}
        aria-label={ariaLabel ?? placeholder}
        title={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onClick={openPicker}
        onFocus={openPicker}
        className={`${fieldClass} relative z-0 cursor-pointer ${
          !value
            ? '[&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-datetime-edit]:text-transparent [&::-webkit-datetime-edit-fields-wrapper]:text-transparent'
            : ''
        }`}
      />
    </div>
  );
}
