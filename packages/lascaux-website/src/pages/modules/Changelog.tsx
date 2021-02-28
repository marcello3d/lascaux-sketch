import React from 'react';

import styles from './Changelog.module.css';

export function Changelog() {
  return (
    <div className={styles.changelog}>
      <h3>2021-02-28</h3>
      <ul>
        <li>Fixed rare crash</li>
      </ul>

      <h3>2021-02-27</h3>
      <ul>
        <li>Fixed keyboard shortcuts on Windows</li>
      </ul>

      <h3>2020-08-02</h3>
      <ul>
        <li>Added keyboard shortcuts</li>
      </ul>

      <h3>2020-07-25</h3>
      <ul>
        <li>Bug fixes</li>
      </ul>

      <h3>2020-07-12</h3>
      <ul>
        <li>Redesigned sliders with better iPad support</li>
      </ul>

      <h3>2020-07-08</h3>
      <ul>
        <li>New internal drawing format</li>
        <li>Add ability to rename layers</li>
        <li>Export/import raw drawing JSON</li>
        <li>Improve stroke rendering</li>
      </ul>

      <h3>2020-06-28</h3>
      <ul>
        <li>Fix erasing on first layer (all layers are RGBA now)</li>
      </ul>

      <h3>2020-06-23</h3>
      <ul>
        <li>Fix add layer undo</li>
      </ul>

      <h3>2020-06-21</h3>
      <ul>
        <li>
          <b>Open source!!!</b>
        </li>
        <li>Group drawings by date</li>
        <li>Rename drawings by clicking on their title</li>
      </ul>

      <h3>2020-06-20</h3>
      <ul>
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
