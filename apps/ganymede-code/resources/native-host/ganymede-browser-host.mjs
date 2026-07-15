#!/usr/bin/env node
import { connect } from 'node:net';
import { join } from 'node:path';
import { homedir } from 'node:os';

const socketPath = join(
  homedir(),
  'Library',
  'Application Support',
  'Ganymede Code',
  'browser-bridge.sock',
);
const socket = connect(socketPath);
let stdinBuffer = Buffer.alloc(0);
let socketBuffer = Buffer.alloc(0);

process.stdin.on('data', (chunk) => {
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
  stdinBuffer = drain(stdinBuffer, (payload) => socket.write(frame(payload)));
});

socket.on('data', (chunk) => {
  socketBuffer = Buffer.concat([socketBuffer, chunk]);
  socketBuffer = drain(socketBuffer, (payload) => process.stdout.write(frame(payload)));
});

socket.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});

process.stdin.on('end', () => socket.end());
socket.on('close', () => process.exit(0));

function frame(payload) {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

function drain(buffer, onMessage) {
  let offset = 0;
  while (buffer.length - offset >= 4) {
    const length = buffer.readUInt32LE(offset);
    if (buffer.length - offset - 4 < length) break;
    const start = offset + 4;
    onMessage(buffer.subarray(start, start + length));
    offset = start + length;
  }
  return buffer.subarray(offset);
}
