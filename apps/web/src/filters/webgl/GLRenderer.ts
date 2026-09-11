import type {
  BeautySettings,
  FaceTrackingData,
  FilterAnchor,
  FilterDefinition,
  FilterSprite,
  SpriteId,
} from '@kushlov/filter-core';
import {
  BLUR_FRAG,
  COMPOSITE_FRAG,
  COPY_FRAG,
  GRADE_INDEX,
  QUAD_VERT,
  SPRITE_FRAG,
  SPRITE_VERT,
} from './shaders';
import { paintSprite } from './sprites';

/**
 * WebGL2 compositor for the filter pipeline.
 *
 * Every frame is: upload camera → optional half-res separable blur → single
 * beauty/grade pass → textured sprite quads. No pixel ever crosses back to
 * JavaScript; there is no getImageData anywhere in the loop.
 */

/** Blur runs at half resolution — invisible at these radii, 4x cheaper. */
const BLUR_DIVISOR = 2;

type Program = {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
};

type RenderTarget = {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
};

type SpriteLayout = {
  centerX: number;
  centerY: number;
  halfW: number;
  halfH: number;
};

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function link(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string,
  uniformNames: string[],
): Program | null {
  const vert = compile(gl, gl.VERTEX_SHADER, vertSource);
  const frag = compile(gl, gl.FRAGMENT_SHADER, fragSource);
  if (!vert || !frag) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.bindAttribLocation(program, 0, 'a_pos');
  gl.linkProgram(program);
  // Shader objects are reference-counted by the program once attached.
  gl.deleteShader(vert);
  gl.deleteShader(frag);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
}

