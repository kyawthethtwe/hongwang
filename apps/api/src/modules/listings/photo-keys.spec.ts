import { isListingPhotoKey, isSamePhotoSet, photoPrefix } from './photo-keys';

describe('photo keys', () => {
  const id = '7d1f7c2e-4a7b-4f3e-9a51-1c2d3e4f5a6b';

  it('accepts keys made by storage.newKey for this listing', () => {
    expect(isListingPhotoKey(id, `${photoPrefix(id)}0b8e5a52-3f0c-4d7e-a1e1-4c5d6e7f8a9b.jpg`)).toBe(true);
    expect(isListingPhotoKey(id, `listings/${id}/abc.webp`)).toBe(true);
  });

  it('rejects other listings, traversal and nested paths', () => {
    expect(isListingPhotoKey(id, 'listings/other-id/abc.jpg')).toBe(false);
    expect(isListingPhotoKey(id, `listings/${id}/../other/abc.jpg`)).toBe(false);
    expect(isListingPhotoKey(id, `listings/${id}/sub/abc.jpg`)).toBe(false);
    expect(isListingPhotoKey(id, `avatars/${id}/abc.jpg`)).toBe(false);
    expect(isListingPhotoKey(id, `listings/${id}/`)).toBe(false);
  });

  it('reorder needs exactly the current ids', () => {
    expect(isSamePhotoSet(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
    expect(isSamePhotoSet(['a', 'b', 'c'], ['a', 'b'])).toBe(false);
    expect(isSamePhotoSet(['a', 'b', 'c'], ['a', 'b', 'b'])).toBe(false);
    expect(isSamePhotoSet(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(false);
  });
});
