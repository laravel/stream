# Laravel Stream for React

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/dt/@laravel/stream-react" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/v/@laravel/stream-react" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/l/@laravel/stream-react" alt="License"></a>
</p>

Easily consume streams in your React application.

## Installation

```bash
npm install @laravel/stream-react
```

## Streaming Responses

> [!IMPORTANT]
> The `useStream` hook is currently in Beta, the API is subject to change prior to the v1.0.0 release. All notable changes will be documented in the [changelog](./../../CHANGELOG.md).

The `useStream` hook allows you to seamlessly consume [streamed responses](https://laravel.com/docs/responses#streamed-responses) in your React application.

Provide your stream URL and the hook will automatically update `data` with the concatenated response as data is returned from your server:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { data, isFetching, isStreaming, send } = useStream("chat");

    const sendMessage = () => {
        send({
            message: `Current timestamp: ${Date.now()}`,
        });
    };

    return (
        <div>
            <div>{data}</div>
            {isFetching && <div>Connecting...</div>}
            {isStreaming && <div>Generating...</div>}
            <button onClick={sendMessage}>Send Message</button>
        </div>
    );
}
```

When sending data back to the stream, the active connection to the stream is canceled before sending the new data. All requests are sent as JSON `POST` requests.

The second argument given to `useStream` is an options object that you may use to customize the stream consumption behavior. The default values for this object are shown below:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { data } = useStream("chat", {
        id: undefined,
        initialInput: undefined,
        headers: undefined,
        csrfToken: undefined,
        credentials: undefined,
        onResponse: (response: Response) => void,
        onData: (data: string) => void,
        onCancel: () => void,
        onFinish: () => void,
        onError: (error: Error) => void,
    });

    return <div>{data}</div>;
}
```

`onResponse` is triggered after a successful initial response from the stream and the raw [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) is passed to the callback.

`onData` is called as each chunk is received, the current chunk is passed to the callback.

`onFinish` is called when a stream has finished and when an error is thrown during the fetch/read cycle.

By default, a request is not made the to stream on initialization. You may pass an initial payload to the stream by using the `initialInput` option:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { data } = useStream("chat", {
        initialInput: {
            message: "Introduce yourself.",
        },
    });

    return <div>{data}</div>;
}
```

To cancel a stream manually, you may use the `cancel` method returned from the hook:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { data, cancel } = useStream("chat");

    return (
        <div>
            <div>{data}</div>
            <button onClick={cancel}>Cancel</button>
        </div>
    );
}
```

Each time the `useStream` hook is used, a random `id` is generated to identify the stream. This is sent back to the server with each request in the `X-STREAM-ID` header.

When consuming the same stream from multiple components, you can read and write to the stream by providing your own `id`:

```tsx
// App.tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { data, id } = useStream("chat");

    return (
        <div>
            <div>{data}</div>
            <StreamStatus id={id} />
        </div>
    );
}

// StreamStatus.tsx
import { useStream } from "@laravel/stream-react";

function StreamStatus({ id }) {
    const { isFetching, isStreaming } = useStream("chat", { id });

    return (
        <div>
            {isFetching && <div>Connecting...</div>}
            {isStreaming && <div>Generating...</div>}
        </div>
    );
}
```

The `useJsonStream` hook is identical to the `useStream` hook except that it will attempt to parse the data as JSON once it has finished streaming:

```tsx
import { useJsonStream } from "@laravel/stream-react";

type User = {
    id: number;
    name: string;
    email: string;
};

function App() {
    const { data, send } = useJsonStream<{ users: User[] }>("users");

    const loadUsers = () => {
        send({
            query: "taylor",
        });
    };

    return (
        <div>
            <ul>
                {data?.users.map((user) => (
                    <li>
                        {user.id}: {user.name}
                    </li>
                ))}
            </ul>
            <button onClick={loadUsers}>Load Users</button>
        </div>
    );
}
```

## Event Streams (SSE)

The `useEventStream` hook allows you to seamlessly consume [Server-Sent Events (SSE)](https://laravel.com/docs/responses#event-streams) in your React application.

Provide your stream URL and the hook will automatically update `message` with the concatenated response as messages are returned from your server:

```tsx
import { useEventStream } from "@laravel/stream-react";

function App() {
    const { message } = useEventStream("/stream");

    return <div>{message}</div>;
}
```

You also have access to the array of message parts:

```tsx
import { useEventStream } from "@laravel/stream-react";

function App() {
    const { messageParts } = useEventStream("/stream");

    return (
        <ul>
            {messageParts.forEach((message) => (
                <li>{message}</li>
            ))}
        </ul>
    );
}
```

If you'd like to listen to multiple events:

```tsx
import { useEventStream } from "@laravel/stream-react";

function App() {
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

    return null;
}
```

The second parameter is an options object where all properties are optional (defaults are shown below):

```tsx
import { useEventStream } from "@laravel/stream-react";

function App() {
    const { message } = useEventStream("/stream", {
        event: "update",
        onMessage: (message) => {
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

    return <div>{message}</div>;
}
```

You can close the connection manually by using the returned `close` function:

```tsx
import { useEventStream } from "@laravel/stream-react";
import { useEffect } from "react";

function App() {
    const { message, close } = useEventStream("/stream");

    useEffect(() => {
        setTimeout(() => {
            close();
        }, 3000);
    }, []);

    return <div>{message}</div>;
}
```

The `clearMessage` function may be used to clear the message content that has been received so far:

```tsx
import { useEventStream } from "@laravel/stream-react";
import { useEffect } from "react";

function App() {
    const { message, clearMessage } = useEventStream("/stream");

    useEffect(() => {
        setTimeout(() => {
            clearMessage();
        }, 3000);
    }, []);

    return <div>{message}</div>;
}
```

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
