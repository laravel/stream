import { nanoid } from "nanoid";
import {
    MaybeRefOrGetter,
    onMounted,
    onUnmounted,
    readonly,
    Ref,
    ref,
    toRef,
    watch,
} from "vue";
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

export const useStream = <
    TSendBody extends Record<string, any> = {},
    TJsonData = null,
>(
    url: MaybeRefOrGetter<string>,
    options: StreamOptions<TSendBody> = {},
): {
    data: Readonly<Ref<string>>;
    jsonData: Readonly<TJsonData | null>;
    isFetching: Readonly<Ref<boolean>>;
    isStreaming: Readonly<Ref<boolean>>;
    id: string;
    send: (body?: TSendBody) => void;
    cancel: () => void;
    clearData: () => void;
} => {
    const reactiveUrl = toRef(url);
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

        fetch(reactiveUrl.value, modifiedRequest ?? request)
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
    });

    watch(reactiveUrl, (newUrl: string, oldUrl: string) => {
        if (newUrl !== oldUrl) {
            cancel();
            clearData();
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

export const useJsonStream = <
    TJsonData = null,
    TSendBody extends Record<string, any> = {},
>(
    url: MaybeRefOrGetter<string>,
    options: Omit<StreamOptions<TSendBody>, "json"> = {},
) => {
    const { jsonData, data, ...rest } = useStream<TSendBody, TJsonData>(url, {
        ...options,
        json: true,
    });

    return { data: jsonData, strData: data, ...rest };
};
