# Laravel `useStream` Hooks for React and Vue

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/ci.yml"><img src="https://github.com/laravel/stream/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/dt/@laravel/stream-react" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/v/@laravel/stream-react" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-react"><img src="https://img.shields.io/npm/l/@laravel/stream-react" alt="License"></a>
</p>

This repo contains the code for the Laravel useStream hook for React and Vue. Using this hook will make it easier to handle Server-Sent Events (SSE) in your React and Vue applications.

## Installation

```bash
npm install @laravel/stream-react
```

## Usage

```tsx
import { useStream } from "@laravel/stream-react";

function App() {
    const { message } = useStream("/stream");

    return (
        <p className="text-lg font-medium max-w-2xl mx-auto text-center my-32">
            {message}
        </p>
    );
}
```

## Testing a Streamed Response

If you would like to test out a simple streamed response, you can use the following example.

Add the following to your `routes/web.php` file:

```php
Route::inertia('stream-test', 'stream-test');
Route::get('/stream', function () {
    return response()->eventStream(function () {
        $messages = [
            "This is an example of a",
            "streamed response. These messages",
            "come back as chunks, the",
            "client is then responsible for",
            "assembling them."
        ];

        foreach ($messages as $message) {
            yield "data: {$message}\n\n";
            sleep(1); // simulate streaming delay
        }

        // Send end signal
        yield "data: </stream>\n\n";
    });
});
```

```tsx
import { useStream } from "@laravel/stream-react";

export default function StreamTest() {
    const { message, onComplete } = useStream("/stream");

    onComplete(() => {
        console.log("Stream completed");
    });

    return (
        <p className="text-lg font-medium max-w-2xl mx-auto text-center my-32">
            {message}
        </p>
    );
}
```

## Stream Results

There are a few results you can get back from the **useStream** hook, which are the following:

-   **message** - The accumulated message
-   **messageParts** - Array of individual message parts
-   **onMessage** - Register a callback for message events
-   **onComplete** - Register a callback for stream completion
-   **onError** - Register a callback for errors

## Stream Params

In addition to the **Source** url that you pass into the `useStream('/source-url')`, you can also pass in the following params:

-   **eventName** - Optional custom event name (defaults to 'update')
-   **endSignal** - Optional custom end signal (defaults to '</stream>')
-   **separator** - Optional separator for joining message parts (defaults to ' ')

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
