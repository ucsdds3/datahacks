/**
 * The Nether backdrop (Figma "Shell"): a nether-brick wall with a few embers drifting
 * up from a lava flow along the bottom edge, and the lava's heat haze. Styled in
 * nether-shell.css.
 *
 * Two layers pinned to the viewport: the wall sits behind everything in the
 * `.sp-root.sp-nether` it's placed in, and the lava in front, as in the design, so
 * the page scrolls under it (the frame leaves room for it at the end of the page).
 */
export function NetherSky() {
  return (
    <>
      <div className="sp-nether-sky" aria-hidden="true">
        {EMBERS.map(i => <span key={i} className="sp-nether-ember" />)}
      </div>
      <div className="sp-nether-lava" aria-hidden="true" />
    </>
  );
}

const EMBERS = [1, 2, 3, 4, 5, 6];
