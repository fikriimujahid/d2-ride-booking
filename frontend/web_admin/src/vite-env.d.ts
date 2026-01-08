/// <reference types="vite/client" />

// This repo currently ships without TS config files.
// Keeping this declaration in `src/` ensures VS Code/tsserver picks it up.
declare module "qrcode" {
  export function toDataURL(text: string, options?: Record<string, unknown>): Promise<string>;
}
