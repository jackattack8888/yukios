import * as CANNON from "cannon-es";
import { GENRES } from "./GameState.js";
import { createElement } from "../shared/domUtils.js";

const SHELF_Y_LEVELS = [0.5, 1.25, 2.0];
const SHELF_WIDTH = 0.55;
const SHELF_DEPTH = 0.5;
const SHELF_HEIGHT = 2.5;
const PLANK_THICKNESS = 0.03;
const SLOT_Y_OFFSET = 0.22;
const SLOT_Z_OFFSET = -0.02;
const SLOT_SPACING = 0.06;

const ALL_GENRES = ["horror", "strategy", "casual", "puzzle", "action", "adventure", "simulation", "rpg", "platformer"];

const SHELF_POSITIONS = [
  { x: -4.5, z: -2.8, genre: "horror" },
  { x: -4.5, z: -1.4, genre: "strategy" },
  { x: -4.5, z: 0, genre: "casual" },
  { x: -4.5, z: 1.4, genre: "puzzle" },
  { x: -4.5, z: 2.8, genre: "action" },
  { x: 4.5, z: -2.8, genre: "adventure" },
  { x: 4.5, z: -1.4, genre: "simulation" },
  { x: 4.5, z: 0, genre: "rpg" },
  { x: 4.5, z: 1.4, genre: "platformer" }
];

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export class ShelfManager {
  constructor(THREE, scene, physicsWorld) {
    this.THREE = THREE;
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.slots = [];
    this.shelfMeshes = [];
    this.shelfBodies = [];
    this.animatingCases = [];
    this.gameMode = false;
    this.shelfCategories = {};
    this.labelMeshes = [];
    this.categoryGlowMeshes = [];
    this.shelfData = [];
    this.movingShelvesEnabled = false;
    this.slotOffsets = {};
    this.shelfLabels = [];
    this.shelfGlows = [];
    this.scratchVec = new THREE.Vector3();
    this.targetHomeGlowIndices = [];
  }

  setGameMode(enabled) {
    this.gameMode = enabled;
    if (enabled) {
      this.createLabels();
    } else {
      this.clearLabels();
    }
  }

  setMovingShelves(enabled) {
    this.movingShelvesEnabled = enabled;
  }

  setHomesGlow(intensity) {
    if (!this.gameMode) return;
    for (let i = 0; i < this.categoryGlowMeshes.length; i++) {
      this.categoryGlowMeshes[i].material.opacity = intensity;
    }
  }

  getShelfCategory(slot) {
    if (!this.gameMode) return null;
    return slot.genre || null;
  }

  isCorrectShelf(gameCase, slot) {
    if (!this.gameMode) return true;
    const type = gameCase.type || "book";
    if (slot.homeType) {
      return !!slot.homeTypes && slot.homeTypes.includes(type);
    }
    const genre = gameCase.genre || "casual";
    return type === "book" && genre === slot.genre;
  }

  getBestSnapSlot(gameCase, fromPos, forwardVec, opts = {}) {
    const maxDist = opts.maxDist != null ? opts.maxDist : 2;
    const maxAngle = opts.maxAngle != null ? opts.maxAngle : 0.7;
    const angleWeight = opts.angleWeight != null ? opts.angleWeight : 0.25;
    if (!this.gameMode) return null;
    let best = null;
    let bestScore = Infinity;
    for (const slot of this.slots) {
      if (slot.occupied || !this.isCorrectShelf(gameCase, slot)) continue;
      this.scratchVec.copy(slot.position).sub(fromPos);
      const dist = this.scratchVec.length();
      if (dist > maxDist) continue;
      const angle = this.scratchVec.angleTo(forwardVec);
      if (angle > maxAngle) continue;
      const score = angle + angleWeight * (dist / maxDist);
      if (score < bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    return best;
  }

  createLabels() {
    const T = this.THREE;
    for (let i = 0; i < this.shelfData.length; i++) {
      const shelf = this.shelfData[i];
      const category = shelf.genre;
      const genreInfo = GENRES[category];
      const labelText = shelf.label ? String(shelf.label) : genreInfo ? genreInfo.label : category || "Home";
      const colorHex = shelf.labelColor || (genreInfo ? genreInfo.color : 0x44cc88);
      const r = (colorHex >> 16) & 0xff;
      const g = (colorHex >> 8) & 0xff;
      const b2 = colorHex & 0xff;
      const colorStr = `rgb(${r}, ${g}, ${b2})`;
      const canvas = createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, 256, 64);
      ctx.fillStyle = colorStr;
      ctx.font = "bold 24px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, 128, 32);
      const tex = new T.CanvasTexture(canvas);
      tex.needsUpdate = true;
      const mat = new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        opacity: 0.85,
        side: T.DoubleSide
      });
      const labelGeo = new T.PlaneGeometry(0.72, 0.18);
      const labelMesh = new T.Mesh(labelGeo, mat);
      let labelPos;
      let labelYaw;
      if (shelf.labelPos) {
        labelPos = shelf.labelPos.clone();
        labelYaw = shelf.rotY;
      } else {
        const labelX = shelf.x < 0 ? shelf.x + SHELF_WIDTH / 2 + 0.005 : shelf.x - SHELF_WIDTH / 2 - 0.005;
        labelPos = new T.Vector3(labelX, SHELF_Y_LEVELS[2] + 0.3, shelf.z);
        labelYaw = shelf.x < 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      labelMesh.position.copy(labelPos);
      labelMesh.rotation.set(0, labelYaw, 0);
      labelMesh.userData.isLabel = true;
      labelMesh.userData.basePos = labelPos.clone();
      this.scene.add(labelMesh);
      this.labelMeshes.push(labelMesh);
      if (!this.shelfLabels[i]) this.shelfLabels[i] = [];
      this.shelfLabels[i].push(labelMesh);
      const glowGeo = new T.PlaneGeometry(0.72, 0.18);
      const glowMat = new T.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0,
        side: T.DoubleSide
      });
      const glowMesh = new T.Mesh(glowGeo, glowMat);
      glowMesh.position.copy(labelPos);
      glowMesh.rotation.set(0, labelYaw, 0);
      glowMesh.userData.isGlow = true;
      glowMesh.userData.basePos = labelPos.clone();
      this.scene.add(glowMesh);
      this.categoryGlowMeshes.push(glowMesh);
      if (!this.shelfGlows[i]) this.shelfGlows[i] = [];
      this.shelfGlows[i].push(glowMesh);
    }
  }

  highlightCategory(genre, duration) {
    if (!this.gameMode) return;
    for (let i = 0; i < this.shelfData.length; i++) {
      if (this.shelfData[i].genre === genre) {
        this.categoryGlowMeshes[i].material.opacity = 0.6;
        setTimeout(() => {
          if (this.categoryGlowMeshes[i]) this.categoryGlowMeshes[i].material.opacity = 0;
        }, duration);
      }
    }
  }

  highlightTypeHome(type, duration) {
    if (!this.gameMode) return;
    for (let i = 0; i < this.shelfData.length; i++) {
      const home = this.shelfData[i];
      if (home.homeTypes && home.homeTypes.includes(type)) {
        this.categoryGlowMeshes[i].material.opacity = 0.6;
        setTimeout(() => {
          if (this.categoryGlowMeshes[i]) this.categoryGlowMeshes[i].material.opacity = 0;
        }, duration);
      }
    }
  }

  setTargetHome(key, enabled) {
    if (!this.gameMode) return;
    if (enabled) {
      for (let i = 0; i < this.shelfData.length; i++) {
        const shelf = this.shelfData[i];
        if (shelf.genre !== key && !(shelf.homeTypes && shelf.homeTypes.includes(key))) continue;
        this.categoryGlowMeshes[i].material.opacity = 0.4;
        if (!this.targetHomeGlowIndices.includes(i)) this.targetHomeGlowIndices.push(i);
      }
    } else {
      for (const idx of this.targetHomeGlowIndices) {
        if (this.categoryGlowMeshes[idx]) this.categoryGlowMeshes[idx].material.opacity = 0;
      }
      this.targetHomeGlowIndices = [];
    }
  }

  getMatchingShelves(key) {
    const out = [];
    for (const shelf of this.shelfData) {
      if (shelf.genre !== key && !(shelf.homeTypes && shelf.homeTypes.includes(key))) continue;
      const genreInfo = GENRES[shelf.genre];
      const colorHex = shelf.labelColor || (genreInfo ? genreInfo.color : 0x44cc88);
      const r = (colorHex >> 16) & 0xff;
      const g = (colorHex >> 8) & 0xff;
      const b = colorHex & 0xff;
      out.push({
        labelPos: shelf.labelPos,
        label: shelf.label || (genreInfo ? genreInfo.label : shelf.genre || "Home"),
        color: `rgb(${r}, ${g}, ${b})`
      });
    }
    return out;
  }

  flashSlot(slot, correct) {
    if (!this.gameMode) return;
    const color = correct ? 0x44ff88 : 0xff4444;
    const T = this.THREE;
    const flashGeo = new T.PlaneGeometry(0.18, 0.42);
    const flashMat = new T.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      side: T.DoubleSide
    });
    const flashMesh = new T.Mesh(flashGeo, flashMat);
    flashMesh.position.copy(slot.position);
    flashMesh.position.y += 0.02;
    flashMesh.rotation.y = slot.rotY != null ? slot.rotY : slot.position.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    this.scene.add(flashMesh);
    let elapsed = 0;
    const animate = () => {
      elapsed += 0.016;
      flashMat.opacity = Math.max(0, 0.7 * (1 - elapsed / 1.2));
      if (elapsed < 1.2) {
        requestAnimationFrame(animate);
      } else {
        this.scene.remove(flashMesh);
        flashGeo.dispose();
        flashMat.dispose();
      }
    };
    requestAnimationFrame(animate);
  }

  clearLabels() {
    for (const mesh of this.labelMeshes) {
      this.scene.remove(mesh);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    this.labelMeshes = [];
    for (const mesh of this.categoryGlowMeshes) {
      this.scene.remove(mesh);
      if (mesh.material.map) mesh.material.map.dispose();
      mesh.material.dispose();
      mesh.geometry.dispose();
    }
    this.categoryGlowMeshes = [];
    this.shelfLabels = [];
    this.shelfGlows = [];
    this.shelfCategories = {};
  }

  build(savedShelves, mapId) {
    const T = this.THREE;
    if (typeof savedShelves === "string" && mapId === undefined) {
      mapId = savedShelves;
      savedShelves = {};
    }
    this.savedShelves = savedShelves || {};
    if (this.shelfMeshes.length > 0 || this.shelfBodies.length > 0 || this.slots.length > 0) {
      this.clearLabels();
      for (const mesh of this.shelfMeshes) this.scene.remove(mesh);
      for (const body of this.shelfBodies) {
        try {
          this.physicsWorld.removeBody(body);
        } catch {}
      }
      this.shelfMeshes = [];
      this.shelfBodies = [];
      this.slots = [];
      this.shelfData = [];
      this.shelfLabels = [];
      this.shelfGlows = [];
      this.categoryGlowMeshes = [];
      this.labelMeshes = [];
      this.animatingCases = [];
      this.targetHomeGlowIndices = [];
    }
    this.woodMat = new T.MeshStandardMaterial({
      color: 0x5c3a1e,
      roughness: 0.9,
      metalness: 0
    });
    this.darkWoodMat = new T.MeshStandardMaterial({
      color: 0x4a2e14,
      roughness: 0.9,
      metalness: 0
    });
    const woodMat = this.woodMat;
    const darkWoodMat = this.darkWoodMat;
    for (let s = 0; s < ALL_GENRES.length; s++) {
      const genre = ALL_GENRES[s];
      const sp = SHELF_POSITIONS[s];
      const sx = sp.x;
      const sz = sp.z;
      const rotY = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
      const back = new T.Mesh(new T.BoxGeometry(0.05, SHELF_HEIGHT, SHELF_DEPTH), darkWoodMat);
      back.position.set(sx, SHELF_HEIGHT / 2, sz);
      back.userData.title = genre + " Shelf";
      this.scene.add(back);
      this.shelfMeshes.push(back);
      for (const zSign of [-1, 1]) {
        const side = new T.Mesh(new T.BoxGeometry(SHELF_WIDTH, SHELF_HEIGHT, 0.05), woodMat);
        side.position.set(sx, SHELF_HEIGHT / 2, sz + (zSign * SHELF_DEPTH) / 2);
        side.userData.title = genre + " Shelf";
        this.scene.add(side);
        this.shelfMeshes.push(side);
        const sideBody = new CANNON.Body({ mass: 0 });
        sideBody.addShape(new CANNON.Box(new CANNON.Vec3(SHELF_WIDTH / 2, SHELF_HEIGHT / 2, 0.025)));
        sideBody.position.set(sx, SHELF_HEIGHT / 2, sz + (zSign * SHELF_DEPTH) / 2);
        this.physicsWorld.addBody(sideBody);
        this.shelfBodies.push(sideBody);
      }
      const backBody = new CANNON.Body({ mass: 0 });
      backBody.addShape(new CANNON.Box(new CANNON.Vec3(0.025, SHELF_HEIGHT / 2, SHELF_DEPTH / 2)));
      backBody.position.set(sx, SHELF_HEIGHT / 2, sz);
      this.physicsWorld.addBody(backBody);
      this.shelfBodies.push(backBody);
      for (const y of SHELF_Y_LEVELS) {
        const plank = new T.Mesh(new T.BoxGeometry(SHELF_WIDTH, PLANK_THICKNESS, SHELF_DEPTH), woodMat);
        plank.position.set(sx, y, sz);
        plank.userData.title = genre + " Shelf";
        this.scene.add(plank);
        this.shelfMeshes.push(plank);
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(new CANNON.Box(new CANNON.Vec3(SHELF_WIDTH / 2, PLANK_THICKNESS / 2, SHELF_DEPTH / 2)));
        body.position.set(sx, y, sz);
        this.physicsWorld.addBody(body);
        this.shelfBodies.push(body);
      }
      const innerEdge = sx < 0 ? sx + SHELF_WIDTH / 2 : sx - SHELF_WIDTH / 2;
      const slotXs =
        sx < 0
          ? [innerEdge - 0.02, innerEdge - 0.08, innerEdge - 0.14]
          : [innerEdge + 0.02, innerEdge + 0.08, innerEdge + 0.14];
      const genreInfo = GENRES[genre];
      const labelColor = genreInfo ? genreInfo.color : 0x44cc88;
      const labelY = SHELF_Y_LEVELS[2] + 0.3;
      const labelX = sx < 0 ? sx + SHELF_WIDTH / 2 + 0.005 : sx - SHELF_WIDTH / 2 - 0.005;
      const labelPos = new T.Vector3(labelX, labelY, sz);
      const shelfIndex = this.shelfData.length;
      this.shelfData.push({
        x: sx,
        z: sz,
        genre: genre,
        type: "shelf",
        rotY: rotY,
        label: null,
        labelColor: labelColor,
        homeType: null,
        homeTypes: null,
        labelPos: labelPos,
        faceDir: new T.Vector3(Math.cos(rotY), 0, -Math.sin(rotY)).normalize()
      });
      for (const shelfY of SHELF_Y_LEVELS) {
        for (const slotX of slotXs) {
          const pos = new T.Vector3(slotX, shelfY + SLOT_Y_OFFSET, sz + SLOT_Z_OFFSET);
          this.slots.push({
            position: pos,
            basePosition: pos.clone(),
            occupied: false,
            gameCase: null,
            shelfY,
            index: this.slots.length,
            genre: genre,
            homeType: null,
            homeTypes: null,
            shelfIndex: shelfIndex,
            rotY: rotY,
            bookRotY: rotY
          });
        }
      }
    }
  }

  rebuildForMap(mapId, savedShelves) {
    this.build(savedShelves || this.savedShelves || {}, mapId);
    if (this.gameMode) this.createLabels();
  }

  getNearestEmptySlot(pos) {
    let best = null;
    let bestDist = Infinity;
    for (const slot of this.slots) {
      if (slot.occupied) continue;
      const dist = pos.distanceTo(slot.position);
      if (dist < bestDist) {
        bestDist = dist;
        best = slot;
      }
    }
    return bestDist < 0.7 ? best : null;
  }

  getSlotByCase(gameCase) {
    for (const slot of this.slots) {
      if (slot.gameCase === gameCase) return slot;
    }
    return null;
  }

  isCaseShelved(gameCase) {
    return this.getSlotByCase(gameCase) !== null;
  }

  getSlotByIndex(index) {
    return this.slots[index] || null;
  }

  getShelfAssignments() {
    const assignments = {};
    for (const slot of this.slots) {
      if (slot.occupied && slot.gameCase) {
        assignments[slot.gameCase.gameId] = slot.index;
      }
    }
    return assignments;
  }

  shelveCase(gameCase, slot) {
    slot.occupied = true;
    slot.gameCase = gameCase;
    const quat = new this.THREE.Quaternion();
    const rot = slot.bookRotY != null ? slot.bookRotY : slot.rotY != null ? slot.rotY : Math.PI / 2;
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), rot);
    this.animatingCases.push({
      gameCase,
      slot,
      startPos: gameCase.mesh.position.clone(),
      startQuat: gameCase.mesh.quaternion.clone(),
      targetPos: slot.position.clone(),
      targetQuat: quat,
      progress: 0,
      duration: 0.35
    });
    gameCase.grabbed = false;
    gameCase.body.type = CANNON.Body.KINEMATIC;
    gameCase.shelved = true;
    gameCase.shelvedAt = slot.index;
  }

  popCaseFromSlot(gameCase) {
    const slot = this.getSlotByCase(gameCase);
    if (!slot) return false;
    slot.occupied = false;
    slot.gameCase = null;
    gameCase.body.type = CANNON.Body.DYNAMIC;
    gameCase.shelved = false;
    gameCase.shelvedAt = null;
    if (gameCase.dynamicMass) {
      gameCase.body.mass = gameCase.dynamicMass;
    }
    gameCase.body.updateMassProperties();
    gameCase.body.allowSleep = true;
    gameCase.body.wakeUp();
    return true;
  }

  placeCaseIntoSlot(gameCase, slot) {
    slot.occupied = true;
    slot.gameCase = gameCase;
    const quat = new this.THREE.Quaternion();
    const rot = slot.bookRotY != null ? slot.bookRotY : slot.rotY != null ? slot.rotY : Math.PI / 2;
    quat.setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), rot);
    gameCase.mesh.position.copy(slot.position);
    gameCase.mesh.quaternion.copy(quat);
    gameCase.body.position.set(slot.position.x, slot.position.y, slot.position.z);
    gameCase.body.quaternion.set(quat.x, quat.y, quat.z, quat.w);
    gameCase.body.type = CANNON.Body.KINEMATIC;
    gameCase.body.velocity.set(0, 0, 0);
    gameCase.body.angularVelocity.set(0, 0, 0);
    gameCase.grabbed = false;
    gameCase.shelved = true;
    gameCase.shelvedAt = slot.index;
    if (gameCase.pos) gameCase.pos.copy(slot.position);
  }

  clearAllSlots() {
    for (const slot of this.slots) {
      if (slot.occupied) {
        slot.occupied = false;
        slot.gameCase = null;
      }
    }
  }

  update(delta) {
    if (this.movingShelvesEnabled) {
      const now = performance.now();
      for (let s = 0; s < this.shelfData.length; s++) {
        const container = this.shelfData[s];
        if (Math.abs(container.rotY % Math.PI) > 1e-6) continue;
        const offset = Math.sin(now / 900 + s * 1.7) * 0.06;
        for (const slot of this.slots) {
          if (slot.shelfIndex === s) {
            slot.position.x = slot.basePosition.x + offset;
          }
        }
        const labels = this.shelfLabels[s] || [];
        for (const mesh of labels) {
          if (mesh.userData.basePos) {
            mesh.position.x = mesh.userData.basePos.x + offset;
          }
        }
        const glows = this.shelfGlows[s] || [];
        for (const mesh of glows) {
          if (mesh.userData.basePos) {
            mesh.position.x = mesh.userData.basePos.x + offset;
          }
        }
      }
    }
    for (let i = this.animatingCases.length - 1; i >= 0; i--) {
      const anim = this.animatingCases[i];
      anim.progress += delta / anim.duration;
      if (anim.progress >= 1) {
        anim.gameCase.mesh.position.copy(anim.targetPos);
        anim.gameCase.mesh.quaternion.copy(anim.targetQuat);
        anim.gameCase.mesh.position.copy(anim.targetPos);
        anim.gameCase.body.position.set(anim.targetPos.x, anim.targetPos.y, anim.targetPos.z);
        anim.gameCase.body.quaternion.set(anim.targetQuat.x, anim.targetQuat.y, anim.targetQuat.z, anim.targetQuat.w);
        this.animatingCases.splice(i, 1);
      } else {
        const t = easeOutCubic(anim.progress);
        anim.gameCase.mesh.position.lerpVectors(anim.startPos, anim.targetPos, t);
        anim.gameCase.mesh.quaternion.slerpQuaternions(anim.startQuat, anim.targetQuat, t);
        anim.gameCase.pos.copy(anim.gameCase.mesh.position);
        anim.gameCase.body.position.set(
          anim.gameCase.mesh.position.x,
          anim.gameCase.mesh.position.y,
          anim.gameCase.mesh.position.z
        );
      }
    }
  }

  destroy() {
    this.clearLabels();
    for (const mesh of this.shelfMeshes) {
      this.scene.remove(mesh);
    }
    for (const body of this.shelfBodies) {
      try {
        this.physicsWorld.removeBody(body);
      } catch {}
    }
    this.shelfMeshes = [];
    this.shelfBodies = [];
    this.slots = [];
    this.shelfData = [];
    this.animatingCases = [];
  }
}
