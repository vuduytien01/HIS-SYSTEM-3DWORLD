# Báo cáo nghiên cứu tham khảo — Hệ thống điều phối quy trình khám bệnh

*Ngày tổng hợp: 2026-11-22. Nguồn: 4 agent nghiên cứu song song dùng Context7, Exa, Brave Search, Firecrawl trên GitHub, HuggingFace, arXiv, docs chính thức. Phần 4 (FHIR) đang được bổ sung.*

Mục tiêu hệ thống. Điều phối quy trình khám bệnh với 3 vai trò: bệnh nhân (đặt lịch, xem trạng thái realtime), lễ tân (quan sát 3D world realtime để điều phối manual, kéo thả đại diện bệnh nhân vào phòng), admin (bảo trì, phát triển, cấu hình luồng khám).

---

## Phần 1. Nghiên cứu học thuật (arXiv và tạp chí)

Mọi bài dưới đây được trả về trực tiếp từ công cụ tìm kiếm trong phiên này, không bài nào bịa thêm.

### Nhánh A. Crowd simulation và chuyển động nhân vật trong 3D

1. **Emergent Crowds Dynamics from Language-Driven Multi-Agent Interactions** (arXiv:2508.15047, 2025). https://arxiv.org/abs/2508.15047 — Crowd agent-based, hành vi xã hội nảy sinh từ tương tác agent với môi trường. Áp: bệnh nhân trong 3D world di chuyển có chủ đích (đến quầy, chờ, vào phòng) thay vì steering thuần.
2. **RESCUE: Crowd Evacuation Simulation via Controlling SDM-United Characters** (arXiv:2507.20117, 2025). https://arxiv.org/abs/2507.20117 — Vòng lặp Cảm nhận, Quyết định, Vận động cho từng agent, Social Force Model thích ứng 3D. Áp: cấu trúc trực tiếp dùng được cho agent bệnh nhân, gồm cả phòng chờ đông.
3. **TravelAgent: Generative Agents in the Built Environment** (arXiv:2412.18985, 2024, MIT Media Lab). https://arxiv.org/abs/2412.18985 — Generative agents nhúng trong môi trường 3D mô hình hóa di chuyển trong không gian xây dựng. Áp: tham chiếu hành vi di chuyển trong nhà.

### Nhánh B. Hospital patient flow, OPD orchestration, queueing theory

4. **Agentic AI for Clinical Urgency Mapping and Queue Optimization in High-Volume Outpatient Departments** (arXiv:2604.00215, 2026). https://arxiv.org/abs/2604.00215 — Gán bác sĩ theo tải, hàng chờ thích ứng, orchestrator đa mục tiêu, đánh giá bằng DES 368 bệnh nhân. Áp: thiết kế logic "gọi ai tiếp theo" thay FCFS cứng.
5. **Walk-In Multi-Stage Patient Flow Scheduling: An ASP Model with DES-Based Evaluation** (arXiv:2607.21198, 2026, dữ liệu bệnh viện Việt Nam). https://arxiv.org/html/2607.21198 — Lịch trình phản ứng cho walk-in qua nhiều phòng, chi phí gồm thời gian di chuyển + thời gian chờ theo trọng số. Áp: đúng bài toán chọn phòng và thứ tự khám.
6. **A High-fidelity, Machine-learning Enhanced Queueing Network Simulation Model for Hospital Ultrasound Operations** (arXiv:2104.07451, 2021). https://arxiv.org/abs/2104.07451 — Định tuyến hai tầng: chọn nhóm phòng theo loại xét nghiệm, chọn phòng cụ thể theo queue length. Áp: tách yếu tố y tế khỏi yếu tố vận hành khi chọn phòng.
7. **Outpatient Diversion using Real-time Length-of-Stay Predictions** (arXiv:2112.03761, 2021). https://ar5iv.labs.arxiv.org/html/2112.03761 — Dự đoán thời gian lưu realtime, chuyển bệnh nhân sang nơi ít đông. Áp: gợi ý điều phối theo độ tắc từng subsystem.

### Nhánh C. Digital twin hospital và hiển thị realtime

8. **HospiT'Win** (DigitalTwin, 2022). https://doi.org/10.12688/digitaltwin.17454.1 — DES chạy song song thế giới thực, hai lớp DT Monitoring và DT Predicting. Áp: kiến trúc hai lớp hiển thị hiện tại và dự báo cho màn hình lễ tân.
9. **An Agent-Based Architecture of the Digital Twin for an Emergency Department** (Sustainability, MDPI, 2023). https://www.mdpi.com/2071-1050/15/4/3412 — Ba chế độ: Digital Shadow (giám sát realtime), Synchronised DT (dự đoán), Exploratory DT (what-if). Áp: lộ trình phát triển tính năng màn hình lễ tân.
10. **BedreFlyt: Improving Patient Flows through Hospital Wards with Digital Twins** (arXiv:2505.06287, 2025). https://arxiv.org/abs/2505.06287 — Twin cho luồng bệnh nhân với agent-based simulation và planner. Áp: nối twin với dữ liệu backend thật.
11. Bổ sung. **Bridging Service Design, Visualizations, and Visual Analytics in Healthcare Digital Twins** (arXiv:2506.24104, 2025). https://arxiv.org/abs/2506.24104 — Khoảng trống thiết kế dịch vụ vs trực quan hóa. Áp: thiết kế trải nghiệm màn hình lễ tân.

### Insight học thuật cho thiết kế

1. Mỗi bệnh nhân là một state machine có chu trình cảm nhận, quyết định, vận động. Backend giữ trạng thái, 3D world chỉ render.
2. Chọn phòng tách hai tầng: y tế quyết nhóm phòng, vận hành quyết phòng cụ thể theo queue length và room availability. Chi phí = thời gian di chuyển + thời gian chờ theo trọng số. Thứ tự gọi điều chỉnh theo mức khẩn, không FCFS cứng.
3. Màn hình lễ tân theo lộ trình digital twin: Digital Shadow trước (trạng thái thật), rồi overlay dự báo (thời gian chờ, phòng trống tiếp theo) sau khi twin được kiểm chứng.

---

## Phần 2. Kiến trúc realtime cho queue orchestration

Nguồn chính: docs chính thức qua Context7 (Socket.io `/socketio/socket.io`, Next.js `/vercel/next.js`, XState `/statelyai/xstate`, Zustand `/pmndrs/zustand`, React Three Fiber `/pmndrs/react-three-fiber`, Prisma `/websites/prisma_io`) và web thực chiến.

