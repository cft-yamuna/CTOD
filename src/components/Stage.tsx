import { useEffect, useState, type ReactNode } from 'react'

/** The design's own resolution. Every coordinate in the app is relative to it. */
export const STAGE_W = 1080
export const STAGE_H = 1920

/**
 * Scales the fixed 1080x1920 stage to fit the panel, letterboxing rather than
 * cropping so the artwork is never cut. The transform is omitted at exactly 1
 * so a 1080x1920 display - the target hardware, and the size the visual diff
 * photographs - composites the plates at their native pixels with no resample.
 */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const fit = () =>
      setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])

  return (
    <div className="stage-fit">
      <div
        className="stage"
        style={scale === 1 ? undefined : { transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
