import { get } from "svelte/store";
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
import {
    JsonEventStream,
    JsonEventStreamState,
    useJsonEventStream,
} from "../src/useJsonEventStream.svelte";

type TestEvent = { type: string };

const state = (
    stream: JsonEventStream<TestEvent>,
): JsonEventStreamState<TestEvent> => get(stream);

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
    afterEach(() => {
        vi.clearAllMocks();
        server.resetHandlers();
    });
    afterAll(() => server.close());

    it("posts a body and parses each frame as its own event", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send({ message: "Hello" });

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedBody).toEqual({ message: "Hello" });
        expect(state(stream).events).toEqual([
            { type: "start" },
            { type: "delta" },
        ]);
        expect(state(stream).isFetching).toBe(false);
        expect(state(stream).isStreaming).toBe(false);
    });

    it("reads a stream shaped like Laravel's eventStream helper", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
    });

    it("only keeps the named events when an event name is given", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            eventName: "token",
            onFinish,
        });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "kept" }]);
    });

    it("joins frames split across chunk boundaries", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "split" }]);
    });

    it("reads frames terminated with CRLF", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    'event: update\r\ndata: {"type":"crlf"}\r\n\r\n',
                    "data: </stream>\r\n\r\n",
                ]),
            ),
        );

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "crlf" }]);
    });

    it("reads a CRLF pair split across two chunks", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
    });

    it("joins multi-line data and ignores comments", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf([
                    ': keep-alive\ndata: {"type":\ndata: "multiline"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "multiline" }]);
    });

    it("accepts a data field written without a space", async () => {
        const onFinish = vi.fn();

        server.use(
            http.post(url, () =>
                streamOf(['data:{"type":"tight"}\n\n', "data: </stream>\n\n"]),
            ),
        );

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "tight" }]);
    });

    it("drops a malformed frame without ending the stream", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "after" }]);
    });

    it("calls onEvent as each frame arrives", async () => {
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

        useJsonEventStream<TestEvent>(url, { onEvent, onFinish }).send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(onEvent).toHaveBeenCalledTimes(2);
        expect(onEvent).toHaveBeenNthCalledWith(1, { type: "one" });
        expect(onEvent).toHaveBeenNthCalledWith(2, { type: "two" });
    });

    it("stops reading at the end signal", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "before" }]);
    });

    it("honors a custom end signal", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            endSignal: "[DONE]",
            onFinish,
        });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([{ type: "before" }]);
    });

    it("finishes when the body closes without an end signal", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, { onFinish });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(state(stream).events).toEqual([
            { type: "one" },
            { type: "two" },
        ]);
        expect(state(stream).isStreaming).toBe(false);
    });

    it("sends the initial input on mount", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            initialInput: { message: "Hello" },
            onFinish,
        });

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedBody).toEqual({ message: "Hello" });
        expect(state(stream).events).toEqual([{ type: "one" }]);
    });

    it("uses the request returned by onBeforeSend", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            onBeforeSend,
            onFinish,
        });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalled());

        expect(capturedHeaders.get("X-Custom-Header")).toBe("custom-value");
        expect(state(stream).events).toEqual([{ type: "one" }]);
    });

    it("does not send when onBeforeSend returns false", async () => {
        const handler = vi.fn(() =>
            streamOf(['data: {"type":"one"}\n\n', "data: </stream>\n\n"]),
        );

        server.use(http.post(url, handler));

        const stream = useJsonEventStream<TestEvent>(url, {
            onBeforeSend: () => false,
        });

        stream.send();

        await vi.waitFor(() => expect(state(stream).isFetching).toBe(false));

        expect(handler).not.toHaveBeenCalled();
        expect(state(stream).events).toEqual([]);
    });

    it("reports a non-OK response as an error", async () => {
        const onError = vi.fn();

        server.use(
            http.post(url, () => HttpResponse.text("Boom", { status: 422 })),
        );

        const stream = useJsonEventStream<TestEvent>(url, { onError });

        stream.send();

        await vi.waitFor(() => expect(onError).toHaveBeenCalled());

        expect(onError.mock.calls[0][0].message).toBe("Boom");
        expect(state(stream).isFetching).toBe(false);
        expect(state(stream).isStreaming).toBe(false);
    });

    it("can cancel an in-flight stream", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            onCancel,
            onFinish,
        });

        stream.send();

        await vi.waitFor(() => expect(state(stream).events).toHaveLength(1));

        stream.cancel();

        // A cancelled run must not also report itself finished...
        await new Promise((resolve) => setTimeout(resolve, 80));

        expect(onCancel).toHaveBeenCalled();
        expect(onFinish).not.toHaveBeenCalled();
        expect(state(stream).isStreaming).toBe(false);
        expect(state(stream).events).toEqual([{ type: "one" }]);
    });

    it("sends the CSRF token and clears events on the next send", async () => {
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

        const stream = useJsonEventStream<TestEvent>(url, {
            csrfToken,
            onFinish,
        });

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(1));

        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Accept")).toBe("text/event-stream");
        expect(state(stream).events).toHaveLength(1);

        stream.send();

        await vi.waitFor(() => expect(onFinish).toHaveBeenCalledTimes(2));

        expect(state(stream).events).toEqual([{ type: "one" }]);
    });
});
