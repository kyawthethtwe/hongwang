import type { Metadata } from 'next';
import { Suspense } from 'react';
import { EditorView } from '@/components/host/editor/editor-view';

export const metadata: Metadata = { title: 'Edit listing' };

/** Listing editor, all sections (design C4). `?section=pricing` opens a step directly. */
export default async function ListingEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <EditorView id={id} />
    </Suspense>
  );
}
