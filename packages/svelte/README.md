# Laravel Stream for Svelte

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-svelte"><img src="https://img.shields.io/npm/dt/@laravel/stream-svelte" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-svelte"><img src="https://img.shields.io/npm/v/@laravel/stream-svelte" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-svelte"><img src="https://img.shields.io/npm/l/@laravel/stream-svelte" alt="License"></a>
</p>

Easily consume streams in your Svelte application.

## Installation

```bash
npm install @laravel/stream-svelte
```

## Streaming Responses

> [!IMPORTANT]
> The `useStream` API is currently in Beta, the API is subject to change prior to the v1.0.0 release. All notable changes will be documented in the [changelog](./../../CHANGELOG.md).

The `useStream` function allows you to seamlessly consume [streamed responses](https://laravel.com/docs/responses#streamed-responses) in your Svelte application.

Call `useStream` at the top level of your component script (or in a `.svelte.ts` module). Provide your stream URL and the returned object will automatically update `data` with the concatenated response as data is returned from your server:

```svelte
<script>
    import { useStream } from "@laravel/stream-svelte";

    const stream = useStream("chat");

    const sendMessage = () => {
        stream.send({
            message: `Current timestamp: ${Date.now()}`,
        });
    };
</script>

<div>
    <div>{stream.data}</div>
    {#if stream.isFetching}
        <div>Connecting...</div>
    {/if}
    {#if stream.isStreaming}
        <div>Generating...</div>
    {/if}
    <button onclick={sendMessage}>Send Message</button>
</div>
```

When sending data back to the stream, the active connection to the stream is canceled before sending the new data. All requests are sent as JSON `POST` requests.

The second argument given to `useStream` is an options object that you may use to customize the stream consumption behavior:

```ts
type StreamOptions = {
    id?: string;
    initialInput?: Record<string, any>;
    headers?: Record<string, string>;
    csrfToken?: string;
    json?: boolean;
    credentials?: RequestCredentials;
    onResponse?: (response: Response) => void;
    onData?: (data: string) => void;
    onCancel?: () => void;
    onFinish?: () => void;
    onError?: (error: Error) => void;
    onBeforeSend?: (request: RequestInit) => boolean | RequestInit | void;
};
```

`onResponse` is triggered after a successful initial response from the stream and the raw [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) is passed to the callback.

`onData` is called as each chunk is received, the current chunk is passed to the callback.

`onFinish` is called when a stream has finished and when an error is thrown during the fetch/read cycle.

`onBeforeSend` is called right before sending the request to the server and receives the `RequestInit` object as an argument. Returning `false` from this callback cancels the request, returning a [`RequestInit`](https://developer.mozilla.org/en-US/docs/Web/API/RequestInit) object will override the existing `RequestInit` object.

By default, a request is not made to the stream on initialization. You may pass an initial payload to the stream by using the `initialInput` option:

```svelte
<script>
    import { useStream } from "@laravel/stream-svelte";

    const stream = useStream("chat", {
        initialInput: {
            message: "Introduce yourself.",
        },
    });
</script>

<div>{stream.data}</div>
```

To cancel a stream manually, you may use the `cancel` method returned from the stream object:

```svelte
<script>
    import { useStream } from "@laravel/stream-svelte";

    const stream = useStream("chat");
</script>

<div>
    <div>{stream.data}</div>
    <button onclick={() => stream.cancel()}>Cancel</button>
</div>
```

Each time `useStream` is used, a random `id` is generated to identify the stream. This is sent back to the server with each request in the `X-STREAM-ID` header.

When consuming the same stream from multiple components, you can read and write to the stream by providing your own `id`:

```svelte
<!-- App.svelte -->
<script>
    import { useStream } from "@laravel/stream-svelte";
    import StreamStatus from "./StreamStatus.svelte";

    const stream = useStream("chat");
</script>

<div>
    <div>{stream.data}</div>
    <StreamStatus id={stream.id} />
</div>
```

```svelte
<!-- StreamStatus.svelte -->
<script>
    import { useStream } from "@laravel/stream-svelte";

    let { id } = $props();

    const stream = useStream("chat", { id });
</script>

<div>
    {#if stream.isFetching}
        <div>Connecting...</div>
    {/if}
    {#if stream.isStreaming}
        <div>Generating...</div>
    {/if}
</div>
```

The `useJsonStream` function is identical to `useStream` except that it will attempt to parse the data as JSON once it has finished streaming:

```svelte
<script>
    import { useJsonStream } from "@laravel/stream-svelte";

    type User = {
        id: number;
        name: string;
        email: string;
    };

    const stream = useJsonStream<{ users: User[] }>("users");

    const loadUsers = () => {
        stream.send({
            query: "taylor",
        });
    };
</script>

<div>
    <ul>
        {#if stream.data?.users}
            {#each stream.data.users as user (user.id)}
                <li>{user.id}: {user.name}</li>
            {/each}
        {/if}
    </ul>
    <button onclick={loadUsers}>Load Users</button>
</div>
```

## Event Streams (SSE)

The `useEventStream` function allows you to seamlessly consume [Server-Sent Events (SSE)](https://laravel.com/docs/responses#event-streams) in your Svelte application.

Provide your stream URL and the returned object will automatically update `message` with the concatenated response as messages are returned from your server:

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";

    const eventStream = useEventStream("/stream");
</script>

<div>{eventStream.message}</div>
```

You also have access to the array of message parts:

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";

    const eventStream = useEventStream("/stream");
</script>

<ul>
    {#each eventStream.messageParts as message}
        <li>{message}</li>
    {/each}
</ul>
```

If you'd like to listen to multiple events:

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";

    useEventStream("/stream", {
        eventName: ["update", "create"],
        onMessage: (event) => {
            if (event.type === "update") {
                // Handle update
            } else {
                // Handle create
            }
        },
    });
</script>
```

The second parameter is an options object where all properties are optional (defaults are shown below):

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";

    const eventStream = useEventStream("/stream", {
        eventName: "update",
        onMessage: (event) => {
            //
        },
        onError: (error) => {
            //
        },
        onComplete: () => {
            //
        },
        endSignal: "</stream>",
        glue: " ",
        replace: false,
    });
</script>
```

You can close the connection manually by using the returned `close` function:

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";
    import { onMount } from "svelte";

    const eventStream = useEventStream("/stream");

    onMount(() => {
        const timeout = setTimeout(() => {
            eventStream.close();
        }, 3000);
        return () => clearTimeout(timeout);
    });
</script>

<div>{eventStream.message}</div>
```

The `clearMessage` function may be used to clear the message content that has been received so far:

```svelte
<script>
    import { useEventStream } from "@laravel/stream-svelte";
    import { onMount } from "svelte";

    const eventStream = useEventStream("/stream");

    onMount(() => {
        const timeout = setTimeout(() => {
            eventStream.clearMessage();
        }, 3000);
        return () => clearTimeout(timeout);
    });
</script>

<div>{eventStream.message}</div>
```

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
