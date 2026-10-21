// Мир целиком: рельеф (поток чанков), растительность, вода, небо и время суток.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createTerrain, BIOME, BIOMES } from './terrain.js';
import { ChunkManager } from './chunks.js';
import { buildVegetationChunk, COLLIDER_STRIDE } from './chunkgen.js';
import { Vegetation } from './vegetation.js';
import { Sky } from './sky.js';
import { Water } from './water.js';
import { Clouds } from './clouds.js';
import { shared } from './materials.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.sky = new Sky(scene);
    this.water = new Water(scene);
    this.clouds = new Clouds(scene);
    this.veg = new Vegetation(scene);
    this.chunks = new ChunkManager(scene, this.veg);
    this.terrain = null;
    this.seed = 0;
    this.time = CONFIG.time.startTime;
    this.day = 1;
    this.elapsed = 0;
    this.viewMeters = 384;
    this.tmpDir = new THREE.Vector3();
  }

  setSeed(seed) {
    this.seed = seed >>> 0;
    this.terrain = createTerrain(this.seed);
    this.chunks.start(this.seed);
    this.clouds.setSeed(this.seed);
  }

  applySettings(quality, viewChunks, camera) {
    const S = CONFIG.world.chunkSize;
    const view = viewChunks * S;
    this.viewMeters = view;
    this.chunks.setLimits(quality, viewChunks);
    const L = this.chunks.limits;
    const fog = this.scene.fog;
    fog.near = view * CONFIG.render.fogNearFactor;
    fog.far = view * CONFIG.render.fogFarFactor;
    camera.far = view * 1.6 + 200;
    camera.updateProjectionMatrix();
    this.sky.setRadius(view * 1.4 + 150);
    this.water.setSize(view);
    this.clouds.configure(quality.clouds, view);
    const g = CONFIG.lod.distances[0] * quality.lodScale;
    shared.uGrassFade.value.set(g - 16, g - 2);
    shared.uSmallFade.value.set(L.smallFar - 18, L.smallFar);
    shared.uTreeFade.value.set(L.treeFar - 35, L.treeFar);
    this.veg.setShadows(quality.shadows);
    this.sky.setShadows(quality.shadows, CONFIG.render.shadowSize, CONFIG.render.shadowRange);
  }

  // dt — реальное время кадра; time идёт только когда идёт игра (или медленно в меню)
  advanceTime(dt, speed = 1) {
    const T = CONFIG.time;
    const night = this.sky.elevation < -0.05 ? T.nightSpeed : 1;
    this.time += (dt * speed * night) / T.dayLengthSec;
    if (this.time >= 1) {
      this.time -= 1;
      this.day++;
    }
  }

  update(dt, camera, focus) {
    this.elapsed += dt;
    shared.uTime.value = this.elapsed;
    shared.uWind.value = 0.75 + 0.35 * Math.sin(this.elapsed * 0.13) + 0.15 * Math.sin(this.elapsed * 0.71);
    this.sky.update(this.time, camera.position, this.elapsed);
    this.water.update(camera.position, this.sky);
    this.clouds.update(dt, camera.position, this.sky);
    camera.getWorldDirection(this.tmpDir);
    this.chunks.update(dt, focus.x, focus.z, this.tmpDir.x, this.tmpDir.z);
  }

  surface(x, z) {
    return this.terrain.surface(x, z);
  }

  biomeAt(x, z) {
    return this.terrain.biomeAt(x, z);
  }

  // Нет ли рядом стволов и камней (растительность считается здесь же, как в воркере)
  clearOfObstacles(x, z, margin, cache) {
    const S = CONFIG.world.chunkSize;
    const density = this.chunks.limits.vegDensity;
    for (let cz = Math.floor((z - margin - 2) / S); cz <= Math.floor((z + margin + 2) / S); cz++) {
      for (let cx = Math.floor((x - margin - 2) / S); cx <= Math.floor((x + margin + 2) / S); cx++) {
        const key = `${cx},${cz}`;
        let c = cache.get(key);
        if (!c) {
          c = buildVegetationChunk(this.terrain, cx, cz, density).colliders;
          cache.set(key, c);
        }
        for (let i = 0; i < c.length; i += COLLIDER_STRIDE) {
          const dx = cx * S + c[i] - x;
          const dz = cz * S + c[i + 1] - z;
          if (Math.hypot(dx, dz) < c[i + 2] + margin) return false;
        }
      }
    }
    return true;
  }

  // Точка старта: ближайшая к центру ровная суша на равнине или в лесу, без деревьев вплотную (детерминированно)
  findSpawn() {
    const sp = CONFIG.player.spawnSearch;
    const t = this.terrain;
    const cache = new Map();
    const ok = (x, z) => {
      const s = t.surface(x, z);
      if (s.h < sp.minHeight || s.h > sp.maxHeight || s.ny < 0.9) return false;
      const b = t.biomeAt(x, z);
      return (b === BIOME.PLAINS || b === BIOME.FOREST) && this.clearOfObstacles(x, z, sp.clearance, cache);
    };
    if (ok(0, 0)) return { x: 0.5, z: 0.5 };
    for (let r = sp.step; r <= sp.maxRadius; r += sp.step) {
      const n = Math.max(8, Math.round((2 * Math.PI * r) / sp.step));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const x = Math.round(Math.cos(a) * r) + 0.5;
        const z = Math.round(Math.sin(a) * r) + 0.5;
        if (ok(x, z)) return { x, z };
      }
    }
    return { x: 0.5, z: 0.5 };
  }

  // Поворот для старта: смотреть туда, где на 200 м вокруг самый интересный вид (выше перепад)
  findSpawnYaw(x, z) {
    let best = 0;
    let bestScore = -Infinity;
    const h0 = this.terrain.height(x, z);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      let score = 0;
      for (let d = 60; d <= 240; d += 60) {
        const h = this.terrain.height(x - Math.sin(a) * d, z - Math.cos(a) * d);
        score += Math.abs(h - h0) * 0.5 + (h < 0 ? 12 : 0);
      }
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  biomeInfo(id) {
    return BIOMES[id];
  }
}
