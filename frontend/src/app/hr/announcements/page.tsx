'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  PageFrame,
  buttonClass,
  buttonDangerClass,
  buttonSecondaryClass,
  cardClass,
  fieldClass,
  formPanelClass,
  labelClass,
} from '@/components/page-frame';
import { Notice } from '@/components/widgets';
import { apiJson } from '@/lib/api';
import { AnnouncementDialog, postedOn, type Announcement } from '@/components/announcements';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface DraftImage {
  key: string;
  url?: string;
  file?: File;
  preview: string;
}

function imageProblem(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_TYPES.has(file.type) || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) {
    return 'Pictures must be JPEG, PNG, or WebP';
  }
  if (file.size > 5 * 1024 * 1024) return 'Each picture must be 5 MB or smaller';
  return '';
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<DraftImage[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [preview, setPreview] = useState<Announcement | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    return apiJson<{ announcements: Announcement[] }>('/api/announcements').then((data) =>
      setItems(data.announcements),
    );
  }

  useEffect(() => {
    load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : 'Could not load announcements'),
    );
  }, []);

  function reset() {
    setTitle('');
    setBody('');
    setImages([]);
    setEditing(null);
  }

  function addImages(list: FileList | null) {
    const incoming = Array.from(list ?? []);
    if (incoming.length === 0) return;
    const next: DraftImage[] = [];
    for (const file of incoming) {
      const problem = imageProblem(file);
      if (problem) {
        setError(problem);
        return;
      }
      next.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });
    }
    setError('');
    setImages((current) => [...current, ...next].slice(0, 8));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const urls: string[] = [];
      for (const image of images) {
        if (image.url) {
          urls.push(image.url);
          continue;
        }
        if (!image.file) continue;
        const form = new FormData();
        form.append('image', image.file);
        const uploaded = await apiJson<{ image_url: string }>('/api/announcements/image', {
          method: 'POST',
          body: form,
        });
        urls.push(uploaded.image_url);
      }
      const payload = { title, body, images: urls };
      if (editing) {
        await apiJson(`/api/announcements/${editing}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setMessage('Announcement updated.');
      } else {
        await apiJson('/api/announcements', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Announcement posted. It is on the dashboard now.');
      }
      reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the announcement');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    setError('');
    setMessage('');
    try {
      await apiJson(`/api/announcements/${id}`, { method: 'DELETE' });
      if (editing === id) reset();
      setMessage('Announcement removed.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove the announcement');
    }
  }

  function startEdit(item: Announcement) {
    setEditing(item.id);
    setTitle(item.title);
    setBody(item.body);
    setImages(item.images.map((image) => ({ key: image.id, url: image.url, preview: image.url })));
  }

  return (
    <PageFrame
      title="Announcements"
      description="Post a title, photos, and a note. People see the newest one on their dashboard and can open older posts."
    >
      <Notice error={error} message={message} />
      <form className={formPanelClass} onSubmit={save}>
        <h2 className="text-ink text-sm font-semibold">
          {editing ? 'Edit announcement' : 'New announcement'}
        </h2>
        <label className="block">
          <span className={labelClass}>Title</span>
          <input
            className={fieldClass}
            required
            minLength={3}
            maxLength={160}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Text</span>
          <textarea
            className={`${fieldClass} min-h-32`}
            maxLength={8000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="What should people know?"
          />
        </label>
        <div>
          <span className={labelClass}>Photos</span>
          <input
            className={fieldClass}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(event) => {
              addImages(event.target.files);
              event.target.value = '';
            }}
          />
          <p className="text-mute mt-1.5 text-xs">
            Up to 8 pictures. JPEG, PNG, or WebP, 5 MB each.
          </p>
          {images.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {images.map((image) => (
                <li key={image.key} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.preview}
                    alt=""
                    className="h-20 w-20 rounded-[var(--app-radius-md)] object-cover"
                  />
                  <button
                    type="button"
                    className="bg-paper/90 text-ink absolute top-1 right-1 rounded px-1.5 text-xs"
                    onClick={() =>
                      setImages((current) => {
                        const target = current.find((item) => item.key === image.key);
                        if (target?.file) URL.revokeObjectURL(target.preview);
                        return current.filter((item) => item.key !== image.key);
                      })
                    }
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button className={buttonClass} type="submit" disabled={saving}>
            {editing ? 'Save changes' : 'Post'}
          </button>
          {editing ? (
            <button className={buttonSecondaryClass} type="button" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <article key={item.id} className={`${cardClass} flex flex-wrap items-center gap-4 p-4`}>
            {item.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.images[0].url}
                alt=""
                className="h-16 w-16 rounded-[var(--app-radius-md)] object-cover"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="text-ink truncate text-sm font-semibold">{item.title}</h3>
              <p className="text-mute text-xs">{postedOn(item.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={buttonSecondaryClass}
                onClick={() => setPreview(item)}
              >
                View
              </button>
              <button
                type="button"
                className={buttonSecondaryClass}
                onClick={() => startEdit(item)}
              >
                Edit
              </button>
              <button type="button" className={buttonDangerClass} onClick={() => remove(item.id)}>
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>

      {preview ? <AnnouncementDialog item={preview} onClose={() => setPreview(null)} /> : null}
    </PageFrame>
  );
}
