import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { App } from './App';
import Diagnostics from './Diagnostics';

// const pixelRatio = window.devicePixelRatio;
// if (pixelRatio > 1) {
//   const meta = document.querySelector('meta[name="viewport"]');
//   if (meta) {
//     const deviceWidth = window.innerWidth > 0 ? window.innerWidth : screen.width;
//     const scale = 1 / (pixelRatio * 2);
//     meta.setAttribute(
//       'content',
//       [
//         `width=${deviceWidth * pixelRatio * 2}`,
//         `initial-scale=${scale}`,
//         `minimum-scale=${scale}`,
//         `maximum-scale=${scale}`,
//       ].join(','),
//     );
//   }
// }

if (document.location.pathname === '/diag') {
  ReactDOM.render(<Diagnostics />, document.getElementById('root'));
  document.body.classList.add('diagnostics');
} else {
  ReactDOM.render(<App />, document.getElementById('root'));
}
