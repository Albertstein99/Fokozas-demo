# Hosting and publishing

[Back to the overview](../README.md)

## First GitHub Pages deployment

1. Create the public repository `Albertstein99/Fokozas-demo`.
2. Push the prepared demo snapshot to its `main` branch.
3. Open the repository's **Settings > Pages**.
4. Select **Deploy from a branch**, **main**, and **/ (root)**, then save.
5. Wait for GitHub's Pages deployment to succeed before sharing its website URL.

The intended URL is `https://albertstein99.github.io/Fokozas-demo/`.
The site uses relative asset paths and includes `.nojekyll`.

## Manual releases

This public repository has its own history. Updating or pushing the private
development repository does not update this demo.

For a new public release, the maintainer builds and tests the desired version,
reviews the generated web files and public documentation, and explicitly
commits and pushes that snapshot here. GitHub Pages then deploys the public
branch. No private-source synchronization or scheduled publishing is configured.

## Files to keep together

- `index.html`: hosted demo page.
- `fokozas-widget.js`: figure frame and toolbar.
- `viewport-navigation.js`: pointer, touch, and keyboard input.
- `viewport.html`, `viewport.js`, `viewport.wasm`: compiled rendering runtime.
- `Fokozas.html`: downloadable self-contained offline version.
- `.nojekyll`: static-site marker.
- `README.md` and `docs/`: public documentation.

The hosted version must retain its complete matching set of runtime files.
Publishing only a changed JavaScript file from a different build can leave the
runtime inconsistent. Review the whole build output as one release.

The repository publishes browser-delivered JavaScript and WebAssembly. It does
not contain the private C++ development tree, credentials, or development history.
