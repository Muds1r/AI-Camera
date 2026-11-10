'use client';

import { useState } from 'react';
import { imageFileError } from '@/lib/fields';
import { labelClass, fieldClass } from './page-frame';

export function PictureField({
  preview,
  onFile,
  previewClassName = 'border-line mt-3 h-20 w-20 rounded-lg border object-cover',
}: {
  preview: string | null;
  onFile: (file: File | null) => void;
  previewClassName?: string;
}) {
  const [error, setError] = useState('');

  return (
    <div>
      <label className={labelClass}>
        Picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className={`${fieldClass} text-mute file:text-ink file:border-line file:bg-surface mt-1 block w-full file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-xs file:font-medium`}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) {
              setError('');
              onFile(null);
              return;
            }
            const message = imageFileError(file);
            setError(message);
            if (message) {
              event.target.value = '';
              onFile(null);
              return;
            }
            onFile(file);
          }}
        />
      </label>
      {error ? (
        <p className="text-danger mt-2 text-xs" role="alert">
          {error}
        </p>
      ) : null}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="Picture preview" className={previewClassName} />
      ) : (
        <p className="text-mute mt-2 text-xs">JPEG, PNG, or WebP, up to 2 MB.</p>
      )}
    </div>
  );
}
