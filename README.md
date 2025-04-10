# Laravel `useStream` Hooks for React and Vue

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/ci.yml"><img src="https://github.com/laravel/stream/actions/workflows/ci.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/laravel-use-stream"><img src="https://img.shields.io/npm/dt/laravel-use-stream" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/laravel-use-stream"><img src="https://img.shields.io/npm/v/laravel-use-stream" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/laravel-use-stream"><img src="https://img.shields.io/npm/l/laravel-use-stream" alt="License"></a>
</p>

This repo contains the code for the Laravel useStream hook for React and Vue. Using this hook will make it easier to handle Server-Sent Events (SSE) in your React and Vue applications.

## Installation

```bash
npm install laravel-use-stream
```

## Usage

### React

```tsx
import { useStream } from 'laravel-use-stream/react';

function App() {
  const { message, streamComplete } = useStream('/stream-url');
  return (
    <div>
        <h1>My Stream</h1>
        <p>{message || 'Waiting for stream...'}</p>
        {streamComplete && <p>✓ Stream completed</p>}
    </div>
  );
}
```

### Vue

```vue
<template>
  <div>
    <h1>My Stream</h1>
    <p v-if="message">{{ message }}</p>
    <p v-if="streamComplete">✓ Stream completed</p>
  </div>
</template>

<script setup>
import { useStream } from 'laravel-use-stream/vue';

const { message, streamComplete } = useStream('/stream-url');
</script>
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

Now, create a new React component `resources/js/pages/stream-test.tsx` to test the stream:

```tsx
import { useStream } from 'laravel-use-stream/react';

export default function StreamTest() {
  const { message, streamComplete } = useStream('/stream');
  return (
    <div className="max-w-2xl mx-auto text-center my-32">
        <p className="text-lg font-medium">{message || 'Waiting for stream...'}</p>
        {streamComplete && <p className="text-green-500">✓ Stream completed</p>}
    </div>
  );
}
```

Or, in a Vue application, you can create a new component at `resources/js/pages/StreamTest.vue`:

```vue
<template>
  <div class="max-w-2xl mx-auto text-center my-32">
    <p class="text-lg font-medium" v-if="message">{{ message }}</p>
    <p class="text-green-500" v-if="streamComplete">✓ Stream completed</p>
  </div>
</template>

<script setup>
import { useStream } from 'laravel-use-stream/vue';

const { message, streamComplete } = useStream('/stream');
</script>
```

## License

The MIT License (MIT). Please see [License File](LICENSE) for more information. 