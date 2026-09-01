export type StreamFrame = {
    event: string | null;
    id: string | null;
    data: string;
};

export type FrameHandler = (frame: StreamFrame) => boolean;

export const readEventStream = async (
    body: ReadableStream<Uint8Array>,
    onFrame: FrameHandler,
): Promise<void> => {
    const reader = body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let carriageReturn = "";

    // Belongs to the stream rather than the frame: it holds its value until
    // the server sets it again, and an id counts even on a frame that
    // dispatches nothing.
    let lastEventId: string | null = null;

    const dispatchFrame = (frame: string): boolean => {
        const fields = parseFields(frame);

        if (fields.id !== undefined) {
            lastEventId = fields.id;
        }

        if (fields.data === null) {
            return true;
        }

        return onFrame({
            event: fields.event,
            id: lastEventId,
            data: fields.data,
        });
    };

    try {
        for (;;) {
            const { done, value } = await reader.read();

            if (done) {
                break;
            }

            buffer += carriageReturn + decoder.decode(value, { stream: true });
            carriageReturn = "";

            // Held back so a CRLF split across two reads is not turned
            // into two line breaks, halving one frame.
            if (buffer.endsWith("\r")) {
                buffer = buffer.slice(0, -1);
                carriageReturn = "\r";
            }

            buffer = buffer.replace(/\r\n?/g, "\n");

            let boundary = buffer.indexOf("\n\n");

            while (boundary !== -1) {
                const frame = buffer.slice(0, boundary);

                buffer = buffer.slice(boundary + 2);

                if (!dispatchFrame(frame)) {
                    // Not awaited: a source mid-write may not settle its
                    // cancel until it finishes.
                    void reader.cancel().catch(() => undefined);

                    return;
                }

                boundary = buffer.indexOf("\n\n");
            }
        }

        // Anything left never reached its blank line, and an incomplete
        // frame is discarded at end of file.
    } finally {
        reader.releaseLock();
    }
};

type ParsedFields = {
    event: string | null;
    id: string | undefined;
    data: string | null;
};

/**
 * @link https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
const parseFields = (frame: string): ParsedFields => {
    const data: string[] = [];

    let event: string | null = null;
    let id: string | undefined;

    for (const line of frame.split("\n")) {
        if (line === "" || line.startsWith(":")) {
            continue;
        }

        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        const value =
            colon === -1 ? "" : stripLeadingSpace(line.slice(colon + 1));

        if (field === "data") {
            data.push(value);
        } else if (field === "event") {
            event = value;
        } else if (field === "id" && !value.includes("\u0000")) {
            id = value;
        }
    }

    return { event, id, data: data.length === 0 ? null : data.join("\n") };
};

const stripLeadingSpace = (value: string): string =>
    value.startsWith(" ") ? value.slice(1) : value;
