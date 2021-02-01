import React, { Suspense } from 'react';
import { render } from 'react-dom';
import { LascauxStandalone, LascauxStandaloneProps } from './LascauxStandalone';

declare global {
  interface Window {
    LascauxSketch2: LascauxSketch2;
  }
}

class LascauxSketch2 {
  constructor({
    domRoot,
    ...rest
  }: LascauxStandaloneProps & { domRoot: HTMLElement }) {
    render(
      <Suspense fallback={<div>Loading Lascaux…</div>}>
        <LascauxStandalone {...rest} />
      </Suspense>,
      domRoot,
    );
  }
}

window.LascauxSketch2 = LascauxSketch2;
