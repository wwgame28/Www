// Игрок от первого лица: ходьба, бег, прыжок, плавание, полёт, коллизии с рельефом и препятствиями.
// Физика идёт фиксированным шагом, камера рисуется с интерполяцией между шагами.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { waveHeight } from '../world/materials.js';

const P = CONFIG.player;
const SEA = CONFIG.world.seaLevel;

export class Player {
  constructor(world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.prev = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.resolved = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = false;
    this.swimming = false;
    this.inWater = false;
    this.flying = false;
    this.wadeDepth = 0;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.stepAcc = 0;
    this.bobPhase = 0;
    this.bobAmp = 0;
    this.dip = 0;
    this.dipV = 0;
    this.runBlend = 0;
    this.flyBlend = 0;
    this.fov = P.fov.base;
    this.speed = 0;
    this.time = 0;
    this.events = [];
    this.colliders = [];
  }

  place(x, z, y = null, yaw = 0, pitch = 0) {
    const ground = this.world.surface(x, z).h;
    const floatY = SEA - P.swim.floatDepth;
    let py = y ?? ground + 0.05;
    if (py < ground) py = ground;
    if (!this.flying && py < floatY && ground < floatY) py = floatY;
    this.pos.set(x, py, z);
    this.prev.copy(this.pos);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = pitch;
    this.grounded = py <= ground + 0.06;
    this.events.length = 0;
  }

