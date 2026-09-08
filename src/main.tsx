import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppV1 from './App'
import AppV2 from './v2/App'
import './styles.css'

/**
 * V2 is the app. V1 is kept reachable at `?v=1`, not deleted.
 *
 * The two builds share nothing but the stage and the hit target - V1 is a
 * linear walk over 22 photographed screens, V2 is a state machine over 13 - so
 * they cannot be merged, and V1 is still the reference the original 22 diffs
 * were measured against. `?v=1` is what keeps that measurement runnable.
 */
const v1 = new URLSearchParams(window.location.search).get('v') === '1'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {v1 ? <AppV1 /> : <AppV2 />}
  </StrictMode>,
)
