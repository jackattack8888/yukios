import * as CANNON from "cannon-es";

export class GameCasePhysics {
  constructor(bounds, colliders) {
    this.bounds = bounds;
    this.colliders = colliders || [];

    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.82, 0)
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    this.world.solver.iterations = 20;

    const def = this.world.defaultContactMaterial;
    def.friction = 0.8;
    def.restitution = 0.03;
    def.contactEquationStiffness = 1e9;
    def.contactEquationRelaxation = 4;

    this.timeScale = 1;
    this.timeScaleTarget = 1;
    this.prevPos = new Map();
    this.partitions = [];
    this.defaultFriction = 0.8;
    this.defaultRestitution = 0.03;
    this.MAX_BODY_SPEED = 6;
    this.bodyHalf = { x: 0, y: 0, z: 0 };

    this.setupWalls();
    this.setupColliders();
    this.setupPartitions();
  }

  setupPartitions() {
    this.partitions = [];
    for (const col of this.colliders) {
      if (col.label !== "partition") continue;
      this.partitions.push({
        x: (col.min.x + col.max.x) / 2,
        half: 0.05,
        z0: col.min.z,
        z1: col.max.z
      });
    }
  }

  bodyHalfSize(body) {
    const s = body.shapes && body.shapes[0];
    if (s && s.halfExtents) {
      this.bodyHalf.x = s.halfExtents.x;
      this.bodyHalf.y = s.halfExtents.y;
      this.bodyHalf.z = s.halfExtents.z;
      return this.bodyHalf;
    }
    if (s && typeof s.radius === "number") {
      this.bodyHalf.x = s.radius;
      this.bodyHalf.y = s.radius;
      this.bodyHalf.z = s.radius;
      return this.bodyHalf;
    }
    this.bodyHalf.x = 0.05;
    this.bodyHalf.y = 0.05;
    this.bodyHalf.z = 0.05;
    return this.bodyHalf;
  }

  setupWalls() {
    const b = this.bounds;
    const shape = new CANNON.Plane();

    const floor = new CANNON.Body({ mass: 0 });
    floor.addShape(shape);
    floor.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(floor);

    const ceil = new CANNON.Body({ mass: 0 });
    ceil.addShape(shape);
    ceil.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
    ceil.position.set(0, 3, 0);
    this.world.addBody(ceil);

    const left = new CANNON.Body({ mass: 0 });
    left.addShape(shape);
    left.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    left.position.set(b.minX, 1.5, 0);
    this.world.addBody(left);

    const right = new CANNON.Body({ mass: 0 });
    right.addShape(shape);
    right.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
    right.position.set(b.maxX, 1.5, 0);
    this.world.addBody(right);

    const back = new CANNON.Body({ mass: 0 });
    back.addShape(shape);
    back.position.set(0, 1.5, b.minZ);
    this.world.addBody(back);

    const winHalfW = 0.6;
    const winHalfH = 0.5;
    const winCenterY = 1.5;
    const winBottom = winCenterY - winHalfH;
    const winTop = winCenterY + winHalfH;
    const winLeft = -winHalfW;
    const winRight = winHalfW;
    const wallZ = b.maxZ;
    const wallThick = 0.05;
    const seg = (cx, cy, hx, hy) => {
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(hx, hy, wallThick)) });
      body.position.set(cx, cy, wallZ);
      this.world.addBody(body);
    };
    seg(0, winBottom / 2, 5, winBottom / 2);
    seg(0, (winTop + 3) / 2, 5, (3 - winTop) / 2);
    seg((b.minX + winLeft) / 2, winCenterY, (winLeft - b.minX) / 2, winHalfH);
    seg((winRight + b.maxX) / 2, winCenterY, (b.maxX - winRight) / 2, winHalfH);
  }

  setupColliders() {
    for (const col of this.colliders) {
      const sx = (col.max.x - col.min.x) / 2;
      const sy = (col.max.y - col.min.y) / 2;
      const sz = (col.max.z - col.min.z) / 2;
      if (sx <= 0 || sy <= 0 || sz <= 0) continue;
      const body = new CANNON.Body({
        mass: 0,
        shape: new CANNON.Box(new CANNON.Vec3(sx, sy, sz))
      });
      body.position.set((col.min.x + col.max.x) / 2, (col.min.y + col.max.y) / 2, (col.min.z + col.max.z) / 2);
      this.world.addBody(body);
    }
  }

  createBody(position, size, mass) {
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2)),
      position: new CANNON.Vec3(position.x, position.y, position.z),
      linearDamping: 0.25,
      angularDamping: 0.4,
      sleepSpeedLimit: 0.05,
      sleepTimeLimit: 0.5
    });
    this.world.addBody(body);
    return body;
  }

  removeBody(body) {
    this.world.removeBody(body);
  }

  setGravityScale(scale) {
    this.world.gravity.set(0, -9.82 * scale, 0);
  }

  setTimeScale(scale) {
    this.timeScaleTarget = scale;
  }

  setRubberRoom(enabled) {
    const mat = this.world.defaultContactMaterial;
    if (enabled) {
      mat.restitution = 1.3;
      mat.friction = 0.1;
    } else {
      mat.restitution = this.defaultRestitution;
      mat.friction = this.defaultFriction;
    }
  }

  update(gameCases, delta, ballBody) {
    this.timeScale += (this.timeScaleTarget - this.timeScale) * Math.min(1, delta * 8);
    this.prevPos.clear();
    for (const gameCase of gameCases) {
      if (gameCase.grabbed) continue;
      if (!gameCase.body) continue;
      this.prevPos.set(gameCase.body, { x: gameCase.body.position.x, z: gameCase.body.position.z });
    }
    if (ballBody && ballBody.type !== CANNON.Body.KINEMATIC) {
      this.prevPos.set(ballBody, { x: ballBody.position.x, z: ballBody.position.z });
    }

    for (const gameCase of gameCases) {
      if (!gameCase.grabbed) continue;
      if (gameCase.body.type !== CANNON.Body.KINEMATIC) {
        gameCase.body.type = CANNON.Body.KINEMATIC;
        gameCase.body.velocity.set(0, 0, 0);
        gameCase.body.angularVelocity.set(0, 0, 0);
        gameCase.body.allowSleep = false;
        gameCase.body.wakeUp();
      }
      gameCase.body.position.set(gameCase.mesh.position.x, gameCase.mesh.position.y, gameCase.mesh.position.z);
      gameCase.body.quaternion.set(
        gameCase.mesh.quaternion.x,
        gameCase.mesh.quaternion.y,
        gameCase.mesh.quaternion.z,
        gameCase.mesh.quaternion.w
      );
    }

    const stepped = Math.min(delta, 0.033) * this.timeScale;

    let anyAwake = ballBody && ballBody.sleepState === 0;
    if (!anyAwake) {
      for (const gameCase of gameCases) {
        if (gameCase.grabbed || (gameCase.body && gameCase.body.sleepState === 0)) {
          anyAwake = true;
          break;
        }
      }
    }
    if (anyAwake) {
      this.world.step(1 / 120, stepped, 4);
    }

    this.clampTunnels();
    this.clampToBounds();
    this.clampSpeed();
    this.pushOutOfColliders();

    for (const gameCase of gameCases) {
      if (gameCase.grabbed) continue;
      gameCase.mesh.position.set(gameCase.body.position.x, gameCase.body.position.y, gameCase.body.position.z);
      gameCase.mesh.quaternion.set(
        gameCase.body.quaternion.x,
        gameCase.body.quaternion.y,
        gameCase.body.quaternion.z,
        gameCase.body.quaternion.w
      );
      gameCase.pos.copy(gameCase.mesh.position);
    }
  }

  clampTunnels() {
    for (const [body, prev] of this.prevPos.entries()) {
      if (body.type === CANNON.Body.KINEMATIC) continue;
      const half = this.bodyHalfSize(body);
      const p = body.position;
      for (const wall of this.partitions) {
        const zOverlaps = p.z + half.z > wall.z0 && p.z - half.z < wall.z1;
        if (!zOverlaps) continue;
        const prevSide = prev.x < wall.x ? -1 : 1;
        const curSide = p.x < wall.x ? -1 : 1;
        if (prevSide === curSide) continue;
        const targetX = wall.x + prevSide * (wall.half + half.x + 0.02);
        body.position.x = targetX;
        body.velocity.x = prevSide * Math.abs(body.velocity.x) * 0.3;
        body.wakeUp();
      }
    }
  }

  clampToBounds() {
    const b = this.bounds;
    for (const [body] of this.prevPos.entries()) {
      if (body.type === CANNON.Body.KINEMATIC) continue;
      const half = this.bodyHalfSize(body);
      const p = body.position;
      const v = body.velocity;
      if (p.x < b.minX) {
        p.x = b.minX + half.x + 0.02;
        v.x = Math.abs(v.x) * 0.2;
      } else if (p.x > b.maxX) {
        p.x = b.maxX - half.x - 0.02;
        v.x = -Math.abs(v.x) * 0.2;
      }
      if (p.z < b.minZ) {
        p.z = b.minZ + half.z + 0.02;
        v.z = Math.abs(v.z) * 0.2;
      } else if (p.z > b.maxZ) {
        const winHalfW = 0.6;
        const winHalfH = 0.5;
        const winCenterY = 1.5;
        const isSmall = half.x < 0.18 && half.z < 0.18 && half.y < 0.22;
        const inWindowX = p.x > -winHalfW + half.x && p.x < winHalfW - half.x;
        const inWindowY = p.y > winCenterY - winHalfH + half.y && p.y < winCenterY + winHalfH - half.y;
        if (isSmall && inWindowX && inWindowY) {
          const maxInside = b.maxZ + 0.3;
          if (p.z > maxInside - half.z) {
            p.z = maxInside - half.z - 0.01;
            v.z = -Math.abs(v.z) * 0.2;
          }
        } else {
          p.z = b.maxZ - half.z - 0.02;
          v.z = -Math.abs(v.z) * 0.2;
        }
      }
      if (p.y < 0) {
        p.y = half.y + 0.02;
        v.y = Math.max(v.y, 0);
      } else if (p.y > 3) {
        p.y = 3 - half.y;
        v.y = -Math.abs(v.y) * 0.2;
      }
    }
  }

  clampSpeed() {
    for (const [body] of this.prevPos.entries()) {
      if (body.type === CANNON.Body.KINEMATIC) continue;
      const v = body.velocity;
      const cap = body.maxSpeed || this.MAX_BODY_SPEED;
      const lenSq = v.x * v.x + v.y * v.y + v.z * v.z;
      if (lenSq > cap * cap) {
        const k = cap / Math.sqrt(lenSq);
        v.x *= k;
        v.y *= k;
        v.z *= k;
      } else if (cap > this.MAX_BODY_SPEED && lenSq < this.MAX_BODY_SPEED * this.MAX_BODY_SPEED) {
        body.maxSpeed = this.MAX_BODY_SPEED;
      }
    }
  }

  pushOutOfColliders() {
    for (const [body] of this.prevPos.entries()) {
      if (body.type === CANNON.Body.KINEMATIC) continue;
      if (!body.collisionResponse) continue;
      const half = this.bodyHalfSize(body);
      for (const col of this.colliders) {
        const halfX = (col.max.x - col.min.x) / 2;
        const halfY = (col.max.y - col.min.y) / 2;
        const halfZ = (col.max.z - col.min.z) / 2;
        if (halfX <= 0 || halfY <= 0 || halfZ <= 0) continue;
        const cx = (col.min.x + col.max.x) / 2;
        const cy = (col.min.y + col.max.y) / 2;
        const cz = (col.min.z + col.max.z) / 2;
        const p = body.position;
        const ox = half.x + halfX - Math.abs(p.x - cx);
        const oy = half.y + halfY - Math.abs(p.y - cy);
        const oz = half.z + halfZ - Math.abs(p.z - cz);
        if (ox <= 0 || oy <= 0 || oz <= 0) continue;
        let choose = "x";
        let min = ox;
        if (oz < min) {
          choose = "z";
          min = oz;
        }
        if (oy < min) {
          if (p.y >= cy) {
            choose = "y";
            min = oy;
          }
        }
        if (choose === "x") {
          p.x = p.x < cx ? cx - halfX - half.x - 0.02 : cx + halfX + half.x + 0.02;
          body.velocity.x = body.velocity.x * 0.2;
        } else if (choose === "y") {
          p.y = cy + halfY + half.y + 0.02;
          body.velocity.y = body.velocity.y * 0.2;
        } else {
          p.z = p.z < cz ? cz - halfZ - half.z - 0.02 : cz + halfZ + half.z + 0.02;
          body.velocity.z = body.velocity.z * 0.2;
        }
        body.wakeUp();
      }
    }
  }

  destroy() {
    while (this.world.bodies.length > 0) {
      this.world.removeBody(this.world.bodies[0]);
    }
  }
}
