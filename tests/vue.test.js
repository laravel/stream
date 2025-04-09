/*
Vue Vite Tests
Each React and Vue test file contains 7 tests, which are the following:
    #1 Initialize with default values
    #2 Process incoming messages
    #3 Handle end signal
    #4 Handle errors
    #5 onMessage callback
    #6 Cleanup
    #7 URL change
*/
import { test } from 'vitest'
import { useStream } from '../src/vue';
import { createApp } from 'vue';
import {
    assertInitialStreamState,
    testProcessMessages,
    testStreamCompletion,
    testErrorHandling,
    testOnMessageCallback,
    testCleanup,
    testUrlChange
} from './stream-assertions';

// Helper function to test composables
function withSetup(composable) {
    let result;
    const app = createApp({
        setup() {
            result = composable();
            return () => {};
        }
    });
    app.mount(document.createElement('div'));
    return [result, app];
}

// #1 Initialize with default values
test('useStream initializes with default values', () => {
    const [result] = withSetup(() => useStream('/stream'));
    assertInitialStreamState(result);
});

// #2 Process incoming messages
test('processes incoming messages correctly', async () => {
    testProcessMessages('vue', withSetup, null, useStream);
});

// #3 Handle end signal
test('handles end signal correctly', async () => {
    testStreamCompletion('vue', withSetup, null, useStream);
});

// #4 Handle errors
test('handles errors correctly', async () => {
    testErrorHandling('vue', withSetup, null, useStream);
});

// #5 onMessage callback
test('onMessage callback is called with incoming messages', async () => {
    testOnMessageCallback('vue', withSetup, null, useStream);
});

// #6 Cleanup
test('cleans up EventSource on unmount', async () => {
    testCleanup('vue', withSetup, useStream);
});

// #7 URL change
test('reconnects when URL changes', async () => {
    testUrlChange('vue', withSetup, useStream);
});