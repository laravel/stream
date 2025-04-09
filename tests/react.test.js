//import { renderHook, act } from '@testing-library/react-hooks';
import { useStream } from '../src/react';

test('useStream initializes with default values', () => {
  const { result } = renderHook(() => useStream('/stream'));
  
  expect(result.current.message).toBe('');
  expect(result.current.messageParts).toEqual([]);
  expect(result.current.streamComplete).toBe(false);
  expect(result.current.error).toBeNull();
  expect(typeof result.current.onMessage).toBe('function');
});