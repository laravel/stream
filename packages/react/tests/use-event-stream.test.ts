import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, test, vi } from "vitest";
import { useEventStream } from "../src/hooks/use-event-stream";

describe("useEventStream", () => {
  let mocks;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mocks = global.createEventSourceMock();
  });

  test("useEventStream initializes with default values", () => {
    const { result } = renderHook(() => useEventStream("/stream"));

    expect(result.current.message).toBe("");
    expect(result.current.messageParts).toEqual([]);
    expect(typeof result.current.clearMessage).toBe("function");
    expect(typeof result.current.close).toBe("function");
  });

  it("processes incoming messages correctly", async () => {
    const result = renderHook(() => useEventStream("/stream")).result;

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

  it("can clear the message", async () => {
    const result = renderHook(() => useEventStream("/stream")).result;

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

    act(() => {
      result.current.clearMessage();
    });

    expect(result.current.message).toBe("");
    expect(result.current.messageParts).toEqual([]);
  });

  it("can close the stream manually", async () => {
    const onCompleteMock = vi.fn();
    const result = renderHook(() =>
      useEventStream("/stream", {
        onComplete: onCompleteMock,
      }),
    ).result;

    act(() => {
      result.current.close();
    });

    expect(mocks.close).toHaveBeenCalled();
    expect(onCompleteMock).not.toHaveBeenCalled();
  });

  it("can handle custom glue", async () => {
    const result = renderHook(() =>
      useEventStream("/stream", {
        glue: "|",
      }),
    ).result;

    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    act(() => {
      eventHandler({ data: "Hello" });
    });

    expect(result.current.message).toBe("Hello");
    expect(result.current.messageParts).toEqual(["Hello"]);

    act(() => {
      eventHandler({ data: "World" });
    });

    expect(result.current.message).toBe("Hello|World");
    expect(result.current.messageParts).toEqual(["Hello", "World"]);
  });

  it("handles end signal correctly", async () => {
    const onCompleteMock = vi.fn();

    renderHook(() =>
      useEventStream("/stream", {
        onComplete: onCompleteMock,
      }),
    ).result;

    const eventHandler = mocks.addEventListener.mock.calls[0][1];

    act(() => {
      eventHandler({ data: "</stream>" });
    });

    expect(mocks.close).toHaveBeenCalled();
    expect(onCompleteMock).toHaveBeenCalled();
  });

  test.each([{ endSignal: "WE DONE" }, { endSignal: "data: WE DONE" }])(
    "handles custom end signal correctly ($endSignal)",
    async ({ endSignal }) => {
      const onCompleteMock = vi.fn();

      renderHook(() =>
        useEventStream("/stream", {
          onComplete: onCompleteMock,
          endSignal: "WE DONE",
        }),
      ).result;

      const eventHandler = mocks.addEventListener.mock.calls[0][1];

      act(() => {
        eventHandler({ data: endSignal });
      });

      expect(mocks.close).toHaveBeenCalled();
      expect(onCompleteMock).toHaveBeenCalled();
    },
  );

  it("handles errors correctly", async () => {
    const onErrorMock = vi.fn();

    renderHook(() =>
      useEventStream("/stream", {
        onError: onErrorMock,
      }),
    ).result;

    const errorHandler = mocks.addEventListener.mock.calls[1][1];
    const testError = new Error("EventSource connection error");

    act(() => {
      errorHandler(testError);
    });

    expect(onErrorMock).toHaveBeenCalled();
    const errorArg = onErrorMock.mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect(errorArg.message).toBe("EventSource connection error");
    expect(mocks.close).toHaveBeenCalled();
  });

  it("onMessage callback is called with incoming messages", async () => {
    const onMessageMock = vi.fn();

    renderHook(() =>
      useEventStream("/stream", {
        onMessage: onMessageMock,
      }),
    ).result;

    const eventHandler = mocks.addEventListener.mock.calls[0][1];
    const testEvent = { data: "Test message" };

    act(() => {
      eventHandler(testEvent);
    });

    expect(onMessageMock).toHaveBeenCalledWith(testEvent);
  });

  it("cleans up EventSource on unmount", async () => {
    const result = renderHook(() => useEventStream("/stream"));

    result.unmount();

    expect(mocks.close).toHaveBeenCalled();
    expect(mocks.removeEventListener).toHaveBeenCalledTimes(2);
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

    const { rerender } = renderHook((props) => useEventStream(props.url), {
      initialProps: { url: "/stream1" },
    });

    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);

    rerender({ url: "/stream2" });

    expect(mockClose).toHaveBeenCalled();
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith("/stream2");
  });
});
