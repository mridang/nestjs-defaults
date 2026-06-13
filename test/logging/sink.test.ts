import { expect, jest, describe, test, afterEach } from '@jest/globals';
import type { Ecs } from '@elastic/ecs';
import {
  PrettyConsoleSink,
  StdoutJsonSink,
  StructuredConsoleSink,
} from '../../src/logging/sink';

const entry: Ecs = {
  ecs: { version: '9.4.0' },
  '@timestamp': '2026-06-12T00:00:00.000Z',
  message: 'a message',
  log: { level: 'info', logger: 'HomeController' },
  service: { name: 'birdlittle' },
};

describe('log sinks', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('StructuredConsoleSink writes the document object to console.log', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

    new StructuredConsoleSink().emit(entry);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(entry);
  });

  test('StdoutJsonSink writes one newline-terminated JSON line to stdout', () => {
    const spy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true);

    new StdoutJsonSink().emit(entry);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(`${JSON.stringify(entry)}\n`);
  });

  test('PrettyConsoleSink writes a readable line via console.log', () => {
    const lines: string[] = [];
    jest.spyOn(console, 'log').mockImplementation((line: unknown) => {
      lines.push(String(line));
    });

    new PrettyConsoleSink().emit(entry);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('a message');
    expect(lines[0]).toContain('INFO');
    expect(lines[0]).toContain('HomeController');
  });
});
