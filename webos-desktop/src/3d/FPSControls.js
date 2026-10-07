export class FPSControls {
  constructor(camera, domElement, bounds, colliders) {
    this.camera = camera;
    this.domElement = domElement;
    this.bounds = bounds || { minX: -4, maxX: 4, minZ: -4, maxZ: 4 };
    this.colliders = colliders || [];
    this.playerRadius = 0.3;
    this.THREE = null;

    this.qx = null;
    this.qy = null;
    this.qz = null;
    this.axisX = null;
    this.axisY = null;
    this.axisZ = null;

    this.enabled = false;
    this.isLocked = false;
    this.touchMode = false;

    this.moveSpeed = 3;
    this.speedMultiplier = 1;
    this.sprintMultiplier = 1.7;
    this.crouchMultiplier = 0.4;
    this.lookSensitivity = 0.002;

    this.pitch = 0;
    this.yaw = 0;

    this.velocityY = 0;
    this.isGrounded = true;
    this.gravity = -9.8;
    this.jumpSpeed = 4.5;
    this.normalHeight = 1.6;
    this.crouchHeight = 0.8;
    this.currentHeight = 1.6;
    this.bobPhase = 0;
    this.landDip = 0;
    this.baseFov = 70;
    this.zoomAmount = 22;
    this.zoomFactor = 0;
    this.zoomTarget = 0;
    this.zoomEnabled = true;

    this.basePos = null;
    this.velX = 0;
    this.velZ = 0;
    this.accel = 14;
    this.friction = 12;
    this.airControl = 0.28;
    this.gaitFreq = 3.4;
    this.bobIntensity = 0;
    this.bobRoll = 0;
    this.prevBobSign = 0;
    this.gamepadActive = false;
    this.moveAxis = { x: 0, y: 0 };
    this.landFov = 0;
    this.onFootstep = null;
    this.onLand = null;
    this.gaitSpeed = 0;
    this.gaitNormalized = 0;
    this.gaitMoving = false;
    this.gaitForward = 0;
    this.gaitStrafe = 0;
    this.gaitStrafeRatio = 0;
    this.gaitBackward = false;

    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      sprint: false,
      jump: false,
      crouch: false
    };

    this.animTarget = null;
    this.animDuration = 0;
    this.animElapsed = 0;
    this.animOnComplete = null;
    this.animStartPos = null;

    this.walkTarget = null;
    this.walkOnArrive = null;

    this.lockPosition = null;

    this.onBeforeLock = null;
    this.shakeOffset = 0;
    this.shakeVelocity = 0;
    this.shakeDamping = 3.5;

    this.onPointerLockChangeBound = this.onPointerLockChange.bind(this);
    this.onMouseMoveBound = this.onMouseMove.bind(this);
    this.onKeyDownBound = this.onKeyDown.bind(this);
    this.onKeyUpBound = this.onKeyUp.bind(this);
    this.onClickBound = this.onClick.bind(this);
    this.onMouseDownBound = this.onMouseDown.bind(this);
    this.onMouseUpBound = this.onMouseUp.bind(this);
  }

  lock() {
    if (this.touchMode) return false;
    if (!this.domElement) return false;
    if (!document.hasFocus()) {
      if (!this.pendingLock) {
        this.pendingLock = true;
        document.addEventListener(
          "focus",
          () => {
            if (this.pendingLock) {
              this.pendingLock = false;
              this.lock();
            }
          },
          { once: true }
        );
      }
      return false;
    }
    this.pendingLock = false;
    try {
      const p = this.domElement.requestPointerLock();
      if (p && typeof p.catch === "function")
        p.catch(() => {
          const retry = () => {
            try {
              const q = this.domElement.requestPointerLock();
              if (q && typeof q.catch === "function") q.catch(() => {});
            } catch {}
          };
          if (document.fullscreenElement !== null) {
            document.addEventListener("fullscreenchange", retry, { once: true });
          } else {
            retry();
          }
        });
    } catch (e) {
      return false;
    }
    return true;
  }

  unlock() {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  onPointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
    if (this.onLockStateChange) {
      this.onLockStateChange(this.isLocked);
    }
  }

  onMouseMove(event) {
    if (!this.isLocked || !this.enabled) return;
    if (this.walkTarget) return;
    const sens = this.zoomFactor > 0 ? this.lookSensitivity * 0.5 : this.lookSensitivity;
    this.yaw -= event.movementX * sens;
    this.pitch -= event.movementY * sens;
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch));
  }

  onMouseDown(event) {
    if (event.button === 2 && this.isLocked && this.enabled && this.zoomEnabled) {
      this.zoomTarget = 1;
    }
  }

  onMouseUp(event) {
    if (event.button === 2) {
      this.zoomTarget = 0;
    }
  }

  applyLook(dx, dy) {
    this.yaw -= dx * this.lookSensitivity;
    this.pitch -= dy * this.lookSensitivity;
    this.pitch = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, this.pitch));
  }

  engageTouch() {
    if (!this.enabled) return;
    this.touchMode = true;
    this.isLocked = true;
    if (this.onLockStateChange) this.onLockStateChange(true);
  }

  disengageTouch() {
    this.touchMode = false;
    this.isLocked = false;
  }

  setZoom(active) {
    this.zoomTarget = active ? 1 : 0;
  }

  onKeyDown(event) {
    if (!this.enabled) return;
    switch (event.code) {
      case "KeyW":
        this.keys.forward = true;
        event.preventDefault();
        break;
      case "KeyS":
        this.keys.backward = true;
        event.preventDefault();
        break;
      case "KeyA":
        this.keys.left = true;
        event.preventDefault();
        break;
      case "KeyD":
        this.keys.right = true;
        event.preventDefault();
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = true;
        break;
      case "Space":
        this.keys.jump = true;
        event.preventDefault();
        break;
      case "KeyC":
        this.keys.crouch = true;
        event.preventDefault();
        break;
    }
  }

  onKeyUp(event) {
    switch (event.code) {
      case "KeyW":
        this.keys.forward = false;
        break;
      case "KeyS":
        this.keys.backward = false;
        break;
      case "KeyA":
        this.keys.left = false;
        break;
      case "KeyD":
        this.keys.right = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        this.keys.sprint = false;
        break;
      case "Space":
        this.keys.jump = false;
        break;
      case "KeyC":
        this.keys.crouch = false;
        break;
    }
  }

  onClick(event) {
    if (this.touchMode) return;
    if (!this.enabled) return;
    if (!this.isLocked) {
      if (this.onBeforeLock && this.onBeforeLock(event)) {
        return;
      }
      this.lock();
    }
  }

  start(THREE) {
    this.THREE = THREE;
    this.enabled = true;
    if (!this.basePos) this.basePos = this.camera.position.clone();
    document.addEventListener("pointerlockchange", this.onPointerLockChangeBound);
    document.addEventListener("mousemove", this.onMouseMoveBound);
    document.addEventListener("keydown", this.onKeyDownBound);
    document.addEventListener("keyup", this.onKeyUpBound);
    document.addEventListener("mousedown", this.onMouseDownBound);
    document.addEventListener("mouseup", this.onMouseUpBound);
    this.domElement.addEventListener("click", this.onClickBound);
  }

  stop() {
    this.enabled = false;
    this.cancelWalk();
    this.unlock();
    document.removeEventListener("pointerlockchange", this.onPointerLockChangeBound);
    document.removeEventListener("mousemove", this.onMouseMoveBound);
    document.removeEventListener("keydown", this.onKeyDownBound);
    document.removeEventListener("keyup", this.onKeyUpBound);
    document.removeEventListener("mousedown", this.onMouseDownBound);
    document.removeEventListener("mouseup", this.onMouseUpBound);
    if (this.domElement) {
      this.domElement.removeEventListener("click", this.onClickBound);
    }
  }

  update(delta) {
    if (!this.enabled || !this.THREE) return;

    if (this.animTarget) {
      this.animElapsed += delta;
      const t = Math.min(this.animElapsed / this.animDuration, 1);
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      this.camera.position.lerpVectors(this.animStartPos, this.animTarget.pos, ease);
      this.camera.lookAt(this.animTarget.lookAt);

      if (t >= 1) {
        this.camera.position.copy(this.animTarget.pos);
        this.camera.lookAt(this.animTarget.lookAt);
        this.basePos.copy(this.camera.position);
        this.velX = 0;
        this.velZ = 0;
        this.bobRoll = 0;
        const cb = this.animOnComplete;
        this.animTarget = null;
        this.animOnComplete = null;
        if (cb) cb();
      }
      return;
    }

    if (!this.isLocked) return;

    if (this.lockPosition) {
      this.camera.position.copy(this.lockPosition);
      this.velX = 0;
      this.velZ = 0;
      this.bobRoll = 0;
      if (!this.qx) {
        this.qx = new this.THREE.Quaternion();
        this.qy = new this.THREE.Quaternion();
        this.axisX = new this.THREE.Vector3(1, 0, 0);
        this.axisY = new this.THREE.Vector3(0, 1, 0);
      }
      this.qx.setFromAxisAngle(this.axisX, this.pitch);
      this.qy.setFromAxisAngle(this.axisY, this.yaw);
      this.camera.quaternion.copy(this.qy.multiply(this.qx));
      return;
    }

    const maxSpeed =
      this.moveSpeed *
      this.speedMultiplier *
      (this.keys.sprint ? this.sprintMultiplier : 1) *
      (this.keys.crouch ? this.crouchMultiplier : 1) *
      (this.walkTarget ? 0.8 : 1);

    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);

    let tvx = 0;
    let tvz = 0;
    let gaitInputX = 0;
    let gaitInputY = 0;

    if (this.walkTarget) {
      gaitInputX = 0;
      gaitInputY = 1;
      const tx = this.walkTarget.x;
      const tz = this.walkTarget.z;
      const dxT = tx - this.basePos.x;
      const dzT = tz - this.basePos.z;
      const d = Math.sqrt(dxT * dxT + dzT * dzT);

      const arrive = () => {
        const cb = this.walkOnArrive;
        this.walkTarget = null;
        this.walkOnArrive = null;
        this.walkLastDist = Infinity;
        this.walkStallFrames = 0;
        if (cb) cb();
      };

      if (d < 0.3) {
        arrive();
      } else {
        if (d >= this.walkLastDist - 0.001) {
          this.walkStallFrames++;
        } else {
          this.walkStallFrames = 0;
        }
        this.walkLastDist = d;
        if (this.walkStallFrames > 12) {
          arrive();
        } else {
          tvx = (dxT / d) * maxSpeed;
          tvz = (dzT / d) * maxSpeed;
        }
      }
    } else {
      let mx, my;
      const gpMag = this.gamepadActive ? Math.hypot(this.moveAxis.x, this.moveAxis.y) : 0;
      if (gpMag > 0.001) {
        mx = this.moveAxis.x;
        my = this.moveAxis.y;
      } else {
        mx = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
        my = (this.keys.forward ? 1 : 0) - (this.keys.backward ? 1 : 0);
      }
      gaitInputX = mx;
      gaitInputY = my;
      if (mx !== 0 || my !== 0) {
        const fwdX = -sinYaw,
          fwdZ = -cosYaw;
        const rightX = cosYaw,
          rightZ = -sinYaw;
        let dx = fwdX * my + rightX * mx;
        let dz = fwdZ * my + rightZ * mx;
        const mag = Math.sqrt(dx * dx + dz * dz);
        if (mag > 1) {
          dx /= mag;
          dz /= mag;
        }
        tvx = dx * maxSpeed;
        tvz = dz * maxSpeed;
      }
    }

    if (this.isGrounded) {
      const targetMoving = tvx * tvx + tvz * tvz > 1e-4;
      const k = targetMoving ? this.accel : this.friction;
      const f = 1 - Math.exp(-k * delta);
      this.velX += (tvx - this.velX) * f;
      this.velZ += (tvz - this.velZ) * f;
    } else {
      const hasInput = tvx * tvx + tvz * tvz > 1e-4;
      if (hasInput) {
        const airAccel = this.accel * this.airControl;
        const f = 1 - Math.exp(-airAccel * delta);
        this.velX += (tvx - this.velX) * f;
        this.velZ += (tvz - this.velZ) * f;
        const airSpeed = Math.hypot(this.velX, this.velZ);
        const cap = maxSpeed * 1.02;
        if (airSpeed > cap) {
          const s = cap / airSpeed;
          this.velX *= s;
          this.velZ *= s;
        }
      }
    }

    const speedNow = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
    const moving = speedNow > 0.05;
    this.gaitSpeed = speedNow;
    this.gaitNormalized = maxSpeed > 0.001 ? Math.min(1, speedNow / maxSpeed) : 0;
    this.gaitMoving = moving;
    this.gaitForward = gaitInputY;
    this.gaitStrafe = gaitInputX;
    const absF = Math.abs(gaitInputY);
    const absS = Math.abs(gaitInputX);
    this.gaitStrafeRatio = absF + absS > 0.001 ? absS / (absF + absS) : 0;
    this.gaitBackward = gaitInputY < -0.1 && absF > absS;

    this.basePos.x += this.velX * delta;
    this.basePos.z += this.velZ * delta;
    this.basePos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, this.basePos.x));
    this.basePos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, this.basePos.z));

    if (this.keys.jump && this.isGrounded && !this.walkTarget) {
      this.velocityY = this.jumpSpeed;
      this.isGrounded = false;
    }

    if (!this.isGrounded) {
      this.velocityY += this.gravity * delta;
      this.basePos.y += this.velocityY * delta;
      const feetY = this.basePos.y - (this.keys.crouch ? this.crouchHeight : this.normalHeight);
      if (feetY <= 0) {
        const impact = Math.abs(this.velocityY);
        this.basePos.y = this.keys.crouch ? this.crouchHeight : this.normalHeight;
        this.velocityY = 0;
        this.isGrounded = true;
        if (impact > 1.5) {
          this.landDip = -Math.min(0.08, impact * 0.012);
          this.landFov = -Math.min(3, impact * 0.5);
          if (this.onLand) this.onLand(impact);
        }
      }
    }

    for (const col of this.colliders) {
      this.resolveCollider(col);
    }

    if (this.isGrounded) {
      const targetHeight = this.keys.crouch ? this.crouchHeight : this.normalHeight;
      this.currentHeight += (targetHeight - this.currentHeight) * Math.min(1, delta * 10);
      this.basePos.y = this.currentHeight;

      let bob = 0;
      if (moving) {
        const bobMul = this.keys.sprint ? 1.35 : 1;
        const crouchBob = this.keys.crouch ? 0.5 : 1;
        this.bobPhase += delta * speedNow * this.gaitFreq * bobMul;
        const tgtIntensity = bobMul * crouchBob;
        this.bobIntensity += (tgtIntensity - this.bobIntensity) * Math.min(1, delta * 6);
        bob = Math.sin(this.bobPhase) * 0.04 * this.bobIntensity;
        const s = Math.sin(this.bobPhase);
        if ((this.prevBobSign <= 0 && s > 0) || (this.prevBobSign >= 0 && s < 0)) {
          if (this.onFootstep) this.onFootstep(!!this.keys.sprint, Math.min(1, speedNow / this.moveSpeed));
        }
        this.prevBobSign = s;
      } else {
        this.bobIntensity += (0 - this.bobIntensity) * Math.min(1, delta * 6);
        this.prevBobSign = 0;
      }
      this.landDip += (0 - this.landDip) * Math.min(1, delta * 7);
      this.landFov += (0 - this.landFov) * Math.min(1, delta * 5);

      this.camera.position.set(this.basePos.x, this.basePos.y + bob + this.landDip, this.basePos.z);
      this.bobRoll = 0;
    } else {
      this.camera.position.copy(this.basePos);
      this.bobRoll = 0;
    }

    this.zoomFactor += (this.zoomTarget - this.zoomFactor) * Math.min(1, delta * 8);

    const targetFov =
      this.baseFov -
      this.zoomFactor * this.zoomAmount +
      (this.keys.sprint && moving && this.isGrounded ? 9 : 0) +
      this.landFov;
    if (this.camera.fov !== targetFov) {
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, delta * 12);
      this.camera.updateProjectionMatrix();
    }

    if (!this.qx) {
      this.qx = new this.THREE.Quaternion();
      this.qy = new this.THREE.Quaternion();
      this.qz = new this.THREE.Quaternion();
      this.axisX = new this.THREE.Vector3(1, 0, 0);
      this.axisY = new this.THREE.Vector3(0, 1, 0);
      this.axisZ = new this.THREE.Vector3(0, 0, 1);
    }
    this.qx.setFromAxisAngle(this.axisX, this.pitch);
    this.qy.setFromAxisAngle(this.axisY, this.yaw);
    this.qz.setFromAxisAngle(this.axisZ, this.bobRoll || 0);
    this.camera.quaternion.copy(this.qy.multiply(this.qx).multiply(this.qz));

    if (this.shakeOffset > 0.001 || this.shakeVelocity < -0.001) {
      this.shakeVelocity -= this.shakeDamping * this.shakeOffset * delta * 8;
      this.shakeOffset += this.shakeVelocity * delta;
      if (this.shakeOffset < 0.001) this.shakeOffset = 0;
      const roll = (this.shakeOffset * 1.2 + Math.random() * this.shakeOffset * 0.3) / 90;
      this.camera.position.y +=
        Math.max(0, Math.min(0.05, Math.abs(this.shakeOffset))) * (Math.sin(performance.now() / 90) * 0.4);
      const shakeZ = new this.THREE.Vector3(0, 0, 1);
      this.camera.rotateOnWorldAxis(shakeZ, roll);
    }
  }

  getGaitState() {
    return {
      speed: this.gaitSpeed,
      normalized: this.gaitNormalized,
      moving: this.gaitMoving,
      sprint: !!this.keys.sprint,
      crouch: !!this.keys.crouch,
      grounded: this.isGrounded,
      forward: this.gaitForward,
      strafe: this.gaitStrafe,
      strafeRatio: this.gaitStrafeRatio,
      backward: this.gaitBackward,
      bobPhase: this.bobPhase,
      bobIntensity: this.bobIntensity,
      velX: this.velX,
      velZ: this.velZ
    };
  }

  addShake(intensity) {
    this.shakeOffset = Math.max(this.shakeOffset, Math.max(0.005, Math.min(1, intensity)));
    this.shakeVelocity = this.shakeOffset * 30;
  }

  resolveCollider(col) {
    const r = this.playerRadius;
    const px = this.basePos.x;
    const pz = this.basePos.z;

    const closestX = Math.max(col.min.x, Math.min(px, col.max.x));
    const closestZ = Math.max(col.min.z, Math.min(pz, col.max.z));
    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < r * r) {
      const dist = Math.sqrt(distSq);
      if (dist < 0.001) {
        const angle = Math.random() * Math.PI * 2;
        this.basePos.x += Math.cos(angle) * r;
        this.basePos.z += Math.sin(angle) * r;
      } else {
        this.basePos.x = closestX + (dx / dist) * r;
        this.basePos.z = closestZ + (dz / dist) * r;
      }
    }
  }

  destroy() {
    this.stop();
    this.domElement = null;
    this.camera = null;
  }

  animateCamera(targetPos, targetLookAt, duration, onComplete) {
    if (!this.THREE) return;
    this.animTarget = { pos: targetPos.clone(), lookAt: targetLookAt.clone() };
    this.animDuration = duration;
    this.animElapsed = 0;
    this.animOnComplete = onComplete;
    this.animStartPos = this.camera.position.clone();
    if (this.isLocked) this.unlock();
  }

  cancelAnimation() {
    if (this.animTarget) {
      this.animTarget = null;
      this.animOnComplete = null;
    }
  }

  setLockPosition(pos) {
    this.lockPosition = pos ? pos.clone() : null;
  }

  clearLockPosition() {
    this.lockPosition = null;
  }

  setMoveAxis(x, y) {
    this.moveAxis.x = x;
    this.moveAxis.y = y;
  }

  setGamepadActive(active) {
    this.gamepadActive = active;
  }

  walkTo(targetPos, onArrive) {
    const target = {
      x: targetPos.x,
      z: targetPos.z
    };
    this.yaw = Math.atan2(this.camera.position.x - target.x, this.camera.position.z - target.z);
    this.walkTarget = target;
    this.walkOnArrive = onArrive;
    this.walkLastDist = Infinity;
    this.walkStallFrames = 0;
    if (!this.isLocked) this.lock();
  }

  cancelWalk() {
    this.walkTarget = null;
    this.walkOnArrive = null;
  }
}
