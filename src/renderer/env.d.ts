import type { AppApi } from '../shared/types';

declare global {
  interface Window { studio: AppApi }
}

export {};
