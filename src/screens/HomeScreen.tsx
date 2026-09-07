import { LayerImg, type Layer } from '../components/LayerStack';

/**
 * Home, rebuilt from its Figma layers instead of one flat plate.
 *
 * The reason is the background: Figma instance #211:5562 is a four-variant
 * component that smart-animates between keyframes forever, and it is the
 * BOTTOM layer of the frame - child index 0, under every other pixel. A plate
 * has already flattened it into the artwork, so the only way to let it move is
 * to separate the layers again and put the animation back underneath them.
 *
 * Only the top 975px needs separating, because that is exactly how tall the
 * animated instance is. Everything below it is reused from the plate as a
 * single crop - identical pixels, nothing to align, and it removes the two
 * worst layers from the problem (see below). The animation itself lives in
 * `styles.css`; only the stacking is here.
 */

/* Offsets are measured, not assumed. Figma exports a node at its full render
   extent, unclipped by the parent frame, so a carousel that runs off the edge
   comes back wider than its layout box AND starts somewhere else: #211:5840
   exports 3709x266 for a 1036x227 box and actually begins at (-2,466), not
   (44,482). Each of these was solved by matching the layer's opaque pixels
   against the plate rather than by reading the layout box. */
const LAYERS: Layer[] = [
  { node: '211:5566', src: '/layers/211-5566.png', left: 0,  top: 784, width: 1080, height: 1493 },
  { node: '211:5840', src: '/layers/211-5840.png', left: -2, top: 466, width: 3709, height: 266 },
  { node: '211:5935', src: '/layers/211-5935.png', left: 44, top: 366, width: 992,  height: 60 },
  { node: '211:6014', src: '/layers/211-6014.png', left: 0,  top: 0,   width: 1080, height: 333 },
];

export function HomeScreen() {
  return (
    <div className="layer-clip">
      {/* Two stacked pairs, not one: the closing leg of the loop is a DISSOLVE,
          which cross-fades rather than moves. Pair B holds keyframe 1 and fades
          in under pair A. */}
      <div className="home-bg">
        <div className="home-pair-a">
          <div className="home-blob home-blob-a" />
          <div className="home-blob home-blob-b" />
        </div>
        <div className="home-pair-b">
          {/* Pair B is keyframe 1 and never moves, so it needs no override -
              the base box in `styles.css` already is keyframe 1. */}
          <div className="home-blob home-blob-a" />
          <div className="home-blob home-blob-b" />
        </div>
      </div>

      {LAYERS.map((l) => <LayerImg key={l.node} layer={l} />)}

      {/* The rest of the screen, straight off the plate. #211:5620 and
          #211:5942 both live down here and both export unclipped and
          off-origin; taking the pixels instead of re-placing them is exact by
          construction. Drawn last so it also covers the tail of #211:5566,
          which is the same pixels either way. */}
      <div className="home-below" >
        <img className="home-below-img" src="/screens/home.png" alt="" draggable={false} />
      </div>
    </div>
  );
}
