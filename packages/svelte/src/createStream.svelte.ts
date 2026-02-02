import { nanoid } from "nanoid";
import { $effect, $state } from "svelte";
import {
    addCallbacks,
    onBeforeSend,
    onCancel,
    onData,
    onError,
    onFinish,
    onResponse,
} from "./streams/dispatch";
import {
    addListener,
    hasListeners,
    resolveStream,
    update,
} from "./streams/store";
import { StreamMeta, StreamOptions } from "./types";

/**
 * Creates a reactive stream for handling streaming responses from Laravel.
 * Must be called from component setup (top-level of a .svelte script) or from another .svelte.ts module.
 *
 * @param url - The URL to POST to (or a getter for reactive URLs)
 * @param options - Stream options (initialInput, callbacks, etc.)
 * @returns A reactive stream object with data, jsonData, isFetching, isStreaming, send, cancel, and clearData
 *
 * @see https://laravel.com/docs/responses#streamed-responses
 */
export const createStream = <
    TSendBody extends Record<string, any> = {},
    TJsonData = null,
>(
    url: string | (() => string),
    options: StreamOptions<TSendBody> = {},
): {
    data: string;
    jsonData: TJsonData | null;
    isFetching: boolean;
    isStreaming: boolean;
    id: string;
    send: (body?: TSendBody) => void;
    cancel: () => void;
    clearData: () => void;
} => {
    const getUrl = typeof url === "function" ? url : () => url;
    const id = options.id ?? nanoid();
    const initialStream = resolveStream<TJsonData>(id);

    let data = $state(initialStream.data);
    let jsonData = $state<TJsonData | null>(initialStream.jsonData);
    let isFetching = $state(initialStream.isFetching);
    let isStreaming = $state(initialStream.isStreaming);

    const headers = (() => {
        const headers: HeadersInit = {
            "Content-Type": "application/json",
            "X-STREAM-ID": id,
        };

        const csrfToken =
            options.csrfToken ??
            document
                .querySelector('meta[name="csrf-token"]')
                ?.getAttribute("content");

        if (csrfToken) {
            headers["X-CSRF-TOKEN"] = csrfToken;
        }

        return headers;
    })();

    let stopListening: (() => void) | undefined;
    let removeCallbacks: (() => void) | undefined;
    let currentUrl = getUrl();

    const updateStream = (params: Partial<StreamMeta<TJsonData>>) => {
        update<TJsonData>(id, params);
    };

    const cancel = () => {
        const stream = resolveStream<TJsonData>(id);
        stream.controller.abort();

        if (isFetching || isStreaming) {
            onCancel(id);
        }

        updateStream({
            isFetching: false,
            isStreaming: false,
        });
    };

    const makeRequest = (body?: TSendBody) => {
        const controller = new AbortController();

        const request: RequestInit = {
            method: "POST",
            signal: controller.signal,
            headers: {
                ...headers,
                ...(options.headers ?? {}),
            },
            body: JSON.stringify(body ?? {}),
            credentials: options.credentials ?? "same-origin",
        };

        const modifiedRequest = onBeforeSend(id, request);

        if (modifiedRequest === false) {
            return;
        }

        updateStream({
            isFetching: true,
            controller,
        });

        fetch(getUrl(), modifiedRequest ?? request)
            .then(async (response) => {

                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(error);
                }

                if (!response.body) {
                    throw new Error(
                        "ReadableStream not yet supported in this browser.",
                    );
                }

                onResponse(id, response);

                updateStream({
                    isFetching: false,
                    isStreaming: true,
                });

                return read(response.body.getReader());
            })
            .catch((error: Error) => {
                updateStream({
                    isFetching: false,
                    isStreaming: false,
                });

                onError(id, error);
                onFinish(id);
            });
    };

    const send = (body?: TSendBody) => {
        cancel();
        makeRequest(body);
        clearData();
    };

    const clearData = () => {
        updateStream({
            data: "",
            jsonData: null,
        });
    };

    const read = async (
        reader: ReadableStreamDefaultReader<AllowSharedBufferSource>,
        str = "",
    ): Promise<string> => {
        return reader.read().then(({ done, value }) => {
            const incomingStr = new TextDecoder("utf-8").decode(value);
            const newData = str + incomingStr;

            onData(id, incomingStr);

            const streamParams: Partial<StreamMeta<TJsonData>> = {
                data: newData,
            };

            if (!done) {
                updateStream(streamParams);

                return read(reader, newData);
            }

            streamParams.isStreaming = false;

            if (options.json) {
                try {
                    streamParams.jsonData = JSON.parse(newData) as TJsonData;
                } catch (error) {
                    onError(id, error as Error);
                }
            }

            updateStream(streamParams);

            onFinish(id);

            return "";
        });
    };

    $effect(() => {
        stopListening = addListener(id, (streamUpdate) => {
            const stream = resolveStream<TJsonData>(id);
            isFetching = streamUpdate.isFetching;
            isStreaming = streamUpdate.isStreaming;
            data = streamUpdate.data;
            jsonData = streamUpdate.jsonData;
        });

        removeCallbacks = addCallbacks(id, options);

        window.addEventListener("beforeunload", cancel);

        if (options.initialInput) {
            makeRequest(options.initialInput);
        }

        return () => {
            if (stopListening) {
                stopListening();
            }

            if (removeCallbacks) {
                removeCallbacks();
            }

            window.removeEventListener("beforeunload", cancel);

            if (!hasListeners(id)) {
                cancel();
            }
        };
    });

    $effect(() => {
        const newUrl = getUrl();

        if (newUrl !== currentUrl) {
            currentUrl = newUrl;
            cancel();
            clearData();
        }
    });

    return {
        get data() {
            return data;
        },
        get jsonData() {
            return jsonData;
        },
        get isFetching() {
            return isFetching;
        },
        get isStreaming() {
            return isStreaming;
        },
        id,
        send,
        cancel,
        clearData,
    };
};

export const createJsonStream = <
    TJsonData = null,
    TSendBody extends Record<string, any> = {},
>(
    url: string | (() => string),
    options: Omit<StreamOptions<TSendBody>, "json"> = {},
) => {
    const { jsonData, data, ...rest } = createStream<TSendBody, TJsonData>(url, {
        ...options,
        json: true,
    });

    return { data: jsonData, strData: data, ...rest };
};
