# Laravel Stream for Vue

<p align="left">
<a href="https://github.com/laravel/stream/actions/workflows/tests.yml"><img src="https://github.com/laravel/stream/actions/workflows/tests.yml/badge.svg" alt="Build Status"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/dt/@laravel/stream-vue" alt="Total Downloads"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/v/@laravel/stream-vue" alt="Latest Stable Version"></a>
<a href="https://www.npmjs.com/package/@laravel/stream-vue"><img src="https://img.shields.io/npm/l/@laravel/stream-vue" alt="License"></a>
</p>

Easily consume [Server-Sent Events (SSE)](https://laravel.com/docs/responses#event-streams) in your Vue application.

## Installation

```bash
npm install @laravel/stream-vue
```

## Usage

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
