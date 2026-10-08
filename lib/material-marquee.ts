export const MATERIAL_LOOP_SECONDS = 9.33
const revisedMaterialIds = new Set([2, 4, 5, 7, 9, 10, 11, 14, 15])

// Preserve the existing material inventory and revised exports. mat3 does not exist.
export const MATERIAL_MODELS = Array.from({ length: 16 }, (_, index) => index + 1)
  .filter(id => id !== 3)
  .map(id => ({ id, src: `/GLB/${revisedMaterialIds.has(id) ? 'materials-v2/' : ''}mat${id}.glb` }))

export function materialPositionX(seconds: number, index: number, viewportWidth: number) {
  const span = Math.max(MATERIAL_MODELS.length * 2.6, viewportWidth + 5.2)
  const position = index * span / MATERIAL_MODELS.length - seconds / MATERIAL_LOOP_SECONDS * span
  return ((position + span / 2) % span + span) % span - span / 2
}