  look(dx, dy) {
    this.yaw -= dx;
    const lim = P.look.pitchLimit;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch - dy));
  }

  setFlying(on) {
    if (this.flying === on) return;
    this.flying = on;
    if (!on) this.vel.y = Math.min(this.vel.y, 0);
    else {
      this.grounded = false;
      this.vel.y = Math.max(this.vel.y, 2);
    }
    this.events.push({ type: 'fly', on });
  }

  requestJump() {
    this.jumpBuffer = P.jumpBuffer;
  }

  fixedUpdate(dt, intent) {
    this.prev.copy(this.pos);
    this.time += dt;
    if (this.flying) this.updateFly(dt, intent);
    else this.updateWalk(dt, intent);

    const hs = Math.hypot(this.pos.x - this.prev.x, this.pos.z - this.prev.z);
    this.speed = hs / dt;
    const moving = (this.grounded || this.swimming) && !this.flying;
    const running = intent.run && this.speed > P.walkSpeed * 0.9;
    if (moving && hs > 0) {
      const stride = this.swimming ? 1.7 : (running ? P.bob.runStride : P.bob.walkStride) / 2;
      this.stepAcc += hs;
      this.bobPhase += (hs / stride) * Math.PI;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        this.events.push({ type: this.swimming ? 'swim' : 'step', run: running, wade: this.wadeDepth });
      }
    }
    const bobTarget =
      moving && !this.swimming && this.speed > 0.5 ? (running ? P.bob.runAmp : P.bob.walkAmp) * Math.min(1, this.speed / P.walkSpeed) : 0;
    this.bobAmp += (bobTarget - this.bobAmp) * Math.min(1, dt * 8);
    this.runBlend += ((running && !this.flying ? 1 : 0) - this.runBlend) * Math.min(1, dt * 5);
    const flyFast = this.flying ? Math.min(1, this.vel.length() / P.fly.fastSpeed) : 0;
    this.flyBlend += (flyFast - this.flyBlend) * Math.min(1, dt * 4);

    // пружина «приседания» камеры после приземления
    const D = P.landDip;
    this.dipV += (-D.stiffness * this.dip - D.damping * this.dipV) * dt;
    this.dip += this.dipV * dt;
    if (this.dip < -D.max) {
      this.dip = -D.max;
      this.dipV = Math.max(this.dipV, 0);
    }
  }

  updateWalk(dt, intent) {
    const pos = this.pos;
    const vel = this.vel;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const mx = intent.move.x;
    const my = intent.move.y;
    const wx = -sin * my + cos * mx;
    const wz = -cos * my - sin * mx;

    const here = this.world.surface(pos.x, pos.z);
    const depthHere = SEA - here.h;
    const floatY = SEA - P.swim.floatDepth;
    this.swimming = depthHere > P.swim.floatDepth && pos.y <= floatY + 0.3;
    this.wadeDepth = !this.swimming && this.grounded && depthHere > P.wade.minDepth ? depthHere : 0;

    let speed = intent.run ? P.runSpeed : P.walkSpeed;
    if (this.swimming) speed = intent.run ? P.swim.runSpeed : P.swim.speed;
    else if (this.wadeDepth > 0) speed *= 1 - P.wade.slow * Math.min(1, this.wadeDepth / P.swim.floatDepth);

    const accel = this.swimming ? 7 : this.grounded ? P.groundAccel : P.airAccel;
    const dvx = wx * speed - vel.x;
    const dvz = wz * speed - vel.z;
    const dl = Math.hypot(dvx, dvz);
    const maxDv = accel * dt;
    if (dl > maxDv) {
      vel.x += (dvx / dl) * maxDv;
      vel.z += (dvz / dl) * maxDv;
    } else {
      vel.x += dvx;
      vel.z += dvz;
    }

    this.coyote = this.grounded ? P.coyoteTime : Math.max(0, this.coyote - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.jumpBuffer > 0) {
      if (this.grounded || this.coyote > 0) {
        vel.y = P.jumpSpeed;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.events.push({ type: 'jump' });
      } else if (this.swimming) {
        vel.y = P.swim.stroke;
        this.jumpBuffer = 0;
        this.events.push({ type: 'swim', stroke: true });
      }
    }

    if (this.swimming && pos.y <= floatY + 0.05 && vel.y <= 0.5) {
      // на плаву: тянет к поверхности, покачивает на волнах
      const target = floatY + waveHeight(pos.x, pos.z, this.world.elapsed) * 0.8;
      vel.y += (target - pos.y) * P.swim.buoyancy * dt;
      vel.y *= Math.max(0, 1 - P.swim.damping * dt);
    } else {
      vel.y = Math.max(vel.y - P.gravity * dt, -P.maxFall);
    }

    let nx = pos.x + vel.x * dt;
    let nz = pos.z + vel.z * dt;
    // слишком крутой склон: убираем составляющую скорости «в гору»
    if (this.grounded && !this.swimming) {
      const s2 = this.world.surface(nx, nz);
      if (s2.ny < P.maxSlope && s2.h > pos.y + 0.05) {
        const gl = Math.hypot(s2.nx, s2.nz);
        if (gl > 1e-6) {
          const ux = -s2.nx / gl;
          const uz = -s2.nz / gl;
          const vu = vel.x * ux + vel.z * uz;
          if (vu > 0) {
            vel.x -= vu * ux;
            vel.z -= vu * uz;
          }
        }
        nx = pos.x + vel.x * dt;
        nz = pos.z + vel.z * dt;
      }
    }

    const standTop = this.resolveColliders(nx, nz, pos.y);
    nx = this.resolved.x;
    nz = this.resolved.z;

    let ny = pos.y + vel.y * dt;
    const s = this.world.surface(nx, nz);
    let ground = s.h;
    if (standTop > ground) ground = standTop;
    const wasGrounded = this.grounded;
    const deep = SEA - s.h > P.swim.floatDepth;
    if (deep && ny < floatY - 0.35) {
      // глубже порога не уйти: вода выталкивает
      ny = floatY - 0.35;
      if (vel.y < 0) vel.y = 0;
    }
    if (ny <= ground) {
      if (!wasGrounded && vel.y < -2.5) this.land(-vel.y);
      ny = ground;
      if (vel.y < 0) vel.y = 0;
      this.grounded = true;
    } else if (wasGrounded && vel.y <= 0 && !deep && ny - ground < 0.35 + Math.hypot(vel.x, vel.z) * dt * 1.6) {
      ny = ground; // прилипание при спуске по склону
      vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const wasInWater = this.inWater;
    this.inWater = ny < SEA - 0.15;
    if (this.inWater && !wasInWater && vel.y < -1.5) this.events.push({ type: 'splash', power: Math.min(1, -vel.y / 12) });
    pos.set(nx, ny, nz);
  }

  // Отталкивание от стволов и камней; возвращает высоту камня, на котором можно стоять
  resolveColliders(nx, nz, feetY) {
    const c = this.world.chunks.collidersNear(nx, nz, this.colliders);
    let standTop = -Infinity;
    const R = P.radius;
    const vel = this.vel;
    for (let i = 0; i < c.length; i += 5) {
      const cx = c[i];
      const cz = c[i + 1];
      const r = c[i + 2];
      const top = c[i + 3];
      const stand = c[i + 4];
      const dx = nx - cx;
      const dz = nz - cz;
      const d = Math.hypot(dx, dz);
      if (stand && d < r * 0.95 && feetY >= top - 0.45) {
        standTop = Math.max(standTop, top);
        continue;
      }
      if (feetY >= top - 0.3) continue;
      const minD = r + R;
      if (d < minD && d > 1e-5) {
        const ux = dx / d;
        const uz = dz / d;
        nx += ux * (minD - d);
        nz += uz * (minD - d);
        const vn = vel.x * ux + vel.z * uz;
        if (vn < 0) {
          vel.x -= vn * ux;
          vel.z -= vn * uz;
        }
      }
    }
    this.resolved.x = nx;
    this.resolved.z = nz;
    return standTop;
  }

  land(impact) {
    this.dipV -= Math.min(impact * P.landDip.perSpeed * 12, 4);
    this.events.push({ type: 'land', impact });
  }

  updateFly(dt, intent) {
    const F = P.fly;
    const pos = this.pos;
    const vel = this.vel;
    const speed = intent.run ? F.fastSpeed : F.speed;
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const sy = Math.sin(this.yaw);
    const cy = Math.cos(this.yaw);
    const my = intent.move.y;
    const mx = intent.move.x;
    const up = (intent.up ? 1 : 0) - (intent.down ? 1 : 0);
    const tx = (-sy * cp * my + cy * mx) * speed;
    const ty = sp * my * speed + up * speed * 0.6;
    const tz = (-cy * cp * my - sy * mx) * speed;
    const k = Math.min(1, F.accel * dt);
    vel.x += (tx - vel.x) * k;
    vel.y += (ty - vel.y) * k;
    vel.z += (tz - vel.z) * k;
    let nx = pos.x + vel.x * dt;
    let ny = pos.y + vel.y * dt;
    let nz = pos.z + vel.z * dt;
    const ground = Math.max(this.world.surface(nx, nz).h, SEA) + F.clearance;
    if (ny < ground) {
      ny = ground;
      if (vel.y < 0) vel.y = 0;
    }
    if (ny > F.maxAltitude) {
      ny = F.maxAltitude;
      if (vel.y > 0) vel.y = 0;
    }
    this.grounded = false;
    this.swimming = false;
    this.inWater = false;
    this.wadeDepth = 0;
    pos.set(nx, ny, nz);
  }

  // Камера: позиция между шагами физики, покачивание, приседание, FOV при беге и полёте
  applyCamera(camera, alpha, baseFov, reduceMotion) {
    const x = this.prev.x + (this.pos.x - this.prev.x) * alpha;
    const y = this.prev.y + (this.pos.y - this.prev.y) * alpha;
    const z = this.prev.z + (this.pos.z - this.prev.z) * alpha;
    let bobY = 0;
    let bobX = 0;
    let dip = 0;
    if (!reduceMotion) {
      bobY = (Math.abs(Math.sin(this.bobPhase)) - 0.5) * this.bobAmp * 2;
      bobX = Math.cos(this.bobPhase) * this.bobAmp * 0.6;
      dip = this.dip;
    }
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    camera.position.set(x + cy * bobX, y + P.eyeHeight + bobY + dip, z - sy * bobX);
    if (this.swimming) {
      const surf = SEA + waveHeight(x, z, this.world.elapsed) + 0.18;
      if (camera.position.y < surf) camera.position.y = surf;
    }
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const kick = reduceMotion ? 0 : P.fov.runKick * this.runBlend + P.fov.flyKick * this.flyBlend;
    const fov = baseFov + kick;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  serialize() {
    return {
      x: +this.pos.x.toFixed(2),
      y: +this.pos.y.toFixed(2),
      z: +this.pos.z.toFixed(2),
      yaw: +this.yaw.toFixed(4),
      pitch: +this.pitch.toFixed(4),
      flying: this.flying,
    };
  }
}
