'use client';

import { avatarUploadInputSchema, type MeDto, type UploadTarget } from '@hongwang/shared';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/surfaces';
import { apiFetch, errorMessage } from '@/lib/api/client';
import { useUpdateProfile } from '@/lib/auth/queries';

const ACCEPT = avatarUploadInputSchema.shape.contentType.options;
const MAX_BYTES = 5 * 1024 * 1024;

/** Profile photo: upload target from the API, PUT straight to storage, then PATCH /users/me. */
export function AvatarUploader({ user }: { user: MeDto }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);
  const update = useUpdateProfile();
  const name = `${user.firstName} ${user.lastName}`.trim();

  async function upload(file: File) {
    if (!(ACCEPT as readonly string[]).includes(file.type)) return void toast.error('Use a JPG, PNG or WebP photo.');
    if (file.size > MAX_BYTES) return void toast.error('That photo is over 5 MB. Try a smaller one.');
    setBusy('upload');
    try {
      const target = await apiFetch<UploadTarget>('/users/me/avatar/upload-url', {
        method: 'POST',
        body: { contentType: file.type, size: file.size },
      });
      const put = await fetch(target.uploadUrl, { method: target.method, headers: target.headers, body: file });
      if (!put.ok) throw new Error('The upload didn’t go through. Please try again.');
      await update.mutateAsync({ avatarUrl: target.publicUrl });
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await update.mutateAsync({ avatarUrl: null });
      toast.success('Photo removed');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Avatar name={name} src={user.avatarUrl} size={72} className="bg-info-bg text-info-ink" />
      <input
        ref={input}
        type="file"
        accept={ACCEPT.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button variant="outline" className="font-medium" loading={busy === 'upload'} disabled={!!busy} onClick={() => input.current?.click()}>
        {user.avatarUrl ? 'Change photo' : 'Upload photo'}
      </Button>
      {user.avatarUrl && (
        <Button variant="ghost" loading={busy === 'remove'} disabled={!!busy} onClick={remove}>
          Remove
        </Button>
      )}
    </div>
  );
}
