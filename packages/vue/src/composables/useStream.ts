import { onMounted, onUnmounted, readonly, ref, watch } from "vue";

interface StreamOptions {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    headers?: HeadersInit;
    body?: BodyInit;
    onMessage?: (data: any) => void;
    onComplete?: () => void;
    onError?: (error: any) => void;
}

interface StreamResult {
    data: Readonly<typeof ref>;
    close: () => void;
    clearData: () => void;
}

/**
 * Composable for handling fetch-based streams
 *
 * @param url - The URL to fetch from
 * @param options - Options for the stream including fetch options and callbacks
 *
 * @returns StreamResult object containing the stream data and control functions
 */
export const useStream = (
    url: string,
    {
        method = "GET",
        headers = {},
        body,
        onMessage = () => null,
        onComplete = () => null,
        onError = () => null,
    }: StreamOptions = {},
): StreamResult => {
    const data = ref<any>(null);
    let controller: AbortController | null = null;
    let reader: ReadableStreamDefaultReader | null = null;

    const resetData = () => {
        data.value = null;
    };

    const closeConnection = (reset: boolean = false) => {
        reader?.cancel();
        controller?.abort();
        reader = null;
        controller = null;

        if (reset) {
            resetData();
        }
    };

    const setupConnection = async () => {
        resetData();
        controller = new AbortController();

        console.log("Setting up connection to:", url);

        try {
            const response = await fetch(url, {
                method,
                headers,
                body,
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            if (!response.body) {
                throw new Error("ReadableStream not supported");
            }

            reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    onComplete();
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                try {
                    const parsedData = JSON.parse(chunk);
                    data.value = parsedData;
                    onMessage(parsedData);
                } catch {
                    data.value = chunk;
                    onMessage(chunk);
                }
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.name === "AbortError") {
                return;
            }
            onError(error);
        } finally {
            closeConnection();
        }
    };

    onMounted(() => {
        void setupConnection();
    });

    onUnmounted(() => {
        closeConnection();
    });

    watch(
        () => url,
        (newUrl: string, oldUrl: string) => {
            if (newUrl !== oldUrl) {
                closeConnection();
                void setupConnection();
            }
        },
    );

    return {
        data: readonly(data),
        close: closeConnection,
        clearData: resetData,
    };
};

export default useStream;
