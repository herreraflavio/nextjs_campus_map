// "use client";

// import React from "react";
// import { eventsLayerRef, eventsStore } from "../arcgisRefs";

// /**
//  * Calendar overlay that filters the Graphics in eventsLayerRef.current
//  * by the string date in attributes.date (format YYYY-MM-DD).
//  */
// export default function EventCalendarOverlay() {
//   const [mode, setMode] = React.useState<"all" | "single" | "range">("all");
//   const [start, setStart] = React.useState<string>("");
//   const [end, setEnd] = React.useState<string>("");

//   const applyFilter = React.useCallback(() => {
//     const layer: any = eventsLayerRef.current;
//     if (!layer || !layer.graphics) return;

//     const items: any[] = layer.graphics.items ?? [];

//     // No filter => show all
//     if (mode === "all" || (!start && !end)) {
//       items.forEach((g) => (g.visible = true));
//       return;
//     }

//     // Normalize range
//     const s = (mode === "single" ? start : start || end) || "";
//     const e = (mode === "single" ? start : end || start) || "";

//     // If we only have one bound, treat it as single day
//     const sEff = s || e;
//     const eEff = e || s;

//     items.forEach((g) => {
//       // date is stored on the graphic's attributes by your toEventGraphic()
//       const d: string | undefined =
//         g.attributes?.date ?? g.attributes?.attributes?.date; // fallback if nested (defensive)

//       if (!d) {
//         // Missing a date: hide when filtering
//         g.visible = false;
//         return;
//       }

//       // Since dates are YYYY-MM-DD, lexicographic compare === chronological compare
//       const inRange = d >= sEff && d <= eEff;
//       g.visible = !!inRange;
//     });
//   }, [mode, start, end]);

//   // Reapply whenever the user changes the filter controls
//   React.useEffect(() => {
//     applyFilter();
//   }, [applyFilter]);

//   // Reapply when new events are added through your store
//   React.useEffect(() => {
//     const onAdded = () => setTimeout(applyFilter, 0);
//     eventsStore?.events?.addEventListener("added", onAdded);
//     return () => eventsStore?.events?.removeEventListener("added", onAdded);
//   }, [applyFilter]);

//   // Reapply when the layer’s graphics collection changes
//   React.useEffect(() => {
//     // eventsLayerRef.current may not be ready on first render—poll briefly
//     let stop = false;
//     const tryAttach = () => {
//       if (stop) return;
//       const layer: any = eventsLayerRef.current;
//       if (layer?.graphics?.on) {
//         const handle = layer.graphics.on("change", () => applyFilter());
//         return () => handle?.remove?.();
//       }
//       // If not ready, try again on next frame
//       requestAnimationFrame(tryAttach);
//     };
//     const cleanup = tryAttach() as unknown as (() => void) | undefined;
//     return () => {
//       stop = true;
//       cleanup && cleanup();
//     };
//   }, [applyFilter]);

//   const disableDates = mode === "all";

//   return (
//     <div
//       style={{
//         position: "absolute",
//         top: 12,
//         right: 12,
//         zIndex: 1000,
//         background: "white",
//         border: "1px solid #ddd",
//         borderRadius: 12,
//         padding: 12,
//         boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
//         width: 320,
//         fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
//         pointerEvents: "auto",
//       }}
//     >
//       <div style={{ fontWeight: 800, marginBottom: 8 }}>Event Dates</div>

//       <div style={{ display: "grid", gap: 8 }}>
//         <div style={{ display: "flex", gap: 12 }}>
//           <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
//             <input
//               type="radio"
//               name="mode"
//               value="all"
//               checked={mode === "all"}
//               onChange={() => setMode("all")}
//             />
//             Show all
//           </label>

//           <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
//             <input
//               type="radio"
//               name="mode"
//               value="single"
//               checked={mode === "single"}
//               onChange={() => setMode("single")}
//             />
//             Single day
//           </label>

//           <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
//             <input
//               type="radio"
//               name="mode"
//               value="range"
//               checked={mode === "range"}
//               onChange={() => setMode("range")}
//             />
//             Range
//           </label>
//         </div>

//         {mode === "single" && (
//           <div style={{ display: "grid", gap: 4 }}>
//             <label style={{ fontSize: 12, color: "#444" }}>Date</label>
//             <input
//               type="date"
//               value={start}
//               onChange={(e) => setStart(e.target.value)}
//               disabled={disableDates}
//               style={inputStyle}
//             />
//           </div>
//         )}

//         {mode === "range" && (
//           <div
//             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
//           >
//             <div style={{ display: "grid", gap: 4 }}>
//               <label style={{ fontSize: 12, color: "#444" }}>From</label>
//               <input
//                 type="date"
//                 value={start}
//                 onChange={(e) => setStart(e.target.value)}
//                 disabled={disableDates}
//                 style={inputStyle}
//               />
//             </div>
//             <div style={{ display: "grid", gap: 4 }}>
//               <label style={{ fontSize: 12, color: "#444" }}>To</label>
//               <input
//                 type="date"
//                 value={end}
//                 onChange={(e) => setEnd(e.target.value)}
//                 disabled={disableDates}
//                 style={inputStyle}
//               />
//             </div>
//           </div>
//         )}

//         {mode === "all" && (
//           <p style={{ margin: 0, fontSize: 12, color: "#666" }}>
//             All events are visible.
//           </p>
//         )}

//         <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
//           <button
//             type="button"
//             onClick={() => {
//               setMode("all");
//               setStart("");
//               setEnd("");
//             }}
//             style={btnStyle}
//           >
//             Show all
//           </button>

//           {mode !== "all" && (
//             <button
//               type="button"
//               onClick={applyFilter}
//               style={btnStyleSecondary}
//             >
//               Apply
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// const inputStyle: React.CSSProperties = {
//   padding: "6px 8px",
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   fontSize: 14,
// };

// const btnStyle: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 700,
//   borderRadius: 8,
//   border: "1px solid #222",
//   background: "#ffd166",
//   cursor: "pointer",
// };

// const btnStyleSecondary: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 700,
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   background: "#f4f4f4",
//   cursor: "pointer",
// };
"use client";

import React from "react";
import { eventsLayerRef, eventsStore } from "../arcgisRefs";

/* Exported types so you can import them elsewhere if/when you convert this to a controlled UI */
export type Mode = "all" | "single" | "range" | "timeline";
export type Unit = "minute" | "hour" | "day" | "week" | "month" | "year";
export type PlayState = "paused" | "playing" | "ended";

