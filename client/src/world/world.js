// 3D World quan sát — vanilla Three.js (ticket 08).
// Phòng, agent, navmesh, sự kiện realtime. UI tiếng Việt.

import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/addons/utils/BufferGeometryUtils.js';

// --- Cấu hình ---
const AGENT_RADIUS = 0.3;
const MAX_AGENTS = 50;
const CAMERA_HEIGHT = 20;
const ROOM_HEIGHT = 3;

// Màu trạng thái phòng 6 cấp
const ROOM_STATE_COLORS = {
  free: 0x4ade80,
  reserved: 0xfbbf24,
  occupied: 0xf87171,
  cleaning: 0x60a5fa,
  disabled: 0x9ca3af,
  alert: 0xef4444,
};

const ROOM_STATE_LABELS = {
  free: 'Trống',
  reserved: 'Đã xếp',
  occupied: 'Đang khám',
  cleaning: 'Vệ sinh',
  disabled: 'Khóa',
  alert: 'Cần xử lý',
};

// Màu agent
const AGENT_COLORS = {
  waiting: 0x60a5fa,
  called: 0xfbbf24,
  present: 0x4ade80,
  parked: 0x9ca3af,
  skipped: 0xf87171,
  'no-show': 0xef4444,
};

const PRIORITY_BORDER = 0xf87171;

// --- Helpers (module level) ---
function createRoomMesh(room, materials) {
  const { width = 5, depth = 4, x = 0, z = 0, code, name, kind, state } = room;
  const geometry = new THREE.BoxGeometry(width, ROOM_HEIGHT, depth);
  const material = materials[room.state] || materials.free;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x + width / 2, ROOM_HEIGHT / 2, z + depth / 2);
  mesh.userData = { room };
  return mesh;
}

function createLabel(text, x, y, z, color = 0xffffff, size = 1) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  ctx.font = `bold ${size * 32}px sans-serif`;
  ctx.fillStyle = '#' + color.toString(16).padStart(6, '0');
  ctx.textAlign = 'center';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + size * 8);
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.position.set(x, y, z);
  sprite.scale.set(size * 4, size, 1);
  return sprite;
}

