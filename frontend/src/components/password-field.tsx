'use client';

import { useState } from 'react';
import { fieldClass } from './page-frame';

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
}: {
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
        className="text-brand absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium"
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
