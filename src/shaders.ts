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

float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

vec3 repeat(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

float map(vec3 p) {
  vec3 q = repeat(p, vec3(2.0));
  return sdSphere(q, 0.5);
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
  uv.x *= u_resolution.x / u_resolution.y;

  vec3 ro = vec3(0.0, 0.0, 5.0 + sin(u_time) * 2.0);
  vec3 rd = normalize(vec3(uv, -1.0));

  float t = 0.0;
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