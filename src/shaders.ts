export const vertexShaderSource = `#version 300 es

in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform float u_sphereSize;
uniform vec3 u_cameraPos;
uniform vec3 u_cameraDir;
uniform vec3 u_cameraUp;
uniform vec3 u_cameraRight;

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 repeat(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

float map(vec3 p) {
  vec3 q = repeat(p, vec3(2.0));
  return sdSphere(q, u_sphereSize);
}

vec3 getNormal(vec3 p) {
  const float eps = 0.001;
  return normalize(vec3(
    map(p + vec3(eps, 0, 0)) - map(p - vec3(eps, 0, 0)),
    map(p + vec3(0, eps, 0)) - map(p - vec3(0, eps, 0)),
    map(p + vec3(0, 0, eps)) - map(p - vec3(0, 0, eps))
  ));
}

void main() {
  vec2 uv = (v_uv - 0.5) * 2.0;

  // Domemaster projection
  float r = length(uv);
  if (r > 1.0) {
    fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  // Convert to spherical coordinates for dome projection
  float theta = r * 1.5708; // 0 to pi/2 (90 degrees)
  float phi = atan(uv.y, uv.x);

  // Convert spherical to cartesian for ray direction (local space)
  vec3 localRd = vec3(
    sin(theta) * cos(phi),
    sin(theta) * sin(phi),
    cos(theta)
  );

  // Transform ray direction using camera basis vectors
  vec3 rd = normalize(
    u_cameraRight * localRd.x +
    u_cameraUp * localRd.y +
    u_cameraDir * localRd.z
  );

  vec3 ro = u_cameraPos;

  float t = 1.0;
  for (int i = 0; i < 64; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);

    if (d < 0.001) {
      vec3 normal = getNormal(p);
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diff = max(0.0, dot(normal, lightDir));

      vec3 color = vec3(0.8, 0.4, 0.2) * diff + vec3(0.1, 0.1, 0.2);
      fragColor = vec4(color, 1.0);
      return;
    }

    t += d;
    if (t > 20.0) break;
  }

  fragColor = vec4(0.05, 0.05, 0.1, 1.0);
}
`

export const lineVertexShaderSource = `#version 300 es

in vec3 a_position;
out vec3 v_worldPos;
out float v_transformedZ;

uniform mat4 u_rotationMatrix;
uniform vec3 u_cameraPos;
uniform vec3 u_cameraDir;
uniform vec3 u_cameraUp;
uniform vec3 u_cameraRight;

void main() {
  // Apply inverted/transposed rotation matrix to move vertices into perspective
  vec3 rotatedPos = (transpose(u_rotationMatrix) * vec4(a_position, 1.0)).xyz;

  // Store world position for fragment shader
  v_worldPos = rotatedPos;

  // Convert world space to camera space
  vec3 relativeToCam = rotatedPos - u_cameraPos;

  // Project to camera coordinates
  float x = dot(relativeToCam, u_cameraRight);
  float y = dot(relativeToCam, u_cameraUp);
  float z = dot(relativeToCam, u_cameraDir);

  // Store the transformed z for fragment shader alpha check
  v_transformedZ = z;

  // Normalize xyz position for domemaster projection
  vec3 normalized = normalize(vec3(x, y, z));

  // Convert to domemaster coordinates
  float theta = acos(normalized.z); // angle from zenith
  float phi = atan(normalized.y, normalized.x); // azimuth angle

  // Map to screen space (domemaster projection)
  float r = theta / 1.5708; // normalize to [0,1] range
  vec2 screenPos = r * vec2(cos(phi), sin(phi));

  gl_Position = vec4(screenPos, 0.0, 1.0);
}
`

export const lineFragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_worldPos;
in float v_transformedZ;
out vec4 fragColor;

void main() {
  // If transformed z is negative, set alpha to 0 (behind camera)
  float alpha = v_transformedZ < 0.0 ? 0.0 : 1.0;

  // Output depth as color for visualization
  float depth = v_transformedZ * 0.1 + 0.5; // scale and offset for visibility

  // Line color with depth-based intensity
  vec3 color = vec3(0.8, 0.6, 1.0) * (1.0 - abs(depth - 0.5));

  fragColor = vec4(color, alpha);
}
`