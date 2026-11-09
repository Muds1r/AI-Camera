'use client';

export function PictureField({
  preview,
  onFile,
}: {
  preview: string | null;
  onFile: (file: File | null) => void;
}) {
  return (
    <div>
      <label className="text-mute block text-xs tracking-wider uppercase">
        Picture
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-mute file:bg-brand mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1.5 file:text-sm file:text-white"
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {preview ? (
        // Blob previews and uploaded files are not served through the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Picture preview"
          className="border-mute/30 mt-3 h-24 w-24 rounded-lg border object-cover"
        />
      ) : (
        <p className="text-mute mt-2 text-xs">JPEG, PNG, or WebP, up to 2 MB.</p>
      )}
    </div>
  );
}
