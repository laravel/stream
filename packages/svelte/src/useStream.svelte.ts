import { derived, get, writable } from "svelte/store";
import { nanoid } from "nanoid";
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

export type StreamState<TJsonData = null> = {
    data: string;
    jsonData: TJsonData | null;
    isFetching: boolean;
    isStreaming: boolean;
};

export type Stream<
    TJsonData = null,
    TSendBody extends Record<string, any> = {},
> = {
    subscribe: (run: (value: StreamState<TJsonData>) => void) => () => void;
    id: string;
    send: (body?: TSendBody) => void;
    cancel: () => void;
    clearData: () => void;
};

/**
 * Creates a reactive stream for handling streaming responses from Laravel.
 * Returns a Svelte store: use `$stream` in templates so the component re-renders when data updates.
 *
 * @param url - The URL to POST to (or a getter for reactive URLs)
 * @param options - Stream options (initialInput, callbacks, etc.)
 * @returns A store-like object: subscribe to react to changes, plus send, cancel, clearData, id
 *
 * @see https://laravel.com/docs/responses#streamed-responses
 */
export const useStream = <
    TSendBody extends Record<string, any> = {},
    TJsonData = null,
>(
    url: string | (() => string),
    options: StreamOptions<TSendBody> = {},
): Stream<TJsonData, TSendBody> => {
    const getUrl = typeof url === "function" ? url : () => url;
    const id = options.id ?? nanoid();
    const initialStream = resolveStream<TJsonData>(id);

    const streamStore = writable<StreamState<TJsonData>>({
        data: initialStream.data,
        jsonData: initialStream.jsonData,
        isFetching: initialStream.isFetching,
        isStreaming: initialStream.isStreaming,
    });

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

        const state = get(streamStore);

        if (state.isFetching || state.isStreaming) {
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
            const incomingStr =
                value !== undefined
                    ? new TextDecoder("utf-8").decode(value)
                    : "";
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

    $effect.root(() => {
        $effect(() => {
            stopListening = addListener(id, (streamUpdate) => {
                streamStore.set({
                    data: streamUpdate.data,
                    jsonData: streamUpdate.jsonData,
                    isFetching: streamUpdate.isFetching,
                    isStreaming: streamUpdate.isStreaming,
                });
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
    });

    return {
        subscribe: streamStore.subscribe,
        id,
        send,
        cancel,
        clearData,
    };
};

export type JsonStreamState<TJsonData = null> = {
    data: TJsonData | null;
    strData: string;
    isFetching: boolean;
    isStreaming: boolean;
};

export const useJsonStream = <
    TJsonData = null,
    TSendBody extends Record<string, any> = {},
>(
    url: string | (() => string),
    options: Omit<StreamOptions<TSendBody>, "json"> = {},
) => {
    const stream = useStream<TSendBody, TJsonData>(url, {
        ...options,
        json: true,
    });

    const jsonStore = derived(stream, ($s) => ({
        data: $s.jsonData,
        strData: $s.data,
        isFetching: $s.isFetching,
        isStreaming: $s.isStreaming,
    }));

    return {
        subscribe: jsonStore.subscribe,
        id: stream.id,
        send: stream.send,
        cancel: stream.cancel,
        clearData: stream.clearData,
    };
};
