import { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import process from "node:process";
import QRCode from "qrcode";
import { type Appointment, isMarker, slots, today, type Visit } from "./model";

const demo = process.env.HOSPITAL_MODE === "demo";
const staffKey = process.env.HOSPITAL_STAFF_KEY;
const calOrigin = process.env.HOSPITAL_CAL_API_ORIGIN;
const calKey = process.env.HOSPITAL_CAL_API_KEY;
const eventTypeId = process.env.HOSPITAL_CAL_EVENT_TYPE_ID;
const bookingUrl = process.env.HOSPITAL_CAL_BOOKING_URL;
if (!staffKey) throw new Error("Set HOSPITAL_STAFF_KEY before starting");
if (!demo && (!calOrigin || !calKey || !eventTypeId || !bookingUrl)) {
  throw new Error("Set the HOSPITAL_CAL_* configuration or explicitly select HOSPITAL_MODE=demo");
}

const db = new Database(process.env.HOSPITAL_DB_PATH ?? ":memory:");
db.exec(`
  CREATE TABLE IF NOT EXISTS demo_bookings (uid TEXT PRIMARY KEY, start TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS visits (
    uid TEXT PRIMARY KEY, day TEXT NOT NULL, start TEXT NOT NULL, number INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE, claimCode TEXT UNIQUE, marker TEXT, seenAt TEXT, UNIQUE (day, number)
  );
`);
type StoredVisit = Visit & { claimCode: string | null };
const byBooking = db.query<StoredVisit, [string, string]>(
  "SELECT * FROM visits WHERE uid = ? AND day = ?"
);
const byToken = db.query<Visit, [string, string]>(
  "SELECT uid, start, number, marker, seenAt FROM visits WHERE token = ? AND day = ?"
);
const checkIn = db.transaction((appointment: Appointment) => {
  const day = today();
  db.run(
    `INSERT INTO visits (uid, day, start, number, token, claimCode)
    SELECT ?, ?, ?, COALESCE(MAX(number), 0) + 1, ?, ? FROM visits WHERE day = ?
    ON CONFLICT(uid) DO NOTHING`,
    [appointment.uid, day, appointment.start, randomUUID(), randomUUID(), day]
  );
  return byBooking.get(appointment.uid, day);
});

async function appointments(): Promise<Appointment[]> {
  const day = today();
  const start = `${day}T00:00:00+07:00`;
  const end = new Date(Date.parse(start) + 86_400_000).toISOString();
  if (demo)
    return db
      .query<Appointment, [string]>("SELECT uid, start FROM demo_bookings WHERE start LIKE ? ORDER BY start")
      .all(`${day}%`);

  const url = new URL("/v2/bookings", calOrigin);
  url.search = new URLSearchParams({
    eventTypeId: eventTypeId!,
    afterStart: start,
    beforeEnd: end,
    status: "upcoming,past",
    take: "100",
    sortStart: "asc",
  }).toString();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${calKey}`, "cal-api-version": "2024-08-13" },
    redirect: "error",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Cal.diy responded with ${response.status}`);
  const payload: { status: string; data: (Appointment & { status: string; eventTypeId: number })[] } =
    await response.json();
  if (payload.status !== "success" || !Array.isArray(payload.data))
    throw new Error("Invalid Cal.diy response");
  return payload.data
    .filter((entry) => entry.status === "accepted" && String(entry.eventTypeId) === eventTypeId)
    .map(({ uid, start: confirmedStart }) => ({ uid, start: confirmedStart }));
}

const html = Bun.file(`${import.meta.dir}/index.html`);
const css = Bun.file(`${import.meta.dir}/style.css`);
const client = `${import.meta.dir}/client.tsx`;
const resolveFromWeb = createRequire(import.meta.url).resolve;
const build = (await Bun.file(client).exists())
  ? await Bun.build({
      entrypoints: [client],
      target: "browser",
      jsx: { runtime: "automatic" },
      plugins: [
        {
          name: "hospital-react",
          setup(builder) {
            // The renderer lives in a second workspace, but hooks must share the app's React instance.
            builder.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({ path: resolveFromWeb(path) }));
          },
        },
      ],
    })
  : null;
if (build && (!build.success || !build.outputs[0])) throw new Error("Could not bundle hospital web client");
const script = build?.outputs[0];
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
const fail = (message: string, status: number) => json({ message }, status);

