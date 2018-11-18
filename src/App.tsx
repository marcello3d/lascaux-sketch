/** @jsx createElement */
const { createElement } = require('react');

import styles from './App.module.css';

export function App() {
  return (
    <div className={styles.root}>
      Hello!
    </div>
  );
}
