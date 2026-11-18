import { projectChannel } from '@promptscope/shared';
import { projectContext } from '~/.server/context';
import { createSubscriber } from '~/.server/redis';
import type { Route } from './+types/events';

const KEEPALIVE_MS = 25_000;

export function loader({ request, context }: Route.LoaderArgs) {
  const { project } = context.get(projectContext);
  const channel = projectChannel(project.id);
  const subscriber = createSubscriber();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: string) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${payload}\n\n`));
      const keepalive = setInterval(
        () => controller.enqueue(encoder.encode(': keepalive\n\n')),
        KEEPALIVE_MS,
      );
      const close = () => {
        clearInterval(keepalive);
        subscriber.disconnect();
        try {
          controller.close();
        } catch {
          // The client already went away.
        }
      };
      request.signal.addEventListener('abort', close);
      subscriber.on('message', (_channel, message) => send('update', message));
      await subscriber.subscribe(channel);
      send('ready', '{}');
    },
    cancel() {
      subscriber.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
