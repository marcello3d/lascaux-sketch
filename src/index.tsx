import './polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import { App } from './App';
import * as serviceWorker from './serviceWorker';
import { StoreContext } from 'redux-react-hook';
import { createStore } from 'redux';
import { reducer } from './app/reducer';

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

const store = createStore(
  reducer,
  // @ts-ignore
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__(),
);

ReactDOM.render(
  <StoreContext.Provider value={store}>
    <App />
  </StoreContext.Provider>,
  document.getElementById('root'),
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: http://bit.ly/CRA-PWA
serviceWorker.unregister();
