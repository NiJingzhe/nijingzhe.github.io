/**
 * Renders the generated museum layout as a top-down plan view PNG.
 *
 * Usage:
 *   npm run plan          — previews with 3 synthetic exhibits
 *   npm run plan -- 8     — previews with N synthetic exhibits
 *
 * The script is a development aid: it imports the same `buildMuseumLayout` the site
 * uses, so the drawing always reflects the real generator output.
 */
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import {
  buildMuseumLayout,
  defaultMuseumConfig,
  getLayoutBounds,
  resolveHangingPoint,
  type ExhibitLayoutInput,
} from '../src/layout'

const countArg = Number(process.argv[2])
const exhibitCount = Number.isFinite(countArg) && countArg > 0 ? Math.floor(countArg) : 3
const categories = defaultMuseumConfig.categories
const inputs: ExhibitLayoutInput[] = Array.from({ length: exhibitCount }, (_, index) => ({
  id: `exhibit-${index + 1}`,
  category: categories[index % categories.length].id,
}))
const layout = buildMuseumLayout(inputs)
const bounds = getLayoutBounds(layout)

const roomAccentById = new Map(layout.rooms.map((room) => [room.id, room.categoryAccent]))

const scale = 30 // pixels per meter
const margin = 3
const minX = bounds.minX - margin
const maxX = bounds.maxX + margin
const minZ = bounds.minZ - margin
const maxZ = bounds.maxZ + margin
const width = Math.ceil((maxX - minX) * scale)
const height = Math.ceil((maxZ - minZ) * scale)
const image = Buffer.alloc(width * height * 4, 0)

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function fillRect(x0: number, z0: number, x1: number, z1: number, color: [number, number, number], alpha = 255): void {
  const px0 = Math.max(0, Math.round((x0 - minX) * scale))
  const px1 = Math.min(width - 1, Math.round((x1 - minX) * scale))
  const pz0 = Math.max(0, Math.round((maxZ - z1) * scale))
  const pz1 = Math.min(height - 1, Math.round((maxZ - z0) * scale))
  for (let py = pz0; py <= pz1; py += 1) {
    for (let px = px0; px <= px1; px += 1) {
      const offset = (py * width + px) * 4
      const blend = alpha / 255
      image[offset] = Math.round(color[0] * blend + image[offset] * (1 - blend))
      image[offset + 1] = Math.round(color[1] * blend + image[offset + 1] * (1 - blend))
      image[offset + 2] = Math.round(color[2] * blend + image[offset + 2] * (1 - blend))
      image[offset + 3] = 255
    }
  }
}

fillRect(minX, minZ, maxX, maxZ, hexToRgb('#2b2822'))
for (const room of layout.rooms) {
  const { minX: rx0, maxX: rx1, minZ: rz0, maxZ: rz1 } = room.bounds
  fillRect(rx0, rz0, rx1, rz1, hexToRgb(room.floorColor))
  fillRect(rx0 + 2.8, rz0 + 2.8, rx1 - 2.8, rz1 - 2.8, hexToRgb(room.carpetColor))
}
for (const zone of layout.walkZones) {
  fillRect(zone.minX, zone.minZ, zone.maxX, zone.maxZ, hexToRgb('#4d7ea8'), 90)
}
for (const guide of layout.lighting.floorGuides) {
  const [gx, , gz] = guide.position
  fillRect(gx - guide.width / 2, gz - guide.depth / 2, gx + guide.width / 2, gz + guide.depth / 2, hexToRgb(guide.color), Math.round(guide.opacity * 255))
}
for (const wall of layout.walls) {
  const horizontal = Math.abs(wall.tangent[0]) > 0.5
  const halfLength = wall.width / 2
  const halfThickness = wall.thickness / 2
  const [ox, oz] = wall.origin
  fillRect(
    ox - (horizontal ? halfLength : halfThickness),
    oz - (horizontal ? halfThickness : halfLength),
    ox + (horizontal ? halfLength : halfThickness),
    oz + (horizontal ? halfThickness : halfLength),
    hexToRgb('#39332a'),
  )
}
for (const point of layout.hangingPoints) {
  const resolved = resolveHangingPoint(layout, point.id)
  const horizontal = Math.abs(resolved.wall.tangent[0]) > 0.5
  const [px, , pz] = resolved.position
  const halfWidth = point.frame.width / 2
  fillRect(
    px - (horizontal ? halfWidth : 0.35),
    pz - (horizontal ? 0.35 : halfWidth),
    px + (horizontal ? halfWidth : 0.35),
    pz + (horizontal ? 0.35 : halfWidth),
    hexToRgb(roomAccentById.get(resolved.wall.roomId) ?? '#c5aa72'),
  )
}
{
  const [sx, , sz] = layout.spawn.position
  fillRect(sx - 0.5, sz - 0.5, sx + 0.5, sz + 0.5, hexToRgb('#3f8f5a'))
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer: Buffer): number {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(width, 0)
ihdr.writeUInt32BE(height, 4)
ihdr[8] = 8
ihdr[9] = 6
const raw = Buffer.alloc((width * 4 + 1) * height)
for (let row = 0; row < height; row += 1) {
  raw[row * (width * 4 + 1)] = 0
  image.copy(raw, row * (width * 4 + 1) + 1, row * width * 4, (row + 1) * width * 4)
}
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(raw)),
  pngChunk('IEND', Buffer.alloc(0)),
])
writeFileSync(`${process.cwd()}/museum-plan.png`, png)

console.log(`exhibits: ${exhibitCount}`)
console.log(`halls: ${layout.rooms.length} -> ${layout.rooms.map((room) => `${room.name}(${room.category})`).join(', ')}`)
console.log(`walls: ${layout.walls.length}, frames: ${layout.hangingPoints.length}, gates: ${layout.walkZones.length}, signs: ${layout.signage.length}`)
console.log(`spawn: ${layout.spawn.position.join(', ')}`)
console.log(`wrote museum-plan.png (${width}x${height})`)
