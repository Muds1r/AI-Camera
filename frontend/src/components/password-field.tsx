'use client';

import { useState } from 'react';
import { fieldClass } from './page-frame';

export function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} pr-16`}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="text-mute hover:text-ink absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
