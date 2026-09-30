# Using the demo

[Back to the overview](../README.md)

## What you see

The blue circle has equation `x² + y² = 25`, centered at the origin with
radius 5. The gray point A starts at `(-6, -2)` and moves freely. The orange
point P starts at `(3, 4)` and stays on the circle. The infinite line through
A and P updates while either point moves.

The coordinates printed below the figure are starting positions, not live
coordinate readouts.

## Controls

| Action | Control |
| --- | --- |
| Move A freely | Drag the gray point with the primary mouse button or one finger |
| Move P around the circle | Drag the orange point with the primary mouse button or one finger |
| Finish a move | Release the pointer |
| Cancel a move | Press Escape; the point and joining line return to their starting state |
| Pan | Drag empty space, or drag with the middle mouse button |
| Zoom | Scroll, pinch with two fingers, or use the toolbar plus/minus buttons |
| Keyboard navigation | Arrow keys pan; plus/minus zoom; Home fits the view |
| Fit the view | Use the fit button or Home |
| Expand the figure | Use the expand button when the browser supports fullscreen |

Click or tap inside the figure before using keyboard controls. A second touch
cancels an active point drag and starts two-finger navigation. Losing pointer
capture or leaving the focused window also cancels an active point drag.

Fit changes the camera; it does not reset the point positions. Reload the page
to return to the initial construction. Positions are not saved between reloads.

## Things to try

1. Keep A in place and move P all the way around the circle. The line always
   passes through both points.
2. Move A inside the circle, then move P again and observe the changing line.
3. Move A onto P. Two coincident points do not determine a unique line, so the
   line disappears. Move A away and it returns.
4. Start a move, then press Escape to restore both the point and line.

When the pointer is at the circle center, there is no preferred direction for
P. The demo keeps its last position until a direction is available again.

## Offline and browser support

Download [Fokozas.html](../Fokozas.html) for the self-contained offline version.
It includes the runtime and needs no server connection after downloading.
The separate `index.html`, JavaScript, and WebAssembly files are the hosted
version; serve them together, for example through GitHub Pages.

The demo requires JavaScript, WebAssembly, and WebGL 2. If a graphics error
appears, check that your browser supports WebGL 2 and permits hardware
acceleration. A browser or device that disables WebGL cannot display the figure.

This is a small demonstration, not a full geometry editor. It does not yet
provide construction tools, a constraint selector, undo history, or saved documents.
