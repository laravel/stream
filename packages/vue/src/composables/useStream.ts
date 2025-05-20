import { nanoid } from "nanoid";
import {
    DeepReadonly,
    onMounted,
    onUnmounted,
    readonly,
    Ref,
    ref,
    UnwrapNestedRefs,
} from "vue";
import { StreamListenerCallback, StreamMeta, StreamOptions } from "../types";

const streams = new Map<string, StreamMeta<unknown>>();
const listeners = new Map<string, StreamListenerCallback[]>();

const resolveStream = <TJsonData = null>(id: string): StreamMeta<TJsonData> => {
    const stream = streams.get(id) as StreamMeta<TJsonData> | undefined;

    if (stream) {
        return stream;
    }

    const newStream = {
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
): {
    data: Readonly<Ref<string>>;
    jsonData: DeepReadonly<UnwrapNestedRefs<TJsonData | null>>;
    isFetching: Readonly<Ref<boolean>>;
    isStreaming: Readonly<Ref<boolean>>;
    id: string;
    send: (body: Record<string, any>) => void;
    cancel: () => void;
    clearData: () => void;
} => {
    const id = options.id ?? nanoid();
    const stream = ref<StreamMeta<TJsonData>>(resolveStream<TJsonData>(id));
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

    const data = ref(stream.value.data);
    const jsonData = ref(stream.value.jsonData);
    const isFetching = ref(stream.value.isFetching);
    const isStreaming = ref(stream.value.isStreaming);

    let stopListening: () => void;

    const updateStream = (params: Partial<StreamMeta<TJsonData>>) => {
        streams.set(id, {
            ...resolveStream(id),
            ...params,
        });

        const updatedStream = resolveStream(id);

        listeners.get(id)?.forEach((listener) => listener(updatedStream));
    };

    const cancel = () => {
        stream.value.controller.abort();

        if (isFetching || isStreaming) {
            options.onCancel?.();
        }

        updateStream({
            isFetching: false,
            isStreaming: false,
        });
    };

    const makeRequest = (body: Record<string, any> = {}) => {
        const controller = new AbortController();

        updateStream({
            isFetching: true,
            controller,
        });

        fetch(url, {
            method: "POST",
            signal: controller.signal,
            headers: {
                ...headers,
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
    };

    const send = (body: Record<string, any>) => {
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

    const read = (
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
                    streamParams.jsonData = JSON.parse(newData) as TJsonData;
                } catch (error) {
                    options.onError?.(error as Error);
                }
            }

            updateStream(streamParams);

            options.onFinish?.();

            return "";
        });
    };

    onMounted(() => {
        stopListening = addListener(id, (streamUpdate) => {
            stream.value = resolveStream<TJsonData>(id);
            isFetching.value = streamUpdate.isFetching;
            isStreaming.value = streamUpdate.isStreaming;
            data.value = streamUpdate.data;
            jsonData.value = streamUpdate.jsonData;
        });

        window.addEventListener("beforeunload", cancel);

        if (options.initialInput) {
            makeRequest(options.initialInput);
        }
    });

    onUnmounted(() => {
        stopListening();
        window.removeEventListener("beforeunload", cancel);

        if (!hasListeners(id)) {
            cancel();
        }
    });

    return {
        data: readonly(data),
        jsonData: readonly(jsonData),
        isFetching: readonly(isFetching),
        isStreaming: readonly(isStreaming),
        id,
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

    return { data: readonly(jsonData), rawData: readonly(data), ...rest };
};
