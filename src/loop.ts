import { createShader, createProgram } from './shader-utils.js'
import { vertexShaderSource, fragmentShaderSource } from './shaders.js'
import { Controls, Transports } from 'av-controls'

export class Loop {
  private canvas: HTMLCanvasElement
  private gl: WebGL2RenderingContext
  private running = false
  private program: WebGLProgram
  private vao: WebGLVertexArrayObject
  private uniformLocations: {
    time: WebGLUniformLocation | null
    resolution: WebGLUniformLocation | null
    sphereSize: WebGLUniformLocation | null
  }
  private startTime = Date.now()
  private sphereSize = 0.5

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.setupShaders()
    this.setupGeometry()
    this.setupControls()
  }

  private setupShaders() {
    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource)
    this.program = createProgram(this.gl, vertexShader, fragmentShader)

    this.uniformLocations = {
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      sphereSize: this.gl.getUniformLocation(this.program, 'u_sphereSize')
    }
  }

  private setupGeometry() {
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ])

    const vao = this.gl.createVertexArray()
    if (!vao) {
      throw new Error('Failed to create VAO')
    }
    this.vao = vao

    this.gl.bindVertexArray(vao)

    const buffer = this.gl.createBuffer()
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)

    const positionLocation = this.gl.getAttribLocation(this.program, 'a_position')
    this.gl.enableVertexAttribArray(positionLocation)
    this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0)

    this.gl.bindVertexArray(null)
  }

  private setupControls() {
    const controlsWindow = window.opener || window.parent
    new Transports.Window.Receiver(controlsWindow, 'domemaster', new Controls.Group.Receiver(
      new Controls.Group.SpecWithoutControls(
        new Controls.Base.Args(
          'domemaster',
          0,
          0,
          100,
          100,
          '#000000'
        ),
      ),
      {
        'sphereSize': new Controls.Fader.Receiver(
          new Controls.Fader.Spec(
            new Controls.Base.Args(
              'sphereSize',
              0,
              0,
              10,
              50,
              '#4a90e2'
            ),
            0.5, // initial value
            0.1, // min value
            1.5, // max value
            2 // displayed decimal places
          ),
          (value) => {
            this.sphereSize = value
          }
        )
      }
    ))
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

    this.gl.useProgram(this.program)

    const time = (Date.now() - this.startTime) / 1000
    this.gl.uniform1f(this.uniformLocations.time, time)
    this.gl.uniform2f(this.uniformLocations.resolution, this.canvas.width, this.canvas.height)
    this.gl.uniform1f(this.uniformLocations.sphereSize, this.sphereSize)

    this.gl.bindVertexArray(this.vao)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    requestAnimationFrame(() => this.loop())
  }
}