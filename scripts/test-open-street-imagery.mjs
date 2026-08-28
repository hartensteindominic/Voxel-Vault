import assert from 'node:assert/strict';
import { fetchOpenStreetImagery, KARTAVIEW_LICENSE } from '../lib/open-street-imagery.js';

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    status: { httpCode: 200 },
    result: {
      data: [
        { id: 'p1', sequenceId: 's1', lat: '42.93680', lng: '-78.81573', heading: '12', shotDate: '2026-01-01', fileurlProc: 'https://storage1.openstreetcam.org/p1.jpg' },
        { id: 'p2', sequenceId: 's1', lat: '42.93681', lng: '-78.81571', heading: '16', shotDate: '2026-01-01', fileurlProc: 'https://storage1.openstreetcam.org/p2.jpg' },
        { id: 'p3', sequenceId: 's2', lat: '42.93679', lng: '-78.81575', heading: '104', shotDate: '2026-01-02', fileurlProc: 'https://storage1.openstreetcam.org/p3.jpg' },
        { id: 'p4', sequenceId: 's3', lat: '42.93682', lng: '-78.81578', heading: '205', shotDate: '2026-01-03', fileurlProc: 'https://storage1.openstreetcam.org/p4.jpg' },
        { id: 'p5', sequenceId: 's4', lat: '42.93684', lng: '-78.81580', heading: '300', shotDate: '2026-01-04', fileurlProc: 'https://storage1.openstreetcam.org/p5.jpg' },
      ],
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const result = await fetchOpenStreetImagery({ latitude: 42.936820258033464, longitude: -78.81574220673212, radiusMeters: 140 });
  assert.equal(result.ok, true);
  assert.equal(result.requiresPaidKey, false);
  assert.equal(result.license, KARTAVIEW_LICENSE);
  assert.equal(result.count, 4, 'open street imagery must remain bounded to four Meshy-friendly views');
  assert.equal(result.meshyReferences.length, 4);
  assert.ok(result.photos.every((photo) => photo.provider === 'KartaView'));
  assert.ok(result.meshyReferences.every((item) => item.rightsBasis === 'open-licensed'));
  assert.ok(result.meshyReferences.every((item) => /CC BY-SA 4\.0/.test(item.rightsReference)));
  assert.ok(new Set(result.photos.map((photo) => photo.heading)).size >= 3, 'view selection should prefer useful heading diversity');

  globalThis.fetch = async () => new Response('rate limited', { status: 429 });
  const unavailable = await fetchOpenStreetImagery({ latitude: 42.9368, longitude: -78.8157 });
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.count, 0);
  assert.deepEqual(unavailable.photos, []);
  assert.deepEqual(unavailable.meshyReferences, []);
  assert.match(unavailable.note, /optional/i);

  console.log('Open street imagery adapter checks passed: no paid key, bounded diverse KartaView views, CC BY-SA Meshy rights metadata, and clean provider failure.');
} finally {
  globalThis.fetch = originalFetch;
}
