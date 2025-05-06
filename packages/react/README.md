# Laravel `useStream` Hooks for React

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/dt/@laravel/stream-react" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/v/@laravel/stream-react" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/l/@laravel/stream-react" alt="License"></a>
</p>

Easily consume [Server-Sent Events (SSE)](https://laravel.com/docs/12.x/responses#event-streams) in your React application.

## Installation

```bash
npm install @laravel/stream-react
```

## Usage

Provide your stream URL and the hook will automatically update the `message` with the concatenated response as messages are returned from your server:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { message } = useStream("/stream");

    return <div>{message}</div>;
}
```

You also have access to the array of message parts:

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { messageParts } = useStream("/stream");

    return (
        <ul>
            {messageParts.forEach((message) => (
                <li>{message}</li>
            ))}
        </ul>
    );
}
```

The second parameter is options object, all properties are optional (defaults are shown here):

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { message } = useStream("/stream", {
        event: "update",
        endSignal: "</stream>",
        glue: " ",
        onMessage: (message) => {
            //
        },
        onError: (error) => {
            //
        },
        onComplete: () => {
            //
        },
    });

    return <div>{message}</div>;
}
```

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
