import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import { createJsonStream, createStream } from "../src/createStream.svelte";

describe("createStream", () => {
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
        const result = createStream(url);

        expect(result.data).toBe("");
        expect(result.isFetching).toBe(false);
        expect(result.isStreaming).toBe(false);
        expect(result.id).toBeDefined();
        expect(result.id).toBeTypeOf("string");
    });

    it("makes a request with initial input", async () => {
        const initialInput = { test: "data" };

        const result = createStream(url, { initialInput });

        await vi.waitFor(() => expect(result.isFetching).toBe(true));
        await vi.waitFor(() => expect(result.isFetching).toBe(false));
        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.data).toBe("chunk1"));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(result.data).toBe("chunk1chunk2");

        result.clearData();

        expect(result.data).toBe("");
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

        const result = createStream(url);

        result.send(payload);

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(capturedBody).toEqual(payload);
        expect(result.data).toBe("chunk1chunk2");
    });

    it("triggers onResponse callback", async () => {
        const onResponse = vi.fn();

        const result = createStream(url, { onResponse });

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(onResponse).toHaveBeenCalled();
    });

    it("triggers onFinish callback", async () => {
        const onFinish = vi.fn();

        const result = createStream(url, { onFinish });

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(onFinish).toHaveBeenCalled();
    });

    it("triggers onBeforeSend callback", async () => {
        const onBeforeSend = vi.fn();

        const result = createStream(url, { onBeforeSend });

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(onBeforeSend).toHaveBeenCalled();
    });

    it("can cancel a call via onBeforeSend callback", async () => {
        const onBeforeSend = vi.fn(() => false);
        let requested = false;

        server.use(
            http.post(url, async () => {
                requested = true;
                return response();
            }),
        );

        const result = createStream(url, { onBeforeSend });

        result.send({ test: "data" });

        expect(onBeforeSend).toHaveBeenCalled();
        expect(requested).toBe(false);
    });

    it("triggers onData callback with chunks", async () => {
        const onData = vi.fn();

        const result = createStream(url, { onData });

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

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
        const result = createStream(url, { onError, onFinish });

        result.send({ test: "data" });

        await vi.waitFor(() => expect(result.isFetching).toBe(true));
        await vi.waitFor(() => expect(result.isFetching).toBe(false));

        expect(onError).toHaveBeenCalledWith(new Error(errorMessage));
        expect(onFinish).toHaveBeenCalled();
        expect(result.isFetching).toBe(false);
        expect(result.isStreaming).toBe(false);
    });

    it("can cancel the stream", async () => {
        const onCancel = vi.fn();
        const result = createStream(url, { onCancel });

        result.send({ test: "data" });
        await vi.waitFor(() => expect(result.data).toBe("chunk1"));

        result.cancel();

        expect(result.isStreaming).toBe(false);
        expect(onCancel).toHaveBeenCalled();
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

        const result = createStream(url, { json: true });

        result.send();

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(result.data).toBe(JSON.stringify(jsonData));
        expect(result.jsonData).toEqual(jsonData);
    });

    it("parses JSON data when json option is true (createJsonStream)", async () => {
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

        const result = createJsonStream(url);

        result.send();

        await vi.waitFor(() => expect(result.isStreaming).toBe(true));
        await vi.waitFor(() => expect(result.isStreaming).toBe(false));

        expect(result.data).toEqual(jsonData);
        expect(result.strData).toBe(JSON.stringify(jsonData));
    });
});
