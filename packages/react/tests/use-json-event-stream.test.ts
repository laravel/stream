import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    afterAll,
    afterEach,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { useJsonEventStream } from "../src/hooks/use-json-event-stream";

type TestEvent = { type: string };

describe("useJsonEventStream", () => {
    const url = "/chat";

    const streamOf = (chunks: string[], duration = 5) =>
        new HttpResponse(
            new ReadableStream({
                async start(controller) {
                    for (const chunk of chunks) {
                        await delay(duration);
                        controller.enqueue(new TextEncoder().encode(chunk));
                    }

                    controller.close();
                },
            }),
            { headers: { "Content-Type": "text/event-stream" } },
        );

    const server = setupServer();

    beforeAll(() => server.listen());
    afterEach(() => server.resetHandlers());
    afterAll(() => server.close());

    it("should post a body and parse each frame as its own event", async () => {
        const onFinish = vi.fn();
        let capturedBody: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedBody = await request.json();

                return streamOf([
                    'data: {"type":"start"}\n\n',
                    'data: {"type":"delta"}\n\n',
                    "data: </stream>\n\n",
                ]);
            }),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send({ message: "Hello" }));

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedBody).toEqual({ message: "Hello" });
        expect(result.current.events).toEqual([
            { type: "start" },
            { type: "delta" },
        ]);
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isStreaming).toBe(false);
    });

    it("should read a stream shaped like Laravel's eventStream helper", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'event: update\ndata: {"type":"one"}\n\n',
                    'event: update\ndata: {"type":"two"}\n\n',
                    "event: update\ndata: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
    });

    it("should only keep the named events when an event name is given", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'event: token\ndata: {"type":"kept"}\n\n',
                    'event: ping\ndata: {"type":"dropped"}\n\n',
                    'data: {"type":"unnamed"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, {
                eventName: "token",
                onFinish,
            }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "kept" }]);
    });

    it("should join frames split across chunk boundaries", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"ty',
                    'pe":"split"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "split" }]);
    });

    it("should read frames terminated with CRLF", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'event: update\r\ndata: {"type":"crlf"}\r\n\r\n',
                    "data: </stream>\r\n\r\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "crlf" }]);
    });

    it("should read a CRLF pair split across two chunks", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"one"}\r',
                    '\n\r\ndata: {"type":"two"}\r\n\r\n',
                    "data: </stream>\r\n\r\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
    });

    it("should join multi-line data and ignore comments", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    ': keep-alive\ndata: {"type":\ndata: "multiline"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "multiline" }]);
    });

    it("should accept a data field written without a space", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf(['data:{"type":"tight"}\n\n', "data: </stream>\n\n"]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "tight" }]);
    });

    it("should drop a malformed frame without ending the stream", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    "data: not json\n\n",
                    'data: {"type":"after"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "after" }]);
    });

    it("should call onEvent as each frame arrives", async () => {
        const onEvent = vi.fn();
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"one"}\n\n',
                    'data: {"type":"two"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onEvent, onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(onEvent).toHaveBeenCalledTimes(2);
        expect(onEvent).toHaveBeenNthCalledWith(1, { type: "one" });
        expect(onEvent).toHaveBeenNthCalledWith(2, { type: "two" });
    });

    it("should stop reading at the end signal", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"before"}\n\n',
                    "data: </stream>\n\n",
                    'data: {"type":"after"}\n\n',
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "before" }]);
    });

    it("should honor a custom end signal", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"before"}\n\n',
                    "data: [DONE]\n\n",
                    'data: {"type":"after"}\n\n',
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, {
                endSignal: "[DONE]",
                onFinish,
            }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([{ type: "before" }]);
    });

    it("should finish when the body closes without an end signal", async () => {
        const onFinish = vi.fn();

        // laravel/ai's AG-UI protocol sends no terminator frame, so the stream
        // simply ends when the body does...
        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"one"}\n\n',
                    'data: {"type":"two"}\n\n',
                ]),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(result.current.events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
        expect(result.current.isStreaming).toBe(false);
    });

    it("should send the initial input on mount", async () => {
        const onFinish = vi.fn();
        let capturedBody: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedBody = await request.json();

                return streamOf([
                    'data: {"type":"one"}\n\n',
                    "data: </stream>\n\n",
                ]);
            }),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, {
                initialInput: { message: "Hello" },
                onFinish,
            }),
        );

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedBody).toEqual({ message: "Hello" });
        expect(result.current.events).toEqual([{ type: "one" }]);
    });

    it("should use the request returned by onBeforeSend", async () => {
        const onFinish = vi.fn();
        let capturedHeaders: any;

        const onBeforeSend = vi.fn((request: RequestInit) => ({
            ...request,
            headers: {
                ...(request.headers as Record<string, string>),
                "X-Custom-Header": "custom-value",
            },
        }));

        server.use(
            http.post(url, ({ request }) => {
                capturedHeaders = request.headers;

                return streamOf([
                    'data: {"type":"one"}\n\n',
                    "data: </stream>\n\n",
                ]);
            }),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onBeforeSend, onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedHeaders.get("X-Custom-Header")).toBe("custom-value");
        expect(result.current.events).toEqual([{ type: "one" }]);
    });

    it("should not send when onBeforeSend returns false", async () => {
        const handler = vi.fn(() =>
            streamOf(['data: {"type":"one"}\n\n', "data: </stream>\n\n"]),
        );

        server.use(http.post(url, handler));

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onBeforeSend: () => false }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(result.current.isFetching).toBe(false));

        expect(handler).not.toHaveBeenCalled();
        expect(result.current.events).toEqual([]);
    });

    it("should report a non-OK response as an error", async () => {
        const onError = vi.fn();

        server.use(
            http.post(url, () => HttpResponse.text("Boom", { status: 422 })),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onError }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onError).toHaveBeenCalled());

        expect(onError.mock.calls[0][0].message).toBe("Boom");
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isStreaming).toBe(false);
    });

    it("should cancel an in-flight stream", async () => {
        const onCancel = vi.fn();
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf(
                    [
                        'data: {"type":"one"}\n\n',
                        'data: {"type":"two"}\n\n',
                        "data: </stream>\n\n",
                    ],
                    30,
                ),
            ),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { onCancel, onFinish }),
        );

        act(() => {
            result.current.send();
        });

        await waitFor(() => expect(result.current.events).toHaveLength(1));

        act(() => {
            result.current.cancel();
        });

        // A cancelled run must not also report itself finished...
        await new Promise((resolve) => setTimeout(resolve, 80));

        expect(onCancel).toHaveBeenCalled();
        expect(onFinish).not.toHaveBeenCalled();
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.events).toEqual([{ type: "one" }]);
    });

    it("should send the CSRF token and clear events on the next send", async () => {
        const csrfToken = "test-csrf-token";
        const onFinish = vi.fn();
        let capturedHeaders: any;

        server.use(
            http.post(url, ({ request }) => {
                capturedHeaders = request.headers;

                return streamOf([
                    'data: {"type":"one"}\n\n',
                    "data: </stream>\n\n",
                ]);
            }),
        );

        const { result } = renderHook(() =>
            useJsonEventStream<TestEvent>(url, { csrfToken, onFinish }),
        );

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));

        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Accept")).toBe("text/event-stream");
        expect(result.current.events).toHaveLength(1);

        await act(() => result.current.send());

        await waitFor(() => expect(onFinish).toHaveBeenCalledTimes(2));

        expect(result.current.events).toEqual([{ type: "one" }]);
    });
});
