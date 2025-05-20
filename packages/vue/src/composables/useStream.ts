import { nanoid } from "nanoid";
import { onMounted, onUnmounted, readonly, ref } from "vue";
import { StreamListenerCallback, StreamMeta, StreamOptions } from "../types";

const streams = new Map<string, StreamMeta>();
const listeners = new Map<string, StreamListenerCallback[]>();

const resolveStream = (id: string): StreamMeta => {
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

export const useStream = (url: string, options: StreamOptions = {}) => {
    const id = options.id ?? nanoid();
    const stream = ref<StreamMeta>(resolveStream(id));
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

    const data = ref<string>(stream.value.data);
    const isFetching = ref(stream.value.isFetching);
    const isStreaming = ref(stream.value.isStreaming);

    let stopListening: () => void;

    const updateStream = (params: Partial<StreamMeta>) => {
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
        updateStream({
            data: "",
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
    };

    onMounted(() => {
        stopListening = addListener(id, (streamUpdate: StreamMeta) => {
            stream.value = resolveStream(id);
            isFetching.value = streamUpdate.isFetching;
            isStreaming.value = streamUpdate.isStreaming;
            data.value = streamUpdate.data;
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
        isFetching: readonly(isFetching),
        isStreaming: readonly(isStreaming),
        id,
        send,
        cancel,
    };
};