### 2.1 Socket.io cùng Next.js App Router

Kết luận chính thức. Route Handler của App Router không host được WebSocket, phải dùng custom server. App Router hoạt động theo mô hình request-response, không có `res` để gọi `handleUpgrade()`.

```js
// server.js — nguồn: Next.js docs custom-server.mdx + Socket.io how-to use-with-nextjs
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const app = next({ dev: process.env.NODE_ENV !== "production" });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);
  const io = new Server(httpServer);
  io.on("connection", (socket) => { /* ... */ });
  httpServer.listen(3000);
});
```

- package.json: `"dev": "node server.js"`, `"start": "NODE_ENV=production node server.js"`.
- Custom server không dùng được với `output: "standalone"`, không deploy lên Vercel (không hỗ trợ WebSocket). Phải self-host (VPS/Docker).
- Broadcast chuẩn: `io.emit`, `io.to(room).emit`, `socket.broadcast.to(room).emit`, `io.to(socketId).emit`.
- Heartbeat Engine.IO v4: server ping theo `pingInterval`, client trả pong trong `pingTimeout` (mặc định 25s/20s).
- Reconnect client có sẵn: backoff lũy tiến có jitter, delay 1000ms đến 5000ms, không tự viết lại.
- Connection state recovery phải bật tường minh: `connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 }`. Sau reconnect thành công `socket.recovered === true`, packet lỡ được gửi lại. Recovery không luôn thành công (server restart mất) nên cần đường dự phòng: xin lại nguyên snapshot.

### 2.2 State machine cho lượt khám

Bảng transition đề xuất (thiết kế tổng hợp từ pattern clinic thực tế: clinicQ issue 41, sauti PR 75, MyClinic, cliniqai):

| Từ | Event | Đến |
|---|---|---|
| registered | CHECK_IN | checked_in |
| checked_in | ENQUEUE | waiting |
| waiting | CALL | in_consultation |
| waiting | NO_SHOW | no_show |
| in_consultation | ORDER_DIAGNOSTICS | diagnostics |
| diagnostics | UPLOAD_RESULTS | results |
| results | REVIEW | in_consultation |
| in_consultation | REQUEST_PAYMENT | payment |
| payment | SETTLE | done |
| registered, checked_in, waiting, diagnostics, results, payment | CANCEL | cancelled |
| in_consultation | CANCEL | không cho phép |
| done, cancelled, no_show | (không transition) | trạng thái kết thúc |

- `diagnostics` và `results` là vòng phụ tùy chọn, bác sĩ đi thẳng `in_consultation → payment` nếu không cần xét nghiệm (event `SKIP_DIAGNOSTICS` hoặc guard).
- Thực thi: source of truth ở server. Một bảng transition thuần `Record<VisitStatus, VisitStatus[]>` validate trước khi ghi DB, kèm test cấm mọi đường ghi status ngoài hàm transition. Client dùng xstate chỉ để hiển thị nếu cần. Với quy mô này bảng transition nhỏ hơn và đủ.

### 2.3 Đồng bộ trạng thái vào scene 3D (zustand + R3F)

- Zustand dùng được ngoài React: `getState()`, `setState()`, `subscribe`, middleware `subscribeWithSelector`. Từ v5 selector so sánh `Object.is`, bọc `useShallow` khi trả object mới.
- Quy tắc chính thức R3F: không bind state thay đổi nhanh vào JSX reactive. Đọc trong `useFrame`:

```jsx
useFrame(() => (ref.current.position.x = store.getState().x));
return <mesh ref={ref} />;
```

Các bước tích hợp:
1. Socket client là singleton module-level, file `"use client"`: `export const socket = io({ autoConnect: false })`.
2. Listener đăng ký một lần ở cấp Provider, không đăng ký trong component lá. Cleanup `socket.off` đúng hàm đã đăng ký.
3. Handler socket ghi thẳng store ngoài React: `socket.on("queue:updated", (p) => useQueueStore.getState().applyDelta(p))`.
4. Component subscribe slice hẹp nhất. Event mang đủ dữ liệu thì ghi thẳng, event chỉ báo hiệu thì invalidate và refetch.
5. Trong Canvas 3D, vị trí bệnh nhân di chuyển liên tục cập nhật bằng ref trong `useFrame`, không qua React state. Chỉ thay đổi rời rạc (được gọi vào phòng) mới qua subscribe/selector.

### 2.4 Prisma + SQLite chống race

SQLite không có row lock, không có `FOR UPDATE / SKIP LOCKED`, một writer tại một thời điểm. Ba lớp phòng chống:

1. **Kết nối đơn lối.** `DATABASE_URL` gắn `connection_limit=1&socket_timeout=10`. Bật WAL mode để reader không bị writer chặn.
2. **Optimistic concurrency bằng conditional updateMany** (Prisma 5/6: `updateMany` trả `{ count }`):

```ts
const res = await prisma.visit.updateMany({
  where: { id, status: "WAITING", version: current.version },
  data: { status: "IN_CONSULTATION", roomId, version: { increment: 1 } },
});
if (res.count === 0) throw new ConflictError();
```

3. **Interactive transaction cho đa bước**, ngắn và có retry. Không emit socket bên trong transaction. Commit xong rồi mới emit.

- Queue query: `findMany` theo ngày, `orderBy: { queueNumber: "asc" }`. Số queue đếm theo ngày, reset lúc nửa đêm địa phương.

### 2.5 Khuyến nghị kiến trúc realtime (tổng hợp)

- Custom server `server.js`, một process Node duy nhất chứa Next.js + Socket.io, self-host Docker/VPS. Một process + SQLite = không cần Redis adapter hay sticky session ở quy mô này. Bật connection state recovery 2 phút.
- Room: bệnh nhân `visit:<visitId>`, lễ tân + dashboard `floor:<floorId>`, admin thêm `admin:ops`. Broadcast delta theo room, không emit global.
- Expose `io` cho Route Handler/Server Action qua module getter ghi vào `globalThis` từ server.js. Commit Prisma xong mới emit.
- Event names và payload đề xuất:

```ts
// Client → Server
"queue:join"       { floorId }
"visit:transition" { visitId, to: VisitStatus }
"queue:assign"     { visitId, roomId }
"snapshot:request" {}

// Server → Client
"queue:snapshot"   { seq, visits: VisitSnapshot[], rooms: RoomSnapshot[] }
"visit:updated"    { seq, visitId, status, roomId?, queueNumber, at }
"queue:updated"    { seq, floorId, deltas: VisitDelta[] }
"presence:count"   { floorId, patients: number, staff: number }
```

