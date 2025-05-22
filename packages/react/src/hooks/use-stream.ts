import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { StreamListenerCallback, StreamMeta, StreamOptions } from "../types";

const streams = new Map<string, StreamMeta<unknown>>();
const listeners = new Map<string, StreamListenerCallback[]>();

const resolveStream = <TJsonData = null>(id: string): StreamMeta<TJsonData> => {
    const stream = streams.get(id) as StreamMeta<TJsonData> | undefined;

    if (stream) {
        return stream;
    }

    const newStream: StreamMeta<TJsonData> = {
        controller: new AbortController(),
        data: "",
        isFetching: false,
        isStreaming: false,
        jsonData: null as TJsonData,
    };

    streams.set(id, newStream);

    return newStream;
};

const resolveListener = (id: string) => {
    if (!listeners.has(id)) {
        listeners.set(id, []);
    }

    return listeners.get(id)!;
};

const hasListeners = (id: string) => {
    return listeners.has(id) && listeners.get(id)?.length;
};

const addListener = (id: string, listener: StreamListenerCallback) => {
    resolveListener(id).push(listener);

    return () => {
        listeners.set(
            id,
            resolveListener(id).filter((l) => l !== listener),
        );

        if (!hasListeners(id)) {
            streams.delete(id);
            listeners.delete(id);
        }
    };
};

export const useStream = <TJsonData = null>(
    url: string,
    options: StreamOptions = {},
) => {
    const id = useRef<string>(options.id ?? nanoid());
    const stream = useRef(resolveStream<TJsonData>(id.current));
    const headers = useRef<HeadersInit>(
        (() => {
            const headers: HeadersInit = {
                "Content-Type": "application/json",
                "X-STREAM-ID": id.current,
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
        })(),
    );

    const [data, setData] = useState<string>(stream.current.data);
    const [jsonData, setJsonData] = useState<TJsonData | null>(
        stream.current.jsonData,
    );
    const [isFetching, setIsFetching] = useState(stream.current.isFetching);
    const [isStreaming, setIsStreaming] = useState(stream.current.isStreaming);

    const updateStream = useCallback(
        (params: Partial<StreamMeta<TJsonData>>) => {
            streams.set(id.current, {
                ...resolveStream(id.current),
                ...params,
            });

            const updatedStream = resolveStream(id.current);

            listeners
                .get(id.current)
                ?.forEach((listener) => listener(updatedStream));
        },
        [],
    );

    const cancel = useCallback(() => {
        stream.current.controller.abort();

        if (isFetching || isStreaming) {
            options.onCancel?.();
        }

        updateStream({
            isFetching: false,
            isStreaming: false,
        });
    }, [isFetching, isStreaming]);

    const clearData = useCallback(() => {
        updateStream({
            data: "",
            jsonData: null,
        });
    }, []);

    const makeRequest = useCallback(
        (body: Record<string, any> = {}) => {
            const controller = new AbortController();

            updateStream({
                isFetching: true,
                controller,
            });

            fetch(url, {
                method: "POST",
                signal: controller.signal,
                headers: {
                    ...headers.current,
                    ...(options.headers ?? {}),
                },
                body: JSON.stringify(body),
            })
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

                    options.onResponse?.(response);

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

                    options.onError?.(error);
                    options.onFinish?.();
                });
        },
        [url],
    );

    const send = useCallback((body: Record<string, any>) => {
        cancel();
        makeRequest(body);
        clearData();
    }, []);

    const read = useCallback(
        (
            reader: ReadableStreamDefaultReader<AllowSharedBufferSource>,
            str = "",
        ): Promise<string> => {
            return reader.read().then(({ done, value }) => {
                const incomingStr = new TextDecoder("utf-8").decode(value);
                const newData = str + incomingStr;

                options.onData?.(incomingStr);

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
                        streamParams.jsonData = JSON.parse(
                            newData,
                        ) as TJsonData;
                    } catch (error) {
                        options.onError?.(error as Error);
                    }
                }

                updateStream(streamParams);

                options.onFinish?.();

                return "";
            });
        },
        [],
    );

    useEffect(() => {
        const stopListening = addListener(
            id.current,
            (streamUpdate: StreamMeta) => {
                stream.current = resolveStream(id.current);
                setIsFetching(streamUpdate.isFetching);
                setIsStreaming(streamUpdate.isStreaming);
                setData(streamUpdate.data);
                setJsonData(streamUpdate.jsonData);
            },
        );

        return () => {
            stopListening();

            if (!hasListeners(id.current)) {
                cancel();
            }
        };
    }, []);

    useEffect(() => {
        window.addEventListener("beforeunload", cancel);

        return () => {
            window.removeEventListener("beforeunload", cancel);
        };
    }, [cancel]);

    useEffect(() => {
        if (options.initialInput) {
            makeRequest(options.initialInput);
        }
    }, []);

    return {
        data,
        jsonData,
        isFetching,
        isStreaming,
        id: id.current,
        send,
        cancel,
        clearData,
    };
};

export const useJsonStream = <TJsonData = null>(
    url: string,
    options: Omit<StreamOptions, "json"> = {},
) => {
    const { jsonData, data, ...rest } = useStream<TJsonData>(url, {
        ...options,
        json: true,
    });

    return { data: jsonData, strData: data, ...rest };
};
