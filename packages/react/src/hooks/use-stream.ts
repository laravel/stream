import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    addCallbacks,
    onBeforeSend,
    onCancel,
    onData,
    onError,
    onFinish,
    onResponse,
} from "../streams/dispatch";
import {
    addListener,
    hasListeners,
    resolveStream,
    update,
} from "../streams/store";
import { StreamMeta, StreamOptions } from "../types";

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
            update<TJsonData>(id.current, params);
        },
        [],
    );

    const cancel = useCallback(() => {
        stream.current.controller.abort();

        if (isFetching || isStreaming) {
            onCancel(id.current);
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

            const request: RequestInit = {
                method: "POST",
                signal: controller.signal,
                headers: {
                    ...headers.current,
                    ...(options.headers ?? {}),
                },
                body: JSON.stringify(body),
                credentials: options.credentials ?? "same-origin",
            };

            const modifiedRequest = onBeforeSend(id.current, request);

            if (modifiedRequest === false) {
                return;
            }

            updateStream({
                isFetching: true,
                controller,
            });

            fetch(url, modifiedRequest ?? request)
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

                    onResponse(id.current, response);

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

                    onError(id.current, error);
                    onFinish(id.current);
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

                onData(id.current, incomingStr);

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
                        onError(id.current, error as Error);
                    }
                }

                updateStream(streamParams);

                onFinish(id.current);

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
        const remove = addCallbacks(id.current, options);

        return () => {
            remove();
        };
    }, [options]);

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
