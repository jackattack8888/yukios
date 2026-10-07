import * as CANNON from "cannon-es";

export class RoomInteraction {
  static INTERACT_DIST = 3;
  static HOLO_DIST = 22;
  static TOSS_SNAP_MAX_DIST = 2;
  static TOSS_SNAP_MAX_ANGLE = 0.7;
  static LOB_ARC_HEIGHT = 1.1;
  static LOB_TRAIL_INTERVAL = 110;
  static LOB_DURATION_MIN = 0.45;
  static LOB_DURATION_PER_UNIT = 0.04;
  static CHARGE_MAX_TIME = 1.1;
  static CHARGE_TAP_THRESHOLD = 0.18;
  static THROW_POWER_MAX = 2.5;
  static CHARGE_PULLBACK = 0.35;
  static CHARGE_SPARKLE_INTERVAL = 140;

  constructor(renderer, controls) {
    this.renderer = renderer;
    this.controls = controls;
    this.raycaster = null;
    this.mouse = null;
    this.callbacks = new Map();
    this.prefixCallbacks = [];
    this.THREE = null;
    this.canvas = null;
    this.gameCases = [];
    this.grabbedCase = null;
    this.grabPlane = null;
    this.grabOffset = null;
    this.lastGrabPos = null;
    this.povGrabbedCase = null;
    this.reachBonus = 0;
    this.lob = null;
    this.lobTrailT = 0;
    this.targetGlowKey = null;
    this.charging = false;
    this.chargeT = 0;
    this.chargeTrailT = 0;
    this.chargeHeldAfterCancel = false;
    this.contractActive = false;
    this.onCatalogOpen = null;
    this.onTrashRequest = null;
    this.nearWastebin = false;
    this.shelfManager = null;
    this.nearShelf = false;
    this.ballMesh = null;
    this.ballBody = null;
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
    this.onLaunchGame = null;
    this.furnitureManager = null;
    this.gameCaseManager = null;
    this.gameState = null;
    this.onCasePlaced = null;
    this.onGrab = null;
    this.onMonitorHover = null;
    this.onMonitorAction = null;
    this.canSitOnSofa = null;
    this.seatedChair = null;
    this.seatedSofa = false;
    this.seatedSavedPos = null;
    this.seatedSavedYaw = null;
    this.seatedSavedPitch = null;
    this.audio = null;
    this.onHoverChange = null;
    this.hoverTarget = null;
    this.wailaTitle = null;
    this.wailaListTime = 0;
    this.wailaRayTime = 0;
    this.wailaCase = null;
    this.tagCase = null;
    this.tagSprite = null;
    this.tagCanvas = null;
    this.tagCtx = null;
    this.tagTexture = null;
    this.tagWorldPos = null;
    this.hoverMeshes = [];
    this.hoverMeshesDirty = true;
    this.cachedBookMeshes = [];
    this.planeNormal = null;
    this.intersectPoint = null;
    this.leftHandMesh = null;
    this.rightHandMesh = null;
    this.scratchVec3a = null;
    this.scratchVec3b = null;
    this.scratchVec3c = null;
    this.scratchQuat = null;
    this.scratchQuat2 = null;
    this.poseDir = null;
    this.poseMid = null;
    this.poseUp = null;
    this.poseQuat = null;
  }

  async init(THREE) {
    this.THREE = THREE;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.grabPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.planeNormal = new THREE.Vector3(0, 1, 0);
    this.intersectPoint = new THREE.Vector3();
    this.tagWorldPos = new THREE.Vector3();
    this.scratchVec3a = new THREE.Vector3();
    this.scratchVec3b = new THREE.Vector3();
    this.scratchVec3c = new THREE.Vector3();
    this.scratchQuat = new THREE.Quaternion();
    this.scratchQuat2 = new THREE.Quaternion();
    this.canvas = this.renderer.renderer.domElement;
    this.canvas.addEventListener("mousemove", (e) => this.onHover(e));
    this.canvas.style.cursor = "default";
    this.controls.onBeforeLock = (event) => this.onBeforeLock(event);
  }

  setGameCases(gameCases) {
    this.gameCases = gameCases;
  }

  makeKinematic(body) {
    body.type = CANNON.Body.KINEMATIC;
    body.velocity.set(0, 0, 0);
    body.angularVelocity.set(0, 0, 0);
    body.allowSleep = false;
    body.wakeUp();
  }

  makeDynamic(body, dynamicMass) {
    body.type = CANNON.Body.DYNAMIC;
    if (dynamicMass) {
      body.mass = dynamicMass;
    }
    body.updateMassProperties();
    body.allowSleep = true;
    body.wakeUp();
  }

  applyThrowVelocity(body, velocity, spin) {
    body.velocity.set(velocity.x, velocity.y, velocity.z);
    if (spin) {
      body.angularVelocity.set(spin.x, spin.y, spin.z);
    }
  }

  capThrowLift(velocity, fromY) {
    if (!this.gameCaseManager || !this.gameCaseManager.physics) return;
    const g = Math.abs(this.gameCaseManager.physics.world.gravity.y) || 9.82;
    const maxRise = Math.max(0.25, 3 - fromY - 0.35);
    const maxVy = Math.sqrt(2 * g * maxRise);
    if (velocity.y > maxVy) velocity.y = maxVy;
  }

  caseRoot(obj) {
    let o = obj;
    while (o && o !== this.ballMesh && !o.userData.isCase && !o.userData.isBook) o = o.parent;
    return o === this.ballMesh || (o && (o.userData.isCase || o.userData.isBook)) ? o : null;
  }

  gameCaseFromRoot(obj) {
    const root = this.caseRoot(obj);
    if (!root) return null;
    return this.gameCases.find((b) => b.mesh === root) || null;
  }

  collectOutlineMesh(hit) {
    const root = this.caseRoot(hit);
    if (root) return root;
    let o = hit;
    while (o) {
      if (o.userData && (o.userData.interactive || o.userData.isBook || o.userData.isCase)) return o;
      o = o.parent;
    }
    return null;
  }

  collectInteractiveRoot(hit) {
    let o = hit;
    while (o) {
      if (o.userData && o.userData.interactive) return o;
      o = o.parent;
    }
    return null;
  }

  applyHoverOutline(hit) {
    if (!this.renderer || !this.renderer.setOutlineMeshes) return;
    const pass = this.renderer.outlinePass;
    if (pass) {
      const held = this.povGrabbedCase;
      const isHeld = hit && held && this.caseRoot(hit) === held.mesh;
      pass.hiddenEdgeColor.set(isHeld ? 0xffffff : 0x16162a);
    }
    const mesh = hit ? this.collectOutlineMesh(hit) : null;
    this.renderer.setOutlineMeshes(mesh ? [mesh] : []);
  }

  setTargetGlow(gameCase) {
    if (!gameCase || !this.shelfManager) return;
    const type = gameCase.type && gameCase.type !== "book" ? gameCase.type : null;
    const key = type || gameCase.genre || "casual";
    this.targetGlowKey = key;
    if (this.shelfManager.setTargetHome) this.shelfManager.setTargetHome(key, true);
  }

  clearTargetGlow() {
    if (this.targetGlowKey !== null && this.shelfManager && this.shelfManager.setTargetHome) {
      this.shelfManager.setTargetHome(this.targetGlowKey, false);
    }
    this.targetGlowKey = null;
  }

