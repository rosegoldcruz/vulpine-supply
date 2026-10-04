// Sutherland–Hodgman clipping. Vertices contain all original glTF attributes.
// Interpolate UVs/normals/tangents at the plane instead of dropping whole triangles.
export function clipPlane(polygon, height, keepAbove) {
  const result = [];
  const inside = (v) => keepAbove ? v.POSITION[1] >= height : v.POSITION[1] <= height;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const aInside = inside(a), bInside = inside(b);
    if (aInside) result.push(a);
    if (aInside !== bInside) {
      const t = (height - a.POSITION[1]) / (b.POSITION[1] - a.POSITION[1]);
      const vertex = Object.fromEntries(Object.keys(a).map((key) => [key,
        a[key].map((value, j) => value + t * (b[key][j] - value)),
      ]));
      vertex.POSITION[1] = height;
      for (const key of ['NORMAL', 'TANGENT']) {
        if (!vertex[key]) continue;
        const length = Math.hypot(...vertex[key].slice(0, 3));
        if (length) for (let j = 0; j < 3; j++) vertex[key][j] /= length;
      }
      if (vertex.TANGENT) vertex.TANGENT[3] = a.TANGENT[3] < 0 ? -1 : 1;
      result.push(vertex);
    }
  }
  return result;
}

export function triangleArea(triangle) {
  const [a, b, c] = triangle.map((v) => v.POSITION);
  const u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
  return Math.hypot(u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]) / 2;
}

export function clipTriangle(triangle, lower, upper) {
  // Horizontal boundary triangles belong only to the lower band.
  if (triangle.every((v) => v.POSITION[1] === lower)) return [];
  const polygon = clipPlane(clipPlane(triangle, lower, true), upper, false);
  const triangles = [];
  for (let i = 1; i + 1 < polygon.length; i++) {
    const tri = [polygon[0], polygon[i], polygon[i + 1]];
    if (triangleArea(tri) > 1e-14) triangles.push(tri);
  }
  return triangles;
}
