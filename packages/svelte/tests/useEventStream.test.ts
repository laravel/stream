import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { createEventStream } from "../src/createEventStream.svelte";

describe("createEventStream", () => {
    let mocks: ReturnType<typeof global.createEventSourceMock>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks = global.createEventSourceMock();
    });

    test("createEventStream initializes with default values", () => {
        const result = createEventStream("/stream");

        expect(result.message).toBe("");
        expect(result.messageParts).toEqual([]);
        expect(typeof result.clearMessage).toBe("function");
        expect(typeof result.close).toBe("function");
    });

    it("processes incoming messages correctly", async () => {
        const result = createEventStream("/stream");

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);

        expect(result.message).toBe("Hello");
        expect(result.messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);

        expect(result.message).toBe("Hello World");
        expect(result.messageParts).toEqual(["Hello", "World"]);
    });

    it("processes incoming messages correctly with replace option", async () => {
        const result = createEventStream("/stream", { replace: true });

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);

        expect(result.message).toBe("Hello");
        expect(result.messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);

        expect(result.message).toBe("World");
        expect(result.messageParts).toEqual(["World"]);
    });

    it("can clear the message", async () => {
        const result = createEventStream("/stream");

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);
        eventHandler({ data: "World" } as MessageEvent);

        expect(result.message).toBe("Hello World");
        expect(result.messageParts).toEqual(["Hello", "World"]);

        result.clearMessage();

        expect(result.message).toBe("");
        expect(result.messageParts).toEqual([]);
    });

    it("can close the stream manually", async () => {
        const onCompleteMock = vi.fn();
        const result = createEventStream("/stream", { onComplete: onCompleteMock });

        result.close();

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).not.toHaveBeenCalled();
    });

    it("can handle custom glue", async () => {
        const result = createEventStream("/stream", { glue: "|" });

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" } as MessageEvent);
        expect(result.message).toBe("Hello");
        expect(result.messageParts).toEqual(["Hello"]);

        eventHandler({ data: "World" } as MessageEvent);
        expect(result.message).toBe("Hello|World");
        expect(result.messageParts).toEqual(["Hello", "World"]);
    });

    it("handles end signal correctly", async () => {
        const onCompleteMock = vi.fn();
        const result = createEventStream("/stream", { onComplete: onCompleteMock });

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        eventHandler({ data: "</stream>" } as MessageEvent);

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).toHaveBeenCalled();
    });

    it("handles errors correctly", async () => {
        const onErrorMock = vi.fn();
        const result = createEventStream("/stream", { onError: onErrorMock });

        const errorHandler = mocks.addEventListener.mock.calls[1][1];
        const testError = new Error("EventSource connection error");

        errorHandler(testError);

        expect(onErrorMock).toHaveBeenCalled();
        const errorArg = onErrorMock.mock.calls[0][0];
        expect(errorArg).toBeInstanceOf(Error);
        expect(errorArg.message).toBe("EventSource connection error");
        expect(mocks.close).toHaveBeenCalled();
    });

    it("onMessage callback is called with incoming messages", async () => {
        const onMessageMock = vi.fn();
        const result = createEventStream("/stream", {
            onMessage: onMessageMock,
        });

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        const testEvent = { data: "Test message" } as MessageEvent;

        eventHandler(testEvent);

        expect(onMessageMock).toHaveBeenCalledWith(testEvent);
    });
});
