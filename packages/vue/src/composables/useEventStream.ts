import { onMounted, onUnmounted, readonly, ref, watch } from "vue";
import { Options, StreamResult } from "../types";

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
  url: string,
  {
    eventName = "update",
    endSignal = "</stream>",
    glue = " ",
    onMessage = () => null,
    onComplete = () => null,
    onError = () => null,
  }: Options = {},
): StreamResult => {
  const message = ref("");
  const messageParts = ref<string[]>([]);

  let source: EventSource | null = null;

  const resetMessageState = () => {
    message.value = "";
    messageParts.value = [];
  };

  const closeConnection = (resetMessage: boolean = false) => {
    source?.removeEventListener(eventName, handleMessage);
    source?.removeEventListener("error", handleError);
    source?.close();
    source = null;

    if (resetMessage) {
      resetMessageState();
    }
  };

  const handleMessage = (event: MessageEvent) => {
    if ([endSignal, `${dataPrefix}${endSignal}`].includes(event.data)) {
      closeConnection();
      onComplete();
      return;
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

    source = new EventSource(url);
    source.addEventListener(eventName, handleMessage);
    source.addEventListener("error", handleError);
  };

  onMounted(() => {
    setupConnection();
  });

  onUnmounted(() => {
    closeConnection();
  });

  watch(
    () => url,
    (newUrl: string, oldUrl: string) => {
      if (newUrl !== oldUrl) {
        closeConnection();
        setupConnection();
      }
    },
  );

  return {
    message: readonly(message),
    messageParts: readonly(messageParts),
    close: closeConnection,
    clearMessage: resetMessageState,
  };
};

export default useEventStream;
