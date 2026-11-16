declare module 'piexifjs' {
  export const ImageIFD: Record<string, number>
  export const ExifIFD: Record<string, number>
  export const GPSIFD: Record<string, number>
  export const InteropIFD: Record<string, number>
  export function dump(exif: Record<string, Record<number, unknown>>): string
  export function insert(exifStr: string, jpegStr: string): string
  export function load(jpegStr: string): Record<string, Record<number, unknown>>
  export function remove(jpegStr: string): string
}
