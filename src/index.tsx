import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';

// Hackity hack to get sub-pixel precision on iPad
// const pixelRatio = window.devicePixelRatio;
// if (pixelRatio > 1 && 'standalone' in navigator) {
//   const meta = document.querySelector('meta[name="viewport"]');
//   if (meta) {
//     const deviceWidth = window.innerWidth;
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
//     document.body.style.transform = `scale(${1 / scale})`;
//     document.body.style.transformOrigin = 'top left';
//   }
// }

ReactDOM.render(<App />, document.getElementById('root'));
