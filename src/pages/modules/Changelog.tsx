import React from 'react';

import styles from './Changelog.module.css';

export function Changelog() {
  return (
    <div className={styles.changelog}>
      <h3>2020-06-20</h3>
      <ul>
        <li>
          <b>Officially open source!</b>
        </li>
        <li>Improve UI, add icons</li>
        <li>Fix bugs where drawing list does not update</li>
        <li>Prevent accidental dots when pinch zooming</li>
      </ul>

      <h3>2020-06-19</h3>
      <ul>
        <li>Show drawing thumbnails</li>
        <li>Block swipe back/forward on Chrome while drawing</li>
      </ul>

      <h3>2020-06-18</h3>
      <ul>
        <li>Set your canvas size before drawing</li>
      </ul>

      <h3>2020-06-16</h3>
      <ul>
        <li>Added "Save PNG" button</li>
      </ul>

      <h3>2020-06-14</h3>
      <ul>
        <li>Version to header</li>
        <li>Code/deployment reorganization</li>
      </ul>

      <h3>2020-06-13</h3>
      <ul>
        <li>Support for float16 (if float32 is not available)</li>
        <li>Faster undo after reloading drawing</li>
      </ul>

      <h3>2020-06-09</h3>
      <ul>
        <li>Click to add a dot</li>
        <li>Brush spacing and hardness sliders</li>
        <li>
          <a href="https://sentry.io">Sentry</a> error tracking
        </li>
        <li>Smoother brush rendering</li>
      </ul>

      <h3>2020-06-06</h3>
      <ul>
        <li>First public release!</li>
        <li>Save drawings to local storage</li>
        <li>Loading screen</li>
      </ul>
    </div>
  );
}