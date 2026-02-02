# @laravel/stream-svelte

Laravel streaming helpers for Svelte 5 using runes (`$state`, `$effect`). Call `createStream` or `createEventStream` from your component's `<script>` (or from another `.svelte.ts` module) so reactivity is set up correctly.

## Installation

```bash
npm install @laravel/stream-svelte
# or
pnpm add @laravel/stream-svelte
# or
yarn add @laravel/stream-svelte
```

## Requirements

- Svelte 5.0.0 or higher
- Laravel backend with streaming support

## Usage

Call `createStream` or `createEventStream` at the top level of your component script (or in a `.svelte.ts` module). The returned object is reactive: use its properties in your template and they update automatically.

### createStream

The `createStream` function provides a reactive way to handle streaming responses from Laravel.

```svelte
<script>
  import { createStream } from '@laravel/stream-svelte';

  const stream = createStream('/api/stream', {
    initialInput: { query: 'test' }
  });
</script>

<div>
  {#if stream.isFetching}
    <p>Loading...</p>
  {:else if stream.isStreaming}
    <p>Streaming: {stream.data}</p>
  {:else}
    <p>Complete: {stream.data}</p>
  {/if}

  <button onclick={() => stream.send({ query: 'new query' })}>Send Request</button>
</div>
```

### createJsonStream

For JSON responses, use `createJsonStream`:

```svelte
<script>
  import { createJsonStream } from '@laravel/stream-svelte';

  const stream = createJsonStream('/api/stream');
</script>

<div>
  {#if stream.data}
    <pre>{JSON.stringify(stream.data, null, 2)}</pre>
  {/if}
</div>
```

### createEventStream

For Server-Sent Events (SSE):

```svelte
<script>
  import { createEventStream } from '@laravel/stream-svelte';

  const eventStream = createEventStream('/api/events', {
    eventName: 'update',
    onMessage: (event) => {
      console.log('Message received:', event.data);
    }
  });
</script>

<div>
  <p>Message: {eventStream.message}</p>
  <button onclick={() => eventStream.close()}>Close</button>
</div>
```

## API

### createStream

```typescript
function createStream<TSendBody, TJsonData>(
  url: string | (() => string),
  options?: StreamOptions<TSendBody>
): {
  data: string;
  jsonData: TJsonData | null;
  isFetching: boolean;
  isStreaming: boolean;
  id: string;
  send: (body?: TSendBody) => void;
  cancel: () => void;
  clearData: () => void;
}
```

### createEventStream

```typescript
function createEventStream(
  url: string | (() => string),
  options?: EventStreamOptions
): {
  message: string;
  messageParts: readonly string[];
  close: (resetMessage?: boolean) => void;
  clearMessage: () => void;
}
```

## Types

The package exports TypeScript types for options and return values: `StreamOptions`, `StreamMeta`, `EventStreamOptions`, and `EventStreamResult`. Use them to type your stream options or component props.

## Options

See the [main documentation](https://github.com/laravel/stream) for full options and API details.
