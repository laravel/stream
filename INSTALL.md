# Local Development and Testing

To test this package locally in another project, follow these steps:

## Option 1: Using npm link

1. In this package directory, run:

```bash
# Build the package first
npm run build

# Create a global link
npm link
```

2. In your project that wants to use this package, run:

```bash
# Link to the global package
npm link laravel-use-stream
```

3. Now you can import it in your project:

```js
import { useEventStream } from "laravel-use-stream/react";
// or
import { useEventStream } from "laravel-use-stream/vue";
```

## Option 2: Install from local directory

1. In this package directory, run:

```bash
# Build the package first
npm run build
```

2. In your project, install the package directly from the local directory:

```bash
npm install /path/to/laravel-use-stream
```

## Troubleshooting

If you're still having issues:

1. Make sure TypeScript can find the types by adding to your project's tsconfig.json:

```json
{
    "compilerOptions": {
        "paths": {
            "laravel-use-stream/*": ["./node_modules/laravel-use-stream/dist/*"]
        }
    }
}
```

2. If using a bundler like webpack or vite, you might need to configure it to resolve the package correctly.

3. Check that the package.json in this package has the correct "exports" configuration.
