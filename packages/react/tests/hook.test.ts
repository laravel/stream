import { act, renderHook } from "@testing-library/react";
import { expect, it, test, vi } from "vitest";
import { useStream } from "../src";

test("useStream initializes with default values", () => {
    const { result } = renderHook(() => useStream("/stream"));

    expect(result.current.message).toBe("");
    expect(result.current.messageParts).toEqual([]);
    expect(typeof result.current.onMessage).toBe("function");
    expect(typeof result.current.onComplete).toBe("function");
    expect(typeof result.current.onError).toBe("function");
});

it("processes incoming messages correctly", async () => {
    const mocks = global.createEventSourceMock();

    const result = renderHook(() => useStream("/stream")).result;

    // Get the event handler, mimicking second arg in eventSource.addEventListener(eventName, eventHandler);
    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    act(() => {
        eventHandler({ data: "Hello" });
    });

    expect(result.current.message).toBe("Hello");
    expect(result.current.messageParts).toEqual(["Hello"]);

    act(() => {
        eventHandler({ data: "World" });
    });

    expect(result.current.message).toBe("Hello World");
    expect(result.current.messageParts).toEqual(["Hello", "World"]);
});

it("handles end signal correctly", async () => {
    const mocks = global.createEventSourceMock();
    const onCompleteMock = vi.fn();

    const result = renderHook(() => useStream("/stream")).result;

    act(() => {
        result.current.onComplete(onCompleteMock);
    });

    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    act(() => {
        eventHandler({ data: "</stream>" });
    });

    expect(mocks.close).toHaveBeenCalled();
    expect(onCompleteMock).toHaveBeenCalled();
});

it("handles errors correctly", async () => {
    const mocks = global.createEventSourceMock();
    const onErrorMock = vi.fn();

    const result = renderHook(() => useStream("/stream")).result;

    act(() => {
        result.current.onError(onErrorMock);
    });

    act(() => {
        mocks.triggerError();
    });

    expect(onErrorMock).toHaveBeenCalled();
    const errorArg = onErrorMock.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe("EventSource connection error");
    expect(mocks.close).toHaveBeenCalled();
});

it("onMessage callback is called with incoming messages", async () => {
    const mocks = global.createEventSourceMock();

    const result = renderHook(() => useStream("/stream")).result;

    const onMessageMock = vi.fn();

    act(() => {
        result.current.onMessage(onMessageMock);
    });

    const eventHandler = mocks.addEventListener.mock.calls[0][1];
    const testEvent = { data: "Test message" };

    act(() => {
        eventHandler(testEvent);
    });

    // Check if the callback was called with the event
    expect(onMessageMock).toHaveBeenCalledWith(testEvent);
});

it("cleans up EventSource on unmount", async () => {
    const mocks = global.createEventSourceMock();

    const result = renderHook(() => useStream("/stream"));

    result.unmount();

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

    const { rerender } = renderHook((props) => useStream(props.url), {
        initialProps: { url: "/stream1" },
    });

    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);

    rerender({ url: "/stream2" });

    expect(mockClose).toHaveBeenCalled();
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith("/stream2");
});