export default function EventCalendarOverlay() {
  const [expanded, setExpanded] = React.useState(true);

  const [mode, setMode] = React.useState<Mode>("all");
  const [singleDate, setSingleDate] = React.useState("");
  const [rangeStart, setRangeStart] = React.useState("");
  const [rangeEnd, setRangeEnd] = React.useState("");

  // Timeline controls
  const [intervalValue, setIntervalValue] = React.useState(1);
  const [intervalUnit, setIntervalUnit] = React.useState<Unit>("day");
  const [tickSeconds, setTickSeconds] = React.useState(1);
  const [playState, setPlayState] = React.useState<PlayState>("paused");

  // Derived from events
  const [minDate, setMinDate] = React.useState<Date | null>(null);
  const [maxDate, setMaxDate] = React.useState<Date | null>(null);
  const [steps, setSteps] = React.useState<Date[]>([]);
  const [stepIndex, setStepIndex] = React.useState(0);

  const tickerRef = React.useRef<number | null>(null);

  // --- helpers ---
  function getLayer(): any | null {
    return eventsLayerRef?.current ?? null;
  }
  function parseLocalDate(d: string, t?: string | null): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
    if (!m) return null;
    const [_, yy, mm, dd] = m;
    let H = 0,
      M = 0;
    if (t && /^\d{2}:\d{2}$/.test(t)) {
      const [h, min] = t.split(":").map((x) => parseInt(x, 10));
      H = h;
      M = min;
    }
    return new Date(Number(yy), Number(mm) - 1, Number(dd), H, M, 0, 0);
  }
  function eventDateFromGraphic(g: any): Date | null {
    const a = g?.attributes || g?.attributes?.attributes;
    if (!a?.date) return null;
    return parseLocalDate(a.date, a.startAt ?? null);
  }
  function addInterval(d: Date, count: number, unit: Unit): Date {
    const next = new Date(d.getTime());
    switch (unit) {
      case "minute":
        next.setMinutes(next.getMinutes() + count);
        break;
      case "hour":
        next.setHours(next.getHours() + count);
        break;
      case "day":
        next.setDate(next.getDate() + count);
        break;
      case "week":
        next.setDate(next.getDate() + 7 * count);
        break;
      case "month":
        next.setMonth(next.getMonth() + count);
        break;
      case "year":
        next.setFullYear(next.getFullYear() + count);
        break;
    }
    return next;
  }
  function buildSteps(start: Date, end: Date, val: number, unit: Unit): Date[] {
    const out: Date[] = [];
    if (val <= 0) return out;
    let cur = new Date(start.getTime());
    while (cur <= end) {
      out.push(new Date(cur.getTime()));
      cur = addInterval(cur, val, unit);
    }
    if (out.length === 0) out.push(new Date(start.getTime()));
    return out;
  }
  function fmt(d: Date | null) {
    if (!d) return "—";
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // --- recompute domain (memoized) ---
  const recomputeDomain = React.useCallback(() => {
    const layer = getLayer();
    if (!layer?.graphics?.items) {
      if (minDate || maxDate || steps.length) {
        setMinDate(null);
        setMaxDate(null);
        setSteps([]);
        setStepIndex(0);
        setPlayState("paused");
      }
      return;
    }

    let minT = Infinity,
      maxT = -Infinity;
    for (const g of layer.graphics.items as any[]) {
      const dt = eventDateFromGraphic(g);
      if (!dt) continue;
      const t = dt.getTime();
      if (t < minT) minT = t;
      if (t > maxT) maxT = t;
    }
    if (!isFinite(minT) || !isFinite(maxT)) {
      if (minDate || maxDate || steps.length) {
        setMinDate(null);
        setMaxDate(null);
        setSteps([]);
        setStepIndex(0);
        setPlayState("paused");
      }
      return;
    }

    const newMin = new Date(minT);
    const newMax = new Date(maxT);

    const unchanged =
      minDate?.getTime() === newMin.getTime() &&
      maxDate?.getTime() === newMax.getTime();

    if (!unchanged) {
      setMinDate(newMin);
      setMaxDate(newMax);
      const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
      setSteps(s);
      setStepIndex(0);
      setPlayState("paused");
    } else {
      const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
      if (
        s.length !== steps.length ||
        s[0]?.getTime() !== steps[0]?.getTime() ||
        s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
      ) {
        setSteps(s);
        setStepIndex(0);
        setPlayState("paused");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalUnit, intervalValue, minDate, maxDate, steps.length]);

  // --- filtering (memoized) ---
  const applyFilter = React.useCallback(() => {
    const layer = getLayer();
    if (!layer?.graphics?.items) return;
    const items: any[] = layer.graphics.items;

    if (mode === "all") {
      items.forEach((g) => (g.visible = true));
      return;
    }
    if (mode === "single") {
      if (!singleDate) return items.forEach((g) => (g.visible = false));
      items.forEach((g) => {
        const dt = eventDateFromGraphic(g);
        if (!dt) return (g.visible = false);
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
          2,
          "0"
        )}-${String(dt.getDate()).padStart(2, "0")}`;
        g.visible = iso === singleDate;
      });
      return;
    }
    if (mode === "range") {
      if (!rangeStart && !rangeEnd)
        return items.forEach((g) => (g.visible = false));
      const s = rangeStart || rangeEnd;
      const e = rangeEnd || rangeStart;
      const sD = parseLocalDate(s!, null)!;
      const eD = addInterval(parseLocalDate(e!, null)!, 1, "day");
      items.forEach((g) => {
        const dt = eventDateFromGraphic(g);
        if (!dt) return (g.visible = false);
        g.visible = dt >= sD && dt < eD;
      });
      return;
    }
    if (mode === "timeline") {
      if (!minDate || !maxDate || steps.length === 0) {
        items.forEach((g) => (g.visible = true));
        return;
      }
      const start = steps[Math.min(stepIndex, steps.length - 1)];
      const end = addInterval(start, intervalValue, intervalUnit);
      items.forEach((g) => {
        const dt = eventDateFromGraphic(g);
        if (!dt) return (g.visible = false);
        g.visible = dt >= start && dt < end;
      });
    }
  }, [
    mode,
    singleDate,
    rangeStart,
    rangeEnd,
    stepIndex,
    steps,
    intervalUnit,
    intervalValue,
    minDate,
    maxDate,
  ]);

  // keep latest callbacks in refs
  const recomputeRef = React.useRef(recomputeDomain);
  const filterRef = React.useRef(applyFilter);
  React.useEffect(() => {
    recomputeRef.current = recomputeDomain;
  }, [recomputeDomain]);
  React.useEffect(() => {
    filterRef.current = applyFilter;
  }, [applyFilter]);

  // mount-only: attach listeners once
  React.useEffect(() => {
    // initial compute & filter
    recomputeRef.current();
    filterRef.current();

    let graphicsHandle: any = undefined;
    let raf = 0;
    function attachWhenReady() {
      const lyr = getLayer();
      if (lyr?.graphics?.on) {
        graphicsHandle = lyr.graphics.on("change", () => {
          recomputeRef.current();
          filterRef.current();
        });
        return;
      }
      raf = requestAnimationFrame(attachWhenReady);
    }
    attachWhenReady();

    const onAdded = () => {
      recomputeRef.current();
      filterRef.current();
    };
    eventsStore?.events?.addEventListener("added", onAdded);

    return () => {
      if (graphicsHandle?.remove) graphicsHandle.remove();
      if (raf) cancelAnimationFrame(raf);
      eventsStore?.events?.removeEventListener("added", onAdded);
    };
  }, []);

  // rebuild steps if domain or interval changed
  React.useEffect(() => {
    if (!minDate || !maxDate) return;
    const s = buildSteps(minDate, maxDate, intervalValue, intervalUnit);
    if (
      s.length !== steps.length ||
      s[0]?.getTime() !== steps[0]?.getTime() ||
      s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
    ) {
      setSteps(s);
      setStepIndex(0);
      setPlayState("paused");
    }
  }, [minDate, maxDate, intervalValue, intervalUnit]); // steps intentionally omitted

  // re-apply filter when inputs change
  React.useEffect(() => {
    applyFilter();
  }, [applyFilter]);

  // ticker (Play / Pause / Replay logic)
  React.useEffect(() => {
    if (playState === "playing" && steps.length > 0 && tickSeconds > 0) {
      if (tickerRef.current) window.clearInterval(tickerRef.current);
      tickerRef.current = window.setInterval(() => {
        setStepIndex((i) => {
          const last = steps.length - 1;
          if (i >= last) {
            setPlayState("ended");
            return last;
          }
          return i + 1;
        });
      }, Math.max(100, tickSeconds * 1000)) as unknown as number;
    } else {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }
    return () => {
      if (tickerRef.current) {
        window.clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    };
  }, [playState, tickSeconds, steps.length]);

  // UI
  if (!expanded) {
    return (
      <button
        aria-label="Open calendar"
        title="Open calendar"
        onClick={() => setExpanded(true)}
        style={fabStyle}
      >
        📅
      </button>
    );
  }

  const timelineStart = steps.length
    ? steps[Math.min(stepIndex, steps.length - 1)]
    : null;
  const timelineEnd =
    timelineStart &&
    fmt(addInterval(timelineStart, intervalValue, intervalUnit));
  const disableDates = mode === "all" || mode === "timeline";

  const mainBtnLabel =
    playState === "playing"
      ? "Pause"
      : playState === "ended"
      ? "Replay"
      : "Play";

  const handleMainBtn = () => {
    if (steps.length === 0) return;
    if (playState === "playing") {
      setPlayState("paused");
    } else if (playState === "ended") {
      setStepIndex(0);
      setPlayState("playing");
    } else {
      if (stepIndex >= steps.length - 1) setStepIndex(0);
      setPlayState("playing");
    }
  };

  return (
    <div style={panelWrap}>
      <div style={panelHeader}>
        <strong>Event Filters</strong>
        <button
          onClick={() => setExpanded(false)}
          style={iconBtn}
          title="Collapse"
        >
          ⤫
        </button>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {(["all", "single", "range", "timeline"] as Mode[]).map((m) => (
            <label
              key={m}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => {
                  setMode(m);
                  if (m !== "timeline" && playState !== "paused")
                    setPlayState("paused");
                }}
              />
              {m === "all" && "Show all"}
              {m === "single" && "Single day"}
              {m === "range" && "Range"}
              {m === "timeline" && "Timeline"}
            </label>
          ))}
        </div>

        {mode === "single" && (
          <div style={{ display: "grid", gap: 6 }}>
            <label style={label}>Date</label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              disabled={disableDates}
              style={input}
            />
          </div>
        )}

        {mode === "range" && (
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <label style={label}>From</label>
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                disabled={disableDates}
                style={input}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <label style={label}>To</label>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                disabled={disableDates}
                style={input}
              />
            </div>
          </div>
        )}

        {mode === "timeline" && (
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, color: "#555" }}>
              Domain: <b>{fmt(minDate)}</b> → <b>{fmt(maxDate)}</b>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label}>Interval value</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={intervalValue}
                  onChange={(e) => {
                    setIntervalValue(Math.max(1, Number(e.target.value || 1)));
                    setPlayState("paused");
                  }}
                  style={input}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <label style={label}>Interval unit</label>
                <select
                  value={intervalUnit}
                  onChange={(e) => {
                    setIntervalUnit(e.target.value as Unit);
                    setPlayState("paused");
                  }}
                  style={input}
                >
                  <option value="minute">Minutes</option>
                  <option value="hour">Hours</option>
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                  <option value="year">Years</option>
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={label}>
                Window: <b>{fmt(timelineStart)}</b> → <b>{timelineEnd}</b>
              </label>
              <input
                type="range"
                min={0}
                max={Math.max(0, steps.length - 1)}
                step={1}
                value={Math.min(stepIndex, Math.max(0, steps.length - 1))}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setStepIndex(idx);
                  if (steps.length > 0) {
                    const last = steps.length - 1;
                    if (idx >= last) setPlayState("ended");
                    else if (playState === "ended") setPlayState("paused");
                  }
                }}
              />
              <div style={{ fontSize: 11, color: "#666" }}>
                Steps: {steps.length || 0}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={handleMainBtn}
                style={btnPrimary}
                disabled={steps.length === 0}
              >
                {mainBtnLabel}
              </button>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={label}>Tick speed (seconds)</label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={tickSeconds}
                  onChange={(e) =>
                    setTickSeconds(Math.max(0.1, Number(e.target.value || 1)))
                  }
                  style={input}
                />
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setStepIndex((i) => {
                      const next = Math.max(0, i - 1);
                      if (playState === "ended" && next < steps.length - 1)
                        setPlayState("paused");
                      return next;
                    });
                  }}
                  style={btn}
                  disabled={steps.length === 0}
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStepIndex((i) => {
                      if (steps.length === 0) return i;
                      const last = steps.length - 1;
                      const next = Math.min(last, i + 1);
                      if (next >= last) setPlayState("ended");
                      return next;
                    });
                  }}
                  style={btn}
                  disabled={steps.length === 0}
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setMode("all");
              setSingleDate("");
              setRangeStart("");
              setRangeEnd("");
              setPlayState("paused");
              setStepIndex(0);
              applyFilter();
            }}
            style={btnPrimary}
          >
            Show all
          </button>

          {(mode === "single" || mode === "range") && (
            <button type="button" onClick={applyFilter} style={btn}>
              Apply
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Styles */
const panelWrap: React.CSSProperties = {
  position: "absolute",

  top: "17px",
  right: "450px",
  zIndex: 1000,
  background: "white",
  border: "4px solid #000000ff",
  borderRadius: 12,
  padding: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  width: 360,
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  pointerEvents: "auto",
};
const panelHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 8,
};
const label: React.CSSProperties = { fontSize: 12, color: "#444" };
const input: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 700,
  borderRadius: 8,
  border: "1px solid #ccc",
  background: "#f6f6f6",
  cursor: "pointer",
};
const btnPrimary: React.CSSProperties = {
  padding: "8px 10px",
  fontWeight: 800,
  borderRadius: 8,
  border: "1px solid #222",
  background: "#ffd166",
  cursor: "pointer",
};
const iconBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
  padding: 4,
};
const fabStyle: React.CSSProperties = {
  position: "absolute",
  top: "17px",
  right: "450px",
  zIndex: 1000,
  width: 44,
  height: 44,
  borderRadius: "50%",
  border: "4px solid #000000ff",
  background: "white",
  boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
  cursor: "pointer",
  fontSize: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
};

//current working bellow
// "use client";

// import React from "react";
// import { eventsLayerRef, eventsStore } from "../arcgisRefs";

// type Mode = "all" | "single" | "range" | "timeline";
// type Unit = "minute" | "hour" | "day" | "week" | "month" | "year";
// type PlayState = "paused" | "playing" | "ended";

// export default function EventCalendarOverlay() {
//   const [expanded, setExpanded] = React.useState(true);

//   const [mode, setMode] = React.useState<Mode>("all");
//   const [singleDate, setSingleDate] = React.useState("");
//   const [rangeStart, setRangeStart] = React.useState("");
//   const [rangeEnd, setRangeEnd] = React.useState("");

//   // Timeline controls
//   const [intervalValue, setIntervalValue] = React.useState(1);
//   const [intervalUnit, setIntervalUnit] = React.useState<Unit>("day");
//   const [tickSeconds, setTickSeconds] = React.useState(1);
//   const [playState, setPlayState] = React.useState<PlayState>("paused");

//   // Derived from events
//   const [minDate, setMinDate] = React.useState<Date | null>(null);
//   const [maxDate, setMaxDate] = React.useState<Date | null>(null);
//   const [steps, setSteps] = React.useState<Date[]>([]);
//   const [stepIndex, setStepIndex] = React.useState(0);

//   const tickerRef = React.useRef<number | null>(null);

//   // --- helpers ---
//   function getLayer(): any | null {
//     return eventsLayerRef?.current ?? null;
//   }
//   function parseLocalDate(d: string, t?: string | null): Date | null {
//     const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
//     if (!m) return null;
//     const [_, yy, mm, dd] = m;
//     let H = 0,
//       M = 0;
//     if (t && /^\d{2}:\d{2}$/.test(t)) {
//       const [h, min] = t.split(":").map((x) => parseInt(x, 10));
//       H = h;
//       M = min;
//     }
//     return new Date(Number(yy), Number(mm) - 1, Number(dd), H, M, 0, 0);
//   }
//   function eventDateFromGraphic(g: any): Date | null {
//     const a = g?.attributes || g?.attributes?.attributes;
//     if (!a?.date) return null;
//     return parseLocalDate(a.date, a.startAt ?? null);
//   }
//   function addInterval(d: Date, count: number, unit: Unit): Date {
//     const next = new Date(d.getTime());
//     switch (unit) {
//       case "minute":
//         next.setMinutes(next.getMinutes() + count);
//         break;
//       case "hour":
//         next.setHours(next.getHours() + count);
//         break;
//       case "day":
//         next.setDate(next.getDate() + count);
//         break;
//       case "week":
//         next.setDate(next.getDate() + 7 * count);
//         break;
//       case "month":
//         next.setMonth(next.getMonth() + count);
//         break;
//       case "year":
//         next.setFullYear(next.getFullYear() + count);
//         break;
//     }
//     return next;
//   }
//   function buildSteps(start: Date, end: Date, val: number, unit: Unit): Date[] {
//     const out: Date[] = [];
//     if (val <= 0) return out;
//     let cur = new Date(start.getTime());
//     while (cur <= end) {
//       out.push(new Date(cur.getTime()));
//       cur = addInterval(cur, val, unit);
//     }
//     if (out.length === 0) out.push(new Date(start.getTime()));
//     return out;
//   }
//   function fmt(d: Date | null) {
//     if (!d) return "—";
//     const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//     return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
//       d.getDate()
//     )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
//   }

//   // --- recompute domain (memoized) ---
//   const recomputeDomain = React.useCallback(() => {
//     const layer = getLayer();
//     if (!layer?.graphics?.items) {
//       if (minDate || maxDate || steps.length) {
//         setMinDate(null);
//         setMaxDate(null);
//         setSteps([]);
//         setStepIndex(0);
//         setPlayState("paused");
//       }
//       return;
//     }

//     let minT = Infinity,
//       maxT = -Infinity;
//     for (const g of layer.graphics.items as any[]) {
//       const dt = eventDateFromGraphic(g);
//       if (!dt) continue;
//       const t = dt.getTime();
//       if (t < minT) minT = t;
//       if (t > maxT) maxT = t;
//     }
//     if (!isFinite(minT) || !isFinite(maxT)) {
//       if (minDate || maxDate || steps.length) {
//         setMinDate(null);
//         setMaxDate(null);
//         setSteps([]);
//         setStepIndex(0);
//         setPlayState("paused");
//       }
//       return;
//     }

//     const newMin = new Date(minT);
//     const newMax = new Date(maxT);

//     // Avoid unnecessary state updates
//     const unchanged =
//       minDate?.getTime() === newMin.getTime() &&
//       maxDate?.getTime() === newMax.getTime();

//     if (!unchanged) {
//       setMinDate(newMin);
//       setMaxDate(newMax);
//       const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
//       setSteps(s);
//       setStepIndex(0);
//       setPlayState("paused");
//     } else {
//       // Domain unchanged, but interval might have changed elsewhere
//       const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
//       if (
//         s.length !== steps.length ||
//         s[0]?.getTime() !== steps[0]?.getTime() ||
//         s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
//       ) {
//         setSteps(s);
//         setStepIndex(0);
//         setPlayState("paused");
//       }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [intervalUnit, intervalValue, minDate, maxDate, steps.length]);

//   // --- filtering (memoized) ---
//   const applyFilter = React.useCallback(() => {
//     const layer = getLayer();
//     if (!layer?.graphics?.items) return;
//     const items: any[] = layer.graphics.items;

//     if (mode === "all") {
//       items.forEach((g) => (g.visible = true));
//       return;
//     }
//     if (mode === "single") {
//       if (!singleDate) return items.forEach((g) => (g.visible = false));
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
//           2,
//           "0"
//         )}-${String(dt.getDate()).padStart(2, "0")}`;
//         g.visible = iso === singleDate;
//       });
//       return;
//     }
//     if (mode === "range") {
//       if (!rangeStart && !rangeEnd)
//         return items.forEach((g) => (g.visible = false));
//       const s = rangeStart || rangeEnd;
//       const e = rangeEnd || rangeStart;
//       const sD = parseLocalDate(s!, null)!;
//       const eD = addInterval(parseLocalDate(e!, null)!, 1, "day");
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         g.visible = dt >= sD && dt < eD;
//       });
//       return;
//     }
//     if (mode === "timeline") {
//       if (!minDate || !maxDate || steps.length === 0) {
//         items.forEach((g) => (g.visible = true));
//         return;
//       }
//       const start = steps[Math.min(stepIndex, steps.length - 1)];
//       const end = addInterval(start, intervalValue, intervalUnit);
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         g.visible = dt >= start && dt < end;
//       });
//     }
//   }, [
//     mode,
//     singleDate,
//     rangeStart,
//     rangeEnd,
//     stepIndex,
//     steps,
//     intervalUnit,
//     intervalValue,
//     minDate,
//     maxDate,
//   ]);

//   // --- keep latest callbacks in refs to avoid effect dependency loops ---
//   const recomputeRef = React.useRef(recomputeDomain);
//   const filterRef = React.useRef(applyFilter);
//   React.useEffect(() => {
//     recomputeRef.current = recomputeDomain;
//   }, [recomputeDomain]);
//   React.useEffect(() => {
//     filterRef.current = applyFilter;
//   }, [applyFilter]);

//   // --- mount-only: attach listeners once, call via refs (prevents loops) ---
//   React.useEffect(() => {
//     // Initial compute & filter
//     recomputeRef.current();
//     filterRef.current();

//     let graphicsHandle: any = undefined;
//     let raf = 0;

//     function attachWhenReady() {
//       const lyr = getLayer();
//       if (lyr?.graphics?.on) {
//         graphicsHandle = lyr.graphics.on("change", () => {
//           recomputeRef.current();
//           filterRef.current();
//         });
//         return;
//       }
//       raf = requestAnimationFrame(attachWhenReady);
//     }
//     attachWhenReady();

//     const onAdded = () => {
//       recomputeRef.current();
//       filterRef.current();
//     };
//     eventsStore?.events?.addEventListener("added", onAdded);

//     return () => {
//       if (graphicsHandle?.remove) graphicsHandle.remove();
//       if (raf) cancelAnimationFrame(raf);
//       eventsStore?.events?.removeEventListener("added", onAdded);
//     };
//   }, []); // ← runs once

//   // --- rebuild steps if domain or interval changed ---
//   React.useEffect(() => {
//     if (!minDate || !maxDate) return;
//     const s = buildSteps(minDate, maxDate, intervalValue, intervalUnit);
//     if (
//       s.length !== steps.length ||
//       s[0]?.getTime() !== steps[0]?.getTime() ||
//       s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
//     ) {
//       setSteps(s);
//       setStepIndex(0);
//       setPlayState("paused");
//     }
//   }, [minDate, maxDate, intervalValue, intervalUnit]); // steps intentionally omitted

//   // --- re-apply filter when inputs change ---
//   React.useEffect(() => {
//     applyFilter();
//   }, [applyFilter]);

//   // --- ticker (Play / Pause / Replay logic) ---
//   React.useEffect(() => {
//     if (playState === "playing" && steps.length > 0 && tickSeconds > 0) {
//       if (tickerRef.current) window.clearInterval(tickerRef.current);
//       tickerRef.current = window.setInterval(() => {
//         setStepIndex((i) => {
//           const last = steps.length - 1;
//           if (i >= last) {
//             // reached the end -> stop, mark as ended, stay on last frame
//             setPlayState("ended");
//             return last;
//           }
//           return i + 1;
//         });
//       }, Math.max(100, tickSeconds * 1000)) as unknown as number;
//     } else {
//       if (tickerRef.current) {
//         window.clearInterval(tickerRef.current);
//         tickerRef.current = null;
//       }
//     }
//     return () => {
//       if (tickerRef.current) {
//         window.clearInterval(tickerRef.current);
//         tickerRef.current = null;
//       }
//     };
//   }, [playState, tickSeconds, steps.length]);

//   // --- UI ---
//   if (!expanded) {
//     return (
//       <button
//         aria-label="Open calendar"
//         title="Open calendar"
//         onClick={() => setExpanded(true)}
//         style={fabStyle}
//       >
//         📅
//       </button>
//     );
//   }

//   const timelineStart = steps.length
//     ? steps[Math.min(stepIndex, steps.length - 1)]
//     : null;
//   const timelineEnd =
//     timelineStart &&
//     fmt(addInterval(timelineStart, intervalValue, intervalUnit));
//   const disableDates = mode === "all" || mode === "timeline";

//   const mainBtnLabel =
//     playState === "playing"
//       ? "Pause"
//       : playState === "ended"
//       ? "Replay"
//       : "Play";
//   const handleMainBtn = () => {
//     if (steps.length === 0) return;
//     if (playState === "playing") {
//       setPlayState("paused");
//     } else if (playState === "ended") {
//       setStepIndex(0);
//       setPlayState("playing");
//     } else {
//       // paused -> play
//       // if we happen to be at the end (e.g., dragged to last), reset to start
//       if (stepIndex >= steps.length - 1) setStepIndex(0);
//       setPlayState("playing");
//     }
//   };

//   return (
//     <div style={panelWrap}>
//       <div style={panelHeader}>
//         <strong>Event Filters</strong>
//         <button
//           onClick={() => setExpanded(false)}
//           style={iconBtn}
//           title="Collapse"
//         >
//           ⤫
//         </button>
//       </div>

//       <div style={{ display: "grid", gap: 10 }}>
//         <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
//           {(["all", "single", "range", "timeline"] as Mode[]).map((m) => (
//             <label
//               key={m}
//               style={{ display: "flex", alignItems: "center", gap: 6 }}
//             >
//               <input
//                 type="radio"
//                 name="mode"
//                 value={m}
//                 checked={mode === m}
//                 onChange={() => {
//                   setMode(m);
//                   // leaving timeline? stop playback
//                   if (m !== "timeline" && playState !== "paused")
//                     setPlayState("paused");
//                 }}
//               />
//               {m === "all" && "Show all"}
//               {m === "single" && "Single day"}
//               {m === "range" && "Range"}
//               {m === "timeline" && "Timeline"}
//             </label>
//           ))}
//         </div>

//         {mode === "single" && (
//           <div style={{ display: "grid", gap: 6 }}>
//             <label style={label}>Date</label>
//             <input
//               type="date"
//               value={singleDate}
//               onChange={(e) => setSingleDate(e.target.value)}
//               disabled={disableDates}
//               style={input}
//             />
//           </div>
//         )}

//         {mode === "range" && (
//           <div
//             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
//           >
//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>From</label>
//               <input
//                 type="date"
//                 value={rangeStart}
//                 onChange={(e) => setRangeStart(e.target.value)}
//                 disabled={disableDates}
//                 style={input}
//               />
//             </div>
//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>To</label>
//               <input
//                 type="date"
//                 value={rangeEnd}
//                 onChange={(e) => setRangeEnd(e.target.value)}
//                 disabled={disableDates}
//                 style={input}
//               />
//             </div>
//           </div>
//         )}

//         {mode === "timeline" && (
//           <div style={{ display: "grid", gap: 10 }}>
//             <div style={{ fontSize: 12, color: "#555" }}>
//               Domain: <b>{fmt(minDate)}</b> → <b>{fmt(maxDate)}</b>
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 8,
//               }}
//             >
//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Interval value</label>
//                 <input
//                   type="number"
//                   min={1}
//                   step={1}
//                   value={intervalValue}
//                   onChange={(e) => {
//                     setIntervalValue(Math.max(1, Number(e.target.value || 1)));
//                     setPlayState("paused");
//                   }}
//                   style={input}
//                 />
//               </div>
//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Interval unit</label>
//                 <select
//                   value={intervalUnit}
//                   onChange={(e) => {
//                     setIntervalUnit(e.target.value as Unit);
//                     setPlayState("paused");
//                   }}
//                   style={input}
//                 >
//                   <option value="minute">Minutes</option>
//                   <option value="hour">Hours</option>
//                   <option value="day">Days</option>
//                   <option value="week">Weeks</option>
//                   <option value="month">Months</option>
//                   <option value="year">Years</option>
//                 </select>
//               </div>
//             </div>

//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>
//                 Window: <b>{fmt(timelineStart)}</b> → <b>{timelineEnd}</b>
//               </label>
//               <input
//                 type="range"
//                 min={0}
//                 max={Math.max(0, steps.length - 1)}
//                 step={1}
//                 value={Math.min(stepIndex, Math.max(0, steps.length - 1))}
//                 onChange={(e) => {
//                   const idx = Number(e.target.value);
//                   setStepIndex(idx);
//                   if (steps.length > 0) {
//                     const last = steps.length - 1;
//                     if (idx >= last) setPlayState("ended");
//                     else if (playState === "ended") setPlayState("paused");
//                   }
//                 }}
//               />
//               <div style={{ fontSize: 11, color: "#666" }}>
//                 Steps: {steps.length || 0}
//               </div>
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "auto 1fr auto",
//                 gap: 8,
//                 alignItems: "center",
//               }}
//             >
//               <button
//                 type="button"
//                 onClick={handleMainBtn}
//                 style={btnPrimary}
//                 disabled={steps.length === 0}
//               >
//                 {mainBtnLabel}
//               </button>

//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Tick speed (seconds)</label>
//                 <input
//                   type="number"
//                   min={0.1}
//                   step={0.1}
//                   value={tickSeconds}
//                   onChange={(e) =>
//                     setTickSeconds(Math.max(0.1, Number(e.target.value || 1)))
//                   }
//                   style={input}
//                 />
//               </div>

//   <div style={{ display: "flex", gap: 6 }}>
//     <button
//       type="button"
//       onClick={() => {
//         setStepIndex((i) => {
//           const next = Math.max(0, i - 1);
//           if (playState === "ended" && next < steps.length - 1)
//             setPlayState("paused");
//           return next;
//         });
//       }}
//       style={btn}
//       disabled={steps.length === 0}
//     >
//       ◀
//     </button>
//     <button
//       type="button"
//       onClick={() => {
//         setStepIndex((i) => {
//           if (steps.length === 0) return i;
//           const last = steps.length - 1;
//           const next = Math.min(last, i + 1);
//           if (next >= last) setPlayState("ended");
//           return next;
//         });
//       }}
//       style={btn}
//       disabled={steps.length === 0}
//     >
//       ▶
//     </button>
//   </div>
//             </div>
//           </div>
//         )}

//         <div style={{ display: "flex", gap: 8 }}>
//           <button
//             type="button"
//             onClick={() => {
//               setMode("all");
//               setSingleDate("");
//               setRangeStart("");
//               setRangeEnd("");
//               setPlayState("paused");
//               setStepIndex(0);
//               applyFilter();
//             }}
//             style={btnPrimary}
//           >
//             Show all
//           </button>

//           {(mode === "single" || mode === "range") && (
//             <button type="button" onClick={applyFilter} style={btn}>
//               Apply
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// /* Styles */
// const panelWrap: React.CSSProperties = {
//   position: "absolute",
//   top: "25px",
//   right: "150px",
//   zIndex: 1000,
//   background: "white",
//   border: "4px solid #000000ff",
//   borderRadius: 12,
//   padding: 12,
//   boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
//   width: 360,
//   fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
//   pointerEvents: "auto",
// };
// const panelHeader: React.CSSProperties = {
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "space-between",
//   marginBottom: 8,
// };
// const label: React.CSSProperties = { fontSize: 12, color: "#444" };
// const input: React.CSSProperties = {
//   padding: "6px 8px",
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   fontSize: 14,
// };
// const btn: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 700,
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   background: "#f6f6f6",
//   cursor: "pointer",
// };
// const btnPrimary: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 800,
//   borderRadius: 8,
//   border: "1px solid #222",
//   background: "#ffd166",
//   cursor: "pointer",
// };
// const iconBtn: React.CSSProperties = {
//   border: "none",
//   background: "transparent",
//   cursor: "pointer",
//   fontSize: 16,
//   lineHeight: 1,
//   padding: 4,
// };
// const fabStyle: React.CSSProperties = {
//   position: "absolute",
//   top: "25px",
//   right: "150px",
//   zIndex: 1000,
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "1px solid #ddd",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   pointerEvents: "auto",
// };

// "use client";

// import React from "react";
// import { eventsLayerRef, eventsStore } from "../arcgisRefs";

// type Mode = "all" | "single" | "range" | "timeline";
// type Unit = "minute" | "hour" | "day" | "week" | "month" | "year";

// export default function EventCalendarOverlay() {
//   const [expanded, setExpanded] = React.useState(true);

//   const [mode, setMode] = React.useState<Mode>("all");
//   const [singleDate, setSingleDate] = React.useState("");
//   const [rangeStart, setRangeStart] = React.useState("");
//   const [rangeEnd, setRangeEnd] = React.useState("");

//   // Timeline controls
//   const [intervalValue, setIntervalValue] = React.useState(1);
//   const [intervalUnit, setIntervalUnit] = React.useState<Unit>("day");
//   const [tickSeconds, setTickSeconds] = React.useState(1);
//   const [isPlaying, setIsPlaying] = React.useState(false);

//   // Derived from events
//   const [minDate, setMinDate] = React.useState<Date | null>(null);
//   const [maxDate, setMaxDate] = React.useState<Date | null>(null);
//   const [steps, setSteps] = React.useState<Date[]>([]);
//   const [stepIndex, setStepIndex] = React.useState(0);

//   const tickerRef = React.useRef<number | null>(null);

//   // --- helpers ---
//   function getLayer(): any | null {
//     return eventsLayerRef?.current ?? null;
//   }
//   function parseLocalDate(d: string, t?: string | null): Date | null {
//     const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
//     if (!m) return null;
//     const [_, yy, mm, dd] = m;
//     let H = 0,
//       M = 0;
//     if (t && /^\d{2}:\d{2}$/.test(t)) {
//       const [h, min] = t.split(":").map((x) => parseInt(x, 10));
//       H = h;
//       M = min;
//     }
//     return new Date(Number(yy), Number(mm) - 1, Number(dd), H, M, 0, 0);
//   }
//   function eventDateFromGraphic(g: any): Date | null {
//     const a = g?.attributes || g?.attributes?.attributes;
//     if (!a?.date) return null;
//     return parseLocalDate(a.date, a.startAt ?? null);
//   }
//   function addInterval(d: Date, count: number, unit: Unit): Date {
//     const next = new Date(d.getTime());
//     switch (unit) {
//       case "minute":
//         next.setMinutes(next.getMinutes() + count);
//         break;
//       case "hour":
//         next.setHours(next.getHours() + count);
//         break;
//       case "day":
//         next.setDate(next.getDate() + count);
//         break;
//       case "week":
//         next.setDate(next.getDate() + 7 * count);
//         break;
//       case "month":
//         next.setMonth(next.getMonth() + count);
//         break;
//       case "year":
//         next.setFullYear(next.getFullYear() + count);
//         break;
//     }
//     return next;
//   }
//   function buildSteps(start: Date, end: Date, val: number, unit: Unit): Date[] {
//     const out: Date[] = [];
//     if (val <= 0) return out;
//     let cur = new Date(start.getTime());
//     while (cur <= end) {
//       out.push(new Date(cur.getTime()));
//       cur = addInterval(cur, val, unit);
//     }
//     if (out.length === 0) out.push(new Date(start.getTime()));
//     return out;
//   }
//   function fmt(d: Date | null) {
//     if (!d) return "—";
//     const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
//     return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
//       d.getDate()
//     )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
//   }

//   // --- recompute domain (memoized) ---
//   const recomputeDomain = React.useCallback(() => {
//     const layer = getLayer();
//     if (!layer?.graphics?.items) {
//       if (minDate || maxDate || steps.length) {
//         setMinDate(null);
//         setMaxDate(null);
//         setSteps([]);
//         setStepIndex(0);
//       }
//       return;
//     }

//     let minT = Infinity,
//       maxT = -Infinity;
//     for (const g of layer.graphics.items as any[]) {
//       const dt = eventDateFromGraphic(g);
//       if (!dt) continue;
//       const t = dt.getTime();
//       if (t < minT) minT = t;
//       if (t > maxT) maxT = t;
//     }
//     if (!isFinite(minT) || !isFinite(maxT)) {
//       if (minDate || maxDate || steps.length) {
//         setMinDate(null);
//         setMaxDate(null);
//         setSteps([]);
//         setStepIndex(0);
//       }
//       return;
//     }

//     const newMin = new Date(minT);
//     const newMax = new Date(maxT);

//     // Avoid unnecessary state updates
//     const unchanged =
//       minDate?.getTime() === newMin.getTime() &&
//       maxDate?.getTime() === newMax.getTime();

//     if (!unchanged) {
//       setMinDate(newMin);
//       setMaxDate(newMax);
//       const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
//       setSteps(s);
//       setStepIndex(0);
//     } else {
//       // Domain unchanged, but interval might have changed elsewhere
//       const s = buildSteps(newMin, newMax, intervalValue, intervalUnit);
//       // Only set if length/bounds differ to avoid churn
//       if (
//         s.length !== steps.length ||
//         s[0]?.getTime() !== steps[0]?.getTime() ||
//         s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
//       ) {
//         setSteps(s);
//         setStepIndex(0);
//       }
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [intervalUnit, intervalValue, minDate, maxDate, steps.length]);

//   // --- filtering (memoized) ---
//   const applyFilter = React.useCallback(() => {
//     const layer = getLayer();
//     if (!layer?.graphics?.items) return;
//     const items: any[] = layer.graphics.items;

//     if (mode === "all") {
//       items.forEach((g) => (g.visible = true));
//       return;
//     }
//     if (mode === "single") {
//       if (!singleDate) return items.forEach((g) => (g.visible = false));
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(
//           2,
//           "0"
//         )}-${String(dt.getDate()).padStart(2, "0")}`;
//         g.visible = iso === singleDate;
//       });
//       return;
//     }
//     if (mode === "range") {
//       if (!rangeStart && !rangeEnd)
//         return items.forEach((g) => (g.visible = false));
//       const s = rangeStart || rangeEnd;
//       const e = rangeEnd || rangeStart;
//       const sD = parseLocalDate(s!, null)!;
//       const eD = addInterval(parseLocalDate(e!, null)!, 1, "day");
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         g.visible = dt >= sD && dt < eD;
//       });
//       return;
//     }
//     if (mode === "timeline") {
//       if (!minDate || !maxDate || steps.length === 0) {
//         items.forEach((g) => (g.visible = true));
//         return;
//       }
//       const start = steps[Math.min(stepIndex, steps.length - 1)];
//       const end = addInterval(start, intervalValue, intervalUnit);
//       items.forEach((g) => {
//         const dt = eventDateFromGraphic(g);
//         if (!dt) return (g.visible = false);
//         g.visible = dt >= start && dt < end;
//       });
//     }
//   }, [
//     mode,
//     singleDate,
//     rangeStart,
//     rangeEnd,
//     stepIndex,
//     steps,
//     intervalUnit,
//     intervalValue,
//     minDate,
//     maxDate,
//   ]);

//   // --- keep latest callbacks in refs to avoid effect dependency loops ---
//   const recomputeRef = React.useRef(recomputeDomain);
//   const filterRef = React.useRef(applyFilter);
//   React.useEffect(() => {
//     recomputeRef.current = recomputeDomain;
//   }, [recomputeDomain]);
//   React.useEffect(() => {
//     filterRef.current = applyFilter;
//   }, [applyFilter]);

//   // --- mount-only: attach listeners once, call via refs (prevents loops) ---
//   React.useEffect(() => {
//     // Initial compute on mount
//     recomputeRef.current();
//     filterRef.current();

//     let graphicsHandle: any = undefined;
//     let raf = 0;

//     function attachWhenReady() {
//       const lyr = getLayer();
//       if (lyr?.graphics?.on) {
//         graphicsHandle = lyr.graphics.on("change", () => {
//           // Only call latest versions
//           recomputeRef.current();
//           filterRef.current();
//         });
//         return;
//       }
//       raf = requestAnimationFrame(attachWhenReady);
//     }
//     attachWhenReady();

//     const onAdded = () => {
//       recomputeRef.current();
//       filterRef.current();
//     };
//     eventsStore?.events?.addEventListener("added", onAdded);

//     return () => {
//       if (graphicsHandle?.remove) graphicsHandle.remove();
//       if (raf) cancelAnimationFrame(raf);
//       eventsStore?.events?.removeEventListener("added", onAdded);
//     };
//   }, []); // ← runs once

//   // --- rebuild steps if domain or interval changed (no listener churn) ---
//   React.useEffect(() => {
//     if (!minDate || !maxDate) return;
//     const s = buildSteps(minDate, maxDate, intervalValue, intervalUnit);
//     // Avoid unnecessary updates
//     if (
//       s.length !== steps.length ||
//       s[0]?.getTime() !== steps[0]?.getTime() ||
//       s[s.length - 1]?.getTime() !== steps[steps.length - 1]?.getTime()
//     ) {
//       setSteps(s);
//       setStepIndex(0);
//     }
//   }, [minDate, maxDate, intervalValue, intervalUnit]); // steps deliberately omitted

//   // --- re-apply filter when inputs change ---
//   React.useEffect(() => {
//     applyFilter();
//   }, [applyFilter]);

//   // --- ticker ---
//   React.useEffect(() => {
//     if (isPlaying && steps.length > 0 && tickSeconds > 0) {
//       if (tickerRef.current) window.clearInterval(tickerRef.current);
//       tickerRef.current = window.setInterval(() => {
//         setStepIndex((i) => (i + 1) % steps.length);
//       }, Math.max(100, tickSeconds * 1000)) as unknown as number;
//     } else {
//       if (tickerRef.current) {
//         window.clearInterval(tickerRef.current);
//         tickerRef.current = null;
//       }
//     }
//     return () => {
//       if (tickerRef.current) {
//         window.clearInterval(tickerRef.current);
//         tickerRef.current = null;
//       }
//     };
//   }, [isPlaying, tickSeconds, steps.length]);

//   // --- UI ---
//   if (!expanded) {
//     return (
//       <button
//         aria-label="Open calendar"
//         title="Open calendar"
//         onClick={() => setExpanded(true)}
//         style={fabStyle}
//       >
//         📅
//       </button>
//     );
//   }

//   const timelineStart = steps.length
//     ? steps[Math.min(stepIndex, steps.length - 1)]
//     : null;
//   const timelineEnd =
//     timelineStart &&
//     fmt(addInterval(timelineStart, intervalValue, intervalUnit));
//   const disableDates = mode === "all" || mode === "timeline";

//   return (
//     <div style={panelWrap}>
//       <div style={panelHeader}>
//         <strong>Event Filters</strong>
//         <button
//           onClick={() => setExpanded(false)}
//           style={iconBtn}
//           title="Collapse"
//         >
//           ⤫
//         </button>
//       </div>

//       <div style={{ display: "grid", gap: 10 }}>
//         <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
//           {(["all", "single", "range", "timeline"] as Mode[]).map((m) => (
//             <label
//               key={m}
//               style={{ display: "flex", alignItems: "center", gap: 6 }}
//             >
//               <input
//                 type="radio"
//                 name="mode"
//                 value={m}
//                 checked={mode === m}
//                 onChange={() => setMode(m)}
//               />
//               {m === "all" && "Show all"}
//               {m === "single" && "Single day"}
//               {m === "range" && "Range"}
//               {m === "timeline" && "Timeline"}
//             </label>
//           ))}
//         </div>

//         {mode === "single" && (
//           <div style={{ display: "grid", gap: 6 }}>
//             <label style={label}>Date</label>
//             <input
//               type="date"
//               value={singleDate}
//               onChange={(e) => setSingleDate(e.target.value)}
//               disabled={disableDates}
//               style={input}
//             />
//           </div>
//         )}

//         {mode === "range" && (
//           <div
//             style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
//           >
//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>From</label>
//               <input
//                 type="date"
//                 value={rangeStart}
//                 onChange={(e) => setRangeStart(e.target.value)}
//                 disabled={disableDates}
//                 style={input}
//               />
//             </div>
//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>To</label>
//               <input
//                 type="date"
//                 value={rangeEnd}
//                 onChange={(e) => setRangeEnd(e.target.value)}
//                 disabled={disableDates}
//                 style={input}
//               />
//             </div>
//           </div>
//         )}

//         {mode === "timeline" && (
//           <div style={{ display: "grid", gap: 10 }}>
//             <div style={{ fontSize: 12, color: "#555" }}>
//               Domain: <b>{fmt(minDate)}</b> → <b>{fmt(maxDate)}</b>
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "1fr 1fr",
//                 gap: 8,
//               }}
//             >
//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Interval value</label>
//                 <input
//                   type="number"
//                   min={1}
//                   step={1}
//                   value={intervalValue}
//                   onChange={(e) =>
//                     setIntervalValue(Math.max(1, Number(e.target.value || 1)))
//                   }
//                   style={input}
//                 />
//               </div>
//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Interval unit</label>
//                 <select
//                   value={intervalUnit}
//                   onChange={(e) => setIntervalUnit(e.target.value as Unit)}
//                   style={input}
//                 >
//                   <option value="minute">Minutes</option>
//                   <option value="hour">Hours</option>
//                   <option value="day">Days</option>
//                   <option value="week">Weeks</option>
//                   <option value="month">Months</option>
//                   <option value="year">Years</option>
//                 </select>
//               </div>
//             </div>

//             <div style={{ display: "grid", gap: 6 }}>
//               <label style={label}>
//                 Window: <b>{fmt(timelineStart)}</b> → <b>{timelineEnd}</b>
//               </label>
//               <input
//                 type="range"
//                 min={0}
//                 max={Math.max(0, steps.length - 1)}
//                 step={1}
//                 value={Math.min(stepIndex, Math.max(0, steps.length - 1))}
//                 onChange={(e) => setStepIndex(Number(e.target.value))}
//               />
//               <div style={{ fontSize: 11, color: "#666" }}>
//                 Steps: {steps.length || 0}
//               </div>
//             </div>

//             <div
//               style={{
//                 display: "grid",
//                 gridTemplateColumns: "auto 1fr auto",
//                 gap: 8,
//                 alignItems: "center",
//               }}
//             >
//               <button
//                 type="button"
//                 onClick={() => setIsPlaying((p) => !p)}
//                 style={btnPrimary}
//                 disabled={steps.length === 0}
//               >
//                 {isPlaying ? "Pause" : "Play"}
//               </button>

//               <div style={{ display: "grid", gap: 6 }}>
//                 <label style={label}>Tick speed (seconds)</label>
//                 <input
//                   type="number"
//                   min={0.1}
//                   step={0.1}
//                   value={tickSeconds}
//                   onChange={(e) =>
//                     setTickSeconds(Math.max(0.1, Number(e.target.value || 1)))
//                   }
//                   style={input}
//                 />
//               </div>

//               <div style={{ display: "flex", gap: 6 }}>
//                 <button
//                   type="button"
//                   onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
//                   style={btn}
//                   disabled={steps.length === 0}
//                 >
//                   ◀
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() =>
//                     setStepIndex((i) => Math.min(steps.length - 1, i + 1))
//                   }
//                   style={btn}
//                   disabled={steps.length === 0}
//                 >
//                   ▶
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         <div style={{ display: "flex", gap: 8 }}>
//           <button
//             type="button"
//             onClick={() => {
//               setMode("all");
//               setSingleDate("");
//               setRangeStart("");
//               setRangeEnd("");
//               setIsPlaying(false);
//               setStepIndex(0);
//               applyFilter();
//             }}
//             style={btnPrimary}
//           >
//             Show all
//           </button>

//           {(mode === "single" || mode === "range") && (
//             <button type="button" onClick={applyFilter} style={btn}>
//               Apply
//             </button>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }

// /* Styles */
// const panelWrap: React.CSSProperties = {
//   position: "absolute",
//   top: 12,
//   right: 12,
//   zIndex: 1000,
//   background: "white",
//   border: "1px solid #ddd",
//   borderRadius: 12,
//   padding: 12,
//   boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
//   width: 360,
//   fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
//   pointerEvents: "auto",
// };
// const panelHeader: React.CSSProperties = {
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "space-between",
//   marginBottom: 8,
// };
// const label: React.CSSProperties = { fontSize: 12, color: "#444" };
// const input: React.CSSProperties = {
//   padding: "6px 8px",
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   fontSize: 14,
// };
// const btn: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 700,
//   borderRadius: 8,
//   border: "1px solid #ccc",
//   background: "#f6f6f6",
//   cursor: "pointer",
// };
// const btnPrimary: React.CSSProperties = {
//   padding: "8px 10px",
//   fontWeight: 800,
//   borderRadius: 8,
//   border: "1px solid #222",
//   background: "#ffd166",
//   cursor: "pointer",
// };
// const iconBtn: React.CSSProperties = {
//   border: "none",
//   background: "transparent",
//   cursor: "pointer",
//   fontSize: 16,
//   lineHeight: 1,
//   padding: 4,
// };
// const fabStyle: React.CSSProperties = {
//   position: "absolute",
//   top: 12,
//   right: 12,
//   zIndex: 1000,
//   width: 44,
//   height: 44,
//   borderRadius: "50%",
//   border: "1px solid #ddd",
//   background: "white",
//   boxShadow: "0 6px 16px rgba(0,0,0,0.18)",
//   cursor: "pointer",
//   fontSize: 20,
//   display: "flex",
//   alignItems: "center",
//   justifyContent: "center",
//   pointerEvents: "auto",
// };
