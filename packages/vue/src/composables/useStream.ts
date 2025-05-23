import { nanoid } from "nanoid";
import { onMounted, onUnmounted, readonly, Ref, ref } from "vue";
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
): {
    data: Readonly<Ref<string>>;
    jsonData: Readonly<TJsonData | null>;
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
    let removeCallbacks: () => void;

    const updateStream = (params: Partial<StreamMeta<TJsonData>>) => {
        update<TJsonData>(id, params);
    };

    const cancel = () => {
        stream.value.controller.abort();

        if (isFetching || isStreaming) {
            onCancel(id);
        }

        updateStream({
            isFetching: false,
            isStreaming: false,
        });
    };

    const makeRequest = (body: Record<string, any> = {}) => {
        const controller = new AbortController();

        const request: RequestInit = {
            method: "POST",
            signal: controller.signal,
            headers: {
                ...headers,
                ...(options.headers ?? {}),
            },
            body: JSON.stringify(body),
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

    onMounted(() => {
        stopListening = addListener(id, (streamUpdate) => {
            stream.value = resolveStream<TJsonData>(id);
            isFetching.value = streamUpdate.isFetching;
            isStreaming.value = streamUpdate.isStreaming;
            data.value = streamUpdate.data;
            jsonData.value = streamUpdate.jsonData;
        });

        removeCallbacks = addCallbacks(id, options);

        window.addEventListener("beforeunload", cancel);

        if (options.initialInput) {
            makeRequest(options.initialInput);
        }
    });

    onUnmounted(() => {
        stopListening();
        removeCallbacks();
        window.removeEventListener("beforeunload", cancel);

        if (!hasListeners(id)) {
            cancel();
        }
    });

    return {
        data: readonly(data),
        jsonData: readonly(jsonData) as Readonly<TJsonData | null>,
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

    return { data: jsonData, strData: data, ...rest };
};
