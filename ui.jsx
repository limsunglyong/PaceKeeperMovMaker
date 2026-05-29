/* ============================================================
   ui.jsx — presentational components (no app state)
   Loaded AFTER helpers.jsx, BEFORE editor.jsx. Exposed on window.
   ============================================================ */
(function () {
  const VIZ_SWATCHES = ["#ffffff", "#ff4d5e", "#2dd4bf", "#ffb020", "#a78bfa", "#5b8cff"];

  /* ---- transport icons (crisp SVG) ---- */
  function TIcon({ name, size }) {
    const s = size || 18;
    const common = { width: s, height: s, viewBox: "0 0 24 24", fill: "currentColor" };
    if (name === "rewind")
      return (
        <svg {...common}><rect x="4" y="5" width="2.4" height="14" rx="1" /><path d="M20 5.5v13a.8.8 0 0 1-1.25.66L9 13.1v5.4a.8.8 0 0 1-1.6 0V5.5a.8.8 0 0 1 1.6 0v5.4l9.75-6.06A.8.8 0 0 1 20 5.5z" /></svg>
      );
    if (name === "forward")
      return (
        <svg {...common}><rect x="17.6" y="5" width="2.4" height="14" rx="1" /><path d="M4 5.5v13a.8.8 0 0 0 1.25.66L15 13.1v5.4a.8.8 0 0 0 1.6 0V5.5a.8.8 0 0 0-1.6 0v5.4L5.25 4.84A.8.8 0 0 0 4 5.5z" /></svg>
      );
    if (name === "play") return <svg {...common}><path d="M7 4.5v15a1 1 0 0 0 1.54.84l11.5-7.5a1 1 0 0 0 0-1.68L8.54 3.66A1 1 0 0 0 7 4.5z" /></svg>;
    if (name === "pause") return <svg {...common}><rect x="6.5" y="4.5" width="4" height="15" rx="1.2" /><rect x="13.5" y="4.5" width="4" height="15" rx="1.2" /></svg>;
    if (name === "stop") return <svg {...common}><rect x="5.5" y="5.5" width="13" height="13" rx="2.2" /></svg>;
    return null;
  }

  /* ---- LED-style timecode readout ---- */
  function LedClock({ t, dur, playing }) {
    const tc = fmtTC(t, true);
    const dc = fmtTC(dur, true);
    return (
      <div className="led-wrap">
        <span className={"led-rec " + (playing ? "live" : "")}></span>
        <div className="led">
          <span className="led-ghost">88:88:88</span>
          <span className="led-val">{tc}</span>
        </div>
        <div className="led-total">
          <span className="led-total-lbl">DUR</span>
          {dc}
        </div>
      </div>
    );
  }

  /* ---- generic inspector rows ---- */
  function Row({ label, children }) {
    return (
      <div className="row">
        <label className="row-label">{label}</label>
        <div className="row-ctrl">{children}</div>
      </div>
    );
  }
  function Slider({ label, v, min, max, step, on, fmt }) {
    return (
      <div className="row slider-row">
        <label className="row-label">{label}<b>{fmt ? fmt(v) : v}</b></label>
        <input type="range" min={min} max={max} step={step} value={v}
          onChange={(e) => on(parseFloat(e.target.value))} />
      </div>
    );
  }
  function Swatches({ v, on }) {
    return (
      <div className="row">
        <label className="row-label">Color</label>
        <div className="swatches">
          {VIZ_SWATCHES.map((c) => (
            <button key={c} className={"sw " + (v === c ? "on" : "")}
              style={{ background: c }} onClick={() => on(c)}></button>
          ))}
        </div>
      </div>
    );
  }

  /* ---- visualizer style picker (req 1) ---- */
  const VIZ_STYLES = [
    { id: "bars", label: "Bars" },
    { id: "mirror", label: "Mirror" },
    { id: "wave", label: "Wave" },
    { id: "circle", label: "Circle" },
    { id: "dots", label: "Dots" },
  ];
  function VizStylePicker({ value, on }) {
    return (
      <div className="row">
        <label className="row-label">Effect</label>
        <div className="viz-styles">
          {VIZ_STYLES.map((s) => (
            <button key={s.id} className={"vz " + (value === s.id ? "on" : "")}
              onClick={() => on(s.id)}>
              <span className={"vz-ico vz-" + s.id}></span>
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ---- left projects rail (req 2) ---- */
  function ProjectsRail({ projects, currentId, name, setName, onSave, onNew, onLoad, onDelete, dirty }) {
    return (
      <aside className="rail">
        <div className="rail-head">
          <span className="rail-title">Projects</span>
          <button className="rail-new" onClick={onNew} title="New project">＋</button>
        </div>
        <div className="rail-save">
          <input className="proj-name" value={name} placeholder="Project name"
            onChange={(e) => setName(e.target.value)} />
          <button className={"save-btn " + (dirty ? "dirty" : "")} onClick={onSave}>
            Save{dirty ? " •" : ""}
          </button>
        </div>
        <div className="proj-list">
          {projects.length === 0 && <div className="proj-empty">No saved projects yet.</div>}
          {projects.map((p) => (
            <div key={p.id} className={"proj-card " + (p.id === currentId ? "active" : "")}
              onClick={() => onLoad(p.id)}>
              <div className="proj-thumb">
                {p.thumb ? <img src={p.thumb} alt="" /> : <div className="proj-noimg"></div>}
                <button className="proj-del" title="Delete"
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}>✕</button>
              </div>
              <div className="proj-meta">
                <span className="proj-cname">{p.name}</span>
                <span className="proj-time">{new Date(p.updatedAt).toLocaleDateString()} {new Date(p.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    );
  }

  Object.assign(window, { TIcon, LedClock, Row, Slider, Swatches, VizStylePicker, ProjectsRail });
})();