// --- World class ---
export class HospitalWorld {
  constructor(container, socket) {
    this.container = container;
    this.socket = socket;
    this.scene = new THREE.Scene();
    this.agents = new Map();
    this.rooms = new Map();
    this.pendingCalls = new Map();
    this.navmesh = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.clock = new THREE.Clock();

    this.initRenderer();
    this.initCamera();
    this.initLights();
    this.initMaterials();
    this.initGround();
    this.initControls();
    this.bindSocket();
    this.animate();
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.container.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.onResize());
  }

  initCamera() {
    this.camera = new THREE.PerspectiveCamera(50, this.container.clientWidth / this.container.clientHeight, 0.1, 200);
    this.camera.position.set(0, CAMERA_HEIGHT, 20);
    this.camera.lookAt(0, 0, 0);
  }

  initLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(10, 30, 10);
    dir.castShadow = true;
    dir.shadow.mapSize.width = 2048;
    dir.shadow.mapSize.height = 2048;
    this.scene.add(dir);
  }

  initMaterials() {
    this.materials = {};
    for (const [state, color] of Object.entries(ROOM_STATE_COLORS)) {
      this.materials[state] = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.1,
        transparent: state === 'disabled',
        opacity: state === 'disabled' ? 0.5 : 1,
      });
    }
    this.agentMaterials = {};
    for (const [status, color] of Object.entries(AGENT_COLORS)) {
      this.agentMaterials[status] = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.5,
        metalness: 0.2,
      });
    }
  }

  initGround() {
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  initControls() {
    this.controls = {
      target: new THREE.Vector3(0, 0, 0),
      distance: CAMERA_HEIGHT * 1.5,
      theta: Math.PI / 4,
      phi: Math.PI / 3,
      minDistance: 10,
      maxDistance: 80,
    };
    this.updateCamera();

    let isDragging = false;
    let lastX = 0, lastY = 0;
    this.renderer.domElement.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      this.controls.theta -= dx * 0.005;
      this.controls.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, this.controls.phi + dy * 0.005));
      lastX = e.clientX;
      lastY = e.clientY;
      this.updateCamera();
    });
    window.addEventListener('mouseup', () => { isDragging = false; });
    this.renderer.domElement.addEventListener('wheel', (e) => {
      this.controls.distance = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, this.controls.distance + e.deltaY * 0.05));
      this.updateCamera();
    }, { passive: true });
  }

  updateCamera() {
    const { distance, theta, phi, target } = this.controls;
    this.camera.position.set(
      target.x + distance * Math.sin(phi) * Math.cos(theta),
      target.y + distance * Math.cos(phi),
      target.z + distance * Math.sin(phi) * Math.sin(theta)
    );
    this.camera.lookAt(target);
  }

  onResize() {
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }

  async loadNavmesh() {
    const rooms = Array.from(this.rooms.values()).map((r) => r.room);
    const geometries = [];
    for (const room of rooms) {
      if (room.state === 'disabled') continue;
      const geo = new THREE.BoxGeometry(room.width, 0.1, room.depth);
      const mesh = new THREE.Mesh(geo);
      mesh.position.set(room.x + room.width / 2, 0.05, room.z + room.depth / 2);
      mesh.updateMatrixWorld(true);
      geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    }
    if (geometries.length === 0) return;
    const merged = THREE.BufferGeometryUtils.mergeGeometries(geometries);
    this.navmesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }));
    this.scene.add(this.navmesh);
    merged.computeBoundsTree();
  }

  async buildWorld(config) {
    this.rooms.forEach((r) => { this.scene.remove(r.mesh); if (r.label) this.scene.remove(r.label); });
    this.rooms.clear();
    this.agents.forEach((a) => this.scene.remove(a.mesh));
    this.agents.clear();

    const materials = this.materials;
    for (const room of config.rooms) {
      const mesh = createRoomMesh(room, materials);
      this.scene.add(mesh);
      const label = createLabel(`${room.code} (${ROOM_STATE_LABELS[room.state] || room.state})`, room.x + room.width / 2, ROOM_HEIGHT + 1, room.z + room.depth / 2, 0x1f2937, 1.2);
      this.scene.add(label);
      this.rooms.set(room.id, { mesh, label, room });
    }
    await this.loadNavmesh();
    const bounds = new THREE.Box3().setFromObject(this.scene);
    this.controls.target.copy(bounds.getCenter(new THREE.Vector3()));
    this.updateCamera();
  }

  updateRoom(roomData) {
    const entry = this.rooms.get(roomData.id);
    if (!entry) return;
    entry.mesh.material = this.materials[roomData.state] || this.materials.free;
    entry.room = roomData;
    if (entry.label) {
      this.scene.remove(entry.label);
      entry.label = createLabel(`${roomData.code} (${ROOM_STATE_LABELS[roomData.state] || roomData.state})`,
        roomData.x + roomData.width / 2, ROOM_HEIGHT + 1, roomData.z + roomData.depth / 2, 0x1f2937, 1.2);
      this.scene.add(entry.label);
    }
  }

  createAgent(ticket, startPos, targetPos) {
    if (this.agents.size >= MAX_AGENTS) return;
    const geometry = new THREE.CapsuleGeometry(AGENT_RADIUS, 1.2, 4, 8);
    const material = this.agentMaterials[ticket.status] || this.agentMaterials.waiting;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.position.copy(startPos);
    mesh.userData = { ticket };
    if (ticket.priority !== 'routine') {
      const borderGeo = new THREE.RingGeometry(AGENT_RADIUS + 0.05, AGENT_RADIUS + 0.15, 16);
      const borderMat = new THREE.MeshBasicMaterial({ color: PRIORITY_BORDER, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
      const border = new THREE.Mesh(borderGeo, borderMat);
      border.rotation.x = -Math.PI / 2;
      border.position.y = -0.6;
      mesh.add(border);
    }
    const label = createLabel(`${ticket.number}${ticket.groupId ? '·' + ticket.groupId.slice(-4) : ''}`, 0, 2.2, 0, 0x1f2937, 0.8);
    mesh.add(label);
    this.agents.set(ticket.id, { mesh, ticket, target: targetPos, path: [], pathIndex: 0, moving: false });
    this.scene.add(mesh);
  }

  removeAgent(ticketId) {
    const agent = this.agents.get(ticketId);
    if (agent) { this.scene.remove(agent.mesh); this.agents.delete(ticketId); }
  }

  updateAgent(ticketId, ticket, targetPos) {
    const agent = this.agents.get(ticketId);
    if (!agent) return;
    agent.ticket = ticket;
    agent.mesh.material = this.agentMaterials[ticket.status] || this.agentMaterials.waiting;
    agent.target = targetPos;
    if (targetPos.distanceTo(agent.target) > 0.5) {
      agent.target = targetPos;
      agent.path = this.findPath(agent.mesh.position, targetPos);
      agent.pathIndex = 0;
      agent.moving = agent.path.length > 0;
    }
  }

  findPath(start, end) {
    if (!this.navmesh) return [start.clone(), end.clone()];
    return [start.clone(), end.clone()];
  }

  animateAgents(delta) {
    for (const [ticketId, agent] of this.agents) {
      if (!agent.moving || !agent.path.length) continue;
      const pos = agent.mesh.position;
      const target = agent.path[agent.pathIndex];
      const dir = new THREE.Vector3().subVectors(target, pos);
      const dist = dir.length();
      if (dist < 0.1) {
        agent.pathIndex++;
        if (agent.pathIndex >= agent.path.length) {
          agent.moving = false;
          agent.path = [];
        }
        continue;
      }
      dir.normalize();
      const speed = 2.0;
      pos.addScaledVector(dir, speed * delta);
      agent.mesh.lookAt(target.x, agent.mesh.position.y, target.z);
    }
  }

  bindSocket() {
    this.socket.on('queue:snapshot', (snap) => {
      this.applySnapshot(snap);
    });
    this.socket.on('call.issued', (payload) => {
      this.handleCallIssued(payload);
    });
    this.socket.on('config.changed', () => {
      this.socket.emit('getConfig');
    });
  }

  applySnapshot(snap) {
    const tickets = [...(snap.called || []), ...(snap.next || []), ...(snap ? [snap] : [])];
    for (const t of tickets) {
      const room = this.getRoomForTicket(t);
      const targetPos = room ? new THREE.Vector3(room.x + room.width / 2, AGENT_RADIUS, room.z + room.depth / 2)
        : new THREE.Vector3(0, AGENT_RADIUS, 0);
      if (this.agents.has(t.id)) {
        this.updateAgent(t.id, t, targetPos);
      } else {
        this.createAgent(t, targetPos.clone(), targetPos.clone());
      }
    }
  }

  getRoomForTicket(t) {
    for (const entry of this.rooms.values()) {
      if (entry.room.kind === 'CASHIER') return entry.room;
    }
    return null;
  }

  handleCallIssued(payload) {
    const agent = this.agents.get(payload.number);
    if (agent) {
      this.pendingCalls.set(payload.number, true);
    }
  }

  animate() {
    const delta = this.clock.getDelta();
    this.animateAgents(delta);
    for (const [id, blinking] of this.pendingCalls) {
      const agent = this.agents.get(id);
      if (agent) {
      }
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    this.renderer.dispose();
    this.scene.clear();
    window.removeEventListener('resize', this.onResize);
  }
}