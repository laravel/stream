# Laravel `useStream` Hooks for React and Vue

<p align="center">
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

## License

The MIT License (MIT). Please see [License File](LICENSE) for more information. 