/*
React Vite Tests
Each React and Vue test file contains 7 tests, which are the following:
    #1 Initialize with default values
    #2 Process incoming messages
    #3 Handle end signal
    #4 Handle errors
    #5 onMessage callback
    #6 Cleanup
    #7 URL change
*/
import { act, renderHook } from "@testing-library/react";
import { test } from "vitest";
import { useStream } from "../src";
import {
    assertInitialStreamState,
    testCleanup,
    testErrorHandling,
    testOnMessageCallback,
    testProcessMessages,
    testStreamCompletion,
    testUrlChange,
} from "./stream-tests";

// #1 Initialize with default values
test("useStream initializes with default values", () => {
    const { result } = renderHook(() => useStream("/stream"));
    assertInitialStreamState(result);
});

// #2 Process incoming messages
test("processes incoming messages correctly", async () => {
    testProcessMessages("react", renderHook, act, useStream);
});

// #3 Handle end signal
test("handles end signal correctly", async () => {
    testStreamCompletion("react", renderHook, act, useStream);
});

// #4 Handle errors
test("handles errors correctly", async () => {
    testErrorHandling("react", renderHook, act, useStream);
});

// #5 onMessage callback
test("onMessage callback is called with incoming messages", async () => {
    testOnMessageCallback("react", renderHook, act, useStream);
});

// #6 Cleanup
test("cleans up EventSource on unmount", async () => {
    testCleanup("react", renderHook, useStream);
});

// #7 URL change
test("reconnects when URL changes", async () => {
    testUrlChange("react", renderHook, useStream);
});
