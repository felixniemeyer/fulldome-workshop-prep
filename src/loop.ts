import { createShader, createProgram } from './shader-utils.js'
import { vertexShaderSource, fragmentShaderSource } from './shaders.js'
import { Controls, Transports } from 'av-controls'
import { vec3 } from 'gl-matrix'
import Simulator from 'dome-simulator'

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
    cameraPos: WebGLUniformLocation | null
    cameraDir: WebGLUniformLocation | null
    cameraUp: WebGLUniformLocation | null
    cameraRight: WebGLUniformLocation | null
  }
  private startTime = Date.now()
  private sphereSize = 0.5
  private domeSimEnabled = false

  // Framebuffer and texture for intermediate rendering
  private fbo: WebGLFramebuffer | null = null
  private fboTexture: WebGLTexture | null = null
  private domeSimulator: Simulator

  private currentPos = vec3.fromValues(0, 0, 0)
  private currentDirection = vec3.fromValues(0, 0, -1)
  private targetPos = vec3.fromValues(0, 0, 0)
  private targetDirection = vec3.fromValues(0, 0, -1)

  private currentUp = vec3.create()
  private currentRight = vec3.create()

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas

    const gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL2 not supported')
    }
    this.gl = gl

    this.setupShaders()
    this.setupGeometry()
    this.setupFramebuffer()
    this.setupControls()

    this.domeSimulator = new Simulator(this.gl, this.canvas)

    // Initialize canvas as square (simulation off by default)
    this.canvas.classList.add('square')
  }

  private setupShaders() {
    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource)
    const fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource)
    this.program = createProgram(this.gl, vertexShader, fragmentShader)

    this.uniformLocations = {
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      sphereSize: this.gl.getUniformLocation(this.program, 'u_sphereSize'),
      cameraPos: this.gl.getUniformLocation(this.program, 'u_cameraPos'),
      cameraDir: this.gl.getUniformLocation(this.program, 'u_cameraDir'),
      cameraUp: this.gl.getUniformLocation(this.program, 'u_cameraUp'),
      cameraRight: this.gl.getUniformLocation(this.program, 'u_cameraRight')
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

  private setupFramebuffer() {
    this.fbo = this.gl.createFramebuffer()
    if (!this.fbo) {
      throw new Error('Failed to create framebuffer')
    }

    this.fboTexture = this.gl.createTexture()
    if (!this.fboTexture) {
      throw new Error('Failed to create texture')
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTexture)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE)
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE)

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo)
    this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.fboTexture, 0)

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)
  }

  private updateFramebufferSize() {
    if (!this.fboTexture) return

    // Intermediary texture should always be square (domemaster format)
    const size = Math.min(this.canvas.width, this.canvas.height)

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fboTexture)
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, size, size, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, null)
    this.gl.bindTexture(this.gl.TEXTURE_2D, null)

    this.domeSimulator.setResolution(this.canvas.width, this.canvas.height)
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
              30,
              40,
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
        ),
        'randomMove': new Controls.Pad.Receiver(
          new Controls.Pad.Spec(
            new Controls.Base.Args(
              'randomMove',
              35,
              0,
              25,
              25,
              '#e24a4a'
            ),
          ),
          () => {
            // Set random target position [-5,5]³
            vec3.set(this.targetPos,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 10,
              (Math.random() - 0.5) * 10
            )

            // Set random target direction [-1,1]³ normalized
            vec3.set(this.targetDirection,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2,
              (Math.random() - 0.5) * 2
            )
            vec3.normalize(this.targetDirection, this.targetDirection)
          }
        ),
        'domeSimulation': new Controls.Switch.Receiver(
          new Controls.Switch.Spec(
            new Controls.Base.Args(
              'domeSimulation',
              65,
              0,
              30,
              25,
              '#6a4c93'
            ),
            false // initial value (off)
          ),
          (value) => {
            this.domeSimEnabled = value
            // Toggle canvas aspect ratio
            if (value) {
              this.canvas.classList.remove('square')
            } else {
              this.canvas.classList.add('square')
            }
            // Defer resize until next frame to ensure DOM changes are applied
            requestAnimationFrame(() => this.resize())
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
    this.updateFramebufferSize()
  }

  private loop() {
    if (!this.running) return

    // Update camera interpolation
    vec3.lerp(this.currentPos, this.currentPos, this.targetPos, 0.01)
    vec3.lerp(this.currentDirection, this.currentDirection, this.targetDirection, 0.01)
    vec3.normalize(this.currentDirection, this.currentDirection)

    // Calculate camera basis vectors
    // up = normalize(cross(front, (0,1,0)))
    const worldUp = vec3.fromValues(0, 1, 0)
    vec3.cross(this.currentUp, this.currentDirection, worldUp)
    vec3.normalize(this.currentUp, this.currentUp)

    // right = normalize(cross(front, up))
    vec3.cross(this.currentRight, this.currentDirection, this.currentUp)
    vec3.normalize(this.currentRight, this.currentRight)

    // Always render to framebuffer first (square domemaster format)
    const size = Math.min(this.canvas.width, this.canvas.height)
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo)
    this.gl.viewport(0, 0, size, size)

    this.gl.clearColor(0, 0, 0, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    this.gl.useProgram(this.program)

    const time = (Date.now() - this.startTime) / 1000
    this.gl.uniform1f(this.uniformLocations.time, time)
    this.gl.uniform2f(this.uniformLocations.resolution, size, size)
    this.gl.uniform1f(this.uniformLocations.sphereSize, this.sphereSize)
    this.gl.uniform3fv(this.uniformLocations.cameraPos, this.currentPos)
    this.gl.uniform3fv(this.uniformLocations.cameraDir, this.currentDirection)
    this.gl.uniform3fv(this.uniformLocations.cameraUp, this.currentUp)
    this.gl.uniform3fv(this.uniformLocations.cameraRight, this.currentRight)

    this.gl.bindVertexArray(this.vao)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)

    // Always use dome simulator for final rendering
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    if (this.fboTexture) {
      this.domeSimulator.render(this.fboTexture, this.domeSimEnabled)
    }

    requestAnimationFrame(() => this.loop())
  }
}