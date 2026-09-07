/**
 * A screen rebuilt from its individual Figma layers rather than one flat plate.
 *
 * Only two screens need this, and only because each has an animation on a layer
 * that sits *underneath* other artwork. A plate is one flattened image, so an
 * interior layer cannot move inside it - the layers have to be separated again
 * to put the animation back at its correct depth.
 *
 * Everything else still uses `Plate`. This is the expensive path, not the
 * default one.
 */
export type Layer = {
  /** Figma node id, so a misplaced layer can be traced back to source. */
  node: string;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  opacity?: number;
};

export function LayerImg({ layer }: { layer: Layer }) {
  return (
    <img
      className="layer"
      src={layer.src}
      alt=""
      draggable={false}
      style={{
        left: layer.left,
        top: layer.top,
        width: layer.width,
        height: layer.height,
        opacity: layer.opacity,
      }}
    />
  );
}
