import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { createApp } from "vue";
import { useEventStream } from "../src/composables/useEventStream";

function withSetup(composable) {
    let result;

    const app = createApp({
        setup() {
            result = composable();
            return () => {};
        },
    });

    app.mount(document.createElement("div"));

    return [result, app];
}

describe("useEventStream", () => {
    let mocks;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        mocks = global.createEventSourceMock();
    });

    test("useEventStream initializes with default values", () => {
        const [result] = withSetup(() => useEventStream("/stream"));

        expect(result.message.value).toBe("");
        expect(result.messageParts.value).toEqual([]);
        expect(typeof result.clearMessage).toBe("function");
        expect(typeof result.close).toBe("function");
    });

    it("processes incoming messages correctly", async () => {
        const [result] = withSetup(() => useEventStream("/stream"));

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" });

        expect(result.message.value).toBe("Hello");
        expect(result.messageParts.value).toEqual(["Hello"]);

        eventHandler({ data: "World" });

        expect(result.message.value).toBe("Hello World");
        expect(result.messageParts.value).toEqual(["Hello", "World"]);
    });

    it("processes incoming messages correctly with replace option", async () => {
        const [result] = withSetup(() =>
            useEventStream("/stream", { replace: true }),
        );

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" });

        expect(result.message.value).toBe("Hello");
        expect(result.messageParts.value).toEqual(["Hello"]);

        eventHandler({ data: "World" });

        expect(result.message.value).toBe("World");
        expect(result.messageParts.value).toEqual(["World"]);
    });

    it("can clear the message", async () => {
        const [result] = withSetup(() => useEventStream("/stream"));

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" });
        eventHandler({ data: "World" });

        expect(result.message.value).toBe("Hello World");
        expect(result.messageParts.value).toEqual(["Hello", "World"]);

        result.clearMessage();

        expect(result.message.value).toBe("");
        expect(result.messageParts.value).toEqual([]);
    });

    it("can close the stream manually", async () => {
        const onCompleteMock = vi.fn();
        const [result] = withSetup(() =>
            useEventStream("/stream", { onComplete: onCompleteMock }),
        );

        result.close();

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).not.toHaveBeenCalled();
    });

    it("can handle custom glue", async () => {
        const [result] = withSetup(() =>
            useEventStream("/stream", { glue: "|" }),
        );

        const eventHandler = mocks.addEventListener.mock.calls[0][1];

        eventHandler({ data: "Hello" });
        expect(result.message.value).toBe("Hello");
        expect(result.messageParts.value).toEqual(["Hello"]);

        eventHandler({ data: "World" });
        expect(result.message.value).toBe("Hello|World");
        expect(result.messageParts.value).toEqual(["Hello", "World"]);
    });

    it("handles end signal correctly", async () => {
        const onCompleteMock = vi.fn();
        const [result] = withSetup(() =>
            useEventStream("/stream", { onComplete: onCompleteMock }),
        );

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        eventHandler({ data: "</stream>" });

        expect(mocks.close).toHaveBeenCalled();
        expect(onCompleteMock).toHaveBeenCalled();
    });

    test.each([{ endSignal: "WE DONE" }, { endSignal: "data: WE DONE" }])(
        "handles custom end signal correctly ($endSignal)",
        async ({ endSignal }) => {
            const onCompleteMock = vi.fn();
            const [result] = withSetup(() =>
                useEventStream("/stream", {
                    onComplete: onCompleteMock,
                    endSignal: "WE DONE",
                }),
            );

            const eventHandler = mocks.addEventListener.mock.calls[0][1];
            eventHandler({ data: endSignal });

            expect(mocks.close).toHaveBeenCalled();
            expect(onCompleteMock).toHaveBeenCalled();
        },
    );

    it("handles errors correctly", async () => {
        const onErrorMock = vi.fn();
        const [result] = withSetup(() =>
            useEventStream("/stream", { onError: onErrorMock }),
        );

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
        const [result] = withSetup(() =>
            useEventStream("/stream", {
                onMessage: onMessageMock,
            }),
        );

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        const testEvent = { data: "Test message" };

        eventHandler(testEvent);

        expect(onMessageMock).toHaveBeenCalledWith(testEvent);
    });

    it("cleans up EventSource on unmount", async () => {
        const [result, app] = withSetup(() => useEventStream("/stream"));

        app.unmount();

        expect(mocks.close).toHaveBeenCalled();
        expect(mocks.removeEventListener).toHaveBeenCalled();
    });

    it("reconnects when URL changes", async () => {
        const mockClose = vi.fn();
        let eventSourceCount = 0;

        vi.stubGlobal(
            "EventSource",
            vi.fn(function EventSourceMock() {
                eventSourceCount++;
                return {
                    addEventListener: vi.fn(),
                    removeEventListener: vi.fn(),
                    close: mockClose,
                };
            }),
        );

        const [result, app] = withSetup(() => useEventStream("/stream1"));

        expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);

        app.unmount();

        const [newResult, newApp] = withSetup(() => useEventStream("/stream2"));

        expect(mockClose).toHaveBeenCalled();
        expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
        expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith("/stream2");
    });

    it("can handle multiple events", async () => {
        const onMessageMock = vi.fn();
        withSetup(() =>
            useEventStream("/stream", {
                onMessage: onMessageMock,
                eventName: ["message", "customEvent"],
            }),
        );

        const eventHandler = mocks.addEventListener.mock.calls[0][1];
        const testEvent1 = { data: "Test message", type: "message" };
        const testEvent2 = { data: "Test custom event", type: "customEvent" };

        eventHandler(testEvent1);
        eventHandler(testEvent2);

        expect(onMessageMock).toHaveBeenCalledWith(testEvent1);
        expect(onMessageMock).toHaveBeenCalledWith(testEvent2);
    });

    it("will ignore events we are not listening to", async () => {
        const onMessageMock = vi.fn();
        withSetup(() =>
            useEventStream("/stream", {
                onMessage: onMessageMock,
                eventName: ["message", "customEvent"],
            }),
        );

        const testEvent1 = { data: "Test message", type: "message" };
        const testEvent2 = { data: "Test custom event", type: "customEvent" };
        const ignoredEvent = { data: "Ignored event", type: "ignoredEvent" };

        mocks.triggerEvent("message", testEvent1);
        mocks.triggerEvent("customEvent", testEvent2);
        mocks.triggerEvent("ignoredEvent", ignoredEvent);

        expect(onMessageMock).toHaveBeenCalledWith(testEvent1);
        expect(onMessageMock).toHaveBeenCalledWith(testEvent2);
        expect(onMessageMock).not.toHaveBeenCalledWith(ignoredEvent);
    });
});