const server = Bun.serve({
  hostname: process.env.HOSPITAL_HOST ?? "127.0.0.1",
  port: Number(process.env.HOSPITAL_PORT ?? 3010),
  maxRequestBodySize: 4096,
  async fetch(request) {
    const url = new URL(request.url);
    const { pathname } = url;
    const auth = request.headers.get("Authorization");
    try {
      if (request.method === "GET") {
        if (script && ["/", "/staff", "/patient"].includes(pathname)) return new Response(html);
        if (script && pathname === "/client.js") return new Response(script);
        if (script && pathname === "/style.css") return new Response(css);
        if (pathname === "/api/config")
          return json({ demo, bookingUrl: demo ? null : bookingUrl, slots, day: today() });
        if (pathname === "/api/qr") {
          const marker = url.searchParams.get("marker");
          if (!isMarker(marker)) return fail("Mốc không hợp lệ", 400);
          const positionUrl = new URL(
            `/patient?marker=${marker}`,
            process.env.HOSPITAL_PUBLIC_URL ?? url.origin
          );
          const svg = await QRCode.toString(positionUrl.href, { type: "svg", margin: 2 });
          return new Response(svg, { headers: { "Content-Type": "image/svg+xml" } });
        }
        if (pathname === "/api/bookings") {
          if (auth !== `Bearer ${staffKey}`) return fail("Mã truy cập quầy không hợp lệ", 401);
          return json(
            (await appointments()).map((item) => ({
              ...item,
              number: byBooking.get(item.uid, today())?.number ?? null,
            }))
          );
        }
        if (pathname === "/api/ticket") {
          const visit = byToken.get(auth?.replace(/^Bearer /, "") ?? "", today());
          return visit ? json(visit) : fail("Cần liên kết tiếp nhận từ quầy", 401);
        }
      }
      if (request.method !== "POST") return fail("Không tìm thấy trang", 404);
      const input = (await request.json().catch(() => null)) as {
        uid?: unknown;
        slot?: unknown;
        marker?: unknown;
        code?: unknown;
      } | null;
      if (pathname === "/api/demo-booking" && demo) {
        if (typeof input?.slot !== "string" || !slots.includes(input.slot))
          return fail("Chọn một khung giờ", 400);
        const item = { uid: randomUUID().slice(0, 8), start: `${today()}T${input.slot}:00+07:00` };
        const result = db.run("INSERT INTO demo_bookings VALUES (?, ?) ON CONFLICT(start) DO NOTHING", [
          item.uid,
          item.start,
        ]);
        return result.changes ? json(item, 201) : fail("Khung giờ đã được đặt", 409);
      }
      if (pathname === "/api/check-in") {
        if (auth !== `Bearer ${staffKey}`) return fail("Mã truy cập quầy không hợp lệ", 401);
        const appointment = (await appointments()).find((entry) => entry.uid === input?.uid);
        if (!appointment) return fail("Lịch này không còn đủ điều kiện tiếp nhận", 409);
        const visit = checkIn.immediate(appointment);
        if (!visit) return fail("Chưa tạo được lượt", 503);
        return json({ number: visit.number, link: visit.claimCode ? `/patient#${visit.claimCode}` : null });
      }
      if (pathname === "/api/claim" && typeof input?.code === "string") {
        const claimed = db
          .query<{ token: string }, [string, string]>(
            "UPDATE visits SET claimCode = NULL WHERE claimCode = ? AND day = ? RETURNING token"
          )
          .get(input.code, today());
        return claimed ? json(claimed) : fail("Liên kết đã dùng hoặc hết hạn", 401);
      }
      if (pathname === "/api/location") {
        const token = auth?.replace(/^Bearer /, "") ?? "";
        if (!isMarker(input?.marker)) return fail("Mốc không hợp lệ", 400);
        db.run("UPDATE visits SET marker = ?, seenAt = ? WHERE token = ? AND day = ?", [
          input.marker,
          new Date().toISOString(),
          token,
          today(),
        ]);
        const visit = byToken.get(token, today());
        return visit ? json(visit) : fail("Cần liên kết tiếp nhận từ quầy", 401);
      }
      return fail("Không tìm thấy thao tác", 404);
    } catch (error) {
      console.error(
        "Hospital request failed",
        pathname,
        error instanceof Error ? error.message : "Unknown error"
      );
      return fail("Không đọc được dữ liệu. Vui lòng thử lại.", 503);
    }
  },
});
console.log(`Hospital operations (${demo ? "demo data" : "Cal.diy"}): ${server.url}`);
