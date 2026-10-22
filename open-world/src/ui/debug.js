// Отладочный оверлей (клавиша ~): FPS, время кадра, чанки, draw calls, треугольники, экспозиция.
import { CONFIG } from '../config.js';

export class DebugOverlay {
  constructor() {
    this.el = document.getElementById('debug');
    this.visible = false;
    this.frames = 0;
    this.time = 0;
    this.worst = 0;
    this.fps = 0;
    this.ms = 0;
    this.timer = 0;
  }

  setVisible(v) {
    this.visible = v;
    this.el.hidden = !v;
  }

  // Каждый кадр: считаем FPS даже когда оверлей скрыт (нужно адаптивному разрешению)
  frame(dt) {
    this.frames++;
    this.time += dt;
    this.worst = Math.max(this.worst, dt);
    if (this.time >= 0.5) {
      this.fps = this.frames / this.time;
      this.ms = (this.time / this.frames) * 1000;
      this.worstMs = this.worst * 1000;
      this.frames = 0;
      this.time = 0;
      this.worst = 0;
    }
  }

  update(dt, info) {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 1 / CONFIG.ui.debugHz;
    const c = info.chunks;
    const r = info.render;
    const p = info.player;
    this.el.textContent = [
      `FPS ${this.fps.toFixed(0)}  кадр ${this.ms.toFixed(1)} мс  худший ${(this.worstMs || 0).toFixed(1)} мс`,
      `draw calls ${r.calls}  треугольников ${(r.triangles / 1000).toFixed(0)}k  разрешение ×${info.pixelRatio.toFixed(2)}`,
      `чанки ${c.meshes}/${c.loaded}  LOD ${c.lods.join('/')}  очередь ${c.queued}  в работе ${c.inFlight}  воркеров ${c.workers}${c.inline ? ' + основной поток' : ''}`,
      `генерация ${c.genMs.toFixed(1)} мс/чанк  трава ${c.grass}  растения ${info.instances}`,
      `качество ${info.tier}  экспозиция ${info.exposure.toFixed(2)}  облачность ${(info.clouds * 100).toFixed(0)}%`,
      `геометрий ${info.memory.geometries}  текстур ${info.memory.textures}`,
      `x ${p.pos.x.toFixed(1)} y ${p.pos.y.toFixed(1)} z ${p.pos.z.toFixed(1)}  ${p.flying ? 'полёт' : p.swimming ? 'плывёт' : p.grounded ? 'на земле' : 'в воздухе'}`,
      `сид ${info.seed}  ${info.biome}`,
    ].join('\n');
  }
}
