import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Html5FloorRenderer } from "../../../packages/features/hospital-pipeline/lib/html5-world/html5-floor-renderer";
import { FLOOR_HEIGHT_M } from "../../../packages/features/hospital-pipeline/lib/html5-world/world-to-screen";
import {
  type Appointment,
  clinic,
  formatTime,
  isMarker,
  type Marker,
  markers,
  room,
  timeZone,
  type Visit,
} from "./model";

type Config = { demo: boolean; bookingUrl: string | null; slots: string[]; day: string };
type StaffBooking = Appointment & { number: number | null };
type Admission = { number: number; link: string | null };
const dateLabel = (day: string) =>
  new Date(day + "T00:00:00+07:00").toLocaleDateString("vi-VN", {
    timeZone,
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const stringError = (error: unknown) => (error instanceof Error ? error.message : "Có lỗi khi tải dữ liệu.");

async function api<T>(path: string, key?: string, input?: Record<string, string>): Promise<T> {
  const headers = new Headers();
  if (key) headers.set("Authorization", "Bearer " + key);
  if (input) headers.set("Content-Type", "application/json");
  const response = await fetch("/api/" + path, {
    method: input ? "POST" : "GET",
    headers,
    body: input ? JSON.stringify(input) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
  return data;
}

function Booking({ config }: { config: Config }) {
  const [appointment, setAppointment] = useState<Appointment>();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function book(slot: string) {
    setError("");
    setPending(true);
    try {
      setAppointment(await api<Appointment>("demo-booking", undefined, { slot }));
    } catch (problem) {
      setError(stringError(problem));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel">
      <h1>Đặt lịch khám</h1>
      <h2>{clinic}</h2>
      {config.bookingUrl && (
        <a className="button" href={config.bookingUrl}>
          Chọn ngày và giờ khám trên Cal.diy
        </a>
      )}
      {config.demo && (
        <>
          <p className="muted">{dateLabel(config.day)}</p>
          <div className="actions">
            {config.slots.map((slot) => (
              <button key={slot} disabled={pending} onClick={() => void book(slot)}>
                {slot}
              </button>
            ))}
          </div>
          {appointment && (
            <p className="feedback" role="status">
              Đã đặt {formatTime(appointment.start)}. Mã lịch <strong>{appointment.uid}</strong>. Vui lòng xác
              nhận tại quầy để nhận số.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function Staff({ config }: { config: Config }) {
  const [key, setKey] = useState(sessionStorage.getItem("hospitalStaff") ?? "");
  const keyRef = useRef(key);
  const [bookings, setBookings] = useState<StaffBooking[]>();
  const [admission, setAdmission] = useState<Admission>();
  const [error, setError] = useState("");
  async function refresh() {
    setError("");
    const requestKey = keyRef.current;
    try {
      const result = await api<StaffBooking[]>("bookings", requestKey);
      if (keyRef.current !== requestKey) return;
      setBookings(result);
      sessionStorage.setItem("hospitalStaff", requestKey);
    } catch (problem) {
      if (keyRef.current !== requestKey) return;
      setBookings(undefined);
      setError(stringError(problem));
    }
  }
  async function admit(uid: string) {
    setError("");
    setAdmission(undefined);
    try {
      setAdmission(await api<Admission>("check-in", key, { uid }));
      await refresh();
    } catch (problem) {
      setError(stringError(problem));
    }
  }
  return (
    <>
      <section className="panel">
        <h1>Quầy tiếp nhận</h1>
        <p className="muted">{dateLabel(config.day)}</p>
        <form
          className="actions"
          onSubmit={(event) => {
            event.preventDefault();
            void refresh();
          }}>
          <label>
            Mã truy cập quầy{" "}
            <input
              type="password"
              autoComplete="off"
              value={key}
              required
              onChange={(event) => {
                keyRef.current = event.target.value;
                setKey(event.target.value);
                setBookings(undefined);
                setAdmission(undefined);
                sessionStorage.removeItem("hospitalStaff");
              }}
            />
          </label>
          <button type="submit">{bookings ? "Cập nhật lịch" : "Xem lịch hôm nay"}</button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {bookings?.length === 0 && <p>Hôm nay chưa có lịch đã xác nhận.</p>}
        {!!bookings?.length && (
          <ul className="bookings">
            {bookings.map(({ uid, start, number }) => (
              <li key={uid}>
                <span>
                  <strong>{formatTime(start)}</strong>
                  <br />
                  <span className="muted">Mã lịch {uid}</span>
                </span>
                <button type="button" onClick={() => void admit(uid)}>
                  {number ? "Mở lại lượt " + number : "Tiếp nhận"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {admission && (
          <p className="feedback" role="status">
            Đã tiếp nhận số <strong>{admission.number}</strong>.{" "}
            {admission.link ? (
              <>
                <a href={admission.link} target="_blank" rel="noreferrer">
                  Mở trang theo dõi
                </a>{" "}
                hoặc gửi liên kết này cho bệnh nhân.
              </>
            ) : (
              "Bệnh nhân đã mở liên kết theo dõi."
            )}
          </p>
        )}
      </section>
      <section className="panel">
        <h2>Mã QR xác nhận vị trí</h2>
        <div className="actions">
          {(Object.keys(markers) as Marker[]).map((marker) => (
            <figure key={marker}>
              <img
                src={"/api/qr?marker=" + marker}
                alt={"QR " + markers[marker].label}
                width="126"
                height="126"
              />
              <figcaption>
                <a href={"/patient?marker=" + marker}>{markers[marker].label}</a>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </>
  );
}

function Patient() {
  const [token, setToken] = useState(localStorage.getItem("hospitalVisit") ?? "");
  const [visit, setVisit] = useState<Visit>();
  const [error, setError] = useState("");
  const [focusRoom, setFocusRoom] = useState(false);
  const [pending, setPending] = useState(false);
  async function choose(marker: Marker) {
    setError("");
    setPending(true);
    try {
      setVisit(await api<Visit>("location", token, { marker }));
      setFocusRoom(false);
    } catch (problem) {
      setError(stringError(problem));
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    const load = async () => {
      let key = localStorage.getItem("hospitalVisit") ?? "";
      const code = location.hash.slice(1);
      const marker = new URLSearchParams(location.search).get("marker");
      if (code) {
        try {
          const claimed = await api<{ token: string }>("claim", undefined, { code });
          key = claimed.token;
          localStorage.setItem("hospitalVisit", key);
          setToken(key);
        } catch {
          // Claim failed (link already used or expired): fall back to the saved token below.
        } finally {
          history.replaceState(null, "", location.pathname);
        }
      }
      if (!key) return;
      setVisit(
        isMarker(marker) ? await api<Visit>("location", key, { marker }) : await api<Visit>("ticket", key)
      );
      history.replaceState(null, "", location.pathname);
    };
    void load().catch((problem) => setError(stringError(problem)));
  }, []);
  const marker = visit?.marker ? markers[visit.marker] : null;
  const focus = focusRoom ? room : (marker ?? markers.lobby);
  const height = FLOOR_HEIGHT_M * focus.floor;
  return (
    <section className="panel">
      <h1>Vị trí và lượt khám</h1>
      <p>
        {visit ? (
          <>
            Lượt <strong>{visit.number}</strong> · Giờ hẹn {formatTime(visit.start)} · Đã tiếp nhận
          </>
        ) : (
          "Nhận liên kết theo dõi từ quầy sau khi xác nhận lịch."
        )}
      </p>
      <p>
        {marker ? (
          <>
            <strong>
              {marker.label}, tầng {marker.floor}
            </strong>{" "}
            · Xác nhận lúc {formatTime(visit!.seenAt!)}
          </>
        ) : (
          "Chưa có vị trí xác nhận."
        )}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {visit && (
        <div className="actions">
          <button disabled={pending} onClick={() => void choose("lobby")}>
            Sảnh tiếp nhận
          </button>
          <button disabled={pending} onClick={() => void choose("waiting")}>
            Khu chờ
          </button>
          <button onClick={() => setFocusRoom(!focusRoom)}>
            {focusRoom ? "Xem vị trí của tôi" : room.label + " · Tầng " + room.floor}
          </button>
        </div>
      )}
      <div className="model" aria-label={"Mô hình HTML5, tầng " + focus.floor}>
        <Html5FloorRenderer
          cameraPose={{
            target: { x: focus.position.x, y: height + 1.5, z: focus.position.z },
            position: { x: focus.position.x + 12, y: height + 12, z: focus.position.z + 12 },
          }}
          patientState={marker ? { ...marker.position, y: FLOOR_HEIGHT_M * marker.floor } : null}
          reducedMotion
        />
      </div>
      <p className="muted">Mô hình HTML5 · Tầng {focus.floor}. Vị trí lấy từ mốc xác nhận gần nhất.</p>
    </section>
  );
}

function App() {
  const [config, setConfig] = useState<Config>();
  const [error, setError] = useState("");
  useEffect(() => {
    void api<Config>("config")
      .then(setConfig)
      .catch((problem) => setError(stringError(problem)));
  }, []);
  return (
    <>
      <header>
        <div>
          <a className="brand" href="/">
            Bệnh viện · Lịch khám
          </a>
          {config?.demo && <span className="badge">Dữ liệu minh họa</span>}
        </div>
        <nav aria-label="Chức năng">
          <a href="/">Đặt lịch</a>
          <a href="/staff">Tiếp nhận</a>
          <a href="/patient">Mô hình HTML5</a>
        </nav>
      </header>
      <main>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : !config ? (
          <p>Đang tải lịch khám…</p>
        ) : location.pathname === "/staff" ? (
          <Staff config={config} />
        ) : location.pathname === "/patient" ? (
          <Patient />
        ) : (
          <Booking config={config} />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