  tagKey(gameCase) {
    return gameCase.type && gameCase.type !== "book" ? gameCase.type : gameCase.genre || "casual";
  }

  isTaggedCase(gameCase) {
    return !!gameCase && !gameCase.isBall;
  }

  ensureTag(gameCase) {
    const T = this.THREE;
    if (!T) return;
    if (!this.tagSprite) {
      this.tagCanvas = document.createElement("canvas");
      this.tagCanvas.width = 256;
      this.tagCanvas.height = 128;
      this.tagCtx = this.tagCanvas.getContext("2d");
      this.tagTexture = new T.CanvasTexture(this.tagCanvas);
      this.tagSprite = new T.Sprite(new T.SpriteMaterial({ map: this.tagTexture, transparent: true, depthTest: true }));
      this.tagSprite.scale.set(0.7, 0.35, 1);
      if (this.renderer && this.renderer.scene) this.renderer.scene.add(this.tagSprite);
    }
    const homes =
      this.shelfManager && this.shelfManager.getMatchingShelves
        ? this.shelfManager.getMatchingShelves(this.tagKey(gameCase))
        : [];
    const home = homes[0] || null;
    this.drawTagTexture(home ? home.label : "", home ? home.color : "#44ff88");
    this.tagSprite.visible = true;
  }

