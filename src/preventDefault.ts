import * as React from 'react';

export function preventDefault(event: UIEvent | React.SyntheticEvent) {
  event.preventDefault();
}
