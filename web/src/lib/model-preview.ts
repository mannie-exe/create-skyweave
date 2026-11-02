import * as THREE from 'three'
import { textureFrame } from './texture-frame.ts'
import { readColorTokens } from './style-tokens.ts'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export type Face = { uv: number[]; texture: string; rotation?: number }
export type Element = {
  name?: string
  from: number[]
  to: number[]
  faces: Record<string, Face>
  transform?: number[][]
  rotation?: {
    axis: 'x' | 'y' | 'z'
    angle: number
    origin: number[]
    rescale?: boolean
  }
}
export type Model = {
  textures: Record<string, string>
  elements: Element[]
  meshes?: {
    name?: string
    positions: number[]
    uv: number[]
    texture: string
  }[]
  doubleSided?: boolean
  sceneRotation?: number[]
}
export type TextureSource = {
  url: string
  originalUrl?: string
  width: number
  height: number
  frameWidth?: number
  frameHeight: number
  animation: {
    frametime?: number
    frames?: (number | { index: number; time?: number })[]
  } | null
}
export type Preview = {
  id: string
  model: Model
  texture: TextureSource
  textures: Record<string, TextureSource>
  elements: number
  faces: number
  masks?: {
    plane: number
    key: string
    width: number
    height: number
    texture: string
    pixels: number[][]
  }[]
}

// Minecraft face winding and UV orientation, in model coordinates. Keep this
// conversion separate from editor state so preview and tests share one mapping.
export function faceGeometry(element: Element, direction: string, face: Face) {
  const [x0, y0, z0] = element.from
  const [x1, y1, z1] = element.to
  const corners: Record<string, number[][]> = {
    north: [
      [x1, y1, z0],
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
    ],
    south: [
      [x0, y1, z1],
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
    ],
    west: [
      [x0, y1, z0],
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
    ],
    east: [
      [x1, y1, z1],
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
    ],
    up: [
      [x0, y1, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ],
    down: [
      [x0, y0, z1],
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y0, z1],
    ],
  }
  const positions = corners[direction]
    .map((p) => {
      const point = new THREE.Vector3(...(p as [number, number, number]))
      if (element.rotation) {
        const rotation = element.rotation
        const origin = new THREE.Vector3(
          ...(rotation.origin as [number, number, number]),
        )
        const angle = THREE.MathUtils.degToRad(rotation.angle)
        point.sub(origin)
        if (rotation.rescale) {
          const scale = 1 / Math.cos(angle)
          for (const axis of ['x', 'y', 'z'] as const)
            if (axis !== rotation.axis) point[axis] *= scale
        }
        const axis = new THREE.Vector3()
        axis[rotation.axis] = 1
        point.applyAxisAngle(axis, angle).add(origin)
      }
      if (element.transform) {
        const coordinates = point.toArray().map((value) => value / 16)
        point.fromArray(
          element.transform.map(
            (row) =>
              (row[3] +
                row
                  .slice(0, 3)
                  .reduce(
                    (sum, value, index) => sum + value * coordinates[index],
                    0,
                  )) *
              16,
          ),
        )
      }
      return point.toArray()
    })
    .flat()
  const [u0, v0, u1, v1] = face.uv
  const uv = [
    [u0, v0],
    [u0, v1],
    [u1, v1],
    [u1, v0],
  ]
  const steps = (face.rotation ?? 0) / 90
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      uv.flatMap((_, i) => [
        uv[(i + steps) % 4][0] / 16,
        1 - uv[(i + steps) % 4][1] / 16,
      ]),
      2,
    ),
  )
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.computeVertexNormals()
  return geometry
}

