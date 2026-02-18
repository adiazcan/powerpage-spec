export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'text/plain',
] as const;

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_FILE_COUNT = 3;

export type FileValidationErrorCode = 'INVALID_TYPE' | 'FILE_TOO_LARGE' | 'TOO_MANY_FILES';

export interface FileValidationError {
  code: FileValidationErrorCode;
  message: string;
  fileName?: string;
}

export function validateFiles(files: File[]): FileValidationError[] {
  const errors: FileValidationError[] = [];

  if (files.length > MAX_FILE_COUNT) {
    errors.push({
      code: 'TOO_MANY_FILES',
      message: `You can upload a maximum of ${MAX_FILE_COUNT} files.`,
    });
  }

  for (const file of files) {
    if (!ACCEPTED_ATTACHMENT_MIME_TYPES.includes(file.type as (typeof ACCEPTED_ATTACHMENT_MIME_TYPES)[number])) {
      errors.push({
        code: 'INVALID_TYPE',
        fileName: file.name,
        message: `${file.name} has an unsupported file type.`,
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        fileName: file.name,
        message: `${file.name} must be 10 MB or smaller.`,
      });
    }
  }

  return errors;
}
