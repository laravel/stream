# Laravel Stream for React

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/dt/@laravel/stream-react" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/v/@laravel/stream-react" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/l/@laravel/stream-react" alt="License"></a>
</p>

Easily consume [Server-Sent Events (SSE)](https://laravel.com/docs/responses#event-streams) in your React application.

## Installation

```bash
npm install @laravel/stream-react
```

## Usage

Provide your stream URL and the hook will automatically update the `message` with the concatenated response as messages are returned from your server:

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
