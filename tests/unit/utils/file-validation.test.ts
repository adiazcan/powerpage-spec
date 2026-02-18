import { describe, expect, it } from 'vitest';
import { validateFiles } from '@/utils/file-validation';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob(['x'.repeat(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe('validateFiles', () => {
  it('accepts files in the MIME type whitelist', () => {
    const files = [
      makeFile('doc.pdf', 'application/pdf', 1024),
      makeFile('doc.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024),
      makeFile('image.png', 'image/png', 1024),
    ];

    const errors = validateFiles(files);
    expect(errors).toEqual([]);
  });

  it('returns type validation error for disallowed MIME type', () => {
    const files = [makeFile('app.exe', 'application/octet-stream', 1024)];

    const errors = validateFiles(files);

    expect(errors).toEqual([
      expect.objectContaining({
        code: 'INVALID_TYPE',
        fileName: 'app.exe',
      }),
    ]);
  });

  it('returns size validation error for files over 10 MB raw size', () => {
    const elevenMb = 11 * 1024 * 1024;
    const files = [makeFile('large.pdf', 'application/pdf', elevenMb)];

    const errors = validateFiles(files);

    expect(errors).toEqual([
      expect.objectContaining({
        code: 'FILE_TOO_LARGE',
        fileName: 'large.pdf',
      }),
    ]);
  });

  it('returns count validation error when more than 3 files are provided', () => {
    const files = [
      makeFile('a.pdf', 'application/pdf', 1024),
      makeFile('b.pdf', 'application/pdf', 1024),
      makeFile('c.pdf', 'application/pdf', 1024),
      makeFile('d.pdf', 'application/pdf', 1024),
    ];

    const errors = validateFiles(files);

    expect(errors).toEqual([
      expect.objectContaining({
        code: 'TOO_MANY_FILES',
      }),
    ]);
  });

  it('returns typed validation errors for multiple violations', () => {
    const files = [
      makeFile('ok.pdf', 'application/pdf', 1024),
      makeFile('bad.exe', 'application/octet-stream', 1024),
      makeFile('large.pdf', 'application/pdf', 11 * 1024 * 1024),
      makeFile('extra.png', 'image/png', 1024),
    ];

    const errors = validateFiles(files);

    expect(errors.map((error) => error.code)).toEqual(
      expect.arrayContaining(['TOO_MANY_FILES', 'INVALID_TYPE', 'FILE_TOO_LARGE'])
    );
  });
});
