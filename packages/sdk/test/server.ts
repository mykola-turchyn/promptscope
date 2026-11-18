import type { IngestEventInput } from '@promptscope/shared/events';
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';

export const BASE_URL = 'http://ingest.test';
export const received: IngestEventInput[] = [];

export const server = setupServer(
  http.post(`${BASE_URL}/v1/ingest`, async ({ request }) => {
    const body = (await request.json()) as { events: IngestEventInput[] };
    received.push(...body.events);

    return HttpResponse.json({ accepted: body.events.length }, { status: 202 });
  }),
);

export function eventsOfType<T extends IngestEventInput['type']>(type: T) {
  return received.filter(
    (event): event is Extract<IngestEventInput, { type: T }> => event.type === type,
  );
}