export class GLRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly copy: Program;
  private readonly blur: Program;
  private readonly composite: Program;
  private readonly sprite: Program;
  private readonly vao: WebGLVertexArrayObject;
  private readonly quadBuffer: WebGLBuffer;
  private readonly videoTexture: WebGLTexture;
  private readonly spriteTextures = new Map<SpriteId, WebGLTexture | null>();
  private targets: [RenderTarget, RenderTarget] | null = null;
  private width = 0;
  private height = 0;
  private disposed = false;

  private constructor(
    gl: WebGL2RenderingContext,
    programs: { copy: Program; blur: Program; composite: Program; sprite: Program },
    vao: WebGLVertexArrayObject,
    quadBuffer: WebGLBuffer,
    videoTexture: WebGLTexture,
  ) {
    this.gl = gl;
    this.copy = programs.copy;
    this.blur = programs.blur;
    this.composite = programs.composite;
    this.sprite = programs.sprite;
    this.vao = vao;
    this.quadBuffer = quadBuffer;
    this.videoTexture = videoTexture;
  }

  /** Returns null when WebGL2 is unavailable or a shader fails to build. */
  static create(canvas: HTMLCanvasElement): GLRenderer | null {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) return null;

    const copy = link(gl, QUAD_VERT, COPY_FRAG, ['u_tex']);
    const blur = link(gl, QUAD_VERT, BLUR_FRAG, ['u_tex', 'u_texel', 'u_dir']);
    const composite = link(gl, QUAD_VERT, COMPOSITE_FRAG, [
      'u_src',
      'u_blur',
      'u_smoothing',
      'u_brightness',
      'u_warmth',
      'u_grade',
      'u_faceMask',
    ]);
    const spriteProgram = link(gl, SPRITE_VERT, SPRITE_FRAG, [
      'u_sprite',
      'u_viewport',
      'u_centerPx',
      'u_halfPx',
      'u_rot',
      'u_opacity',
    ]);
    if (!copy || !blur || !composite || !spriteProgram) return null;

    const vao = gl.createVertexArray();
    const quadBuffer = gl.createBuffer();
    const videoTexture = gl.createTexture();
    if (!vao || !quadBuffer || !videoTexture) return null;

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    return new GLRenderer(
      gl,
      { copy, blur, composite, sprite: spriteProgram },
      vao,
      quadBuffer,
      videoTexture,
    );
  }

  resize(width: number, height: number): void {
    if (this.disposed || width <= 0 || height <= 0) return;
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;
    this.releaseTargets();
    this.targets = [
      this.createTarget(Math.max(1, Math.floor(width / BLUR_DIVISOR)), Math.max(1, Math.floor(height / BLUR_DIVISOR))),
      this.createTarget(Math.max(1, Math.floor(width / BLUR_DIVISOR)), Math.max(1, Math.floor(height / BLUR_DIVISOR))),
    ].filter(Boolean) as [RenderTarget, RenderTarget];
    if (this.targets.length !== 2) this.targets = null;
  }

  private createTarget(width: number, height: number): RenderTarget | null {
    const gl = this.gl;
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) return null;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (!complete) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      return null;
    }
    return { framebuffer, texture, width, height };
  }

  private spriteTexture(id: SpriteId): WebGLTexture | null {
    const cached = this.spriteTextures.get(id);
    if (cached !== undefined) return cached;

    const gl = this.gl;
    const bitmap = paintSprite(id);
    if (!bitmap) {
      this.spriteTextures.set(id, null);
      return null;
    }
    const texture = gl.createTexture();
    if (!texture) {
      this.spriteTextures.set(id, null);
      return null;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // Canvas bitmaps are top-down and the sprite shader expects that.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.spriteTextures.set(id, texture);
    return texture;
  }

  /**
   * Anchor geometry in pixels. Eye separation drives accessory width because
   * it stays stable as the head turns, unlike the bounding box.
   */
  private layoutSprite(
    face: FaceTrackingData,
    anchor: FilterAnchor,
    scale: number,
    yOffset: number,
  ): SpriteLayout {
    const faceW = face.width * this.width;
    const faceH = face.height * this.height;
    const point = face.anchors[anchor] ?? face.anchors.face;
    const offsetPx = yOffset * face.height * this.height;

    let w: number;
    let h: number;
    switch (anchor) {
      case 'eyes': {
        w = Math.max(0.22, face.eyeDistance * 2.7) * this.width * scale;
        h = w * 0.55;
        break;
      }
      case 'forehead': {
        w = faceW * 1.05 * scale;
        h = w * 0.72;
        break;
      }
      case 'mouth': {
        w = faceW * 0.92 * scale;
        h = w * 0.7;
        break;
      }
      case 'nose': {
        w = faceW * 0.42 * scale;
        h = w;
        break;
      }
      default: {
        w = faceW * 1.12 * scale;
        h = faceH * 1.1 * scale;
      }
    }

    return {
      centerX: point.x * this.width,
      centerY: point.y * this.height + offsetPx,
      halfW: w / 2,
      halfH: h / 2,
    };
  }

  private runBlur(): WebGLTexture | null {
    const gl = this.gl;
    const targets = this.targets;
    if (!targets) return null;
    const [a, b] = targets;

    // Downsample the camera into A.
    gl.bindFramebuffer(gl.FRAMEBUFFER, a.framebuffer);
    gl.viewport(0, 0, a.width, a.height);
    gl.useProgram(this.copy.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.copy.uniforms.u_tex ?? null, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(this.blur.program);
    gl.uniform1i(this.blur.uniforms.u_tex ?? null, 0);

    // Horizontal A → B, then vertical B → A.
    gl.bindFramebuffer(gl.FRAMEBUFFER, b.framebuffer);
    gl.viewport(0, 0, b.width, b.height);
    gl.bindTexture(gl.TEXTURE_2D, a.texture);
    gl.uniform2f(this.blur.uniforms.u_texel ?? null, 1 / a.width, 1 / a.height);
    gl.uniform2f(this.blur.uniforms.u_dir ?? null, 1, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, a.framebuffer);
    gl.viewport(0, 0, a.width, a.height);
    gl.bindTexture(gl.TEXTURE_2D, b.texture);
    gl.uniform2f(this.blur.uniforms.u_texel ?? null, 1 / b.width, 1 / b.height);
    gl.uniform2f(this.blur.uniforms.u_dir ?? null, 0, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    return a.texture;
  }

  render(
    video: HTMLVideoElement,
    face: FaceTrackingData | null,
    filter: FilterDefinition | null,
    beauty: BeautySettings,
  ): void {
    if (this.disposed || this.width === 0 || this.height === 0) return;
    const gl = this.gl;

    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

    const smoothing = beauty.skinSmoothing;
    const blurTexture = smoothing > 0.001 ? this.runBlur() : null;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    gl.useProgram(this.composite.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(this.composite.uniforms.u_src ?? null, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, blurTexture ?? this.videoTexture);
    gl.uniform1i(this.composite.uniforms.u_blur ?? null, 1);

    gl.uniform1f(this.composite.uniforms.u_smoothing ?? null, blurTexture ? smoothing : 0);
    gl.uniform1f(this.composite.uniforms.u_brightness ?? null, beauty.brightness);
    gl.uniform1f(this.composite.uniforms.u_warmth ?? null, beauty.warmth);
    gl.uniform1i(
      this.composite.uniforms.u_grade ?? null,
      filter?.colorGrade ? (GRADE_INDEX[filter.colorGrade] ?? 0) : 0,
    );

    if (face?.detected) {
      // uv space has v=0 at the bottom, tracking has y=0 at the top.
      gl.uniform4f(
        this.composite.uniforms.u_faceMask ?? null,
        face.cx,
        1 - face.cy,
        face.width * 0.62,
        face.height * 0.6,
      );
    } else {
      gl.uniform4f(this.composite.uniforms.u_faceMask ?? null, 0.5, 0.5, 1, 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const sprites = filter?.sprites;
    if (sprites?.length && face?.detected) {
      this.drawSprites(sprites, face);
    }

    gl.bindVertexArray(null);
  }

  private drawSprites(sprites: FilterSprite[], face: FaceTrackingData): void {
    const gl = this.gl;
    gl.useProgram(this.sprite.program);
    gl.enable(gl.BLEND);
    gl.uniform2f(this.sprite.uniforms.u_viewport ?? null, this.width, this.height);
    gl.uniform1i(this.sprite.uniforms.u_sprite ?? null, 0);
    gl.activeTexture(gl.TEXTURE0);

    for (const item of sprites) {
      const texture = this.spriteTexture(item.sprite);
      if (!texture) continue;

      const layout = this.layoutSprite(face, item.anchor, item.scale, item.yOffset ?? 0);
      if (layout.halfW < 2 || layout.halfH < 2) continue;

      if (item.blend === 'screen') {
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_COLOR);
      } else {
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform2f(this.sprite.uniforms.u_centerPx ?? null, layout.centerX, layout.centerY);
      gl.uniform2f(this.sprite.uniforms.u_halfPx ?? null, layout.halfW, layout.halfH);
      gl.uniform1f(this.sprite.uniforms.u_rot ?? null, face.roll);
      gl.uniform1f(this.sprite.uniforms.u_opacity ?? null, item.opacity ?? 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    gl.disable(gl.BLEND);
  }

  private releaseTargets(): void {
    if (!this.targets) return;
    for (const target of this.targets) {
      this.gl.deleteFramebuffer(target.framebuffer);
      this.gl.deleteTexture(target.texture);
    }
    this.targets = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const gl = this.gl;
    this.releaseTargets();
    for (const texture of this.spriteTextures.values()) {
      if (texture) gl.deleteTexture(texture);
    }
    this.spriteTextures.clear();
    gl.deleteTexture(this.videoTexture);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.vao);
    for (const program of [this.copy, this.blur, this.composite, this.sprite]) {
      gl.deleteProgram(program.program);
    }
    // Frees the drawing buffer immediately instead of waiting for GC.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