  drawTagTexture(label, color) {
    const ctx = this.tagCtx;
    const W = this.tagCanvas.width;
    const H = this.tagCanvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10, 8, 22, 0.85)";
    this.roundRectPath(ctx, 10, 30, W - 20, H - 60, 26);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 52px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, W / 2, H / 2 + 2);
    this.tagTexture.needsUpdate = true;
  }

  roundRectPath(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.arcTo(x + w, y, x + w, y + rr, rr);
    ctx.lineTo(x + w, y + h - rr);
    ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
    ctx.lineTo(x + rr, y + h);
    ctx.arcTo(x, y + h, x, y + h - rr, rr);
    ctx.lineTo(x, y + rr);
    ctx.arcTo(x, y, x + rr, y, rr);
    ctx.closePath();
  }

  updateCaseTag() {
    const active = (this.gameState && this.gameState.active) || this.contractActive;
    const held = this.povGrabbedCase || this.grabbedCase;
    let target = null;
    if (active) {
      if (held && this.isTaggedCase(held)) target = held;
      else if (this.wailaCase && this.isTaggedCase(this.wailaCase)) target = this.wailaCase;
    }
    if (target !== this.tagCase) {
      this.tagCase = target;
      if (target) this.ensureTag(target);
      else if (this.tagSprite) this.tagSprite.visible = false;
    }
    if (target && this.tagSprite && this.tagSprite.visible) {
      target.mesh.updateMatrixWorld();
      this.tagWorldPos.setFromMatrixPosition(target.mesh.matrixWorld);
      this.tagWorldPos.y += (target.size ? target.size.y : 0.2) / 2 + 0.18;
      this.tagSprite.position.copy(this.tagWorldPos);
    }
  }

  resolveGrabbedColliders(pos, size) {
    const cols =
      (this.renderer && (this.renderer.colliders || (this.renderer.getColliders && this.renderer.getColliders()))) ||
      [];
    if (cols.length === 0) return;
    const hx = size.x / 2;
    const hy = size.y / 2;
    const hz = size.z / 2;
    for (const col of cols) {
      if (pos.y + hy <= col.min.y || pos.y - hy >= col.max.y) continue;
      const closestX = Math.max(col.min.x, Math.min(pos.x, col.max.x));
      const closestZ = Math.max(col.min.z, Math.min(pos.z, col.max.z));
      const dx = pos.x - closestX;
      const dz = pos.z - closestZ;
      const ax = Math.abs(dx);
      const az = Math.abs(dz);
      if (ax >= hx || az >= hz) continue;
      const pushX = hx - ax;
      const pushZ = hz - az;
      if (pushX <= pushZ) {
        if (dx > 1e-6) pos.x += pushX;
        else if (dx < -1e-6) pos.x -= pushX;
        else pos.x += Math.sign(pos.x - (col.min.x + col.max.x) / 2) * pushX;
      } else {
        if (dz > 1e-6) pos.z += pushZ;
        else if (dz < -1e-6) pos.z -= pushZ;
        else pos.z += Math.sign(pos.z - (col.min.z + col.max.z) / 2) * pushZ;
      }
    }
  }

  getCameraForward(camera) {
    const fwd = new this.THREE.Vector3(0, 0, -1);
    fwd.applyQuaternion(camera.quaternion);
    fwd.y = 0;
    return fwd.normalize();
  }

  beginLob(camera) {
    if (this.lob || !this.povGrabbedCase || this.povGrabbedCase.isBall || !this.shelfManager) return false;
    const gameCase = this.povGrabbedCase;
    if (!this.shelfManager.getBestSnapSlot) return false;
    const slot = this.shelfManager.getBestSnapSlot(gameCase, gameCase.mesh.position, this.getCameraForward(camera), {
      maxDist: RoomInteraction.TOSS_SNAP_MAX_DIST,
      maxAngle: RoomInteraction.TOSS_SNAP_MAX_ANGLE
    });
    if (!slot) return false;
    this.clearTargetGlow();
    const dist = gameCase.mesh.position.distanceTo(slot.position);
    this.lob = {
      gameCase,
      slot,
      startPos: gameCase.mesh.position.clone(),
      startQuat: gameCase.mesh.quaternion.clone(),
      t: 0,
      duration: RoomInteraction.LOB_DURATION_MIN + dist * RoomInteraction.LOB_DURATION_PER_UNIT
    };
    if (this.audio && this.audio.playLobThrow) this.audio.playLobThrow();
    return true;
  }

  finishLob() {
    const lob = this.lob;
    this.lob = null;
    if (!lob) return;
    const gameCase = lob.gameCase;
    const slot = lob.slot;
    if (slot.occupied) {
      this.releasePOVGrab(null);
      return;
    }
    gameCase.mesh.position.copy(slot.position);
    gameCase.pos.copy(slot.position);
    gameCase.body.position.set(slot.position.x, slot.position.y, slot.position.z);
    if (this.audio && this.audio.playLobSnap) this.audio.playLobSnap();
    this.shelveAndReport(gameCase, slot, true);
    this.povGrabbedCase = null;
    this.applyHoverOutline(null);
    this.resetArm(this.renderer.player.rightArm);
  }

  startCharge() {
    if (this.charging || this.lob) return;
    if (!this.povGrabbedCase || this.povGrabbedCase.isBall) return;
    this.charging = true;
    this.chargeT = 0;
  }

  cancelCharge() {
    if (this.charging) this.chargeHeldAfterCancel = true;
    this.charging = false;
    this.chargeT = 0;
  }

  updateCharge(dt) {
    if (!this.charging) return;
    this.chargeT = Math.min(RoomInteraction.CHARGE_MAX_TIME, this.chargeT + dt);
    const now = performance.now();
    if (
      now - this.chargeTrailT < RoomInteraction.CHARGE_SPARKLE_INTERVAL ||
      !this.gameCaseManager ||
      !this.povGrabbedCase
    )
      return;
    this.chargeTrailT = now;
    const progress = this.chargeT / RoomInteraction.CHARGE_MAX_TIME;
    const color = progress > 0.75 ? 0xff6bd6 : progress > 0.45 ? 0xffcc44 : 0x44ff88;
    if (this.gameCaseManager.spawnSparkle) this.gameCaseManager.spawnSparkle(this.povGrabbedCase.mesh.position, color);
  }

  releaseCharge(camera) {
    if (this.chargeHeldAfterCancel) {
      this.chargeHeldAfterCancel = false;
      return true;
    }
    if (!this.charging || !this.povGrabbedCase) {
      this.cancelCharge();
      return false;
    }
    const gameCase = this.povGrabbedCase;
    const isTap = this.chargeT < RoomInteraction.CHARGE_TAP_THRESHOLD;
    const progress = this.chargeT / RoomInteraction.CHARGE_MAX_TIME;
    this.cancelCharge();
    this.chargeHeldAfterCancel = false;
    if (!gameCase.isBall && this.shelfManager && this.beginLob(camera)) return true;
    if (isTap && !gameCase.isBall && this.shelfManager && this.nearShelf) {
      const slot = this.shelfManager.getNearestEmptySlot(gameCase.mesh.position);
      if (slot) {
        const isCorrect = this.shelfManager.isCorrectShelf(gameCase, slot);
        if (this.audio) this.audio.playBookShelve();
        this.shelveAndReport(gameCase, slot, isCorrect);
        if (isCorrect) {
          if (this.audio) this.audio.playCorrect();
        } else {
          if (this.audio) this.audio.playWrong();
        }
        this.povGrabbedCase = null;
        this.clearTargetGlow();
        this.applyHoverOutline(null);
        this.resetArm(this.renderer.player.rightArm);
        return true;
      }
    }
    this.throwCharged(camera, progress);
    return true;
  }

  throwCharged(camera, progress) {
    const gameCase = this.povGrabbedCase;
    if (!gameCase) return;
    const power = 1 + (RoomInteraction.THROW_POWER_MAX - 1) * Math.min(1, progress);
    if (this.audio) this.audio.playReleasePOV();
    this.makeDynamic(gameCase.body, gameCase.dynamicMass);
    if (camera && this.THREE) {
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      const baseSpeed = gameCase.isBall ? 13 : 7.5;
      fwd.multiplyScalar(baseSpeed * power);
      fwd.y += (gameCase.isBall ? 1.5 : 2.2) * power;
      this.capThrowLift(fwd, gameCase.body.position.y);
      gameCase.body.velocity.set(fwd.x, fwd.y, fwd.z);
      gameCase.body.maxSpeed = baseSpeed * power;
      gameCase.body.angularVelocity.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      );
    }
    gameCase.grabbed = false;
    this.povGrabbedCase = null;
    this.clearTargetGlow();
    this.applyHoverOutline(null);
    this.resetArm(this.renderer.player.rightArm);
  }

  releasePOVGrab(camera) {
    if (!this.povGrabbedCase) return false;
    this.clearTargetGlow();
    this.applyHoverOutline(null);
    this.cancelCharge();
    this.chargeHeldAfterCancel = false;
    if (camera && this.beginLob(camera)) return true;
    if (this.audio) this.audio.playReleasePOV();
    const gameCase = this.povGrabbedCase;
    this.makeDynamic(gameCase.body, gameCase.dynamicMass);
    if (camera && this.THREE) {
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      const speed = gameCase.isBall ? 13 : 7.5;
      fwd.multiplyScalar(speed);
      fwd.y += gameCase.isBall ? 1.5 : 2.2;
      this.capThrowLift(fwd, gameCase.body.position.y);
      gameCase.body.velocity.set(fwd.x, fwd.y, fwd.z);
      gameCase.body.angularVelocity.set(
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 3
      );
    }
    gameCase.grabbed = false;
    this.povGrabbedCase = null;
    this.resetArm(this.renderer.player.rightArm);
    return false;
  }

  gamepadGrabToggle() {
    if (this.povGrabbedCase) {
      this.releasePOVGrab();
      return;
    }
    if (this.grabbedCase) {
      this.releaseBook();
      return;
    }
    if (this.grabbedBallMesh) {
      this.releaseBall();
      return;
    }
    if (!this.raycaster || !this.renderer || !this.renderer.camera) return;
    this.mouse.set(0, 0);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length === 0) return;
    const intersects = this.raycaster.intersectObjects(bookMeshes, true);
    if (intersects.length === 0) return;
    if (intersects[0].distance >= RoomInteraction.INTERACT_DIST + this.reachBonus) return;
    const root = this.caseRoot(intersects[0].object);
    if (root === this.ballMesh) this.grabBall();
    else if (root) {
      const gc = this.gameCases.find((b) => b.mesh === root);
      if (gc) this.povGrabCase(gc);
      else this.grabBook(root);
    }
  }

  setMouseFromClient(clientX, clientY) {
    this.updateMouse({ clientX, clientY });
  }

  handleTap(clientX, clientY) {
    if (this.editorManager && this.editorManager.isEditActive()) return false;
    if (!this.raycaster || !this.renderer || !this.renderer.camera) return false;
    const camera = this.renderer.camera;
    this.setMouseFromClient(clientX, clientY);
    this.raycaster.setFromCamera(this.mouse, camera);
    if (this.seatedSofa) {
      if (this.interactWithView(camera)) return true;
      this.standFromSofa(this.controls);
      return true;
    }
    if (this.seatedChair) {
      if (this.interactWithView(camera)) return true;
      this.standFromChair(this.controls);
      return true;
    }
    if (this.povGrabbedCase) {
      this.startCharge();
      this.releaseCharge(camera);
      return true;
    }
    if (this.grabbedCase) {
      this.releaseBook();
      return true;
    }
    if (this.grabbedBallMesh) {
      this.makeDynamic(this.ballBody);
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      fwd.multiplyScalar(12);
      this.capThrowLift(fwd, this.ballBody.position.y);
      this.applyThrowVelocity(this.ballBody, fwd);
      this.ballGrabbed = false;
      this.grabbedBallMesh = null;
      this.applyHoverOutline(null);
      this.resetArm(this.renderer.player.rightArm);
      return true;
    }
    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(bookMeshes, true);
      if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST + this.reachBonus) {
        const root = this.caseRoot(intersects[0].object);
        if (root === this.ballMesh) {
          this.grabBall();
          return true;
        }
        const gameCase = this.gameCases.find((b) => b.mesh === root);
        if (gameCase) {
          this.povGrabCase(gameCase);
          return true;
        }
      }
    }
    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const oi = this.raycaster.intersectObjects(objects);
      if (oi.length > 0 && oi[0].distance < RoomInteraction.INTERACT_DIST) {
        const obj = oi[0].object;
        const id = obj.userData.objectId;
        if (id === "spawnBox") {
          if (this.onCatalogOpen) this.onCatalogOpen();
          return true;
        }
        if (id) {
          if (this.dispatch(obj)) return true;
        }
      }
    }
    const holoScreen = this.renderer.monitorScreen;
    const holoRenderer = this.renderer.hologramRenderer;
    if (holoScreen && holoRenderer && holoRenderer.getItemAtUV) {
      const hh = this.raycaster.intersectObject(holoScreen);
      if (hh.length > 0 && hh[0].uv && hh[0].distance < RoomInteraction.HOLO_DIST) {
        const item = holoRenderer.getItemAtUV(hh[0].uv.x, hh[0].uv.y);
        if (item) {
          if (holoRenderer.clickAtUV) holoRenderer.clickAtUV(hh[0].uv.x, hh[0].uv.y);
          else if (this.onMonitorAction) this.onMonitorAction(item);
          if (this.audio) this.audio.playClick();
          return true;
        }
      }
    }
    return false;
  }

  interactWithView(camera) {
    this.mouse.set(0, 0);
    this.raycaster.setFromCamera(this.mouse, camera);
    const holoScreen = this.renderer.monitorScreen;
    const holoRenderer = this.renderer.hologramRenderer;
    if (holoScreen && holoRenderer) {
      const holoMaxDist =
        holoRenderer.isPanelMode && holoRenderer.isPanelMode()
          ? RoomInteraction.HOLO_DIST
          : RoomInteraction.INTERACT_DIST;
      const holoHits = this.raycaster.intersectObject(holoScreen);
      if (holoHits.length > 0 && holoHits[0].uv && holoHits[0].distance < holoMaxDist) {
        const holoDist = holoHits[0].distance;
        const bookMeshes = this.getBookMeshes();
        const objects = this.renderer.getInteractiveObjects();
        const allMeshes = this.renderer.roomObjects || [];
        const shelfMeshes = this.shelfManager ? this.shelfManager.shelfMeshes || [] : [];
        const everything = [...bookMeshes, ...objects, ...allMeshes, ...shelfMeshes];
        let occluded = false;
        if (everything.length > 0) {
          const blockerHits = this.raycaster.intersectObjects(everything);
          if (blockerHits.length > 0 && blockerHits[0].distance < holoDist) occluded = true;
        }
        if (!occluded) {
          const item = holoRenderer.getItemAtUV(holoHits[0].uv.x, holoHits[0].uv.y);
          if (item) {
            if (holoRenderer.clickAtUV) holoRenderer.clickAtUV(holoHits[0].uv.x, holoHits[0].uv.y);
            else if (this.onMonitorAction) this.onMonitorAction(item);
            if (this.audio) this.audio.playClick();
            return true;
          }
        }
      }
    }
    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
        const obj = intersects[0].object;
        const id = obj.userData.objectId;
        if (id === "spawnBox") {
          if (this.onCatalogOpen) this.onCatalogOpen();
          return true;
        }
        if (id) {
          if (this.dispatch(obj)) return true;
        }
      }
    }
    return false;
  }

  updateWAILA(camera) {
    if (this.renderer) this.renderer.hologramFrozen = false;
    const held = this.povGrabbedCase || this.grabbedCase;
    if (held) {
      this.wailaCase = held;
      const key = held.type && held.type !== "book" ? held.type : held.genre || "casual";
      this.wailaTitle = key ? key.toUpperCase() : null;
      return;
    }
    const now = performance.now();
    if (now - this.wailaListTime > 250) {
      this.wailaListTime = now;
      if (this.renderer.collectWAILAMeshes) this.renderer.collectWAILAMeshes();
    }
    if (now - this.wailaRayTime > 100) {
      this.wailaRayTime = now;
      this.raycaster.setFromCamera(new this.THREE.Vector2(0, 0), camera);
      const wailaMeshes = this.renderer.wailaMeshes;
      if (!wailaMeshes || wailaMeshes.length === 0) {
        this.wailaTitle = null;
        return;
      }
      const hits = this.raycaster.intersectObjects(wailaMeshes, true);
      const closeHit = hits.find((h) => h.distance < RoomInteraction.INTERACT_DIST);
      if (closeHit) {
        this.wailaCase = this.gameCaseFromRoot(closeHit.object);
        if (this.wailaCase) {
          const k = this.wailaCase.genre || this.wailaCase.type || "";
          this.wailaTitle = k ? k.toUpperCase() : null;
        } else {
          let obj = closeHit.object;
          while (obj && !obj.userData.title) obj = obj.parent;
          this.wailaTitle = obj ? obj.userData.title || null : null;
        }
      } else {
        this.wailaTitle = null;
        this.wailaCase = null;
      }
    }
  }

  getBookMeshes() {
    const meshes = this.gameCases.filter((b) => !b.grabbed && b !== this.povGrabbedCase).map((b) => b.mesh);
    if (this.ballMesh && !this.ballGrabbed && !this.grabbedBallMesh) meshes.push(this.ballMesh);
    return meshes;
  }

  resolveCallback(id) {
    const exact = this.callbacks.get(id);
    if (exact) return exact;
    for (const { prefix, callback } of this.prefixCallbacks) {
      if (id && id.startsWith(prefix)) return callback;
    }
    return null;
  }

  dispatch(obj) {
    const id = obj.userData.objectId;
    const cb = this.resolveCallback(id);
    if (cb) return cb(obj) !== false;
    return false;
  }

  onBeforeLock(event) {
    if (this.editorManager && this.editorManager.isEditActive()) return false;
    this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    if (this.grabbedCase || this.grabbedBallMesh) {
      if (this.grabbedBallMesh) this.releaseBall();
      else this.releaseBook();
      return true;
    }
    if (this.povGrabbedCase) return true;
    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        if (hitObj.userData.isFurniture && this.furnitureManager) {
          const item = this.furnitureManager.findByMesh(hitObj);
          if (item) {
            this.furnitureManager.povGrab(item);
            return true;
          }
        }
        this.lastIntersect = intersects[0];
        this.dispatch(hitObj);
        return true;
      }
    }
    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length > 0) {
      const intersects = this.raycaster.intersectObjects(bookMeshes, true);
      if (intersects.length > 0) {
        const root = this.caseRoot(intersects[0].object);
        if (root === this.ballMesh) this.grabBall();
        else {
          const gameCase = this.gameCases.find((b) => b.mesh === root);
          if (gameCase && this.onLaunchGame) this.onLaunchGame(gameCase.gameId);
          else if (gameCase) this.grabBook(root);
        }
        return true;
      }
    }
    return false;
  }

  grabBook(mesh) {
    const gameCase = this.gameCases.find((b) => b.mesh === mesh);
    if (!gameCase) return;
    if (this.shelfManager) this.shelfManager.popCaseFromSlot(gameCase);
    if (this.audio) this.audio.playBookGrab();
    gameCase.grabbed = true;
    this.makeKinematic(gameCase.body);
    this.grabbedCase = gameCase;
    this.applyHoverOutline(gameCase.mesh);
    if (this.onGrab) this.onGrab(gameCase);
    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -gameCase.mesh.position.y);
    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) this.grabOffset = new this.THREE.Vector3().copy(gameCase.mesh.position).sub(intersectPoint);
    else this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    this.lastGrabPos = gameCase.mesh.position.clone();
    this.setTargetGlow(gameCase);
  }

  releaseBook() {
    if (this.grabbedCase) {
      const gameCase = this.grabbedCase;
      if (this.shelfManager && !gameCase.isBall) {
        const slot = this.shelfManager.getNearestEmptySlot(gameCase.mesh.position);
        if (slot) {
          const isCorrect = this.shelfManager.isCorrectShelf(gameCase, slot);
          if (this.audio) this.audio.playBookShelve();
          this.shelveAndReport(gameCase, slot, isCorrect);
          if (isCorrect) {
            if (this.audio) this.audio.playCorrect();
          } else {
            if (this.audio) this.audio.playWrong();
          }
          this.grabbedCase = null;
          this.grabOffset = null;
          this.clearTargetGlow();
          this.applyHoverOutline(null);
          return;
        }
      }
      this.makeDynamic(gameCase.body, gameCase.dynamicMass);
      if (this.lastGrabPos) {
        const throwVel = new this.THREE.Vector3().copy(gameCase.pos).sub(this.lastGrabPos);
        this.capThrowLift(throwVel, gameCase.body.position.y);
        gameCase.body.velocity.set(throwVel.x, Math.max(throwVel.y, 0), throwVel.z);
        const spin = new this.THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5
        );
        gameCase.body.angularVelocity.set(spin.x, spin.y, spin.z);
      }
      gameCase.grabbed = false;
      this.clearTargetGlow();
      this.applyHoverOutline(null);
    }
    this.grabbedCase = null;
    this.grabOffset = null;
  }

  shelveAndReport(gameCase, slot, isCorrect) {
    if (this.shelfManager) this.shelfManager.shelveCase(gameCase, slot);
    const inTidy = (this.gameState && this.gameState.active) || this.contractActive;
    if (this.gameState && this.gameState.active) {
      if (this.shelfManager.flashSlot) this.shelfManager.flashSlot(slot, isCorrect);
      if (isCorrect) this.gameState.placeGameCaseCorrectly(gameCase.gameId);
      else this.gameState.placeGameCaseWrongly(gameCase.gameId);
    } else if (this.contractActive) {
      if (this.shelfManager.flashSlot) this.shelfManager.flashSlot(slot, isCorrect);
    }
    if (this.onCasePlaced && inTidy) this.onCasePlaced(gameCase, isCorrect);
  }

  updateGrabbed() {
    if (this.grabbedBallMesh) {
      this.updateBallDrag();
      return;
    }
    if (!this.grabbedCase || !this.grabOffset) return;
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    this.grabPlane.set(this.planeNormal, -this.grabbedCase.pos.y);
    const intersectPoint = this.intersectPoint;
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;
    this.lastGrabPos.copy(this.grabbedCase.pos);
    this.grabbedCase.mesh.position.copy(intersectPoint).add(this.grabOffset);
    const b = this.renderer.bounds;
    const sx = this.grabbedCase.size.x / 2;
    const sy = this.grabbedCase.size.y / 2;
    const sz = this.grabbedCase.size.z / 2;
    this.grabbedCase.mesh.position.x = Math.max(b.minX + sx, Math.min(b.maxX - sx, this.grabbedCase.mesh.position.x));
    this.grabbedCase.mesh.position.z = Math.max(b.minZ + sz, Math.min(b.maxZ - sz, this.grabbedCase.mesh.position.z));
    this.grabbedCase.mesh.position.y = Math.max(sy, Math.min(3 - sy, this.grabbedCase.mesh.position.y));
    this.resolveGrabbedColliders(this.grabbedCase.mesh.position, this.grabbedCase.size);
    this.grabbedCase.pos.copy(this.grabbedCase.mesh.position);
  }

  updateBallDrag() {
    if (!this.grabbedBallMesh || !this.grabOffset) return;
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const y = this.grabbedBallMesh.position.y;
    this.grabPlane.set(this.planeNormal, -y);
    const intersectPoint = this.intersectPoint;
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (!hit) return;
    this.lastGrabPos.copy(this.grabbedBallMesh.position);
    this.grabbedBallMesh.position.copy(intersectPoint).add(this.grabOffset);
    const b = this.renderer.bounds;
    this.grabbedBallMesh.position.x = Math.max(b.minX + 0.12, Math.min(b.maxX - 0.12, this.grabbedBallMesh.position.x));
    this.grabbedBallMesh.position.z = Math.max(b.minZ + 0.12, Math.min(b.maxZ - 0.12, this.grabbedBallMesh.position.z));
    this.grabbedBallMesh.position.y = Math.max(0.12, Math.min(3 - 0.12, this.grabbedBallMesh.position.y));
    this.resolveGrabbedColliders(this.grabbedBallMesh.position, { x: 0.28, y: 0.28, z: 0.28 });
    if (this.ballBody)
      this.ballBody.position.set(
        this.grabbedBallMesh.position.x,
        this.grabbedBallMesh.position.y,
        this.grabbedBallMesh.position.z
      );
  }

  findNearestChair(camera) {
    if (!this.furnitureManager) return null;
    let best = null;
    let bestDist = 1.5;
    for (const item of this.furnitureManager.items.values()) {
      if (!item.id.startsWith("wooden-chair")) continue;
      const dx = camera.position.x - item.mesh.position.x;
      const dz = camera.position.z - item.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    return best;
  }

  findNearestSofa(camera) {
    const seat = this.renderer && this.renderer.sofaSeat;
    if (seat) {
      if (!this.raycaster) return null;
      this.raycaster.setFromCamera(this.mouse, camera);
      const intersects = this.raycaster.intersectObject(seat, false);
      if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
        const world = new this.THREE.Vector3();
        seat.getWorldPosition(world);
        return { mesh: seat, position: world };
      }
      return null;
    }
    if (!this.furnitureManager) return null;
    let best = null;
    let bestDist = 1.5;
    for (const item of this.furnitureManager.items.values()) {
      if (!item.id.includes("sofa") && !item.id.includes("couch")) continue;
      const dx = camera.position.x - item.mesh.position.x;
      const dz = camera.position.z - item.mesh.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < bestDist) {
        bestDist = dist;
        best = item;
      }
    }
    if (best) {
      const world = best.mesh.position.clone();
      return { mesh: best.mesh, position: world };
    }
    return null;
  }

  getHeldCase() {
    return this.povGrabbedCase || this.grabbedCase;
  }

  sitOnChair(camera, controls) {
    const chair = this.findNearestChair(camera);
    if (!chair) return false;
    if (this.audio) this.audio.playSit();
    this.seatedChair = chair;
    this.seatedSavedPos = camera.position.clone();
    this.seatedSavedYaw = controls.yaw;
    this.seatedSavedPitch = controls.pitch;
    const chairPos = chair.mesh.position;
    const forward = new this.THREE.Vector3(0, 0, 1);
    forward.applyQuaternion(chair.mesh.quaternion);
    const sitPos = new this.THREE.Vector3(
      chairPos.x + forward.x * 0.05,
      chairPos.y + 1.65,
      chairPos.z + forward.z * 0.05
    );
    const lookTarget = sitPos.clone().add(forward.clone().multiplyScalar(3));
    controls.animateCamera(sitPos, lookTarget, 0.5);
    return true;
  }

  standFromChair(controls) {
    if (!this.seatedChair) return;
    if (this.audio) this.audio.playStand();
    const chair = this.seatedChair;
    const fwd = new this.THREE.Vector3(0, 0, -1);
    fwd.x = -Math.sin(this.seatedSavedYaw) * Math.cos(this.seatedSavedPitch);
    fwd.y = Math.sin(this.seatedSavedPitch);
    fwd.z = -Math.cos(this.seatedSavedYaw) * Math.cos(this.seatedSavedPitch);
    const lookAtTarget = this.seatedSavedPos.clone().add(fwd.multiplyScalar(10));
    this.seatedChair = null;
    controls.animateCamera(this.seatedSavedPos, lookAtTarget, 0.4, () => {
      controls.yaw = this.seatedSavedYaw;
      controls.pitch = this.seatedSavedPitch;
      const V = this.THREE.Vector3;
      const Q = this.THREE.Quaternion;
      const qx = new Q();
      const qy = new Q();
      qx.setFromAxisAngle(new V(1, 0, 0), controls.pitch);
      qy.setFromAxisAngle(new V(0, 1, 0), controls.yaw);
      controls.camera.quaternion.copy(qy.multiply(qx));
      controls.lock();
    });
    this.seatedSavedPos = null;
    this.seatedSavedYaw = null;
    this.seatedSavedPitch = null;
  }

  sitOnSofa(camera, controls) {
    const sofa = this.findNearestSofa(camera);
    if (!sofa) return false;
    if (this.audio) this.audio.playSit();
    this.seatedSofa = true;
    this.seatedSavedPos = camera.position.clone();
    this.seatedSavedYaw = controls.yaw;
    this.seatedSavedPitch = controls.pitch;
    const forward = new this.THREE.Vector3(0, 0, 1);
    if (sofa.mesh.getWorldQuaternion)
      forward.applyQuaternion(sofa.mesh.getWorldQuaternion(new this.THREE.Quaternion()));
    else forward.applyQuaternion(sofa.mesh.quaternion);
    const seat = sofa.position;
    const sitPos = new this.THREE.Vector3(seat.x + forward.x * 0.05, seat.y + 0.95, seat.z + forward.z * 0.05);
    if (controls.setLockPosition) {
      controls.camera.position.copy(sitPos);
      controls.yaw = Math.atan2(-forward.x, -forward.z);
      controls.pitch = 0;
      controls.setLockPosition(sitPos);
      if (!controls.isLocked) controls.lock();
    } else {
      const lookTarget = sitPos.clone().add(forward.clone().multiplyScalar(3));
      controls.animateCamera(sitPos, lookTarget, 0.5);
    }
    return true;
  }

  standFromSofa(controls) {
    if (!this.seatedSofa) return;
    if (this.audio) this.audio.playStand();
    const savedPos = this.seatedSavedPos.clone();
    const savedYaw = this.seatedSavedYaw;
    const savedPitch = this.seatedSavedPitch;
    this.seatedSofa = false;
    this.seatedSavedPos = null;
    this.seatedSavedYaw = null;
    this.seatedSavedPitch = null;
    if (controls.clearLockPosition) controls.clearLockPosition();
    controls.camera.position.copy(savedPos);
    controls.yaw = savedYaw;
    controls.pitch = savedPitch;
    const V = this.THREE.Vector3;
    const Q = this.THREE.Quaternion;
    const qx = new Q();
    const qy = new Q();
    qx.setFromAxisAngle(new V(1, 0, 0), savedPitch);
    qy.setFromAxisAngle(new V(0, 1, 0), savedYaw);
    controls.camera.quaternion.copy(qy.multiply(qx));
    controls.lock();
  }

  isSeated() {
    return this.seatedChair !== null || !!this.seatedSofa;
  }

  handleEKey(camera, controls) {
    if (this.editorManager && this.editorManager.isEditActive()) return false;
    if (!this.raycaster) return false;
    if (controls.walkTarget) return false;
    if (this.seatedSofa) {
      if (this.interactWithView(camera)) return true;
      this.standFromSofa(controls);
      return true;
    }
    if (this.seatedChair) {
      this.standFromChair(controls);
      return true;
    }
    if (this.povGrabbedCase) {
      this.startCharge();
      return true;
    }
    if (this.grabbedCase) this.releaseBook();
    if (this.grabbedBallMesh) {
      this.makeDynamic(this.ballBody);
      const fwd = new this.THREE.Vector3(0, 0, -1);
      fwd.applyQuaternion(camera.quaternion);
      fwd.multiplyScalar(12);
      this.capThrowLift(fwd, this.ballBody.position.y);
      this.applyThrowVelocity(this.ballBody, fwd);
      this.ballGrabbed = false;
      this.grabbedBallMesh = null;
      this.applyHoverOutline(null);
      this.resetArm(this.renderer.player.rightArm);
      return true;
    }
    if (this.furnitureManager && this.furnitureManager.povGrabbedItem) {
      this.furnitureManager.releasePovGrab();
      if (this.audio) this.audio.playFurnitureRelease();
      return true;
    }
    this.mouse.set(0, 0);
    this.raycaster.setFromCamera(this.mouse, camera);
    const objects = this.renderer.getInteractiveObjects();
    if (objects.length > 0) {
      const intersects = this.raycaster.intersectObjects(objects);
      if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
        const obj = intersects[0].object;
        if (obj.userData.isFurniture && this.furnitureManager) {
          const item = this.furnitureManager.findByMesh(obj);
          if (item) {
            this.furnitureManager.povGrab(item);
            if (this.audio) this.audio.playFurnitureGrab();
            return true;
          }
        }
        const id = obj.userData.objectId;
        if (id === "spawnBox") {
          if (this.onCatalogOpen) this.onCatalogOpen();
          return true;
        }
        if (id) {
          if (this.dispatch(obj)) return true;
        }
      }
    }
    if (this.interactWithView(camera)) return true;
    if (this.findNearestSofa(camera) && (!this.canSitOnSofa || this.canSitOnSofa()))
      return this.sitOnSofa(camera, this.controls);
    if (this.findNearestChair(camera)) return this.sitOnChair(camera, this.controls);
    const bookMeshes = this.getBookMeshes();
    if (bookMeshes.length === 0) return false;
    const intersects = this.raycaster.intersectObjects(bookMeshes, true);
    if (intersects.length === 0 || intersects[0].distance >= RoomInteraction.INTERACT_DIST + this.reachBonus)
      return false;
    const root = this.caseRoot(intersects[0].object);
    if (root === this.ballMesh) {
      this.grabBall();
      return true;
    }
    const gameCase = this.gameCases.find((b) => b.mesh === root);
    if (!gameCase) return false;
    this.povGrabCase(gameCase);
    return true;
  }

  povGrabCase(gameCase) {
    if (this.shelfManager && this.shelfManager.isCaseShelved(gameCase)) this.shelfManager.popCaseFromSlot(gameCase);
    gameCase.grabbed = true;
    this.makeKinematic(gameCase.body);
    if (this.audio) this.audio.playBookGrabPOV();
    this.povGrabbedCase = gameCase;
    this.setTargetGlow(gameCase);
    this.applyHoverOutline(gameCase.mesh);
    if (this.onGrab) this.onGrab(gameCase);
  }

  launchFocusedGame() {
    if (this.povGrabbedCase) return this.povGrabbedCase.gameId;
    if (!this.raycaster || !this.renderer || !this.renderer.camera) return null;
    const camera = this.renderer.camera;
    this.raycaster.setFromCamera(new this.THREE.Vector2(0, 0), camera);
    const meshes = this.gameCases.filter((b) => !b.grabbed && b !== this.povGrabbedCase).map((b) => b.mesh);
    const intersects = this.raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0 && intersects[0].distance < RoomInteraction.INTERACT_DIST) {
      const gameCase = this.gameCaseFromRoot(intersects[0].object);
      if (gameCase) return gameCase.gameId;
    }
    return null;
  }

  grabBall() {
    if (!this.ballMesh) return;
    if (this.audio) this.audio.playBallGrab();
    this.ballGrabbed = true;
    this.makeKinematic(this.ballBody);
    this.grabbedBallMesh = this.ballMesh;
    this.applyHoverOutline(this.ballMesh);
    this.grabPlane.set(new this.THREE.Vector3(0, 1, 0), -this.ballMesh.position.y);
    const intersectPoint = new this.THREE.Vector3();
    const hit = this.raycaster.ray.intersectPlane(this.grabPlane, intersectPoint);
    if (hit) this.grabOffset = new this.THREE.Vector3().copy(this.ballMesh.position).sub(intersectPoint);
    else this.grabOffset = new this.THREE.Vector3(0, 0, 0);
    this.lastGrabPos = this.ballMesh.position.clone();
  }

  releaseBall() {
    if (!this.grabbedBallMesh) return;
    if (this.audio) this.audio.playBallThrow();
    this.makeDynamic(this.ballBody);
    if (this.lastGrabPos) {
      const throwVel = new this.THREE.Vector3().copy(this.ballMesh.position).sub(this.lastGrabPos).multiplyScalar(3);
      throwVel.y = Math.max(throwVel.y, 2);
      this.capThrowLift(throwVel, this.ballBody.position.y);
      this.ballBody.velocity.set(throwVel.x, throwVel.y, throwVel.z);
    }
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
    this.applyHoverOutline(null);
  }

  setBallMesh(mesh, body) {
    this.ballMesh = mesh;
    this.ballBody = body;
    this.ballGrabbed = false;
    this.grabbedBallMesh = null;
  }

  setHandMeshes(leftHand, rightHand) {
    this.leftHandMesh = leftHand;
    this.rightHandMesh = rightHand;
  }

  setShelfManager(shelfManager) {
    this.shelfManager = shelfManager;
  }

  setFurnitureManager(fm) {
    this.furnitureManager = fm;
  }

  setGameCaseManager(bm) {
    this.gameCaseManager = bm;
  }

  setGameState(gs) {
    this.gameState = gs;
  }

  setEditorManager(editorManager) {
    this.editorManager = editorManager;
  }

  setAudio(audio) {
    this.audio = audio;
  }

  updateEGrabbed(camera, delta) {
    if (this.renderer && this.renderer.player)
      this.renderer.player.holdRight = !!(this.povGrabbedCase || this.grabbedBallMesh);
    const dt = delta || 0.016;
    if (this.furnitureManager && this.furnitureManager.povGrabbedItem) {
      this.furnitureManager.updatePovGrabbed(camera);
      return;
    }
    if (this.lob) {
      const L = this.lob;
      L.t += dt;
      const t = Math.min(1, L.t / L.duration);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (!this.scratchVec3a) {
        this.scratchVec3a = new this.THREE.Vector3();
        this.scratchVec3b = new this.THREE.Vector3();
        this.scratchVec3c = new this.THREE.Vector3();
        this.scratchQuat = new this.THREE.Quaternion();
        this.scratchQuat2 = new this.THREE.Quaternion();
      }
      const pos = this.scratchVec3a.lerpVectors(L.startPos, L.slot.position, e);
      pos.y += Math.sin(t * Math.PI) * RoomInteraction.LOB_ARC_HEIGHT;
      L.gameCase.mesh.position.copy(pos);
      L.gameCase.pos.copy(pos);
      L.gameCase.body.position.set(pos.x, pos.y, pos.z);
      this.scratchVec3b.set(0, 1, 0);
      this.scratchQuat.setFromAxisAngle(this.scratchVec3b, L.slot.bookRotY);
      L.gameCase.mesh.quaternion.slerp(this.scratchQuat, Math.min(1, dt * 6));
      const now = performance.now();
      if (
        now - this.lobTrailT > RoomInteraction.LOB_TRAIL_INTERVAL &&
        this.gameCaseManager &&
        this.gameCaseManager.spawnSparkle
      ) {
        this.lobTrailT = now;
        this.gameCaseManager.spawnSparkle(pos, 0x66ffd0);
      }
      if (this.rightHandMesh) {
        const handPos = this.scratchVec3c.copy(pos);
        this.renderer.player.worldToLocal(handPos);
        this.rightHandMesh.position.copy(handPos);
        this.poseArm(this.renderer.player.rightArm, this.renderer.player.baseShoulderR, handPos);
      }
      if (t >= 1) this.finishLob();
      return;
    }
    if (this.povGrabbedCase) {
      this.updateCharge(dt);
      if (!this.scratchVec3a) {
        this.scratchVec3a = new this.THREE.Vector3();
        this.scratchVec3b = new this.THREE.Vector3();
        this.scratchVec3c = new this.THREE.Vector3();
        this.scratchQuat = new this.THREE.Quaternion();
        this.scratchQuat2 = new this.THREE.Quaternion();
      }
      this.scratchVec3b.set(0, 0, -1);
      this.scratchVec3b.applyQuaternion(camera.quaternion);
      let distance = 0.9;
      if (this.charging) distance -= (this.chargeT / RoomInteraction.CHARGE_MAX_TIME) * RoomInteraction.CHARGE_PULLBACK;
      this.scratchVec3b.multiplyScalar(distance);
      const targetPos = this.scratchVec3a.copy(camera.position).add(this.scratchVec3b);
      targetPos.y += 0.15;
      const caseBottom = 0.42;
      const heldPos = this.scratchVec3c.copy(targetPos);
      heldPos.y -= caseBottom;
      const lag = 1 - Math.exp(-dt * 13);
      this.resolveGrabbedColliders(heldPos, this.povGrabbedCase.size);
      this.povGrabbedCase.mesh.position.lerp(heldPos, lag);
      this.povGrabbedCase.pos.copy(this.povGrabbedCase.mesh.position);
      this.povGrabbedCase.mesh.quaternion.slerp(camera.quaternion, Math.min(1, dt * 9));
      if (this.rightHandMesh) {
        const handPos = this.scratchVec3b.copy(this.povGrabbedCase.mesh.position);
        this.renderer.player.worldToLocal(handPos);
        this.rightHandMesh.position.copy(handPos);
        this.poseArm(this.renderer.player.rightArm, this.renderer.player.baseShoulderR, handPos);
      }
    } else if (this.grabbedBallMesh) {
      if (!this.scratchVec3a) {
        this.scratchVec3a = new this.THREE.Vector3();
        this.scratchVec3b = new this.THREE.Vector3();
        this.scratchVec3c = new this.THREE.Vector3();
        this.scratchQuat = new this.THREE.Quaternion();
        this.scratchQuat2 = new this.THREE.Quaternion();
      }
      this.scratchVec3b.set(0, 0, -1);
      this.scratchVec3b.applyQuaternion(camera.quaternion);
      const distance = 0.9;
      this.scratchVec3b.multiplyScalar(distance);
      const targetPos = this.scratchVec3a.copy(camera.position).add(this.scratchVec3b);
      targetPos.y += 0.15;
      this.grabbedBallMesh.position.lerp(targetPos, 1 - Math.exp(-dt * 13));
      if (this.ballBody)
        this.ballBody.position.set(
          this.grabbedBallMesh.position.x,
          this.grabbedBallMesh.position.y,
          this.grabbedBallMesh.position.z
        );
      if (this.rightHandMesh) {
        const handPos = this.scratchVec3c.copy(this.grabbedBallMesh.position);
        this.renderer.player.worldToLocal(handPos);
        this.rightHandMesh.position.copy(handPos);
        this.poseArm(this.renderer.player.rightArm, this.renderer.player.baseShoulderR, handPos);
      }
    }
  }

  poseArm(armMesh, shoulderBase, handLocalPos) {
    if (!armMesh) return;
    if (!this.poseDir) {
      this.poseDir = new this.THREE.Vector3();
      this.poseMid = new this.THREE.Vector3();
      this.poseUp = new this.THREE.Vector3();
      this.poseQuat = new this.THREE.Quaternion();
    }
    const dir = this.poseDir.copy(handLocalPos).sub(shoulderBase);
    const distance = dir.length();
    if (distance < 0.01) return;
    dir.normalize();
    const mid = this.poseMid.copy(shoulderBase).add(handLocalPos).multiplyScalar(0.5);
    armMesh.position.copy(mid);
    this.poseUp.set(0, 1, 0);
    this.poseQuat.setFromUnitVectors(this.poseUp, dir);
    armMesh.quaternion.copy(this.poseQuat);
    armMesh.scale.y = distance / 0.48;
  }

  resetArm(armMesh) {
    if (!armMesh) return;
    armMesh.quaternion.identity();
    armMesh.scale.set(1, 1, 1);
    if (this.renderer && this.renderer.player && this.renderer.player.baseArmR)
      armMesh.position.copy(this.renderer.player.baseArmR);
    if (armMesh === this.renderer.player.rightArm && this.rightHandMesh && this.renderer.player.baseHandR) {
      this.rightHandMesh.position.copy(this.renderer.player.baseHandR);
    }
    if (armMesh === this.renderer.player.leftArm && this.leftHandMesh && this.renderer.player.baseHandL) {
      this.leftHandMesh.position.copy(this.renderer.player.baseHandL);
    }
  }

  isEGrabbed() {
    return (
      this.povGrabbedCase !== null ||
      this.grabbedBallMesh !== null ||
      (this.furnitureManager && this.furnitureManager.povGrabbedItem !== null)
    );
  }

  updateProximity() {
    this.nearWastebin = false;
    this.nearShelf = false;
    if (!this.povGrabbedCase || this.povGrabbedCase.isBall) return;
    if (this.shelfManager) {
      const slot = this.shelfManager.getNearestEmptySlot(this.povGrabbedCase.mesh.position);
      this.nearShelf = slot !== null;
    }
  }

  updateWastebinProximity(camera) {
    return this.updateProximity(camera);
  }

  hashId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) {
      h = (h << 5) - h + id.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  onHover(event) {
    if (this.renderer) this.renderer.hologramFrozen = false;
    if (this.editorManager && this.editorManager.isEditActive()) {
      this.applyHoverOutline(null);
      return;
    }
    if (this.grabbedCase || this.povGrabbedCase || this.grabbedBallMesh) {
      const held = this.povGrabbedCase || this.grabbedCase;
      const heldMesh = held ? held.mesh : this.grabbedBallMesh;
      this.applyHoverOutline(heldMesh);
      if (!this.povGrabbedCase) this.canvas.style.cursor = "default";
      this.updateCaseTag();
      return;
    }
    if (this.controls.isLocked) this.mouse.set(0, 0);
    else this.updateMouse(event);
    this.raycaster.setFromCamera(this.mouse, this.renderer.camera);
    const bookMeshes = this.getBookMeshes();
    const objects = this.renderer.getInteractiveObjects();
    const allMeshes = this.renderer.roomObjects || [];
    const shelfMeshes = this.shelfManager ? this.shelfManager.shelfMeshes || [] : [];
    const everything = [...bookMeshes, ...objects, ...allMeshes, ...shelfMeshes];
    const holoScreen = this.renderer.monitorScreen;
    const holoRenderer = this.renderer.hologramRenderer;
    if (holoScreen && holoRenderer) {
      const holoMaxDist =
        holoRenderer.isPanelMode && holoRenderer.isPanelMode()
          ? RoomInteraction.HOLO_DIST
          : RoomInteraction.INTERACT_DIST;
      const holoHits = this.raycaster.intersectObject(holoScreen);
      if (holoHits.length > 0 && holoHits[0].uv && holoHits[0].distance < holoMaxDist) {
        const holoDist = holoHits[0].distance;
        let occluded = false;
        if (everything.length > 0) {
          const blockerHits = this.raycaster.intersectObjects(everything);
          if (blockerHits.length > 0 && blockerHits[0].distance < holoDist) occluded = true;
        }
        if (!occluded) {
          const item = holoRenderer.getItemAtUV(holoHits[0].uv.x, holoHits[0].uv.y);
          if (this.onMonitorHover) this.onMonitorHover(item);
          if (item) {
            if (this.renderer) this.renderer.hologramFrozen = true;
            if (!this.controls.isLocked) this.canvas.style.cursor = "pointer";
            this.applyHoverOutline(null);
            return;
          }
        }
      }
    }
    let found = false;
    if (everything.length > 0) {
      const intersects = this.raycaster.intersectObjects(everything, true);
      if (intersects.length > 0) {
        const hit = intersects[0].object;
        const root = this.caseRoot(hit);
        const caseRoot = root && root !== this.ballMesh && (root.userData.isCase || root.userData.isBook) ? root : null;
        const hitCase = caseRoot ? this.gameCases.find((b) => b.mesh === caseRoot) : null;
        const isCase = !!hitCase;
        if (root === this.ballMesh || isCase) {
          if (!this.controls.isLocked) this.canvas.style.cursor = "grab";
        } else {
          if (!this.controls.isLocked) this.canvas.style.cursor = hit.userData.interactive ? "pointer" : "default";
        }
        found = true;
        const outlineHit = root === this.ballMesh || isCase || this.collectInteractiveRoot(hit) ? hit : null;
        this.applyHoverOutline(outlineHit);
        if (this.onHoverChange) {
          const target =
            root === this.ballMesh
              ? "ball"
              : isCase && hitCase
                ? "case"
                : hit.userData.interactive
                  ? "interactive"
                  : "object";
          if (target !== this.hoverTarget) {
            this.hoverTarget = target;
            this.onHoverChange(target);
          }
        }
      }
    }
    if (!found) {
      this.applyHoverOutline(null);
      if (!this.controls.isLocked) this.canvas.style.cursor = "default";
      if (this.onHoverChange && this.hoverTarget !== null) {
        this.hoverTarget = null;
        this.onHoverChange(null);
      }
    }
    this.updateCaseTag();
  }

  register(id, callback) {
    this.callbacks.set(id, callback);
  }

  registerPrefix(prefix, callback) {
    this.prefixCallbacks.push({ prefix, callback });
  }

  updateMouse(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  destroy() {
    this.callbacks.clear();
    this.prefixCallbacks = [];
    this.gameCases = [];
    this.grabbedCase = null;
    this.wailaListTime = 0;
    this.wailaRayTime = 0;
    this.povGrabbedCase = null;
    this.lob = null;
    this.lobTrailT = 0;
    this.targetGlowKey = null;
    this.charging = false;
    this.chargeT = 0;
    this.chargeTrailT = 0;
    this.chargeHeldAfterCancel = false;
    if (this.tagSprite && this.renderer && this.renderer.scene) this.renderer.scene.remove(this.tagSprite);
    if (this.tagTexture) this.tagTexture.dispose();
    this.tagCase = null;
    this.tagSprite = null;
    this.tagCanvas = null;
    this.tagCtx = null;
    this.tagTexture = null;
    this.ballMesh = null;
    this.ballBody = null;
    this.grabbedBallMesh = null;
    this.shelfManager = null;
    this.gameCaseManager = null;
    this.gameState = null;
    this.raycaster = null;
    this.mouse = null;
  }
}
