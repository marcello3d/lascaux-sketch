# Lascaux Sketch 2.0

Open source WebGL-based drawing tool using in React/TypeScript.

- Go try it now at [lascaux.studio](https://lascaux.studio)!
- Star and watch this repo!
- Follow me [@marcello3d](https://twitter.com/marcello3d) on Twitter for updates

## Background

Lascaux Sketch was originally a Java Applet I wrote back in [2002](https://web.archive.org/web/20041009175410/http://www.cellosoft.com/sketchstudio/)
used on [2draw.net](https://2draw.net/). This is a new version built from the ground up using TypeScript and WebGL.

## Technical stack

- [TypeScript](https://www.typescriptlang.org) for type-checked JavaScript
- [React](https://reactjs.org) for UI
- [Create React App](https://reactjs.org/docs/create-a-new-react-app.html) for scaffolding (this may change to [Next.JS](https://nextjs.org))
- [Vercel](https://vercel.com) for deployment
- [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) for graphics compositing
- [Dexie](https://dexie.org) for IndexedDB-based browser local storage

## Code structure

- `src/` main source code
  - `db/` local-storage related files, including storage implementation
  - `icons/` icon files (not open source!) 
  - `lascaux/` **main drawing app logic** 
    - `browser/` browser integration
    - `data-model/` core data model for drawing (strokes, gotos, modes, storage interface)
    - `test/` (tests? lol, not actually used)
    - `util/` various helper utility functions
    - `webgl/` all drawing, blending, and compositing logic
  - `pages/` the logic for the various pages
  - `react-hooks/` React helper hooks 
  - `ui/` misc UI components
- `public/` static files served on deployment
- `patches/` [patch-package](https://www.npmjs.com/package/patch-package) patches for broken types

## Contributing

This is a side project, but I welcome collaborators! I'm tracking and planning work in 
[Github Projects](https://github.com/marcello3d/lascaux-sketch/projects), so be sure to check 
that out, and probably easiest to reach out to me on Twitter or by email.

## License

Source code is licensed under [Zlib open source license](https://opensource.org/licenses/Zlib).

**Note:** Lascaux Sketch logo and name cannot to be used without permission.

**Note:** [Font Awesome Pro icons](https://fontawesome.com) cannot be redistributed without a license (I have one for my own usage)
