import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import { StreamListenerCallback, StreamMeta, StreamOptions } from "../types";

const streams = new Map<string, StreamMeta>();
const listeners = new Map<string, StreamListenerCallback[]>();

const resolveStream = (id: string) => {
    const stream = streams.get(id);

    if (stream) {
        return stream;
    }

    streams.set(id, {
        controller: new AbortController(),
        data: "",
        isFetching: false,
        isStreaming: false,
    });

    return streams.get(id)!;
};

const resolveListener = (id: string) => {
    if (!listeners.has(id)) {
        listeners.set(id, []);
    }

    return listeners.get(id)!;
};

const addListener = (id: string, listener: StreamListenerCallback) => {
    resolveListener(id).push(listener);

    return () => {
        listeners.set(
            id,
            resolveListener(id).filter((l) => l !== listener),
        );
    };
};

export const useStream = (url: string, options: StreamOptions = {}) => {
    const id = useRef<string>(options.id ?? nanoid());
    const stream = useRef(resolveStream(id.current));
    const headers = useRef<HeadersInit>(
        (() => {
            const headers: HeadersInit = {
                "Content-Type": "application/json",
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
    const [isLoading, setIsLoading] = useState(stream.current.isFetching);
    const [isStreaming, setIsStreaming] = useState(stream.current.isStreaming);

    const updateStream = useCallback((params: Partial<StreamMeta>) => {
        streams.set(id.current, {
            ...resolveStream(id.current),
            ...params,
        });

        listeners
            .get(id.current)
            ?.forEach((listener) => listener(streams.get(id.current)!));
    }, []);

    const stop = useCallback(() => {
        stream.current.controller.abort();

        updateStream({
            isFetching: false,
            isStreaming: false,
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
                .then((response) => {
                    if (!response.ok) {
                        throw new Error("Network response was not ok");
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
                .catch((error) => {
                    updateStream({
                        isFetching: false,
                        isStreaming: false,
                    });

                    if (error?.name === "AbortError") {
                        options.onCancel?.();
                    } else {
                        options.onError?.(error);
                    }

                    options.onFinish?.();
                });
        },
        [url],
    );

    const send = useCallback((body: Record<string, any>) => {
        stop();
        makeRequest(body);
        updateStream({
            data: "",
        });
    }, []);

    const read = useCallback(
        (
            reader: ReadableStreamDefaultReader<AllowSharedBufferSource>,
            str = "",
        ): Promise<string> => {
            return reader.read().then(({ done, value }) => {
                const newData = str + new TextDecoder().decode(value);

                options.onData?.(str);

                if (done) {
                    updateStream({
                        data: newData,
                        isStreaming: false,
                    });

                    options.onFinish?.();

                    return "";
                }

                updateStream({
                    data: newData,
                });

                return read(reader, newData);
            });
        },
        [],
    );

    useEffect(() => {
        const stopListening = addListener(
            id.current,
            (streamUpdate: StreamMeta) => {
                stream.current = resolveStream(id.current);
                setIsLoading(streamUpdate.isFetching);
                setIsStreaming(streamUpdate.isStreaming);
                setData(streamUpdate.data);
            },
        );

        return () => {
            stopListening();
        };
    }, []);

    useEffect(() => {
        window.addEventListener("beforeunload", stop);
    }, [stop]);

    useEffect(() => {
        if (options.initialInput) {
            makeRequest(options.initialInput);
        }
    }, []);

    return {
        data,
        isLoading,
        isStreaming,
        id: id.current,
        send,
        stop,
    };
};

export default useStream;
