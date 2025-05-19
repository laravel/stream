# Laravel Stream for Vue

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/dt/@laravel/stream-vue" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/v/@laravel/stream-vue" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/l/@laravel/stream-vue" alt="License"></a>
</p>

Easily consume streams in your Vue application.

## Installation

```bash
npm install @laravel/stream-vue
```

## Streaming Responses

> [!IMPORTANT]
> The `useStream` hook is currently in Beta, the API is subject to change prior to the v1.0.0 release. All notable changes will be documented in the [changelog](./CHANGELOG.md).

The `useStream` hook allows you to seamlessly consume [streamed responses](https://laravel.com/docs/responses#streamed-responses) in your Vue application.

Provide your stream URL and the hook will automatically update `data` with the concatenated response as data is returned from your server:

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { data, isFetching, isStreaming, send } = useStream("chat");

const sendMessage = () => {
    send({
        message: `Current timestamp: ${Date.now()}`,
    });
};
</script>

<template>
    <div>
        <div>{{ data }}</div>
        <div v-if="isFetching">Connecting...</div>
        <div v-if="isStreaming">Generating...</div>
        <button @click="sendMessage">Send Message</button>
    </div>
</template>
```

When sending data back to the stream, the active connection to the stream is canceled before sending the new data. All requests are sent as JSON `POST` requests.

The second argument given to `useStream` is an options object that you may use to customize the stream consumption behavior. The default values for this object are shown below:

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { data } = useStream("chat", {
    id: undefined,
    initialInput: undefined,
    headers: undefined,
    csrfToken: undefined,
    onResponse: (response: Response) => void,
    onData: (data: string) => void,
    onCancel: () => void,
    onFinish: () => void,
    onError: (error: Error) => void,
});
</script>

<template>
    <div>{{ data }}</div>
</template>
```

`onResponse` is triggered after a successful initial response from the stream and the raw [Response](https://developer.mozilla.org/en-US/docs/Web/API/Response) is passed to the callback.

`onData` is called as each chunk is received, the current chunk is passed to the callback.

`onFinish` is called when a stream has finished and when an error is thrown during the fetch/read cycle.

By default, a request is not made the to stream on initialization. You may pass an initial payload to the stream by using the `initialInput` option:

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { data } = useStream("chat", {
    initialInput: {
        message: "Introduce yourself.",
    },
});
</script>

<template>
    <div>{{ data }}</div>
</template>
```

To cancel a stream manually, you may use the `cancel` method returned from the hook:

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { data, cancel } = useStream("chat");
</script>

<template>
    <div>
        <div>{{ data }}</div>
        <button @click="cancel">Cancel</button>
    </div>
</template>
```

Each time the `useStream` hook is used, a random `id` is generated to identify the stream. This is sent back to the server with each request in the `X-STREAM-ID` header.

When consuming the same stream from multiple components, you can read and write to the stream by providing your own `id`:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";
import StreamStatus from "./StreamStatus.vue";

const { data, id } = useStream("chat");
</script>

<template>
    <div>
        <div>{{ data }}</div>
        <StreamStatus :id="id" />
    </div>
</template>
```

```vue
<!-- StreamStatus.vue -->
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const props = defineProps<{
    id: string;
}>();

const { isFetching, isStreaming } = useStream("chat", { id: props.id });
</script>

<template>
    <div>
        <div v-if="isFetching">Connecting...</div>
        <div v-if="isStreaming">Generating...</div>
    </div>
</template>
```

## Event Streams (SSE)

The `useEventStream` hook allows you to seamlessly consume [Server-Sent Events (SSE)](https://laravel.com/docs/responses#event-streams) in your Vue application.

Provide your stream URL and the hook will automatically update the `message` with the concatenated response as messages are returned from your server:

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";

const { message } = useEventStream("/stream");
</script>

<template>
    <div>{{ message }}</div>
</template>
```

You also have access to the array of message parts:

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";

const { messageParts } = useEventStream("/stream");
</script>

<template>
    <ul>
        <li v-for="message in messageParts">
            {{ message }}
        </li>
    </ul>
</template>
```

If you'd like to listen to multiple events:

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";

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

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";

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
</script>
```

You can close the connection manually by using the returned `close` function:

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";
import { onMounted } from "vue";

const { message, close } = useEventStream("/stream");

onMounted(() => {
    setTimeout(() => {
        close();
    }, 3000);
});
</script>

<template>
    <div>{{ message }}</div>
</template>
```

The `clearMessage` function may be used to clear the message content that has been received so far:

```vue
<script setup lang="ts">
import { useEventStream } from "@laravel/stream-vue";
import { onMounted } from "vue";

const { message, clearMessage } = useEventStream("/stream");

onMounted(() => {
    setTimeout(() => {
        clearMessage();
    }, 3000);
});
</script>

<template>
    <div>{{ message }}</div>
</template>
```

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
