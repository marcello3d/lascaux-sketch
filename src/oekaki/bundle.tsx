import React, { Suspense } from 'react';
import { render } from 'react-dom';
import { LascauxStandalone, LascauxStandaloneProps } from './LascauxStandalone';
import { LascauxPlayer, LascauxPlayerProps } from './LascauxPlayer';

declare global {
  interface Window {
    LascauxSketch2: LascauxSketch2;
    LascauxSketch2Player: LascauxSketch2Player;
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
class LascauxSketch2Player {
  constructor({
    domRoot,
    ...rest
  }: LascauxPlayerProps & { domRoot: HTMLElement }) {
    render(
      <Suspense fallback={<div>Loading Lascaux…</div>}>
        <LascauxPlayer {...rest} />
      </Suspense>,
      domRoot,
    );
  }
}

window.LascauxSketch2 = LascauxSketch2;
window.LascauxSketch2Player = LascauxSketch2Player;
