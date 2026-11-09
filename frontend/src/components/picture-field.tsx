'use client';

import { labelClass, fieldClass } from './page-frame';

export function PictureField({
  preview,
  onFile,
}: {
  preview: string | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <div>
      <label className={labelClass}>
        Picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={`${fieldClass} text-mute file:text-ink file:border-line file:bg-surface mt-1 block w-full file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-xs file:font-medium`}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Picture preview"
          className="border-line mt-3 h-20 w-20 rounded-lg border object-cover"
        />
      ) : (
        <p className="text-mute mt-2 text-xs">JPEG, PNG, or WebP, up to 2 MB.</p>
      )}
    </div>
  );
}
