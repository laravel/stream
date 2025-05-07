import { useCallback, useEffect, useRef, useState } from "react";
import { Options, StreamResult } from "../types";

const dataPrefix = "data: ";

/**
 * Hook for handling server-sent event (SSE) streams
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
  const sourceRef = useRef<EventSource | null>(null);
  const messagePartsRef = useRef<string[]>([]);

  const [message, setMessage] = useState("");
  const [messageParts, setMessageParts] = useState<string[]>([]);

  const resetMessageState = useCallback(() => {
    messagePartsRef.current = [];
    setMessage("");
    setMessageParts([]);
  }, []);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if ([endSignal, `${dataPrefix}${endSignal}`].includes(event.data)) {
        closeConnection();
        onComplete();

        return;
      }

      messagePartsRef.current.push(
        event.data.startsWith(dataPrefix)
          ? event.data.substring(dataPrefix.length)
          : event.data,
      );

      setMessage(messagePartsRef.current.join(glue));
      setMessageParts(messagePartsRef.current);

      onMessage(event);
    },
    [eventName, glue],
  );

  const handleError = useCallback((error: Event) => {
    onError(error);
    closeConnection();
  }, []);

  const closeConnection = useCallback((resetMessage: boolean = false) => {
    sourceRef.current?.removeEventListener(eventName, handleMessage);
    sourceRef.current?.removeEventListener("error", handleError);
    sourceRef.current?.close();
    sourceRef.current = null;

    if (resetMessage) {
      resetMessageState();
    }
  }, []);

  useEffect(() => {
    resetMessageState();

    sourceRef.current = new EventSource(url);
    sourceRef.current.addEventListener(eventName, handleMessage);
    sourceRef.current.addEventListener("error", handleError);

    return closeConnection;
  }, [url, eventName, handleMessage, handleError, resetMessageState]);

  return {
    message,
    messageParts,
    close: closeConnection,
    clearMessage: resetMessageState,
  };
};