export class ModelPreview {
  private canvas: HTMLCanvasElement
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  private controls: OrbitControls
  private group = new THREE.Group()
  private grid: THREE.GridHelper
  private highlightColor: THREE.Color
  private observer: ResizeObserver
  private maps: { map: THREE.Texture; source: TextureSource }[] = []
  private generation = 0
  private selected = -1
  private wireframe = false
  private textureTime: number | undefined
  private renderFrame: (time: number) => void = () => {}
  private cameraListener?: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const palette = readColorTokens(canvas, {
      selected: '--color-action',
      grid: '--ink-muted',
      line: '--line-subtle',
    })
    this.highlightColor = new THREE.Color(palette.selected).multiplyScalar(0.2)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.camera.position.set(32, 25, 35)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.target.set(8, 8, 8)
    this.controls.minDistance = 8
    this.controls.maxDistance = 120
    this.controls.update()
    this.controls.addEventListener('change', () => this.cameraListener?.())
    this.scene.add(this.group, new THREE.AmbientLight(0xffffff, 2))
    const light = new THREE.DirectionalLight(0xffffff, 2)
    light.position.set(10, 30, 20)
    this.scene.add(light)
    this.grid = new THREE.GridHelper(32, 16, palette.grid, palette.line)
    this.grid.position.set(8, -0.02, 8)
    this.scene.add(this.grid)
    this.observer = new ResizeObserver(() => {
      const width = canvas.clientWidth,
        height = canvas.clientHeight
      this.renderer.setSize(width, height, false)
      this.camera.aspect = width / Math.max(height, 1)
      this.camera.updateProjectionMatrix()
    })
    this.observer.observe(canvas)
    this.renderFrame = (time) => {
      for (const { map, source } of this.maps) {
        const frame = textureFrame(source, this.textureTime ?? time)
        map.repeat.set(frame.repeat[0], frame.repeat[1])
        map.offset.set(frame.offset[0], frame.offset[1])
      }
      this.renderer.render(this.scene, this.camera)
    }
    this.active(true)
  }

  private clear() {
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshLambertMaterial
      >
      mesh.geometry.dispose()
      mesh.material.dispose()
      this.group.remove(mesh)
    }
    for (const { map } of this.maps) map.dispose()
    this.maps = []
  }

  async show(preview: Preview) {
    const generation = ++this.generation
    const textures = await Promise.all(
      Object.entries(preview.textures).map(async ([key, source]) => {
        const map = await new THREE.TextureLoader().loadAsync(source.url)
        map.magFilter = map.minFilter = THREE.NearestFilter
        map.colorSpace = THREE.SRGBColorSpace
        map.generateMipmaps = false
        return { key, source, map }
      }),
    )
    if (generation !== this.generation) {
      textures.forEach(({ map }) => map.dispose())
      return
    }
    this.clear()
    this.maps = textures
    for (const [index, element] of preview.model.elements.entries()) {
      for (const [direction, face] of Object.entries(element.faces)) {
        const identifier = preview.model.textures[face.texture.slice(1)]
        const map = textures.find((t) => t.key === identifier)?.map
        if (!map) throw new Error(`Missing preview texture: ${identifier}`)
        const material = new THREE.MeshLambertMaterial({
          map,
          alphaTest: 0.1,
          wireframe: this.wireframe,
        })
        const mesh = new THREE.Mesh(
          faceGeometry(element, direction, face),
          material,
        )
        mesh.userData.element = index
        this.group.add(mesh)
      }
    }
    for (const face of preview.model.meshes ?? []) {
      if (face.positions.length !== 12 || face.uv.length !== 8)
        throw new Error('Unsupported preview mesh face')
      const identifier = preview.model.textures[face.texture]
      const map = textures.find((texture) => texture.key === identifier)?.map
      if (!map) throw new Error(`Missing mesh texture: ${identifier}`)
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(face.positions, 3),
      )
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(face.uv, 2))
      geometry.setIndex([0, 1, 2, 0, 2, 3])
      geometry.computeVertexNormals()
      const material = new THREE.MeshLambertMaterial({
        map,
        alphaTest: 0.1,
        side: preview.model.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        wireframe: this.wireframe,
      })
      this.group.add(new THREE.Mesh(geometry, material))
    }
    this.group.rotation.set(0, 0, 0)
    this.group.position.set(0, 0, 0)
    if (preview.model.sceneRotation) {
      const [x, y] = preview.model.sceneRotation
      this.group.rotation.set(
        THREE.MathUtils.degToRad(x),
        -THREE.MathUtils.degToRad(y),
        0,
      )
      const center = new THREE.Vector3(8, 8, 8).applyEuler(this.group.rotation)
      this.group.position.set(8 - center.x, 8 - center.y, 8 - center.z)
    }
    this.highlight(this.selected)
    this.canvas.dataset.ready = preview.id
  }

  active(value: boolean) {
    this.renderer.setAnimationLoop(value ? this.renderFrame : null)
  }

  textureClock(milliseconds: number | undefined) {
    this.textureTime = milliseconds
  }

  onCameraChange(listener?: () => void) {
    this.cameraListener = listener
  }

  cameraState() {
    return {
      position: this.camera.position.toArray(),
      target: this.controls.target.toArray(),
      up: this.camera.up.toArray(),
    }
  }

  setCamera(state: ReturnType<ModelPreview['cameraState']>) {
    this.camera.position.fromArray(state.position)
    this.camera.up.fromArray(state.up)
    this.controls.target.fromArray(state.target)
    this.controls.update()
  }

  bounds() {
    const bounds = new THREE.Box3().setFromObject(this.group)
    return { min: bounds.min.toArray(), max: bounds.max.toArray() }
  }

  fit(bounds: { min: number[]; max: number[] } = this.bounds()) {
    const minimum = new THREE.Vector3().fromArray(bounds.min),
      maximum = new THREE.Vector3().fromArray(bounds.max)
    const center = minimum.add(maximum).multiplyScalar(0.5)
    const size = new THREE.Vector3()
      .fromArray(bounds.max)
      .sub(new THREE.Vector3().fromArray(bounds.min))
    const distance = Math.max(size.x, size.y, size.z, 8) * 2.1
    this.controls.target.copy(center)
    this.camera.position
      .copy(center)
      .add(
        new THREE.Vector3(0.65, 0.48, 0.8).normalize().multiplyScalar(distance),
      )
    this.controls.update()
  }

  orient(view: 'front' | 'top') {
    this.controls.target.set(8, 8, 8)
    this.camera.up.set(0, 1, 0)
    this.camera.position.set(
      8,
      view === 'top' ? 48 : 8,
      view === 'top' ? 8.01 : 48,
    )
    this.controls.update()
  }

  highlight(index: number) {
    this.selected = index
    for (const child of this.group.children) {
      const mesh = child as THREE.Mesh<
        THREE.BufferGeometry,
        THREE.MeshLambertMaterial
      >
      if (mesh.userData.element === index)
        mesh.material.emissive.copy(this.highlightColor)
      else mesh.material.emissive.setHex(0)
    }
  }

  wire(value: boolean) {
    this.wireframe = value
    for (const child of this.group.children)
      (
        child as THREE.Mesh<THREE.BufferGeometry, THREE.MeshLambertMaterial>
      ).material.wireframe = value
  }

  reset() {
    this.camera.position.set(32, 25, 35)
    this.controls.target.set(8, 8, 8)
    this.controls.update()
  }

  dispose() {
    this.generation++
    this.renderer.setAnimationLoop(null)
    this.observer.disconnect()
    this.controls.dispose()
    this.clear()
    this.grid.geometry.dispose()
    for (const material of Array.isArray(this.grid.material)
      ? this.grid.material
      : [this.grid.material])
      material.dispose()
    this.renderer.dispose()
  }
}
