export class Loop {
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private running = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl
  }

  start() {
    if (this.running) return

    this.running = true
    window.addEventListener('resize', this.resize.bind(this))
    this.resize()
    this.loop()
  }

  stop() {
    this.running = false
    window.removeEventListener('resize', this.resize.bind(this))
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1
    const rect = this.canvas.getBoundingClientRect()

    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr

    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  private loop() {
    if (!this.running) return

    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    requestAnimationFrame(() => this.loop())
  }
}