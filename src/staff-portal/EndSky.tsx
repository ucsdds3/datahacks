/**
 * The portal's background: Mohak's End islands under a dark purple scrim, on a layer
 * pinned to the viewport. A fixed layer rather than `background-attachment: fixed`,
 * which iOS Safari ignores. Styled in end-theme.css; sits behind everything in the
 * `.sp-root.sp-end` it's placed in.
 */
export function EndSky() {
  return <div className="sp-end-sky" aria-hidden="true" />;
}
