import type { ComponentType } from 'react';

export interface ShellHandle<Data = unknown> {
  breadcrumb: string | ((data: Data) => string);
  live?: boolean | ((data: Data) => boolean);
  liveBadge?: boolean | ((data: Data) => boolean);
  HeaderActions?: ComponentType<{ data: Data }>;
}

export function defineHandle<Data>(handle: ShellHandle<Data>): ShellHandle<Data> {
  return handle;
}

export function isShellHandle(value: unknown): value is ShellHandle {
  return typeof value === 'object' && value !== null && 'breadcrumb' in value;
}
