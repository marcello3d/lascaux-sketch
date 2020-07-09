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

export function uploadFile(acceptTypes?: string[]): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    if (acceptTypes) {
      input.setAttribute('accept', acceptTypes.join(','));
    }
    const onSelect = () => {
      resolve(input.files);
      input.removeEventListener('change', onSelect);
    };
    input.addEventListener('change', onSelect);
    input.click();
  });
}
