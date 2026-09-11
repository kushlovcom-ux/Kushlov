/**
 * GLSL ES 3.00 sources for the filter pipeline.
 *
 * Orientation convention: the camera and sprite textures are uploaded with
 * UNPACK_FLIP_Y_WEBGL set appropriately so that sampling at `v_uv` always
 * yields the upright image. Framebuffer passes inherit the same convention,
 * so no pass needs a corrective flip.
 */

export const QUAD_VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * One axis of a separable Gaussian using linear-sampled tap pairs: five
 * texture reads cover a nine-tap kernel. Run twice (horizontal, vertical) on
 * a half-resolution target.
 */
export const BLUR_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_texel;
uniform vec2 u_dir;
out vec4 fragColor;

const float W0 = 0.2270270270;
const float W1 = 0.3162162162;
const float W2 = 0.0702702703;
const float O1 = 1.3846153846;
const float O2 = 3.2307692308;

void main() {
  vec2 step1 = u_dir * u_texel * O1;
  vec2 step2 = u_dir * u_texel * O2;
  vec3 sum = texture(u_tex, v_uv).rgb * W0;
  sum += texture(u_tex, v_uv + step1).rgb * W1;
  sum += texture(u_tex, v_uv - step1).rgb * W1;
  sum += texture(u_tex, v_uv + step2).rgb * W2;
  sum += texture(u_tex, v_uv - step2).rgb * W2;
  fragColor = vec4(sum, 1.0);
}
`;

/** Straight blit, used to seed the blur chain and for the unfiltered path. */
export const COPY_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = vec4(texture(u_tex, v_uv).rgb, 1.0);
}
`;

/**
 * Beauty + colour grade in a single pass.
 *
 * Skin smoothing is an edge-aware blend rather than a plain blur: the blurred
 * sample is only accepted where it is close to the source, which keeps brows,
 * lashes and lips sharp while flattening skin. It is further confined to a
 * soft ellipse around the tracked face so the background never smears.
 */
export const COMPOSITE_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;

uniform sampler2D u_src;
uniform sampler2D u_blur;

uniform float u_smoothing;
uniform float u_brightness;
uniform float u_warmth;
uniform int u_grade;

// xy = face centre in uv space, zw = ellipse radii. w <= 0.0 disables the mask.
uniform vec4 u_faceMask;

out vec4 fragColor;

float faceWeight(vec2 uv) {
  if (u_faceMask.w <= 0.0) return 1.0;
  vec2 d = (uv - u_faceMask.xy) / max(u_faceMask.zw, vec2(0.0001));
  return 1.0 - smoothstep(0.75, 1.15, length(d));
}

vec3 applyGrade(vec3 c, int grade) {
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  if (grade == 1) {
    // Warm
    return clamp(vec3(c.r * 1.09 + 0.02, c.g * 1.02, c.b * 0.93), 0.0, 1.0);
  } else if (grade == 2) {
    // Cool
    return clamp(vec3(c.r * 0.93, c.g * 0.99, c.b * 1.11 + 0.02), 0.0, 1.0);
  } else if (grade == 3) {
    // Vintage: sepia pull with lifted blacks and reduced contrast
    vec3 sepia = vec3(
      dot(c, vec3(0.393, 0.769, 0.189)),
      dot(c, vec3(0.349, 0.686, 0.168)),
      dot(c, vec3(0.272, 0.534, 0.131))
    );
    vec3 mixed = mix(c, sepia, 0.55);
    return clamp(mixed * 0.88 + 0.08, 0.0, 1.0);
  } else if (grade == 4) {
    // Cinematic: teal shadows, warm highlights, gentle S-curve
    vec3 shadows = vec3(0.0, 0.12, 0.18);
    vec3 highlights = vec3(0.16, 0.06, 0.0);
    vec3 graded = c + mix(shadows, highlights, smoothstep(0.2, 0.8, luma)) * 0.5;
    graded = clamp(graded, 0.0, 1.0);
    return clamp((graded - 0.5) * 1.16 + 0.5, 0.0, 1.0);
  } else if (grade == 5) {
    // Mono
    return clamp(vec3((luma - 0.5) * 1.1 + 0.5), 0.0, 1.0);
  }
  return c;
}

void main() {
  vec3 src = texture(u_src, v_uv).rgb;
  vec3 color = src;

  if (u_smoothing > 0.001) {
    vec3 blurred = texture(u_blur, v_uv).rgb;
    float edge = length(src - blurred);
    float flat_ = 1.0 - smoothstep(0.05, 0.20, edge);
    color = mix(color, blurred, u_smoothing * flat_ * faceWeight(v_uv));
  }

  if (u_brightness > 0.001) {
    // Lift toward white so highlights roll off instead of clipping.
    color += u_brightness * 0.28 * (1.0 - color);
  }

  float warm = (u_warmth - 0.5) * 2.0;
  if (abs(warm) > 0.001) {
    color.r = clamp(color.r + warm * 0.055, 0.0, 1.0);
    color.b = clamp(color.b - warm * 0.055, 0.0, 1.0);
  }

  color = applyGrade(color, u_grade);
  fragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`;

/**
 * Face-attached sprite quad. Positioning happens in pixel space then converts
 * to clip space, so roll rotation stays circular on non-square viewports.
 */
export const SPRITE_VERT = /* glsl */ `#version 300 es
in vec2 a_pos;
uniform vec2 u_viewport;
uniform vec2 u_centerPx;
uniform vec2 u_halfPx;
uniform float u_rot;
out vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  vec2 local = vec2(a_pos.x * u_halfPx.x, -a_pos.y * u_halfPx.y);
  float c = cos(u_rot);
  float s = sin(u_rot);
  vec2 rotated = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 px = u_centerPx + rotated;
  gl_Position = vec4(px.x / u_viewport.x * 2.0 - 1.0, 1.0 - px.y / u_viewport.y * 2.0, 0.0, 1.0);
}
`;

export const SPRITE_FRAG = /* glsl */ `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_sprite;
uniform float u_opacity;
out vec4 fragColor;
void main() {
  vec4 texel = texture(u_sprite, v_uv);
  fragColor = vec4(texel.rgb, texel.a * u_opacity);
}
`;

/** Maps a ColorGrade name to the branch index used by COMPOSITE_FRAG. */
export const GRADE_INDEX: Record<string, number> = {
  warm: 1,
  cool: 2,
  vintage: 3,
  cinematic: 4,
  mono: 5,
};
