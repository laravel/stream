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
import { streamJsonEvents } from "../streams/jsonEvents";
import { JsonEventStreamOptions, JsonEventStreamResult } from "../types";

/**
 * Composable for posting a body and reading a stream of JSON events back
 *
 * @param url - The URL to post to
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns Result object containing the received events, send, and cancel functions
 */
export const useJsonEventStream = <
    TEvent = unknown,
    TSendBody extends Record<string, any> = {},
>(
    url: MaybeRefOrGetter<string>,
    options: JsonEventStreamOptions<TEvent, TSendBody> = {},
): JsonEventStreamResult<TEvent, TSendBody> => {
    const urlRef = toRef(url);
    const events = ref([]) as Ref<TEvent[]>;
    const isFetching = ref(false);
    const isStreaming = ref(false);

    let controller: AbortController | null = null;

    const clearEvents = () => {
        events.value = [];
    };

    const cancel = () => {
        if (controller === null) {
            return;
        }

        controller.abort();
        controller = null;

        isFetching.value = false;
        isStreaming.value = false;

        options.onCancel?.();
    };

    const finish = () => {
        controller = null;
        isFetching.value = false;
        isStreaming.value = false;

        options.onFinish?.();
    };

    const send = async (body?: TSendBody) => {
        cancel();

        const pending = new AbortController();

        try {
            const sent = await streamJsonEvents<TEvent, TSendBody>({
                url: urlRef.value,
                body,
                signal: pending.signal,
                headers: options.headers,
                csrfToken: options.csrfToken,
                xsrfCookieName: options.xsrfCookieName,
                xsrfHeaderName: options.xsrfHeaderName,
                credentials: options.credentials,
                eventName: options.eventName,
                endSignal: options.endSignal,
                onBeforeSend: options.onBeforeSend,
                onParseError: options.onParseError,
                onSend: () => {
                    clearEvents();

                    controller = pending;
                    isFetching.value = true;
                },
                onResponse: (response) => {
                    isFetching.value = false;
                    isStreaming.value = true;

                    options.onResponse?.(response);
                },
                onEvent: (event) => {
                    events.value = [...events.value, event];

                    options.onEvent?.(event);
                },
            });

            if (sent) {
                finish();
            }
        } catch (error) {
            if ((error as Error).name === "AbortError") {
                return;
            }

            isFetching.value = false;
            isStreaming.value = false;

            options.onError?.(error as Error);

            finish();
        }
    };

    onMounted(() => {
        window.addEventListener("beforeunload", cancel);

        if (options.initialInput) {
            void send(options.initialInput);
        }
    });

    onUnmounted(() => {
        window.removeEventListener("beforeunload", cancel);

        cancel();
    });

    watch(urlRef, (newUrl: string, oldUrl: string) => {
        if (newUrl !== oldUrl) {
            cancel();
            clearEvents();
        }
    });

    return {
        events: readonly(events) as Readonly<Ref<readonly TEvent[]>>,
        isFetching: readonly(isFetching),
        isStreaming: readonly(isStreaming),
        send,
        cancel,
        clearEvents,
    };
};
