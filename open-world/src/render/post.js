// Постобработка: сцена рендерится в HDR (half float, MSAA), яркие места мягко светятся (bloom),
// затем тональная компрессия и перевод в sRGB (OutputPass), в конце — виньетка, зерно и цветокоррекция.
// На слабом качестве композер не используется: тональная компрессия идёт прямо в материалах.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CONFIG } from '../config.js';

const R = CONFIG.render;

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: R.vignette },
    uGrain: { value: R.grain },
    uSaturation: { value: R.saturation },
    uContrast: { value: R.contrast },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uVignette;
uniform float uGrain;
uniform float uSaturation;
uniform float uContrast;
uniform float uTime;
varying vec2 vUv;
float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  vec3 col = c.rgb;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);
  col = (col - 0.5) * uContrast + 0.5;
  vec2 d = vUv - 0.5;
  col *= 1.0 - uVignette * dot(d, d) * 2.2;
  // зерно сильнее в тенях, как у плёнки; меняется каждый кадр
  float n = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 811.0) - 0.5;
  col += n * uGrain * (1.2 - l);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
}`,
};

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.composer = null;
    this.final = null;
    this.key = '';
    this.size = new THREE.Vector2();
  }

  get enabled() {
    return !!this.composer;
  }

  configure(q) {
    const key = `${q.post}-${q.msaa}-${q.bloom}`;
    if (key === this.key) return;
    this.key = key;
    this.dispose();
    if (!q.post) return;
    const r = this.renderer;
    r.getDrawingBufferSize(this.size);
    const rt = new THREE.WebGLRenderTarget(this.size.x, this.size.y, {
      type: THREE.HalfFloatType,
      samples: q.msaa || 0,
      depthBuffer: true,
    });
    const composer = new EffectComposer(r, rt);
    composer.addPass(new RenderPass(this.scene, this.camera));
    if (q.bloom) {
      const b = R.bloom;
      this.bloom = new UnrealBloomPass(new THREE.Vector2(this.size.x / 2, this.size.y / 2), b.strength, b.radius, b.threshold);
      composer.addPass(this.bloom);
    }
    composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    composer.addPass(this.final);
    this.composer = composer;
    this.resize();
  }

  resize() {
    if (!this.composer) return;
    const r = this.renderer;
    const w = r.domElement.clientWidth || window.innerWidth;
    const h = r.domElement.clientHeight || window.innerHeight;
    this.composer.setPixelRatio(r.getPixelRatio());
    this.composer.setSize(w, h);
  }

  // свечение — только у того, что на экране ярче белого: порог в единицах сцены зависит от экспозиции
  setExposure(exposure) {
    if (this.bloom) this.bloom.threshold = R.bloom.threshold / Math.max(exposure, 1e-3);
  }

  render(dt, elapsed) {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      return;
    }
    this.final.uniforms.uTime.value = elapsed;
    this.composer.render(dt);
  }

  dispose() {
    if (!this.composer) return;
    for (const p of this.composer.passes) p.dispose?.();
    this.composer.renderTarget1.dispose();
    this.composer.renderTarget2.dispose();
    this.composer = null;
    this.bloom = null;
    this.final = null;
  }
}
