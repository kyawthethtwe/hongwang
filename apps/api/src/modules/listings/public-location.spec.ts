import { distanceMeters, publicLocationFor, PUBLIC_OFFSET_MAX_M, PUBLIC_OFFSET_MIN_M } from './public-location';

describe('publicLocationFor', () => {
  const door = { x: 100.5452, y: 13.7801 };

  it('is deterministic per listing id', () => {
    const id = '7d1f7c2e-4a7b-4f3e-9a51-1c2d3e4f5a6b';
    expect(publicLocationFor(id, door)).toEqual(publicLocationFor(id, door));
  });

  it('moves the pin 150-350 m from the front door for many ids', () => {
    for (let i = 0; i < 300; i++) {
      const id = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      const d = distanceMeters(door, publicLocationFor(id, door));
      expect(d).toBeGreaterThanOrEqual(PUBLIC_OFFSET_MIN_M - 1);
      expect(d).toBeLessThanOrEqual(PUBLIC_OFFSET_MAX_M + 1);
    }
  });

  it('differs between listings', () => {
    const a = publicLocationFor('aaaaaaaa-0000-4000-8000-000000000000', door);
    const b = publicLocationFor('bbbbbbbb-0000-4000-8000-000000000000', door);
    expect(a).not.toEqual(b);
  });

  it('keeps the same offset when the pin moves slightly (no averaging attack)', () => {
    const id = 'cccccccc-0000-4000-8000-000000000000';
    const p1 = publicLocationFor(id, door);
    const p2 = publicLocationFor(id, { x: door.x + 0.0001, y: door.y });
    expect(p2.x - p1.x).toBeCloseTo(0.0001, 6);
    expect(p2.y - p1.y).toBeCloseTo(0, 6);
  });
});
