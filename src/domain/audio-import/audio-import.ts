export const SUPPORTED_AUDIO_EXTENSIONS = [
  ".wav",
  ".mp3",
  ".m4a",
  ".aac",
  ".flac",
] as const;

export const MAX_IMPORTED_AUDIO_BYTES = 2 * 1024 * 1024 * 1024;

export function validateImportedAudio(
  fileName: string,
  sizeBytes: number,
): string | null {
  const normalizedName = fileName.trim().toLowerCase();
  const supported = SUPPORTED_AUDIO_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension),
  );

  if (!supported) {
    return "Choose a WAV, MP3, M4A, AAC, or FLAC audio file.";
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "This audio file is empty or its size could not be read.";
  }
  if (sizeBytes > MAX_IMPORTED_AUDIO_BYTES) {
    return "Audio files must be no larger than 2 GB.";
  }

  return null;
}
