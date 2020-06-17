export function downloadFile(blob: Blob, filename: string) {
  const a = document.createElement('a');
  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  // This doesn't work on iOS:
  // window.URL.revokeObjectURL(url);
}

export function filenameDate(date = new Date()) {
  return date.toISOString().replace(/:/g, '');
}
