/**
 * Stream Assertions
 * 
 * This file contains shared test utilities for both React and Vue implementations
 * of the useStream hook. It provides a consistent way to test both implementations
 * with the same assertions and test logic.
 * 
 * The file exports 7 test functions corresponding to the 7 core tests:
 *   #1 assertInitialStreamState - Test initial state values
 *   #2 testProcessMessages - Test message processing
 *   #3 testStreamCompletion - Test stream completion
 *   #4 testErrorHandling - Test error handling
 *   #5 testOnMessageCallback - Test onMessage callback
 *   #6 testCleanup - Test cleanup on unmount
 *   #7 testUrlChange - Test URL change reconnection
 */

import { expect, vi } from 'vitest';

// Private helper functions

/**
 * Creates a mock EventSource implementation for testing
 * 
 * @returns {Object} Mock implementation with event handler access
 */
function createMockEventSource() {
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();
  const mockClose = vi.fn();
  
  // Create the mock
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    close: mockClose
  })));
  
  return {
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    close: mockClose
  };
}

/**
 * Creates a mock EventSource with error handler for testing
 * 
 * @returns {Object} Mock implementation with error handler access
 */
function createMockEventSourceWithErrorHandler() {
  const mockAddEventListener = vi.fn();
  const mockClose = vi.fn();
  let errorHandler;
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: vi.fn(),
    close: mockClose,
    set onerror(handler) {
      errorHandler = handler;
    }
  })));
  
  return {
    addEventListener: mockAddEventListener,
    close: mockClose,
    errorHandler: () => errorHandler
  };
}

/**
 * Helper function to assert message state
 */
function assertMessageProcessed(result, expectedMessage, expectedParts) {
  if ('current' in result) {
    // React style assertions
    expect(result.current.message).toBe(expectedMessage);
    expect(result.current.messageParts).toEqual(expectedParts);
  } else {
    // Vue style assertions
    expect(result.message.value).toBe(expectedMessage);
    expect(result.messageParts.value).toEqual(expectedParts);
  }
}

/**
 * Helper function to assert stream completion
 */
function assertStreamCompleted(result) {
  if ('current' in result) {
    // React style assertions
    expect(result.current.streamComplete).toBe(true);
  } else {
    // Vue style assertions
    expect(result.streamComplete.value).toBe(true);
  }
}

// Exported test functions

/**
 * #1 - Test initial state values
 * Asserts that a stream hook has the expected initial values
 * Works with both React and Vue implementations
 * 
 * @param {Object} result - The result object from renderHook or withSetup
 */
export function assertInitialStreamState(result) {
  if ('current' in result) {
    // React style assertions
    expect(result.current.message).toBe('');
    expect(result.current.messageParts).toEqual([]);
    expect(result.current.streamComplete).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.onMessage).toBe('function');
  } else {
    // Vue style assertions
    expect(result.message.value).toBe('');
    expect(result.messageParts.value).toEqual([]);
    expect(result.streamComplete.value).toBe(false);
    expect(result.error.value).toBeNull();
    expect(typeof result.onMessage).toBe('function');
  }
}









