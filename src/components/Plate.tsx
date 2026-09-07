/**
 * A whole exported Figma frame, rendered as one image.
 *
 * Plate mode: the artwork IS the design, so nothing on it is redrawn in DOM.
 * In particular, never render live text over one - the plate already contains
 * every glyph, and a second copy a pixel away reads as blur, not as a bug.
 */
export function Plate({ src, alt }: { src: string; alt: string }) {
  return <img className="plate" src={src} alt={alt} draggable={false} />
}
