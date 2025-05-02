import { expect, it, test, vi } from "vitest";
import { createApp } from "vue";
import { useStream } from "../src";

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

test("useStream initializes with default values", () => {
    const [result] = withSetup(() => useStream("/stream"));

    expect(result.message.value).toBe("");
    expect(result.messageParts.value).toEqual([]);
    expect(typeof result.onMessage).toBe("function");
    expect(typeof result.onComplete).toBe("function");
    expect(typeof result.onError).toBe("function");
});

it("processes incoming messages correctly", async () => {
    const mocks = global.createEventSourceMock();

    const result = withSetup(() => useStream("/stream"))[0];

    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    eventHandler({ data: "Hello" });

    expect(result.message.value).toBe("Hello");
    expect(result.messageParts.value).toEqual(["Hello"]);

    eventHandler({ data: "World" });

    expect(result.message.value).toBe("Hello World");
    expect(result.messageParts.value).toEqual(["Hello", "World"]);
});

it("handles end signal correctly", async () => {
    const mocks = global.createEventSourceMock();
    const onCompleteMock = vi.fn();

    const result = withSetup(() => useStream("/stream"))[0];

    result.onComplete(onCompleteMock);

    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    eventHandler({ data: "</stream>" });

    expect(mocks.close).toHaveBeenCalled();
    expect(onCompleteMock).toHaveBeenCalled();
});

it("handles errors correctly", async () => {
    const mocks = global.createEventSourceMock();
    const onErrorMock = vi.fn();

    const result = withSetup(() => useStream("/stream"))[0];

    result.onError(onErrorMock);

    mocks.triggerError();

    expect(onErrorMock).toHaveBeenCalled();

    const errorArg = onErrorMock.mock.calls[0][0];

    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe("EventSource connection error");
    expect(mocks.close).toHaveBeenCalled();
});

it("onMessage callback is called with incoming messages", async () => {
    const mocks = global.createEventSourceMock();

    const result = withSetup(() => useStream("/stream"))[0];

    const onMessageMock = vi.fn();

    result.onMessage(onMessageMock);

    const eventHandler = mocks.addEventListener.mock.calls[0][1];
    const testEvent = { data: "Test message" };

    eventHandler(testEvent);

    expect(onMessageMock).toHaveBeenCalledWith(testEvent);
});

it("cleans up EventSource on unmount", async () => {
    const mocks = global.createEventSourceMock();

    const rendered = withSetup(() => useStream("/stream"));

    rendered[1].unmount();

    expect(mocks.close).toHaveBeenCalled();
    expect(mocks.removeEventListener).toHaveBeenCalled();
});

it("reconnects when URL changes", async () => {
    const mockClose = vi.fn();
    let eventSourceCount = 0;

    vi.stubGlobal(
        "EventSource",
        vi.fn().mockImplementation(() => {
            eventSourceCount++;
            return {
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                close: mockClose,
            };
        }),
    );

    const [result, app] = withSetup(() => useStream("/stream1"));

    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);

    app.unmount();

    const [newResult, newApp] = withSetup(() => useStream("/stream2"));

    expect(mockClose).toHaveBeenCalled();
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith("/stream2");
});