/**
 * #2 - Test message processing
 * Runs a test for processing messages with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} actFn - act function for React or null for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testProcessMessages(framework, renderFn, actFn, useStreamFn) {
  // Create mock EventSource
  const mocks = createMockEventSource();
  
  // Render the hook
  const result = framework === 'react' 
    ? renderFn(() => useStreamFn('/stream')).result
    : renderFn(() => useStreamFn('/stream'))[0];
  
  // Get the event handler
  const eventHandler = mocks.addEventListener.mock.calls[0][1];
  
  // Simulate first message
  if (framework === 'react' && actFn) {
    actFn(() => {
      eventHandler({ data: 'Hello' });
    });
  } else {
    eventHandler({ data: 'Hello' });
  }
  
  // Check first message
  assertMessageProcessed(
    framework === 'react' ? { current: result.current } : result, 
    'Hello', 
    ['Hello']
  );
  
  // Simulate second message
  if (framework === 'react' && actFn) {
    actFn(() => {
      eventHandler({ data: 'World' });
    });
  } else {
    eventHandler({ data: 'World' });
  }
  
  // Check combined messages
  assertMessageProcessed(
    framework === 'react' ? { current: result.current } : result, 
    'Hello World', 
    ['Hello', 'World']
  );
  
  return { result, mocks };
}

/**
 * #3 - Test stream completion
 * Runs a test for stream completion with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} actFn - act function for React or null for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testStreamCompletion(framework, renderFn, actFn, useStreamFn) {
  // Create mock EventSource
  const mockAddEventListener = vi.fn();
  const mockRemoveEventListener = vi.fn();
  const mockClose = vi.fn();
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: mockRemoveEventListener,
    close: mockClose
  })));
  
  const onCompleteMock = vi.fn();
  
  // Render the hook
  const result = framework === 'react' 
    ? renderFn(() => useStreamFn('/stream', undefined, onCompleteMock)).result
    : renderFn(() => useStreamFn('/stream', undefined, onCompleteMock))[0];
  
  // Get the event handler function
  const eventHandler = mockAddEventListener.mock.calls[0][1];
  
  // Simulate end signal
  if (framework === 'react' && actFn) {
    actFn(() => {
      eventHandler({ data: '</stream>' });
    });
  } else {
    eventHandler({ data: '</stream>' });
  }
  
  // Check if stream complete state was updated correctly
  assertStreamCompleted(framework === 'react' ? { current: result.current } : result);
  expect(mockClose).toHaveBeenCalled();
  expect(onCompleteMock).toHaveBeenCalled();
  
  return { result, mocks: { addEventListener: mockAddEventListener, close: mockClose } };
}

/**
 * #4 - Test error handling
 * Runs a test for error handling with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} actFn - act function for React or null for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testErrorHandling(framework, renderFn, actFn, useStreamFn) {
  // Mock EventSource implementation
  const mockAddEventListener = vi.fn();
  const mockClose = vi.fn();
  let errorHandler;
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: vi.fn(),
    close: mockClose,
    set onerror(handler) {
      errorHandler = handler;
    }
  })));
  
  // Render the hook
  const result = framework === 'react' 
    ? renderFn(() => useStreamFn('/stream')).result
    : renderFn(() => useStreamFn('/stream'))[0];
  
  // Simulate an error
  if (framework === 'react' && actFn) {
    actFn(() => {
      errorHandler(new Event('error'));
    });
  } else {
    errorHandler(new Event('error'));
  }
  
  // Check if error state was updated correctly
  if (framework === 'react') {
    expect(result.current.error).not.toBeNull();
    expect(result.current.error.message).toBe('EventSource connection error');
  } else {
    expect(result.error.value).not.toBeNull();
    expect(result.error.value.message).toBe('EventSource connection error');
  }
  
  expect(mockClose).toHaveBeenCalled();
  
  return { result, errorHandler, mockClose };
}

/**
 * #5 - Test onMessage callback
 * Runs a test for onMessage callback with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} actFn - act function for React or null for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testOnMessageCallback(framework, renderFn, actFn, useStreamFn) {
  // Mock EventSource implementation
  const mockAddEventListener = vi.fn();
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: mockAddEventListener,
    removeEventListener: vi.fn(),
    close: vi.fn()
  })));
  
  // Render the hook
  const result = framework === 'react' 
    ? renderFn(() => useStreamFn('/stream')).result
    : renderFn(() => useStreamFn('/stream'))[0];
  
  const onMessageMock = vi.fn();
  
  // Register the callback
  if (framework === 'react' && actFn) {
    actFn(() => {
      result.current.onMessage(onMessageMock);
    });
  } else {
    result.onMessage(onMessageMock);
  }
  
  // Get the event handler function
  const eventHandler = mockAddEventListener.mock.calls[0][1];
  const testEvent = { data: 'Test message' };
  
  // Simulate a message
  if (framework === 'react' && actFn) {
    actFn(() => {
      eventHandler(testEvent);
    });
  } else {
    eventHandler(testEvent);
  }
  
  // Check if the callback was called with the event
  expect(onMessageMock).toHaveBeenCalledWith(testEvent);
  
  return { result, eventHandler, onMessageMock };
}

/**
 * #6 - Test cleanup on unmount
 * Runs a test for cleanup on unmount with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testCleanup(framework, renderFn, useStreamFn) {
  // Mock EventSource implementation
  const mockClose = vi.fn();
  const mockRemoveEventListener = vi.fn();
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => ({
    addEventListener: vi.fn(),
    removeEventListener: mockRemoveEventListener,
    close: mockClose
  })));
  
  // Render the hook
  const rendered = framework === 'react' 
    ? renderFn(() => useStreamFn('/stream'))
    : renderFn(() => useStreamFn('/stream'));
  
  // Unmount the component
  if (framework === 'react') {
    rendered.unmount();
  } else {
    rendered[1].unmount();
  }
  
  // Check if cleanup was performed correctly
  expect(mockClose).toHaveBeenCalled();
  expect(mockRemoveEventListener).toHaveBeenCalled();
  
  return { mockClose, mockRemoveEventListener };
}

/**
 * #7 - Test URL change reconnection
 * Runs a test for URL change reconnection with the appropriate framework
 * 
 * @param {string} framework - 'react' or 'vue'
 * @param {Function} renderFn - renderHook for React or withSetup for Vue
 * @param {Function} useStreamFn - the useStream hook to test
 */
export function testUrlChange(framework, renderFn, useStreamFn) {
  // Mock EventSource implementation
  const mockClose = vi.fn();
  let eventSourceCount = 0;
  
  // Override the global mock for this specific test
  vi.stubGlobal('EventSource', vi.fn().mockImplementation(() => {
    eventSourceCount++;
    return {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: mockClose
    };
  }));
  
  // Render with initial URL
  if (framework === 'react') {
    const { rerender } = renderFn(
      (props) => useStreamFn(props.url),
      { initialProps: { url: '/stream1' } }
    );
    
    // Check initial connection
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);
    
    // Change URL
    rerender({ url: '/stream2' });
    
    // Check reconnection
    expect(mockClose).toHaveBeenCalled();
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith('/stream2');
    
    return { mockClose, eventSourceCount };
  } else {
    // For Vue, we need to unmount and remount
    let url = '/stream1';
    const [result, app] = renderFn(() => useStreamFn(url));
    
    // Check initial connection
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(1);
    
    // Change URL and force a re-render
    url = '/stream2';
    app.unmount();
    const [newResult, newApp] = renderFn(() => useStreamFn(url));
    
    // Check reconnection
    expect(mockClose).toHaveBeenCalled();
    expect(vi.mocked(EventSource)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(EventSource)).toHaveBeenLastCalledWith('/stream2');
    
    return { mockClose, eventSourceCount, result, newResult };
  }
}