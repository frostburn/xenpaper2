/// <reference types="vite/client" />

declare module 'moment-of-symmetry' {
  export function stepString(
    countLarge: number,
    countSmall: number,
    options?: { up?: number; down?: number; period?: number | null },
  ): string

  export function generateNotation(pattern: string): {
    scale: Map<string, readonly [number, number]>
  }
}
