import { vi } from "vitest";

/**
 * Creates a unified EventSource mock for testing
 * Includes both basic functionality and error handling
 *
 * @returns {Object} Mock implementation with event handler and error handler access
 */
const createEventSourceMock = () => {
    const mockAddEventListener = vi.fn((eventType, handler) => {
        if (!eventHandlers[eventType]) {
            eventHandlers[eventType] = [];
        }

        eventHandlers[eventType].push(handler);
    });

    const mockRemoveEventListener = vi.fn((eventType, handler) => {
        if (eventHandlers[eventType]) {
            eventHandlers[eventType] = eventHandlers[eventType].filter(
                (h) => h !== handler,
            );
        }
    });

    const mockClose = vi.fn();

    const eventHandlers: Record<string, Array<(event: any) => void>> = {};
    let onCompleteHandler: null | (() => void) = null;
    let onErrorHandler: null | ((error: any) => void) = null;

    const onComplete = vi.fn((cb) => {
        onCompleteHandler = cb;
    });

    const onError = vi.fn((cb) => {
        onErrorHandler = cb;
    });

    vi.stubGlobal(
        "EventSource",
        vi.fn().mockImplementation(() => ({
            addEventListener: mockAddEventListener,
            removeEventListener: mockRemoveEventListener,
            close: mockClose,
            set onerror(handler) {
                // Legacy: for direct assignment, not used in new API
                onErrorHandler = handler;
            },
        })),
    );

    return {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
        close: mockClose,
        // New handlers for test access
        onComplete,
        onError,
        triggerComplete: () => {
            if (onCompleteHandler) {
                onCompleteHandler();
            }
        },
        triggerError: (err = new Error("EventSource connection error")) => {
            if (onErrorHandler) {
                onErrorHandler(err);
            }
        },
        triggerEvent: (eventType: string, event: any) => {
            if (eventHandlers[eventType]) {
                eventHandlers[eventType].forEach((handler) => handler(event));
            }
        },
    };
};

createEventSourceMock();

global.createEventSourceMock = createEventSourceMock;
