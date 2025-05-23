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
import { useJsonStream, useStream } from "../src/hooks/use-stream";

describe("useStream", () => {
    const url = "/chat";
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

    it("should initialize with default values", () => {
        const { result } = renderHook(() => useStream(url));

        expect(result.current.data).toBe("");
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isStreaming).toBe(false);
        expect(result.current.id).toBeDefined();
        expect(result.current.id).toBeTypeOf("string");
    });

    it("should make a request with initial input", async () => {
        const initialInput = { test: "data" };

        const { result } = await act(async () => {
            return renderHook(() => useStream(url, { initialInput }));
        });

        await waitFor(() => expect(result.current.isFetching).toBe(true));
        await waitFor(() => expect(result.current.isFetching).toBe(false));
        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.data).toBe("chunk1"));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.data).toBe("chunk1chunk2");

        await act(() => {
            result.current.clearData();
        });

        expect(result.current.data).toBe("");
    });

    it("can send data back to the endpoint", async () => {
        const payload = { test: "data" };
        let capturedBody: any;
        const onCancel = vi.fn();

        server.use(
            http.post(url, async ({ request }) => {
                capturedBody = await request.json();
                return response();
            }),
        );

        const { result } = renderHook(() => useStream(url, { onCancel }));

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(capturedBody).toEqual(payload);
        expect(result.current.data).toBe("chunk1chunk2");
        expect(result.current.isStreaming).toBe(false);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("will trigger the onResponse callback", async () => {
        const payload = { test: "data" };
        const onResponse = vi.fn();

        const { result } = renderHook(() =>
            useStream(url, {
                onResponse,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onResponse).toHaveBeenCalled();
    });

    it("will trigger the onFinish callback", async () => {
        const payload = { test: "data" };
        const onFinish = vi.fn();

        const { result } = renderHook(() =>
            useStream(url, {
                onFinish,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onFinish).toHaveBeenCalled();
    });

    it("will trigger the onBeforeSend callback", async () => {
        const payload = { test: "data" };
        const onBeforeSend = vi.fn();

        const { result } = renderHook(() =>
            useStream(url, {
                onBeforeSend,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onBeforeSend).toHaveBeenCalled();
    });

    it("can cancel via the onBeforeSend callback", async () => {
        const payload = { test: "data" };
        const onBeforeSend = vi.fn(() => false);
        let requested = false;

        server.use(
            http.post(url, async () => {
                requested = true;
                return response();
            }),
        );

        const { result } = renderHook(() =>
            useStream(url, {
                onBeforeSend,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        expect(onBeforeSend).toHaveBeenCalled();
        expect(requested).toBe(false);
    });

    it("can modify the request via the onBeforeSend callback", async () => {
        const payload = { test: "data" };
        const onBeforeSend = vi.fn((request) => ({
            ...request,
            body: JSON.stringify({ modified: true }),
        }));
        let capturedBody;

        server.use(
            http.post(url, async ({ request }) => {
                capturedBody = await request.json();
                return response();
            }),
        );

        const { result } = renderHook(() =>
            useStream(url, {
                onBeforeSend,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onBeforeSend).toHaveBeenCalled();
        expect(capturedBody).toEqual({ modified: true });
    });

    it("will trigger the onData callback", async () => {
        const payload = { test: "data" };
        const onData = vi.fn();

        const { result } = renderHook(() =>
            useStream(url, {
                onData,
            }),
        );

        act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onData).toHaveBeenCalledWith("chunk1");
        expect(onData).toHaveBeenCalledWith("chunk2");
    });

    it("should handle errors correctly", async () => {
        const errorMessage = "Serve error";
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
        const { result } = renderHook(() =>
            useStream(url, { onError, onFinish }),
        );

        act(() => {
            result.current.send({ test: "data" });
        });

        await waitFor(() => expect(result.current.isFetching).toBe(true));
        await waitFor(() => expect(result.current.isFetching).toBe(false));

        expect(onError).toHaveBeenCalledWith(new Error(errorMessage));
        expect(onFinish).toHaveBeenCalled();
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isStreaming).toBe(false);
    });

    it("should handle network errors correctly", async () => {
        server.use(
            http.post(url, async () => {
                return HttpResponse.error();
            }),
        );

        const onError = vi.fn();
        const onFinish = vi.fn();
        const { result } = renderHook(() =>
            useStream(url, { onError, onFinish }),
        );

        await act(() => {
            result.current.send({ test: "data" });
        });

        expect(onError).toHaveBeenCalled();
        expect(onFinish).toHaveBeenCalled();
        expect(result.current.isFetching).toBe(false);
        expect(result.current.isStreaming).toBe(false);
    });

    it("should stop streaming when stop is called", async () => {
        const onCancel = vi.fn();
        const { result } = renderHook(() => useStream(url, { onCancel }));

        act(() => {
            result.current.send({ test: "data" });
        });

        await waitFor(() => expect(result.current.data).toBe("chunk1"));
        act(() => {
            result.current.cancel();
        });
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(result.current.isStreaming).toBe(false);
        expect(result.current.data).toBe("chunk1");
        expect(onCancel).toHaveBeenCalled();
    });

    it("should handle custom headers", async () => {
        const customHeaders = { "X-Custom-Header": "test" };
        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const { result } = renderHook(() =>
            useStream(url, { headers: customHeaders }),
        );

        await act(() => {
            result.current.send({ test: "data" });
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));
        expect(capturedHeaders.get("X-Custom-Header")).toBe(
            customHeaders["X-Custom-Header"],
        );
        expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    });

    it("should handle CSRF token from meta tag", async () => {
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

        const { result } = renderHook(() => useStream(url));

        await act(() => {
            result.current.send({ test: "data" });
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        document.head.removeChild(metaTag);
        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    });

    it("should handle CSRF token from passed option", async () => {
        const csrfToken = "test-csrf-token";
        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const { result } = renderHook(() => useStream(url, { csrfToken }));

        await act(() => {
            result.current.send({ test: "data" });
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(capturedHeaders.get("X-CSRF-TOKEN")).toBe(csrfToken);
        expect(capturedHeaders.get("Content-Type")).toBe("application/json");
    });

    it("will generate unique ids for streams", async () => {
        const { result } = renderHook(() => useStream(url));
        const { result: result2 } = renderHook(() => useStream(url));

        expect(result.current.id).toBeTypeOf("string");
        expect(result2.current.id).toBeTypeOf("string");
        expect(result.current.id).not.toBe(result2.current.id);
    });

    it("will sync streams with the same id", async () => {
        const payload = { test: "data" };
        const id = "test-stream-id";
        const onFinish = vi.fn();
        let capturedHeaders: any;

        server.use(
            http.post(url, async ({ request }) => {
                capturedHeaders = request.headers;
                return response();
            }),
        );

        const { result } = renderHook(() => useStream(url, { id }));
        const { result: result2 } = renderHook(() =>
            useStream(url, { id, onFinish }),
        );

        await act(() => {
            result.current.send(payload);
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result2.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.data).toBe("chunk1"));
        await waitFor(() => expect(result2.current.data).toBe("chunk1"));
        await waitFor(() => expect(result.current.data).toBe("chunk1chunk2"));
        await waitFor(() => expect(result2.current.data).toBe("chunk1chunk2"));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));
        await waitFor(() => expect(result2.current.isStreaming).toBe(false));

        expect(result.current.isStreaming).toBe(false);
        expect(result2.current.isStreaming).toBe(false);

        expect(result.current.data).toBe("chunk1chunk2");
        expect(result2.current.data).toBe("chunk1chunk2");

        expect(capturedHeaders.get("X-STREAM-ID")).toBe(id);

        expect(onFinish).toHaveBeenCalled();
    });

    it.skip("should cancel stream when component unmounts", async () => {
        const onCancel = vi.fn();
        const { unmount, result } = renderHook(() =>
            useStream(url, { onCancel }),
        );

        await act(() => {
            result.current.send({
                test: "ok",
            });
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));

        unmount();

        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onCancel).toHaveBeenCalled();
    });

    it("should parse JSON data when json option is true", async () => {
        const jsonData = { test: "data", value: 123 };

        server.use(
            http.post(url, async () => {
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

        const { result } = renderHook(() => useStream(url, { json: true }));

        await act(() => {
            result.current.send({});
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(result.current.data).toEqual(JSON.stringify(jsonData));
        expect(result.current.jsonData).toEqual(jsonData);
    });

    it("should handle JSON parsing errors", async () => {
        const invalidJson = "{invalid json}";
        const onError = vi.fn();

        server.use(
            http.post(url, async () => {
                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(20);
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

        const { result } = renderHook(() =>
            useStream(url, { json: true, onError }),
        );

        await act(() => {
            result.current.send({});
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onError).toHaveBeenCalled();

        expect(result.current.data).toBe(invalidJson);
        expect(result.current.jsonData).toBeNull();
    });

    it("should parse JSON data when json option is true (useJsonStream)", async () => {
        const jsonData = { test: "data", value: 123 };

        server.use(
            http.post(url, async () => {
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

        const { result } = renderHook(() => useJsonStream(url));

        await act(() => {
            result.current.send({});
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(result.current.data).toEqual(jsonData);
        expect(result.current.strData).toEqual(JSON.stringify(jsonData));
    });

    it("should handle JSON parsing errors (useJsonStream)", async () => {
        const invalidJson = "{invalid json}";
        const onError = vi.fn();

        server.use(
            http.post(url, async () => {
                return new HttpResponse(
                    new ReadableStream({
                        async start(controller) {
                            await delay(20);
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

        const { result } = renderHook(() => useJsonStream(url, { onError }));

        await act(() => {
            result.current.send({});
        });

        await waitFor(() => expect(result.current.isStreaming).toBe(true));
        await waitFor(() => expect(result.current.isStreaming).toBe(false));

        expect(onError).toHaveBeenCalled();

        expect(result.current.data).toBeNull();
        expect(result.current.strData).toBe(invalidJson);
    });
});