- Mỗi event mang `seq` tăng dần để client phát hiện gap và xin snapshot. Event điều khiển dùng acknowledgement callback trả `{ ok, error: "INVALID_TRANSITION" | "CONFLICT" }` để UI báo lỗi ngay tại chỗ thả.
- Dòng dữ liệu: event vào → validate transition table → Prisma ghi (connection_limit=1, conditional updateMany) → emit vào room → client ghi zustand qua `getState()` → UI 2D subscribe selector hẹp, scene 3D đọc `getState()` trong `useFrame`. Reconnect: ưu tiên recovery, thất bại thì `snapshot:request`.

---

## Phần 3. React Three Fiber cho 3D world bệnh viện

### 3.1 Tài nguyên đã xác minh (scrape trực tiếp)

1. **pmndrs/racing-game** (https://github.com/pmndrs/racing-game, 2.2k sao, MIT, demo https://racing.pmnd.rs/). Zustand cho trạng thái React + object `mutation` bị mutate trực tiếp mỗi frame cho dữ liệu per-frame; `instancedMesh` với `setMatrixAt`. Áp: pattern nền cho store scene.
2. **devYRPauli/crowd** (https://github.com/devYRPauli/crowd, MIT, demo https://devyrpauli.github.io/crowd/). Simulator đám đông trong browser: Route (flow field Fast Marching), Avoid (ORCA port RVO2), Act (state machine per person: đi, xếp hàng, được phục vụ, ngồi, rời). Cảnh báo: người chỉ join hàng đợi khi chạm tới cuối hàng, không gán slot trước. Sim chạy Web Worker, stream frame bằng transferable buffers. Áp: map gần 1-1 sang bệnh viện — quầy lễ tân = service point, khu chờ = seating area, bệnh nhân = agent có itinerary.
3. **isaac-mason/recast-navigation-js** (https://github.com/isaac-mason/recast-navigation-js, v0.44.0 tháng 10/2026). WASM Recast/Detour: `Crowd` với `addAgent`, `agent.requestMoveTarget(position)`, separation, `interpolatedPosition` mượt mỗi frame. Navmesh generate runtime hoặc offline. Package `@recast-navigation/three`. Áp: bệnh nhân đi bộ giữa các điểm, kéo thả vào phòng chỉ là `requestMoveTarget`, agent tự né nhau.
4. **wass08/r3f-sims-online** (https://github.com/wass08/r3f-sims-online) + tutorial https://wawasensei.dev/tuto/build-a-multiplayer-game-with-react-three-fiber-and-socket-io. Sims-like online, Socket.io đồng bộ vị trí avatar, click-to-move, animation theo trạng thái. Áp: mô hình 3 vai trò nhìn cùng một world.
5. **colyseus/react-racing-game** (https://github.com/colyseus/react-racing-game, docs sync https://github.com/colyseus/react-racing-game/blob/main/MULTIPLAYER.md). Server schema state broadcast khi field đổi; client đọc schema trong `useFrame` set vị trí trực tiếp không qua React state; spawner dùng `onAdd`/`onRemove`. Áp: blueprint sync backend vào scene 3D.
6. **R3F Events docs** (https://r3f.docs.pmnd.rs/api/events). `onClick`, `onPointerDown/Move`, `onPointerMissed`; event chứa `point`, `object`, `delta` (px giữa down/up, phân biệt click với drag); `stopPropagation()`; `setPointerCapture`. Áp: nền cho mọi tương tác pick và kéo thả của lễ tân.
7. **drei DragControls** (https://drei.docs.pmnd.rs/gizmos/drag-controls). Props `axisLock`, `dragLimits`, callbacks `onDragStart`/`onDrag`/`onDragEnd`. Áp: gesture kéo thả, nhưng nguồn sự thật vị trí vẫn là backend, `onDragEnd` mới commit.

### 3.2 Tài nguyên đọc qua kết quả tìm kiếm (chưa scrape nguyên trang)

8. **ibeeeees/wow-sweet** (https://github.com/ibeeeees/wow-sweet). 10.000+ agent trong R3F: state machine per agent, spatial hash grid ô 4.0, 10 InstancedMesh (một per body part) với `setMatrixAt` mỗi frame. Áp: proof quy mô, pattern instancing.
9. **ssethsara/react-three-npc** (https://github.com/ssethsara/react-three-npc, npm v1.2.7). NPC cho R3F dựa Yuka.js, load navmesh .glb. Áp: lựa chọn có sẵn nếu không muốn tự dựng crowd engine; yếu điểm là ít cập nhật.
10. **donmccurdy/three-pathfinding** (https://github.com/donmccurdy/three-pathfinding). Pathfinding trên navmesh tĩnh, cần navmesh ngoài. Áp: phương án gọn nếu không cần agent né nhau runtime. Example kết hợp với recast-navigation: examples/src/example-three-pathfinding.tsx.
11. Tham chiếu hiệu năng: **iodiot/webgpu-crowd** (100.000 steering agent trên GPU, https://github.com/iodiot/webgpu-crowd), **nitzangames/SwarmSimulator** (agent là index trong Float32Array, instance attributes trỏ thẳng vào mảng sim, https://github.com/nitzangames/SwarmSimulator). Áp: chỉ là trần tham chiếu, quy mô bệnh viện chưa cần.

### 3.3 HuggingFace Spaces

Không thấy Space nào là crowd simulation R3F đúng nghĩa. Các Space tìm được chủ yếu là generator thế giới: https://huggingface.co/spaces/awacke1/HTML5-ThreeJS (drag-and-drop card trên bàn 3D, đã scrape xác nhận còn chạy), https://huggingface.co/spaces/akhaliq/kimi-3d-worlds, https://huggingface.co/spaces/akhaliq/qwen35-3d-coder-studio. Giá trị: tham khảo ý tưởng, không phải codebase để mượn pattern.

### 3.4 Sáu pattern kỹ thuật cho dự án

1. **Store hai tầng cho scene state.** Zustand cho trạng thái React (danh sách bệnh nhân, lượt, phòng, selectedPatient) và object mutation ngoài React cho dữ liệu per-frame (vị trí đang đi bộ). Nguồn: racing-game.
2. **Server là nguồn sự thật, scene là view.** Event backend phát patient.call, patient.assignRoom. Spawner map entity qua onAdd/onRemove; vị trí server được interpolate trong `useFrame` ghi thẳng vào mesh, không set React state. Nguồn: colyseus react-racing-game, r3f-sims-online.
3. **Pick và drag: pointer capture + phân biệt click/drag + commit khi drop.** `onPointerDown` bắt drag với `stopPropagation()` và `setPointerCapture`; `onPointerMove` raycast xuống plane sàn; `onPointerUp` mới gửi assignRoom lên backend; `event.delta` phân biệt click xem info với drag kéo. Kéo chỉ là dự đoán UI, backend confirm mới đổi trạng thái thật. Nguồn: R3F events docs, drei DragControls.
4. **Hàng đợi biểu diễn bằng chuyển động có slot vật lý.** Slot chỉ gán khi bệnh nhân đã đến cuối hàng. Quầy quay mặt về phía hàng đợi, queue không đứng trong doorway. Nguồn: devYRPauli/crowd.
5. **Đi bộ qua navmesh crowd, không tween thẳng.** Navmesh từ floorplan, mỗi bệnh nhân là agent với `requestMoveTarget`, `interpolatedPosition` với fixed stepping. Nguồn: recast-navigation-js.
6. **Instancing toàn bộ, character thật chỉ gần camera.** Một InstancedMesh per body part với `setMatrixAt`; hoặc chỉ vài agent gần camera dùng skinned mesh. Nguồn: wow-sweet, crowdsim.

---

## Quyết định đã chốt từ grilling

- **Stack 3D (chốt bởi user, 2026-11-22)**. 3D world dựng bằng HTML5 thuần với vanilla Three.js trên WebGL, không bọc React Three Fiber. World phải đủ vật dụng chuyên khoa và kỹ thuật ngành y tế, càng giống bệnh viện thật càng tốt. Các pattern phần 3 vẫn áp dụng nhưng viết bằng three.js thuần thay vì JSX của R3F. Điểm cần dịch: R3F events docs thành việc tự raycast của three.js (Raycaster với pointer events trên renderer.domElement), drei DragControls thành TransformControls hoặc tự viết gesture kéo thả, useFrame thành vòng requestAnimationFrame với clock delta. Repo devYRPauli/crowd và recast-navigation-js vẫn dùng được nguyên vẹn vì chúng vốn là three.js thuần.
- **Mức độ sản phẩm (chốt bởi user)**. Bám sát chuẩn production thực tế nhất, làm sản phẩm có giá trị thực tiễn thay vì demo. Nghiệp vụ y theo tiêu chuẩn của bệnh viện. Auth thật, phân quyền thật.
- **Trọng tâm nghiệp vụ lễ tân (chốt bởi user)**. Lễ tân xếp bệnh nhân vào các phòng trống, ít bệnh nhân hơn, bằng cách biết qua 3D world phòng nào đang chứa bao nhiêu bệnh nhân. Điều phối là manual: hệ thống hiển thị tải từng phòng realtime, lễ tân quyết định và xử lý bằng tay (kéo thả/gán).
- **Đồng ý theo khuyến nghị**. Frontend plain JS ES modules với Vite, không React. Danh sách phòng mặt bằng v1 (sảnh, quầy lễ tân, khu chờ, nội, ngoại, nhi, mắt, răng, tai mũi họng, X-quang, siêu âm, xét nghiệm, quầy thuốc, vệ sinh, hành lang). Luồng khám 10 trạng thái. Trải nghiệm bệnh nhân: đặt lịch, số thứ tự, trạng thái realtime, thông báo gọi, hủy lịch. Admin 4 phạm vi v1. UI tiếng Việt toàn bộ.
- **Vòng 3 (2026-11-22)**. Q9 chốt chuẩn: Patient có họ tên, ngày sinh, giới tính, CCCD, mã bệnh nhân nội bộ, BHYT tùy chọn, số điện thoại; số thứ tự cấp theo ngày reset mỗi sáng. Q8 mở lại: user cân nhắc LƯỢC BỎ giao diện bác sĩ để tập trung điều phối tối ưu qua lễ tân, đặt câu hỏi usecase người khám thì sao — đã nghiên cứu xong bằng agent 6, khuyến nghị có dẫn chứng ở Phần 6: giữ doctor console mỏng 2-3 nút, lễ tân giữ quyền sở hữu hàng đợi và toàn bộ điều phối. Q10 giữ nguyên tinh thần: lễ tân là trách nhiệm điều phối chính, hệ thống chỉ hỗ trợ thông tin. Mục tiêu từ user: thiết kế tối ưu cho cả người khám, lễ tân và admin, bám sát tiêu chuẩn hiện tại và các bệnh viện hiện đại — đã phủ bằng Phần 5 và Phần 6. Còn chờ user xác nhận ở vòng grill 4: Q8 lại (usecase người khám), Q11 (auth production Postgres Docker), và quyết định tên trạng thái theo FHIR.
- **Vòng 4 (2026-11-22, chốt bằng mặc định hội đồng)**. User trả lời "continue" thay vì chọn phương án; theo nguyên tắc không chặn con người, ba câu hỏi còn mở lấy khuyến nghị hội đồng (docs/council/synthesis.md, hội tụ 6/6 vai) làm quyết định, ghi rõ để user đổi được sau:
  - **Q8 — usecase người khám**: phương án A mỏng nhất. Một đầu vào bắt buộc duy nhất từ bác sĩ là "xong khám", khuyến nghị nút ghép complete-and-call-next. Bắt đầu khám là sự kiện quan sát được (suy từ lúc bệnh nhân vào phòng thật, T2 fallback từ T1), kết thúc chỉ chủ thể trong phòng biết. Giao diện sống trong bề mặt bác sĩ đã mở, hiển thị thụ động 4 dòng, không popup. Nút ngoại lệ (chuyển phòng, yêu cầu CLS, bỏ về) trong menu ẩn, không form lý do. Phát hiện quên: phòng "đang khám" vượt max(1.5×trung vị phòng, 15 phút) thì cờ lên màn lễ tân. Phương án B (bỏ giao diện bác sĩ) chỉ là chế độ thoái lui, không phải mặc định.
  - **Q11 — auth production**: session cookie httpOnly + bcrypt, Postgres qua Prisma, deploy Docker Compose với custom Node server + Socket.io. Ma trận quyền theo hội đồng: lễ tân đổi trạng thái vận hành phòng được, không đổi định nghĩa phòng (mã phòng bất biến); override lễ tân bắt buộc chọn lý do từ danh sách; cổng vào completed chỉ mở bằng tín hiệu bác sĩ trừ đường override ghi audit.
  - **Q12 — tên trạng thái**: dùng bộ từ vựng FHIR R5 giữ nguyên tiếng Anh gốc (Appointment, Encounter, subjectStatus, location.status planned/active/reserved/completed, priority v3 ActPriority) với quy ước hội đồng: discharged trước completed sau thanh toán; sweep cuối ngày chuyển lượt treo in-progress thành discharged + nhãn autoClosed, không bao giờ tự completed; discontinued cho kết thúc sớm có chủ đích; QueueTicket là thực thể hạng nhất v1 với waiting/called/present/parked/skipped/no-show; khai báo system URI cho value set trước khi tích hợp HIS.
  - **Tham số hóa thay vì cố định** (khuyến nghị hội đồng mục 4.6): park 3 phút, recall tối đa 2 lần, ngưỡng phát hiện quên, SLA vàng đỏ là cấu hình admin chỉnh được qua config.changed, không hardcode. Các số hiệu năng 3D (50 agent, 300ms P95) đo trên stack thật ở giai đoạn implement rồi mới ghi SLA.

## Phần 4. Chuẩn HL7 FHIR và quy trình OPD

Mọi trang hl7.org dưới đây đã được agent scrape trực tiếp. FHIR R5 là bản hiện hành, R4 là bản triển khai rộng nhất. Đây là phần có giá trị lớn nhất cho "nghiệp vụ y như một tiêu chuẩn của bệnh viện" mà user chốt.

### 4.1 Tách Appointment khỏi Visit (Encounter)

Thiết kế cốt lõi của FHIR. Appointment ghi kế hoạch, Encounter ghi việc thực tế đã xảy ra (nguồn https://hl7.org/fhir/encounter.html). Với hệ thống có cả đặt hẹn online lẫn walk-in qua lễ tân, việc tách hai thực thể là đúng bài toán.

### 4.2 Bộ trạng thái chuẩn

Appointment.status (https://hl7.org/fhir/valueset-appointmentstatus.html), 10 giá trị: proposed, pending, booked, arrived, checked-in, waitlist, fulfilled, cancelled, noshow, entered-in-error.

Encounter.status R5 (https://hl7.org/fhir/valueset-encounter-status.html), 9 giá trị: planned, in-progress, on-hold, discharged, completed, cancelled, discontinued, entered-in-error, unknown. Chi tiết quan trọng nhất: `discharged` tách "kết thúc lâm sàng, bệnh nhân về" khỏi `completed` "đóng sổ, billing xong". R4 dùng `finished` thay cho `completed`.

Chuỗi chuyển trạng thái điển hình kèm vai trò (bảng "Typical status transition examples" trên https://hl7.org/fhir/appointment.html): Slot free → Appointment pending/booked (Requester, Scheduler) → bệnh nhân đến, Appointment arrived (Admin) → gặp bác sĩ, Appointment fulfilled, subjectStatus receiving-care (Practitioner) → rời đi, Encounter discharged (Practitioner, Admin) → billing xong, Encounter completed (Billing).

### 4.3 Dữ liệu cho 3D world theo FHIR

Phần FHIR-native phù hợp nhất cho 3D world là `Encounter.location` (https://hl7.org/fhir/encounter.html): danh sách các nơi bệnh nhân đã đi qua, mỗi entry có status riêng planned, active, reserved, completed (https://hl7.org/fhir/valueset-encounter-location-status.html). Kết hợp `subjectStatus` (arrived, triaged, waiting, receiving-care, departed) là đủ dữ liệu vẽ vị trí bệnh nhân trong world realtime.

### 4.4 Quy trình OPD chuẩn và ai điều phối

FHIR không mô hình hóa quy trình OPD. Nguồn chính phủ đã tìm được và nhất quán với nhau:

- Bộ Y tế Jordan 2025 (https://www.moh.gov.jo/ebv4.0/root_storage/ar/eb_list_page/guidelines_for_establishing_optimal_primary_care_services_in_jordan-2025_approved__5oct2025.pdf), 7 bước kèm vai trò: Registration (Medical Records Clerk) → Initial Assessment đo sinh hiệu (Nurse) → Medical Evaluation (Physician) → Diagnosis and Orders (Physician) → Execution of Orders (Lab/Rad Technician, Pharmacist) → Documentation and Follow-up (Healthcare Team) → Visit Closure (Administrative).
- Bộ Y tế Nam Phi 2024 (https://www.health.gov.za/wp-content/uploads/2024/05/Approved-national-guideline-on-management-of-PWT-final.pdf): luồng khu vực theo thứ tự entry/information desk, triage, patient registration, stream of care, diagnostics, procedure rooms, pharmacy, departure. Triage phải có nhân viên y tế chuyên môn trực.
- SPMC Citizens Charter (https://spmc.doh.gov.ph/images/SPMC_Citizens_Charter_2019.pdf): quy trình OPD thực tế từng bước với person in charge cụ thể.
- University of Nairobi UHS (https://healthservices.uonbi.ac.ke/sites/healthservices.uonbi.ac.ke/files/5.%20Business%20Prosess%20Re-engeneering.pdf).

Tóm tắt chuẩn tổng hợp: Registration (lễ tân, cấp token) → Triage + sinh hiệu (điều dưỡng) → Chờ và gọi số (lễ tân quản lý queue) → Consultation (bác sĩ) → Diagnostics nếu có (kỹ thuật viên, lễ tân dẫn đường) → Kết quả quay lại bác sĩ kết luận (bác sĩ) → Billing + Pharmacy (thu ngân, dược sĩ) → Departure, đóng lượt (hành chính). Lễ tân đóng cả vai Scheduler lẫn Admin trong bảng vai trò của FHIR (suy luận khi ghép hai nguồn).

### 4.5 Khuyến nghị mượn từ FHIR

Mượn TÊN TRẠNG THÁI và PHÂN TÁCH KHÁI NIỆM, không mượn schema. Lý do: trạng thái là phần FHIR ép buộc nhất (required binding) và khó đổi sau này; schema tự do thiết kế bảng.

Mượn nguyên:
1. Bộ 10 giá trị Appointment.status và bộ 9 giá trị Encounter.status R5, giữ tên tiếng Anh gốc để map về FHIR sau này gần như đổi tên không cần chuyển ngữ nghĩa.
2. Phân tách Appointment (kế hoạch) và Visit (thực tế).
3. subjectStatus làm trạng thái vị trí bệnh nhân trên 3D world.
4. Location với status active, suspended, inactive và quan hệ partOf dựng cây khoa, phòng.
5. Slot free, busy và Schedule boolean active.

Giản lược (suy luận của agent):
- Bỏ proposed, waitlist nếu chưa có kịch bản thương lượng slot. Bỏ entered-in-error, thay bằng soft-delete.
- Appointment.participant giản lược thành patient + doctor + receptionist.
- Slot chỉ giữ free, busy.

Không mượn: cấu trúc Resource đầy đủ (Reference, CodeableConcept, extension), Organization, HealthcareService, PractitionerRole, Patient đầy đủ đặc tả dân tộc, ngôn ngữ. Chúng nặng về trao đổi liên hệ thống, không phục vụ điều phối manual trong một bệnh viện.

### 4.6 Mô hình dữ liệu đề xuất cho prototype (từ agent FHIR)

1. Patient. active, khóa định danh riêng của bệnh viện.
2. Doctor. active, chuyên khoa.
3. Location. status active, suspended, inactive; partOf ghép phòng vào khoa; thêm loại room cho 3D world (lobby, triage, consult, lab, pharmacy, cashier) — phần tự thiết kế.
4. Schedule. owner (doctor và hoặc room), active, planningHorizon.
5. Slot. schedule, start, end, status free, busy.
6. Appointment. patient, doctor, slot, appointmentType (new, follow-up, walk-in), status giữ đủ bộ FHIR trừ entered-in-error, liên kết visit 0..1.
7. Visit (đối ứng Encounter). appointment 0..1, class cố định ambulatory cho OPD, patient, doctor, room hiện tại; status planned, in-progress, on-hold, discharged, completed, cancelled, discontinued; subjectStatus arrived, triaged, waiting, receiving-care, departed.
8. VisitLocationEntry (đối ứng Encounter.location, tự thiết kế). room, status planned, active, completed, enteredAt, leftAt. Đây là dữ liệu cho 3D world.
9. Luồng điều phối gắn vai trò. Lễ tân = Scheduler + Admin. Bác sĩ = Participant (in-progress, fulfilled). Hành chính, thu ngân = Billing (discharged sang completed).

### Lưu ý tổng hợp với Phần 2

Bảng transition của Phần 2 (registered, checked_in, waiting, in_consultation...) cần hợp nhất với bộ từ vựng FHIR của phần này khi làm spec. Hướng hợp nhất đề xuất: giữ cấu trúc transition table của Phần 2 làm cơ chế thực thi, đổi tên trạng thái theo FHIR để đạt chuẩn nghiệp vụ (appointment: booked → visit subjectStatus: waiting → in-progress receiving-care → discharged → completed). Quyết định cuối sẽ nằm ở /to-spec.

---

## Phần 5. Repo tham khảo hospital queue và OPD trên GitHub và GitLab

Agent đã scrape trực tiếp 10 nguồn, xác minh 5 repo qua metadata và README, và gọi trực tiếp GitLab API public projects. 13 repo chính chia hai nhóm.

### 5.1 Nhóm A. Hospital queue management / OPD token

1. **mythrhyth/queuecare** (https://github.com/mythrhyth/queuecare, đã scrape). React + TS + Prisma + Socket.io + JWT. Dashboard lễ tân có KPI gồm room occupancy, drag-and-drop chuyển bệnh nhân giữa phòng và bác sĩ, reorder hàng đợi thủ công, token tự sinh với cấu hình method. Chạy thật, có seed và test.
2. **SufiyanAasim/queueless** (https://github.com/SufiyanAasim/queueless, đã xác minh qua API + README). Firebase Realtime DB làm WebSocket push, MongoDB dual-write, ML wait-time. Tính năng nổi bật: token re-queue trong 2 giờ, queue control call/skip/pause per service, token expiry sweeper 5 phút, auto reset hàng ngày.
3. **gaureshpai/easpataal** (https://github.com/gaureshpai/easpataal, 17 sao, MIT, đã archived). Dashboard theo vai trò Admin, Doctor, Pharmacist, Receptionist. Tách Display Management thành cấu hình riêng cho màn hình công cộng. Mượn ý tưởng, không mượn code vì archived.
4. **Cyber-prince-k/queue-management-system** (https://github.com/Cyber-prince-k/queue-management-system, 13 sao, PHP+MySQL). Token dạng OPD-20251022-0001 có ngày để reset hàng ngày, multi-department, endpoint action=reassign dời bệnh nhân giữa phòng ban, pause/resume queue.
5. **Divyanshukumar2005/MediQueue-Hospital-Management-System** (https://github.com/Divyanshukumar2005/MediQueue-Hospital-Management-System, đã xác minh qua API). Supabase PostgreSQL + RLS làm authorization multi-role, QR token check-in.
6. **Kgupta62/mediq** (https://github.com/Kgupta62/mediq, đã scrape API). Mô hình ba màn hình song song lễ tân, bác sĩ, TV công cộng với chime âm thanh. Khớp cấu trúc role của dự án.
7. **Ankita19Rathore/QUEUEASE** (https://github.com/Ankita19Rathore/QUEUEASE, đã xác minh qua metadata). Business rules tường minh cho token: 1 token mỗi ca mỗi ngày, emergency token ưu tiên, tự phát hiện missed token, max token cấu hình được.
8. **NagaThilak479/opd-flow** (https://github.com/NagaThilak479/opd-flow, chỉ biết qua snippet, chưa scrape). Prediction thời gian chờ. Chưa đánh giá được.

### 5.2 Nhóm B. Điều phối vào phòng, dashboard lễ tân, patient flow

1. **saadelkenawy/fc-ams — QUAN TRỌNG NHẤT** (https://github.com/saadelkenawy/fc-ams, đã scrape). Monorepo 14 microservices Fastify + TS, PostgreSQL, 354 commits. Có chính xác bài toán trọng tâm của dự án đã được giải: `POST /rooms/:roomCode/assign` lễ tân gán bệnh nhân vào phòng cụ thể, `POST /rooms/auto-assign` tự gán phòng trống kế tiếp, `GET /rooms/stream` SSE đẩy trạng thái phòng realtime, `GET /rooms/stats` utilisation, room timeline modal kéo để swap hai slot, waiting screen per-room NOW SERVING. V013 dùng btree_gist time-range exclusion để đảm bảo một phòng chỉ chứa một assignment cùng khung giờ, giải race ở mức DB.
2. **expertX221/Care-Flow — LIÊN QUAN 3D NHẤT** (https://github.com/expertX221/Care-Flow, đã scrape). Next.js + Three.js bundled local làm 3D wayfinding. Optional lazy-loaded Three.js floor view dùng room geometry thật với cùng orthogonal routes như bản đồ 2D, nút rotate/top/reset, WebGL fallback. Queue policy ưu tiên có waiting-age bonus, EWMA estimate từ 10 mẫu gần nhất, no-show window 5 phút, staff recall. 109 Node tests. Repo duy nhất kết hợp queue + 3D navigation, trùng hướng frontend Three.js của dự án.
3. **medlabib/BedBoard** (https://github.com/medlabib/BedBoard, đã scrape). Go + React, REST + SSE. Trạng thái phòng nhiều cấp free, occupied, cleaning, alert thay vì chỉ đếm số. Lifecycle register → triage → assign → consult → archive. Controls đặt ngay trên thẻ phòng. KPI SLA và consultations per hour.
4. **earthians/marley_frontend** (https://github.com/earthians/marley_frontend, đã xác minh qua README). Frappe Healthcare + Vue 3. Appointment Desk cho lễ tân, token journey qua nhiều service unit (mỗi lần chuyển phòng là một Patient Journey Stop), FIFO hoặc slot-based ordering cấu hình được, TV display qua WebSocket, bed management. Chạy thật trong ecosystem Frappe Healthcare. Mượn mô hình domain, không mượn code.
5. **Coding-Philic/hospital-ecosystem** (https://github.com/Coding-Philic/hospital-ecosystem, đã xác minh qua README). Reception Dashboard 6 tab với tab Triage Confirmation là checkpoint con người: AI đề xuất, lễ tân confirm hoặc override cả hai, mọi override ghi audit_log với giá trị trước và sau. Queue chọn bác sĩ bằng sort shortest queue. Mẫu an toàn đúng đắn cho tính năng xếp phòng.

### 5.3 Kết luận GitLab

Đã gọi trực tiếp GitLab API public projects với search hospital queue và OPD. Search hospital queue trả đúng 5 project, tất cả 0 sao, đều là đồ án hoặc demo cũ từ 2018 đến 2022. Search OPD trả chủ yếu repo spam. Kết luận: GitLab không có repo đáng dùng trong lĩnh vực này, GitHub là nguồn duy nhất.

### 5.4 Điểm chung thiết kế rút ra

1. Room là entity first-class, không phải nhãn trên appointment. Các repo mạnh nhất đều có bảng phòng riêng với trạng thái nhiều cấp và endpoint stats riêng.
2. Cặp auto-assign + manual override là mô hình chuẩn. Không repo nào chỉ dùng tự động hoàn toàn. Override luôn có audit log.
3. Queue là state machine, không phải mảng sắp xếp. Các repo mạnh encode invariant ở mức DB bằng exclusion constraint.
4. Ba bề mặt hiển thị tách rời cùng một nguồn trạng thái: portal bệnh nhân, màn điều khiển lễ tân bác sĩ, display board TV công cộng không cần login và lọc zero PII.
5. ETA tính lại liên tục từ dữ liệu thực với EWMA hoặc running average, không phải hằng số cấu hình.

## Phần 6. Workflow thực tế của bác sĩ, lễ tân, admin trong QMS/HIS hiện đại

Báo cáo của agent số 6 với 43 nguồn: sản phẩm QMS thương mại quốc tế (Wavetec, Qmatic, HANA, Veona, Infocis, Qwaiting), HIS/QMS Việt Nam (Viettel HIS, EHIS, MyHospital, ComQ, Davisoft, phụ lục HIS bệnh viện Việt Nam-Cuba), docs admin, và một RCT lâm sàng.

### 6.1 Câu trả lời cho câu hỏi "usecase người khám thì sao"

Chuẩn phổ biến quốc tế là doctor console riêng tối giản. Các sản phẩm đều có cùng bộ nút lõi: Call Next, Call Again, Start service, Complete, Recall, Skip, No show, Transfer. Tác động của bác sĩ trong triển khai thật có thể rút còn đúng một nút: Wavetec Nahdi Care Clinics, cuộc khám đóng lại khi bác sĩ click end serving (https://www.wavetec.com/case-studies/nahdi-care-clinics/).

Hai sự kiện chỉ bác sĩ biết đúng là "bắt đầu khám" và "kết thúc khám". Chúng là đầu vào của thời gian phục vụ, chỉ số cốt lõi mọi QMS ghi timestamp ngay tại hành vi của người phục vụ (Qmatic transaction time, https://cdn2.hubspot.net/hub/303785/file-725165954-pdf/US-infographic/How_a_qmatic_system_works_-_Healthcare.pdf). Nếu lễ tân đoán qua 3D, dữ liệu này thành ước lượng có nhiễu.

Hậu quả của quy trình cập nhật trạng thái thủ công một điểm duy nhất đã được ghi nhận ở Việt Nam: bệnh nhân chờ hơn 90 phút vì một cuốn sổ bị quên trong hộc bàn, không ai theo dõi trạng thái từng trường hợp chờ (https://vietnamnet.vn/benh-nhan-cho-hon-90-phut-vi-nhan-vien-y-te-quen-so-kham-trong-hoc-ban-2569009.html); nhân viên phải chạy đi báo từng phòng khi có sự kiện bất thường (https://myhospital.vn/tin-tuc/so-hoa-quy-trinh-tiep-don-benh-vien/).

Mô hình lễ tân điều khiển hộ là mô hình thật và có chỗ đứng thương mại: Infocis module OPD Hall Attendant điều khiển nhiều hàng đợi bác sĩ từ một lưới (https://infocispakistan.com/infocis-qms-demo/), Qwaiting multi-counter cho một nhân viên phục vụ nhiều phòng (https://qwaiting.com/blog/introducing-multi-counter-call-handling-for-staff). Nhưng nó luôn đi kèm kênh phát tín hiệu từ phòng khám: nút cứng, loa, hoặc nhân viên chạy qua lại.

Ở Việt Nam, chức năng gọi số của bác sĩ thường không phải app QMS riêng mà là vài nút nhúng trong màn hình khám bệnh của HIS bác sĩ đã mở cả ngày: EHIS chọn bệnh nhân chờ và nhấn gọi (https://ehis.vn/products/giai-phap-quan-ly-he-thong-xep-hang-tu-dong-ehis), HIS Việt Nam-Cuba có "gọi loa bệnh nhân vào khám" và "xử trí kết thúc khám" trong phân hệ khám của bác sĩ (https://www.vietnamcuba.vn/upload/files/41%20vncb%2016012025.pdf), Viettel HIS có "Chuyển phòng khám", "Chuyển khám giảm tải" trong phân hệ khám (https://solutions.viettel.vn/wp-content/uploads/2019/11/Tinh-nang-HIS_1.pdf).

### 6.2 Khuyến nghị cho dự án (agent 6)

Giữ một điểm chạm tối giản của bác sĩ, 2-3 nút, không xây giao diện QMS riêng. Lễ tân giữ quyền sở hữu hàng đợi và toàn bộ điều phối.

- Usecase bác sĩ: phát tín hiệu tiến trình khám. Hai nút: "Mời bệnh nhân tiếp theo" và "Kết thúc khám" (hoặc nút ghép Complete & call next kiểu Veona). Xử trí y khoa, kê đơn vẫn nằm ngoài hệ thống này. Không giao dashboard, không giao điều phối.
- Usecase lễ tân: chủ hàng đợi và điều phối viên trung tâm. Gán bệnh nhân vào phòng qua 3D world, gọi tiếp theo, gọi lại, ưu tiên và khẩn, chuyển tuyến giữa phòng, đổi phòng, no-show, đón walk-in. Tín hiệu "phòng này xong rồi" chỉ được phép do bác sĩ phát, lễ tân không tự đánh dấu đang khám.
- Usecase admin: cấu hình dịch vụ, phòng, bác sĩ, mức ưu tiên, ánh xạ phòng; SLA và ngưỡng cảnh báo; vận hành sự cố (mở phòng mới, chuyển khối bệnh nhân giảm tải kiểu Viettel HIS, pause service); báo cáo KPI (thời gian chờ trung bình, thời gian phục vụ, tỷ lệ no-show, hiệu suất từng phòng, giờ cao điểm). Nguồn: Qmatic Experience Cloud, InfyOm admin panel, Wavetec Spectra Dashboard.

### 6.3 Reception workflow chuẩn hiện đại (Entry2Exit checklist + HANA console làm chuẩn tham chiếu)

- Danh sách hàng chờ realtime theo lane/room kèm trạng thái và tổng số từng trạng thái.
- Call next một nút, hệ thống tự chọn theo ưu tiên rồi thời gian đăng ký, phát loa kèm hiển thị. Hotkey phổ biến là phím Next trên bàn phím.
- Recall giới hạn số lần (Hiển thị Recall 1/3), Skip và No show cho người không phản hồi, bỏ lượt sau thời gian cấu hình.
- Transfer chuyển tuyến không cần cấp vé mới, một thao tác.
- Ưu tiên khẩn: nút CUT chen lượt bắt buộc xác nhận, mũi tên kéo thả đổi thứ tự tay.
- Gán phòng kèm room availability trên dashboard; màn hình lễ tân hiển thị trạng thái từng phòng (chờ, đang, đã kết thúc).
- Walk-in tại chỗ chọn doctor hoặc next available, gộp với hẹn trước vào một hàng đợi công bằng.
- Park và Note cho tạm dừng, ghi chú.
- Suy luận của agent: không sản phẩm nào đề cao số lượng nút, mọi nguồn tối ưu cho số lần bấm.

### 6.4 Admin QMS hiện đại quản lý gì

- Cấu hình: CRUD dịch vụ, counters gán trạng thái open/closed/maintenance, staff gán vào counter, danh mục mức ưu tiên (https://infyom.com/docs/queue-management-saas/admin-panel.html). Việt Nam: khai báo chuyên khoa, ánh xạ quầy với phòng khám.
- SLA: target thời gian chờ theo service, ngưỡng cảnh báo, designated queue supervisor cho giờ cao điểm (https://www.qminder.com/blog/queue-management/a-guide-to-implementing-queue-management-systems/).
- KPI chuẩn lặp lại ở mọi nhà cung cấp: waiting time, service duration, vé phát/hoàn thành, no-show và walk-away, hiệu suất counter/nhân viên, giờ cao điểm, xuất CSV/PDF.
- Vận hành sự cố: đổi priority từ xa, pause một service tức thì, mở thêm counter khi dồn ứ, chuyển khối bệnh nhân giảm tải sang phòng cùng chức năng.
- Bằng chứng giá trị: RCT 236 bệnh nhân cấp cứu Iran 2021, nhóm có QMS chờ 15,5 phút so với 27 phút đối chứng, thời gian chờ cảm nhận 11,9 so với 32,8 phút (https://pmc.ncbi.nlm.nih.gov/articles/PMC8464010/).

### 6.5 Ràng buộc pháp lý Việt Nam

QMS phải hỗ trợ ưu tiên bắt buộc cho người cao tuổi, người khuyết tật, phụ nữ có thai, cấp cứu, không thể thuần FIFO. Nguồn: MyHospital dẫn QĐ 1313/QĐ-BYT 22/04/2013 về quy trình khám bệnh tại khoa khám bệnh và TT 38/2024/TT-BYT về số hóa khám chữa bệnh (https://myhospital.vn/tin-tuc/he-thong-quan-ly-hang-doi-benh-vien/). Khuyến nghị này là của MyHospital về quy định của BYT; khi làm spec cần kiểm tra lại văn bản gốc nếu cần dẫn pháp lý chặt.

### 6.6 Phương án dự phòng nếu bỏ hẳn UI bác sĩ (suy luận tổng hợp của agent)

- Bù bằng timeout tự động: Recall giới hạn số lần rồi Skip/No show, bỏ lượt sau thời gian cấu hình.
- Bù bằng phát hiện hiện diện từ 3D world để tự đóng lượt khi phòng trống. Không sản phẩm nào làm điều này, là điểm khác biệt mới, nhưng timestamp sẽ là ước lượng.
- Bù bằng nút cứng hoặc loa tại phòng khám, hình thái có sẵn trên thị trường.

## Phương pháp

Sáu agent nghiên cứu song song dùng bộ công cụ Context7 MCP, Exa, Brave Search, Firecrawl (search + scrape + research papers), phủ GitHub, GitLab (gọi API trực tiếp), HuggingFace Spaces, arXiv và docs chính thức (hl7.org scrape trực tiếp). Agent FHIR dùng lại một lần sau lỗi giới hạn chạy song song. Mọi claim trong file này là tổng hợp từ kết quả agent; các phần ghi rõ "suy luận" trong báo cáo gốc của từng agent được giữ nhãn khi dùng vào thiết kế. Báo cáo gốc đầy đủ của từng agent nằm trong transcript phiên.
