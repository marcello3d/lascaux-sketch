import React, { ChangeEvent, Suspense, useCallback, useState } from 'react';
import { Link, RouteComponentProps } from '@reach/router';

import styles from './index.module.css';
import LascauxLogoPath from './lascaux-logo.jpg';
import PizzaSliceIcon from '../icons/fa/pizza-slice.svg';
import GithubIcon from '../icons/fa/github.svg';
import TwitterIcon from '../icons/fa/twitter.svg';
import LayerGroupIcon from '../icons/fa/layer-group.svg';
import TvRetroIcon from '../icons/fa/tv-retro.svg';
import CalculatorIcon from '../icons/fa/calculator-alt.svg';
import HddIcon from '../icons/fa/hdd.svg';
import MicrochipIcon from '../icons/fa/microchip.svg';
import SparklesIcon from '../icons/fa/sparkles.svg';

import { db } from '../db/db';
import { newDate, newId } from '../db/fields';
import { Layout } from './modules/Layout';
import classNames from 'classnames';
import { DrawingGrid } from './modules/DrawingGrid';
import { Icon } from '../ui/Icon';
import { Changelog } from './modules/Changelog';

function validSize(input: string): number | undefined {
  if (!/^\d+$/.test(input)) {
    return undefined;
  }
  const n = parseInt(input, 10);
  if (n < 8 || n > 4096) {
    return undefined;
  }
  return n;
}

export function IndexPage({ navigate }: RouteComponentProps) {
  const [stringWidth, setWidth] = useState('512');
  const [stringHeight, setHeight] = useState('512');
  const onWidthChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setWidth(event.target.value),
    [],
  );
  const onHeightChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => setHeight(event.target.value),
    [],
  );
  const width = validSize(stringWidth);
  const height = validSize(stringHeight);
  const addDrawing = useCallback(
    async (event: React.SyntheticEvent) => {
      event.preventDefault();
      if (width === undefined || height === undefined) {
        return;
      }
      const id = newId();
      await db.drawings.add({
        id,
        createdAt: newDate(),
        dna: { width, height },
      });
      navigate?.(`/drawings/${id}`);
    },
    [width, height, navigate],
  );

  return (
    <Layout className={styles.root}>
      <div className={styles.column}>
        <h2>Your Drawings</h2>
        <p>
          Start drawing right now! Drawings are saved in your web browser's
          storage.
        </p>
        <form onSubmit={addDrawing}>
          <button
            onClick={addDrawing}
            disabled={!(width !== undefined && height !== undefined)}
          >
            <Icon
              file={PizzaSliceIcon}
              alt="Pizza slice icon for new drawing button"
            />
            New Drawing
          </button>{' '}
          Size:{' '}
          <input
            type="text"
            className={classNames(styles.input, {
              [styles.invalid]: width === undefined,
            })}
            value={stringWidth}
            inputMode="numeric"
            onChange={onWidthChange}
          />
          {' ⨉ '}
          <input
            type="text"
            className={classNames(styles.input, {
              [styles.invalid]: height === undefined,
            })}
            value={stringHeight}
            inputMode="numeric"
            onChange={onHeightChange}
          />
        </form>
        <Suspense fallback={<p>Retrieving…</p>}>
          <DrawingGrid />
        </Suspense>
      </div>
      <div className={styles.column}>
        <p>
          <img
            src={LascauxLogoPath}
            alt="Original Lascaux Sketch logo circa 2002"
            width={300}
            height={170}
          />
        </p>
        <p>
          Lascaux Sketch 2 is an <b>open source</b> web-based digital painting
          tool.
        </p>
        <p>
          <a href="https://github.com/marcello3d/lascaux-sketch/">
            <Icon file={GithubIcon} alt="Github icon" />
            github.com/marcello3d/lascaux-sketch
          </a>
        </p>
        <p>
          <a href="https://twitter.com/marcello3d/">
            <Icon file={TwitterIcon} alt="Twitter icon" />
            marcello3d
          </a>
        </p>
        <h2>About</h2>
        <p>
          I built the first version of Lascaux Sketch back in{' '}
          <a href="https://web.archive.org/web/20041009175410/http://www.cellosoft.com/sketchstudio/">
            2002
          </a>{' '}
          for my site <a href="https://2draw.net/">2draw.net</a> as a side
          project inspired by the{' '}
          <a href="https://en.wiktionary.org/wiki/Oekaki">Oekaki</a> scene at
          the time.
        </p>
        <p>
          This new version is a mashup of experiments I've done over the years.
          The goal is to build a sweet drawing app using modern web
          technologies.
        </p>
        <h2>Features</h2>
        <ul className={styles.features}>
          <li>
            <Icon file={LayerGroupIcon} alt="Layer group icon" /> Multi-layer
            canvas up to 4000 ⨉ 4000
          </li>
          <li>
            <Icon file={MicrochipIcon} alt="Microchip icon" />{' '}
            Hardware-accelerated with WebGL
          </li>
          <li>
            <Icon file={CalculatorIcon} alt="Calculator icon" /> 64bit/128bit
            RGBA blending (if supported)
          </li>
          <li>
            <Icon file={TvRetroIcon} alt="Retro TV icon" /> Full animated stroke
            and undo history
          </li>
          <li>
            <Icon file={HddIcon} alt="HDD icon" /> Saves in browser local
            storage
          </li>
          <li>
            <Icon file={SparklesIcon} alt="Sparkles icon" /> More in the works,
            follow along on <a href="https://twitter.com/marcello3d">Twitter</a>{' '}
            and{' '}
            <a href="https://github.com/marcello3d/lascaux-sketch/">Github</a>!
          </li>
        </ul>
        <h2>Diagnostics</h2>
        <p>
          Visit the <Link to="/diag">diagnostics page</Link> to see how Lascaux
          Sketch handles your device and browser
        </p>
        <h2>Changelog</h2>
        <Changelog />
      </div>
    </Layout>
  );
}
