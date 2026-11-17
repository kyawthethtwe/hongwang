'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MAX_PHOTO_BYTES, MIN_LISTING_PHOTOS, PHOTO_CONTENT_TYPES, type ListingPhotoDto } from '@hongwang/shared';
import { GripVertical, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/lib/api/client';
import { useDeletePhoto, useReorderPhotos, useUpdatePhotoCaption, useUploadPhoto } from '@/lib/queries/host';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { SectionFooter, type SectionProps } from './shared';

const ACCEPT = PHOTO_CONTENT_TYPES.join(',');

function PhotoTile({
  photo,
  index,
  onCaption,
  onDelete,
  deleting,
}: {
  photo: ListingPhotoDto;
  index: number;
  onCaption: (caption: string | null) => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });
  const [caption, setCaption] = useState(photo.caption ?? '');
  return (
    <figure
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('m-0 flex flex-col gap-1.5', isDragging && 'z-10 opacity-80')}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-button bg-tint-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.caption ?? `Photo ${index + 1}`} className="size-full object-cover" />
        {index === 0 && (
          <span className="absolute top-2 left-2 rounded-full bg-surface px-2 py-[3px] text-xs font-semibold">Cover photo</span>
        )}
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={`Move photo ${index + 1}. Use arrow keys after pressing space.`}
          className="absolute bottom-1.5 left-1.5 inline-flex size-11 cursor-grab touch-none items-center justify-center rounded-full bg-surface text-ink shadow-pop active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-5" />
        </button>
        <button
          type="button"
          aria-label={`Remove photo ${index + 1}`}
          disabled={deleting}
          onClick={onDelete}
          className="absolute top-1.5 right-1.5 inline-flex size-11 cursor-pointer items-center justify-center rounded-full bg-surface text-ink shadow-pop disabled:opacity-55"
        >
          {deleting ? <Spinner className="size-4" /> : <X aria-hidden className="size-5" />}
        </button>
      </div>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Caption
        <input
          type="text"
          maxLength={140}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            const next = caption.trim() || null;
            if (next !== (photo.caption ?? null)) onCaption(next);
          }}
          className="min-h-10 rounded-[8px] border border-line-strong px-2.5 text-sm font-normal text-ink focus:border-brand focus:outline-none"
        />
      </label>
    </figure>
  );
}

export function PhotosSection(props: SectionProps) {
  const { listing } = props;
  const upload = useUploadPhoto(listing.id);
  const caption = useUpdatePhotoCaption(listing.id);
  const reorder = useReorderPhotos(listing.id);
  const remove = useDeletePhoto(listing.id);
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const photos = [...listing.photos].sort((a, b) => a.position - b.position);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function addFiles(list: FileList | File[]) {
    const files = Array.from(list);
    for (const f of files) {
      if (!(PHOTO_CONTENT_TYPES as readonly string[]).includes(f.type)) {
        toast.error(`${f.name}: use JPG, PNG, WebP or HEIC.`);
        continue;
      }
      if (f.size > MAX_PHOTO_BYTES) {
        toast.error(`${f.name} is over 20 MB.`);
        continue;
      }
      setUploading((u) => [...u, f.name]);
      try {
        await upload.mutateAsync(f);
        props.onSaved(listing);
      } catch (err) {
        toast.error(errorMessage(err, `Couldn’t upload ${f.name}.`));
      } finally {
        setUploading((u) => {
          const i = u.indexOf(f.name);
          return i < 0 ? u : [...u.slice(0, i), ...u.slice(i + 1)];
        });
      }
    }
  }

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = photos.findIndex((p) => p.id === e.active.id);
    const to = photos.findIndex((p) => p.id === e.over!.id);
    const ids = arrayMove(photos, from, to).map((p) => p.id);
    reorder.mutate(ids, {
      onSuccess: () => props.onSaved(listing),
      onError: (err) => toast.error(errorMessage(err, 'Couldn’t reorder the photos.')),
    });
  }

  const count = photos.length;

  return (
    <div className="flex flex-col gap-5">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
        }}
        className={cn(
          'relative flex min-h-[150px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed p-5 text-center focus-within:outline-2 focus-within:outline-brand',
          dragOver ? 'border-brand bg-brand-soft' : 'border-disabled bg-canvas',
        )}
      >
        <Upload aria-hidden className="size-7 text-ink-2" />
        <span className="font-semibold">Drop photos here or browse</span>
        <span className="text-[13px] text-muted">JPG, PNG or HEIC · up to 20 MB each · landscape works best</span>
        <input
          type="file"
          accept={ACCEPT}
          multiple
          className="absolute size-px opacity-0"
          onChange={(e) => {
            if (e.target.files?.length) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      <p className={cn('m-0 font-semibold', count < MIN_LISTING_PHOTOS ? 'text-warn-ink' : 'text-ink')} aria-live="polite">
        {count} of at least {MIN_LISTING_PHOTOS} photos
        {uploading.length > 0 && <span className="font-normal text-muted"> · uploading {uploading.length}…</span>}
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">
            {photos.map((p, i) => (
              <PhotoTile
                key={p.id}
                photo={p}
                index={i}
                deleting={remove.isPending && remove.variables === p.id}
                onCaption={(c) =>
                  caption.mutate(
                    { photoId: p.id, caption: c },
                    {
                      onSuccess: () => props.onSaved(listing),
                      onError: (err) => toast.error(errorMessage(err, 'Couldn’t save the caption.')),
                    },
                  )
                }
                onDelete={() =>
                  remove.mutate(p.id, {
                    onSuccess: () => props.onSaved(listing),
                    onError: (err) => toast.error(errorMessage(err, 'Couldn’t remove the photo.')),
                  })
                }
              />
            ))}
            {uploading.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-button bg-line-soft text-[13px] text-muted"
              >
                <Spinner />
                <span className="max-w-[90%] truncate">{name}</span>
              </div>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <p className="m-0 text-sm text-muted">
        Drag to reorder. The first photo is the cover. Photos with phone numbers, LINE QR codes or watermarks are
        rejected in review.
      </p>
      <SectionFooter onBack={props.onBack} submitLabel="Continue" onContinue={props.onNext} saving={uploading.length > 0} />
    </div>
  );
}
