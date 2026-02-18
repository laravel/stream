import { get } from "svelte/store";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { createEventStream } from "../src/createEventStream.svelte";

const state = (stream: ReturnType<typeof createEventStream>) => get(stream);

describe("createEventStream", () => {
    let mocks: ReturnType<typeof global.createEventSourceMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks = global.createEventSourceMock();
    });

    test("createEventStream initializes with default values", () => {
        const result = createEventStream("/stream");

        expect(state(result).message).toBe("");
        expect(state(result).messageParts).toEqual([]);
        expect(typeof result.clearMessage).toBe("function");
        expect(typeof result.close).toBe("function");
    });

    it("processes incoming messages correctly", async () => {
        const result = createEventStream("/stream");
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);

        expect(state(result).message).toBe("Hello");
        expect(state(result).messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);

        expect(state(result).message).toBe("Hello World");
        expect(state(result).messageParts).toEqual(["Hello", "World"]);
    });

    it("processes incoming messages correctly with replace option", async () => {
        const result = createEventStream("/stream", { replace: true });
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);

        expect(state(result).message).toBe("Hello");
        expect(state(result).messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);

        expect(state(result).message).toBe("World");
        expect(state(result).messageParts).toEqual(["World"]);
    });

    it("can clear the message", async () => {
        const result = createEventStream("/stream");
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);
        eventHandler({ data: "World" } as MessageEvent);

        expect(state(result).message).toBe("Hello World");
        expect(state(result).messageParts).toEqual(["Hello", "World"]);

        result.clearMessage();

        expect(state(result).message).toBe("");
        expect(state(result).messageParts).toEqual([]);
    });

    it("can close the stream manually", async () => {
        const onCompleteMock = vi.fn();
        const result = createEventStream("/stream", { onComplete: onCompleteMock });
        await Promise.resolve();

        result.close();

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).not.toHaveBeenCalled();
    });

    it("clears message and messageParts when close is called with resetMessage true", async () => {
        const result = createEventStream("/stream");
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);
        eventHandler({ data: "World" } as MessageEvent);

        expect(state(result).message).toBe("Hello World");
        expect(state(result).messageParts).toEqual(["Hello", "World"]);

        result.close(true);

        expect(state(result).message).toBe("");
        expect(state(result).messageParts).toEqual([]);
    });

    it("can handle custom glue", async () => {
        const result = createEventStream("/stream", { glue: "|" });
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);
        expect(state(result).message).toBe("Hello");
        expect(state(result).messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);
        expect(state(result).message).toBe("Hello|World");
        expect(state(result).messageParts).toEqual(["Hello", "World"]);
    });

    it("handles end signal correctly", async () => {
        const onCompleteMock = vi.fn();
        const result = createEventStream("/stream", { onComplete: onCompleteMock });
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        eventHandler({ data: "</stream>" } as MessageEvent);

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).toHaveBeenCalled();
    });

    it("handles errors correctly", async () => {
        const onErrorMock = vi.fn();
        const result = createEventStream("/stream", { onError: onErrorMock });
        await Promise.resolve();

        const errorHandler = mocks.addEventListener.mock.calls[1][1];
        const testError = new Error("EventSource connection error");

        errorHandler(testError);

        expect(onErrorMock).toHaveBeenCalled();
        const errorArg = onErrorMock.mock.calls[0][0];
        expect(errorArg).toBeInstanceOf(Error);
        expect(errorArg.message).toBe("EventSource connection error");
        expect(mocks.close).toHaveBeenCalled();
    });

    it("handles EventSource error event by passing Error to onError", async () => {
        const onErrorMock = vi.fn();
        const result = createEventStream("/stream", { onError: onErrorMock });
        await Promise.resolve();

        const errorHandler = mocks.addEventListener.mock.calls[1][1];
        const eventLike = new Event("error");

        errorHandler(eventLike);

        expect(onErrorMock).toHaveBeenCalled();
        const errorArg = onErrorMock.mock.calls[0][0];
        expect(errorArg).toBeInstanceOf(Error);
        expect(errorArg.message).toContain("EventSource");
        expect(mocks.close).toHaveBeenCalled();
    });

    it("receives messages from multiple event names when eventName is array", async () => {
        const result = createEventStream("/stream", { eventName: ["update", "create"] });
        await Promise.resolve();

        const updateHandler = mocks.addEventListener.mock.calls[0][1];
        const createHandler = mocks.addEventListener.mock.calls[1][1];

        updateHandler({ data: "from-update" } as MessageEvent);
        expect(state(result).message).toBe("from-update");
        expect(state(result).messageParts).toEqual(["from-update"]);

        createHandler({ data: "from-create" } as MessageEvent);
        expect(state(result).message).toBe("from-update from-create");
        expect(state(result).messageParts).toEqual(["from-update", "from-create"]);
    });

    it("onMessage callback is called with incoming messages", async () => {
        const onMessageMock = vi.fn();
        const result = createEventStream("/stream", {
            onMessage: onMessageMock,
        });
        await Promise.resolve();

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        const testEvent = { data: "Test message" } as MessageEvent;

        eventHandler(testEvent);

        expect(onMessageMock).toHaveBeenCalledWith(testEvent);
    });
});
