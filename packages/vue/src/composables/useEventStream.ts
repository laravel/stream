import {
    MaybeRefOrGetter,
    onMounted,
    onUnmounted,
    readonly,
    ref,
    toRef,
    watch,
} from "vue";
import { EventStreamOptions, EventStreamResult } from "../types";

const dataPrefix = "data: ";

/**
 * Composable for handling server-sent events (SSE) streams
 *
 * @param url - The URL to connect to for the EventSource
 * @param options - Options for the stream
 *
 * @link https://laravel.com/docs/responses#event-streams
 *
 * @returns StreamResult object containing the accumulated response, close, and reset functions
 */
export const useEventStream = (
    url: MaybeRefOrGetter<string>,
    {
        eventName = "update",
        endSignal = "</stream>",
        glue = " ",
        replace = false,
        onMessage = () => null,
        onComplete = () => null,
        onError = () => null,
    }: EventStreamOptions = {},
): EventStreamResult => {
    const urlRef = toRef(url);
    const message = ref("");
    const messageParts = ref<string[]>([]);
    const eventNames = Array.isArray(eventName) ? eventName : [eventName];

    let source: EventSource | null = null;

    const resetMessageState = () => {
        message.value = "";
        messageParts.value = [];
    };

    const closeConnection = (resetMessage: boolean = false) => {
        eventNames.forEach((eventName) => {
            source?.removeEventListener(eventName, handleMessage);
        });
        source?.close();
        source = null;

        if (resetMessage) {
            resetMessageState();
        }
    };

    const handleMessage = (event: MessageEvent<string>) => {
        if ([endSignal, `${dataPrefix}${endSignal}`].includes(event.data)) {
            closeConnection();
            onComplete();
            return;
        }

        if (replace) {
            resetMessageState();
        }

        messageParts.value.push(
            event.data.startsWith(dataPrefix)
                ? event.data.substring(dataPrefix.length)
                : event.data,
        );

        message.value = messageParts.value.join(glue);

        onMessage(event);
    };

    const handleError = (e: Event) => {
        onError(e);
        closeConnection();
    };

    const setupConnection = () => {
        resetMessageState();

        source = new EventSource(urlRef.value);

        eventNames.forEach((eventName) => {
            source!.addEventListener(eventName, handleMessage);
        });
        source.addEventListener("error", handleError);
    };

    onMounted(() => {
        setupConnection();
    });

    onUnmounted(() => {
        closeConnection();
    });

    watch(urlRef, (newUrl: string, oldUrl: string) => {
        if (newUrl !== oldUrl) {
            closeConnection();
            setupConnection();
        }
    });

    return {
        message: readonly(message),
        messageParts: readonly(messageParts),
        close: closeConnection,
        clearMessage: resetMessageState,
    };
};

export default useEventStream;
