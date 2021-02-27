const isMac =
  window.navigator && /Mac|iPod|iPhone|iPad/.test(window.navigator.platform);
export const MOUSETRAP_MOD = isMac ? 'meta' : 'ctrl';
export const CTRL_OR_CMD = isMac ? 'Cmd' : 'Ctrl';
