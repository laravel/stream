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
    StreamResponseError,
    streamJsonEvents,
} from "../src/streams/jsonEvents";

type TestEvent = { type: string };

describe("streamJsonEvents", () => {
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

    it("hands each event to the caller without collecting them", async () => {
        const seen: TestEvent[] = [];

        server.use(
            http.post(url, () =>
                streamOf([
                    'data: {"type":"one"}\n\n',
                    'data: {"type":"two"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        const sent = await streamJsonEvents<TestEvent>({
            url,
            body: { message: "Hello" },
            signal: new AbortController().signal,
            onEvent: (event) => seen.push(event),
        });

        expect(sent).toBe(true);
        expect(seen).toEqual([{ type: "one" }, { type: "two" }]);
    });

    it("resolves false when onBeforeSend refuses the request", async () => {
        const handler = vi.fn(() => streamOf(["data: </stream>\n\n"]));

        server.use(http.post(url, handler));

        const sent = await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            onBeforeSend: () => false,
            onEvent: () => undefined,
        });

        expect(sent).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it("calls onSend once the request is committed", async () => {
        const order: string[] = [];

        server.use(
            http.post(url, () =>
                streamOf(['data: {"type":"one"}\n\n', "data: </stream>\n\n"]),
            ),
        );

        await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            onBeforeSend: () => {
                order.push("before");
            },
            onSend: () => order.push("send"),
            onEvent: () => order.push("event"),
        });

        expect(order).toEqual(["before", "send", "event"]);
    });

    it("does not call onSend when onBeforeSend refuses", async () => {
        const onSend = vi.fn();

        server.use(http.post(url, () => streamOf(["data: </stream>\n\n"])));

        await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            onBeforeSend: () => false,
            onSend,
            onEvent: () => undefined,
        });

        expect(onSend).not.toHaveBeenCalled();
    });

    it("honors a renamed XSRF cookie and header", async () => {
        document.cookie = "MY-TOKEN=renamed";

        let capturedHeaders: Headers | undefined;

        server.use(
            http.post(url, ({ request }) => {
                capturedHeaders = request.headers;

                return streamOf(["data: </stream>\n\n"]);
            }),
        );

        await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            xsrfCookieName: "MY-TOKEN",
            xsrfHeaderName: "X-MY-TOKEN",
            onEvent: () => undefined,
        });

        document.cookie = "MY-TOKEN=; max-age=0";

        expect(capturedHeaders?.get("X-MY-TOKEN")).toBe("renamed");
        expect(capturedHeaders?.get("X-XSRF-TOKEN")).toBeNull();
    });

    it("throws the body of a non-OK response", async () => {
        server.use(
            http.post(url, () => HttpResponse.text("Boom", { status: 422 })),
        );

        await expect(
            streamJsonEvents<TestEvent>({
                url,
                signal: new AbortController().signal,
                onEvent: () => undefined,
            }),
        ).rejects.toThrow("Boom");
    });

    it("carries the failed response on the thrown error", async () => {
        server.use(
            http.post(url, () =>
                HttpResponse.json({ message: "Nope" }, { status: 422 }),
            ),
        );

        const error = await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            onEvent: () => undefined,
        }).catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(StreamResponseError);
        expect((error as StreamResponseError).status).toBe(422);
        expect(JSON.parse((error as StreamResponseError).body)).toEqual({
            message: "Nope",
        });
    });

    it("throws when the response is not an event stream", async () => {
        // A login page or proxy error answering 200 with HTML would otherwise
        // finish reporting nothing at all...
        server.use(
            http.post(url, () =>
                HttpResponse.html("<html>Log in</html>", { status: 200 }),
            ),
        );

        await expect(
            streamJsonEvents<TestEvent>({
                url,
                signal: new AbortController().signal,
                onEvent: () => undefined,
            }),
        ).rejects.toThrow(/text\/event-stream/);
    });

    it("reports a malformed frame through onParseError and keeps reading", async () => {
        const onParseError = vi.fn();
        const seen: TestEvent[] = [];

        server.use(
            http.post(url, () =>
                streamOf([
                    "data: not json\n\n",
                    'data: {"type":"after"}\n\n',
                    "data: </stream>\n\n",
                ]),
            ),
        );

        await streamJsonEvents<TestEvent>({
            url,
            signal: new AbortController().signal,
            onParseError,
            onEvent: (event) => seen.push(event),
        });

        expect(onParseError).toHaveBeenCalledTimes(1);
        expect(onParseError.mock.calls[0][1]).toBe("not json");
        expect(seen).toEqual([{ type: "after" }]);
    });

    it("stops promptly when the signal aborts before any frame arrives", async () => {
        const controller = new AbortController();
        const onEvent = vi.fn();

        // fetch errors the response body when its signal aborts, so the
        // pending read rejects rather than waiting for a chunk...
        server.use(
            http.post(url, () => streamOf(['data: {"type":"one"}\n\n'], 5_000)),
        );

        const promise = streamJsonEvents<TestEvent>({
            url,
            signal: controller.signal,
            onEvent,
        });

        controller.abort();

        await expect(promise).rejects.toThrow();

        expect(onEvent).not.toHaveBeenCalled();
    }, 2_000);

    it("stops reading when the signal aborts", async () => {
        const seen: TestEvent[] = [];
        const controller = new AbortController();

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

        const promise = streamJsonEvents<TestEvent>({
            url,
            signal: controller.signal,
            onEvent: (event) => {
                seen.push(event);
                controller.abort();
            },
        });

        await expect(promise).rejects.toThrow();

        expect(seen).toEqual([{ type: "one" }]);
    });

    it("does not treat a throw from onEvent as a malformed frame", async () => {
        server.use(
            http.post(url, () =>
                streamOf(['data: {"type":"one"}\n\n', "data: </stream>\n\n"]),
            ),
        );

        await expect(
            streamJsonEvents<TestEvent>({
                url,
                signal: new AbortController().signal,
                onEvent: () => {
                    throw new Error("caller exploded");
                },
            }),
        ).rejects.toThrow("caller exploded");
    });
});
