import type { DesktopApi } from '../shared/contracts';

declare global {
  interface Window {
    readonly ganymede: DesktopApi;
  }
}

export {};
