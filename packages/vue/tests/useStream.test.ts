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
import { createApp } from "vue";
import { useJsonStream, useStream } from "../src/composables/useStream";

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

describe("useStream", () => {
    const url = "/stream";
    const response = async (duration = 20) => {
        await delay(duration);

        return new HttpResponse(
            new ReadableStream({
                async start(controller) {
                    await delay(duration);
                    controller.enqueue(new TextEncoder().encode("chunk1"));

                    await delay(duration);
                    controller.enqueue(new TextEncoder().encode("chunk2"));
                    controller.close();
                },
            }),
            {
                status: 200,
                headers: {
                    "Content-Type": "text/event-stream",
                },
            },
        );
    };

    const server = setupServer(
        http.post(url, async () => {
            return await response();
        }),
    );

    beforeAll(() => server.listen());
    afterEach(() => {
        vi.clearAllMocks();
        server.resetHandlers();
    });
    afterAll(() => server.close());

    it("initializes with default values", () => {
        const [result] = withSetup(() => useStream(url));

        expect(result.data.value).toBe("");
        expect(result.isFetching.value).toBe(false);
        expect(result.isStreaming.value).toBe(false);
        expect(result.id).toBeDefined();
        expect(result.id).toBeTypeOf("string");
    });

    it("makes a request with initial input", async () => {
        const initialInput = { test: "data" };

        const [result] = withSetup(() => useStream(url, { initialInput }));

        await vi.waitFor(() => expect(result.isFetching.value).toBe(true));
        await vi.waitFor(() => expect(result.isFetching.value).toBe(false));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.data.value).toBe("chunk1"));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(result.data.value).toBe("chunk1chunk2");

        result.clearData();

        expect(result.data.value).toBe("");
    });

    it("can send data to the endpoint", async () => {
        const payload = { test: "data" };
        let capturedBody: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedBody = await request.json();
                return response();
            }),
        );

        const [result] = withSetup(() => useStream(url));

        result.send(payload);

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(capturedBody).toEqual(payload);
        expect(result.data.value).toBe("chunk1chunk2");
    });

    it("triggers onResponse callback", async () => {
        const onResponse = vi.fn();

        const [result] = withSetup(() => useStream(url, { onResponse }));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(onResponse).toHaveBeenCalled();
    });

    it("triggers onFinish callback", async () => {
        const onFinish = vi.fn();

        const [result] = withSetup(() => useStream(url, { onFinish }));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(onFinish).toHaveBeenCalled();
    });

    it("triggers onData callback with chunks", async () => {
        const onData = vi.fn();

        const [result] = withSetup(() => useStream(url, { onData }));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(onData).toHaveBeenCalledWith("chunk1");
        expect(onData).toHaveBeenCalledWith("chunk2");
    });

    it("handles errors correctly", async () => {
        const errorMessage = "Server error";
        server.use(
            http.post(url, async () => {
                return new HttpResponse(errorMessage, {
                    status: 500,
                    headers: {
                        "Content-Type": "application/json",
                    },
                });
            }),
        );

        const onError = vi.fn();
        const onFinish = vi.fn();
        const [result] = withSetup(() => useStream(url, { onError, onFinish }));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isFetching.value).toBe(true));
        await vi.waitFor(() => expect(result.isFetching.value).toBe(false));

        expect(onError).toHaveBeenCalledWith(new Error(errorMessage));
        expect(onFinish).toHaveBeenCalled();
        expect(result.isFetching.value).toBe(false);
        expect(result.isStreaming.value).toBe(false);
    });

    it("can cancel the stream", async () => {
        const onCancel = vi.fn();
        const [result] = withSetup(() => useStream(url, { onCancel }));

        result.send({ test: "data" });
        await vi.waitFor(() => expect(result.data.value).toBe("chunk1"));

        result.cancel();

        expect(result.isStreaming.value).toBe(false);
        expect(onCancel).toHaveBeenCalled();
    });

    it("handles CSRF token from meta tag", async () => {
        const csrfToken = "test-csrf-token";
        const metaTag = document.createElement("meta");
        metaTag.setAttribute("name", "csrf-token");
        metaTag.setAttribute("content", csrfToken);
        document.head.appendChild(metaTag);

        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const [result] = withSetup(() => useStream(url));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        document.head.removeChild(metaTag);
        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    });

    it("handles CSRF token from options", async () => {
        const csrfToken = "test-csrf-token";
        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const [result] = withSetup(() => useStream(url, { csrfToken }));

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    });

    it("generates unique ids for streams", () => {
        const [result1] = withSetup(() => useStream(url));
        const [result2] = withSetup(() => useStream(url));

        expect(result1.id).toBeTypeOf("string");
        expect(result2.id).toBeTypeOf("string");
        expect(result1.id).not.toBe(result2.id);
    });

    it("syncs streams with the same id", async () => {
        const id = "test-stream-id";
        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const [result1] = withSetup(() => useStream(url, { id }));
        const [result2] = withSetup(() => useStream(url, { id }));

        result1.send({ test: "data" });

        await vi.waitFor(() => expect(result1.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result2.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result1.data.value).toBe("chunk1"));
        await vi.waitFor(() => expect(result2.data.value).toBe("chunk1"));
        await vi.waitFor(() => expect(result1.data.value).toBe("chunk1chunk2"));
        await vi.waitFor(() => expect(result2.data.value).toBe("chunk1chunk2"));
        await vi.waitFor(() => expect(result1.isStreaming.value).toBe(false));
        await vi.waitFor(() => expect(result2.isStreaming.value).toBe(false));

        expect(result1.data.value).toBe("chunk1chunk2");
        expect(result2.data.value).toBe("chunk1chunk2");

        expect(capturedHeaders.get("X-STREAM-ID")).toBe(id);
    });

    it("parses JSON data when json option is true", async () => {
        const jsonData = { test: "data", value: 123 };

        server.use(
            http.post(url, async () => {
                await delay(20);

                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(20);
                            controller.enqueue(
                                new TextEncoder().encode('{"test":"data",'),
                            );

                            await delay(20);
                            controller.enqueue(
                                new TextEncoder().encode('"value":123}'),
                            );

                            controller.close();
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
            }),
        );

        const [result] = withSetup(() => useStream(url, { json: true }));

        result.send({});

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(result.data.value).toBe(JSON.stringify(jsonData));
        expect(result.jsonData.value).toEqual(jsonData);
    });

    it("handles JSON parsing errors", async () => {
        const invalidJson = "{invalid json}";
        const onError = vi.fn();

        server.use(
            http.post(url, async () => {
                await delay(50);

                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(50);
                            controller.enqueue(
                                new TextEncoder().encode(invalidJson),
                            );
                            controller.close();
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
            }),
        );

        const [result] = withSetup(() =>
            useStream(url, { json: true, onError }),
        );

        result.send({});

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(onError).toHaveBeenCalled();
        expect(result.data.value).toBe(invalidJson);
        expect(result.jsonData.value).toBeNull();
    });

    it("parses JSON data when json option is true (useJsonStream)", async () => {
        const jsonData = { test: "data", value: 123 };

        server.use(
            http.post(url, async () => {
                await delay(20);

                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(20);
                            controller.enqueue(
                                new TextEncoder().encode('{"test":"data",'),
                            );

                            await delay(20);
                            controller.enqueue(
                                new TextEncoder().encode('"value":123}'),
                            );

                            controller.close();
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
            }),
        );

        const [result] = withSetup(() => useJsonStream(url));

        result.send({});

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(result.data.value).toEqual(jsonData);
        expect(result.rawData.value).toBe(JSON.stringify(jsonData));
    });

    it("handles JSON parsing errors (useJsonStream)", async () => {
        const invalidJson = "{invalid json}";
        const onError = vi.fn();

        server.use(
            http.post(url, async () => {
                await delay(50);

                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(50);
                            controller.enqueue(
                                new TextEncoder().encode(invalidJson),
                            );
                            controller.close();
                        },
                    }),
                    {
                        status: 200,
                        headers: {
                            "Content-Type": "application/json",
                        },
                    },
                );
            }),
        );

        const [result] = withSetup(() => useJsonStream(url, { onError }));

        result.send({});

        await vi.waitFor(() => expect(result.isStreaming.value).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming.value).toBe(false));

        expect(onError).toHaveBeenCalled();
        expect(result.data.value).toBeNull();
        expect(result.rawData.value).toBe(invalidJson);
    });
});
