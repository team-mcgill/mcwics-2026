import { Buffer } from 'buffer'

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer
}

if (typeof globalThis.global === 'undefined') {
  globalThis.global = globalThis
}

if (typeof globalThis.process === 'undefined') {
  const nextTick = (cb, ...args) => Promise.resolve().then(() => cb(...args))
  globalThis.process = {
    env: {},
    browser: true,
    version: '',
    argv: [],
    platform: 'browser',
    cwd: () => '/',
    nextTick,
    on: () => {},
    off: () => {},
    emit: () => false,
  }
}
