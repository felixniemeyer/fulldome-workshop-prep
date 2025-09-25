import './style.css'
import { Loop } from './loop.js'

function init() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement
  const loop = new Loop(canvas)
  loop.start()
}

if (document.readyState === 'loading') {
  window.addEventListener('load', init)
} else {
  init()
}
