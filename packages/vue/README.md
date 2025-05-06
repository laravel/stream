# Laravel `useStream` Hooks for Vue

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

<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { message } = useStream("/stream");
</script>

<template>
    <div>{{ message }}</div>
</template>
````

You also have access to the array of message parts:

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

const { messageParts } = useStream("/stream");
</script>

<template>
  <ul>
    <li v-for="message in messageParts">
      {{ message }}
    </li>
  </ul>
</template>
```

The second parameter is options object, all properties are optional (defaults are shown here):

```vue
<script setup lang="ts">
import { useStream } from "@laravel/stream-vue";

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
</script>
```

## License

Laravel Stream is open-sourced software licensed under the [MIT license](LICENSE.md).
