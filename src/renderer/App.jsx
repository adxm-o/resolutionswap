import { useState, useEffect, useRef } from "react";

var X_CHAR = String.fromCharCode(215);
var DASH = String.fromCharCode(8212);
var DOTS = String.fromCharCode(8230);
var HZ_OPTIONS = ["60", "90", "120", "144", "170", "240"];

function accel(e) {
  var skip = new Set(["Control","Alt","Shift","Meta"]);
  if (skip.has(e.key)) return null;
  var p = [];
  if (e.ctrlKey) p.push("Control");
  if (e.altKey) p.push("Alt");
  if (e.shiftKey) p.push("Shift");
  var k = e.key;
  if (k === " ") k = "Space";
  else if (k.startsWith("Arrow")) k = k.slice(5);
  else if (k === "Escape") k = "Esc";
  else if (k.length === 1) k = k.toUpperCase();
  p.push(k);
  return p.join("+");
}

function fmtKey(a) {
  if (!a) return DASH;
  return a.replace(/Control/g, "Ctrl").replace(/\+/g, " + ");
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function SlotForm({ slot, onSave, onCancel }) {
  var slotHz = slot && Number(slot.hz) > 0 ? String(Number(slot.hz)) : "144";
  var initial = {
    label: slot ? slot.label : "",
    w: slot && slot.configured && Number(slot.w) > 0 ? String(slot.w) : "",
    h: slot && slot.configured && Number(slot.h) > 0 ? String(slot.h) : "",
    hz: slotHz,
    scale: slot ? slot.scale || "default" : "default",
  };
  var [f, setF] = useState(initial);
  var upd = function(k, v) { setF(function(prev) { return Object.assign({}, prev, {[k]: v}); }); };
  var valid = f.label.trim() && parseInt(f.w, 10) > 0 && parseInt(f.h, 10) > 0 && parseInt(f.hz, 10) > 0;

  return (
    <div className="slot-form anim-pop">
      <input className="sf-name" value={f.label} onChange={function(e) { upd("label", e.target.value); }}
        placeholder="Name" autoFocus />
      <div className="sf-row">
        <div className="sf-field">
          <span className="sf-lbl">W</span>
          <input className="sf-input sf-input-w" value={f.w}
            onChange={function(e) { upd("w", e.target.value); }} placeholder="1920" />
        </div>
        <span className="sf-sep">{X_CHAR}</span>
        <div className="sf-field">
          <span className="sf-lbl">H</span>
          <input className="sf-input sf-input-w" value={f.h}
            onChange={function(e) { upd("h", e.target.value); }} placeholder="1080" />
        </div>
      </div>
      <div className="sf-row">
        <div className="sf-field">
          <span className="sf-lbl">Hz</span>
          <select className="sf-select sf-hz" value={f.hz}
            onChange={function(e) { upd("hz", e.target.value); }}>
            {HZ_OPTIONS.map(function(hz) {
              return <option key={hz} value={hz}>{hz} Hz</option>;
            })}
          </select>
        </div>
        <div className="sf-field">
          <span className="sf-lbl">Scale</span>
          <select className="sf-select" value={f.scale}
            onChange={function(e) { upd("scale", e.target.value); }}>
            <option value="default">Default</option>
            <option value="stretch">Stretched</option>
            <option value="center">Centered</option>
          </select>
        </div>
      </div>
      <div className="sf-actions">
        <button className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" disabled={!valid}
          onClick={function() { onSave(Object.assign({}, f, { configured: true })); }}>Save</button>
      </div>
    </div>
  );
}

function Slot(props) {
  var s = props.s, i = props.i, active = props.active, rec = props.rec;
  var onApply = props.onApply, onBind = props.onBind, onClear = props.onClear;
  var onEdit = props.onEdit, onReset = props.onReset, delay = props.delay;

  if (!s.configured) {
    return (
      <div className="card card-empty anim-up" style={{ animationDelay: delay + "ms" }}>
        <div className="card-head"><span className="card-idx">{String(i + 1).padStart(2, "0")}</span></div>
        <div className="card-empty-body">
          <span className="card-empty-txt">Not set</span>
          <button className="btn-configure" onClick={function() { onEdit(i); }}>Configure</button>
        </div>
      </div>
    );
  }

  return (
    <div className={"card" + (active ? " card-on" : "") + " anim-up"}
         style={{ animationDelay: delay + "ms" }}>
      {active && <div className="card-accent" />}
      <div className="card-head">
        <span className="card-idx">{String(i + 1).padStart(2, "0")}</span>
        <div className="card-tags">
          {s.scale !== "default" && <span className="tag tag-scale">{s.scale}</span>}
          {active && <span className="tag tag-live">live</span>}
        </div>
      </div>
      <div className="card-body">
        <span className="card-name">{s.label}</span>
        <span className="card-res">{s.w}<span className="card-x">{X_CHAR}</span>{s.h}</span>
        <span className="card-hz">{s.hz} Hz</span>
      </div>

      <button className={"btn-switch" + (active ? " btn-switch-active" : "")}
        onClick={function(e) { e.stopPropagation(); if (!active) onApply(i); }}>
        {active ? "Current" : "Switch"}
      </button>

      <div className="card-foot" onClick={function(e) { e.stopPropagation(); }}>
        <div className={"card-key" + (rec ? " card-key-rec" : "")}
          onClick={function() { onBind(i); }}>
          {rec ? "press key" + DOTS : fmtKey(s.key)}
        </div>
        <div className="card-ops">
          <button className="op-btn" onClick={function() { onEdit(i); }} title="Edit">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" strokeWidth="1.1"/></svg>
          </button>
          {s.key && <button className="op-btn" onClick={function() { onClear(i); }} title="Clear key">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.1"/></svg>
          </button>}
          <button className="op-btn op-btn-warn" onClick={function() { onReset(i); }} title="Reset">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 3V2h3v1M3.5 3v7h5V3" stroke="currentColor" strokeWidth="1.1"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function Settings(props) {
  var cfg = props.cfg, monitors = props.monitors, onSave = props.onSave;
  var onClose = props.onClose, auto = props.auto, onAutoChange = props.onAutoChange;
  var onRefreshMonitors = props.onRefreshMonitors;

  var [editIdx, setEditIdx] = useState(null);
  var [editName, setEditName] = useState("");

  useEffect(function() { onRefreshMonitors(); }, []);

  function setMon(name) {
    var n = clone(cfg);
    n.monitor = name;
    onSave(n);
  }

  function saveProfile() {
    var n = clone(cfg);
    var snapshot = clone(n.slots);
    n.profiles.push({ name: "Profile " + (n.profiles.length + 1), slots: snapshot });
    n.activeProfile = n.profiles.length - 1;
    onSave(n);
  }

  function loadProfile(i) {
    var n = clone(cfg);
    var p = n.profiles[i];
    if (p.slots && p.slots.length > 0) {
      n.slots = clone(p.slots);
    }
    n.activeProfile = i;
    onSave(n);
  }

  function renameProfile(i, name) {
    if (!name.trim()) return;
    var n = clone(cfg);
    n.profiles[i].name = name.trim();
    onSave(n);
    setEditIdx(null);
  }

  function deleteProfile(i) {
    if (cfg.profiles.length <= 1) return;
    var n = clone(cfg);
    n.profiles.splice(i, 1);
    if (n.activeProfile >= n.profiles.length) n.activeProfile = 0;
    onSave(n);
  }

  return (
    <div className="sp anim-slide">
      <div className="sp-top">
        <span className="sp-title">Settings</span>
        <button className="op-btn" onClick={onClose}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.2"/></svg>
        </button>
      </div>

      <div className="sp-sec">
        <span className="sp-lbl">Monitor</span>
        <div className="sp-mons">
          {monitors.map(function(m, i) {
            var selected = cfg.monitor === m.name || (!cfg.monitor && i === 0);
            return (
              <div key={i} className={"sp-mon" + (selected ? " sp-mon-on" : "")}
                onClick={function() { setMon(m.name); }}>
                <span className="sp-mon-id">{m.name}</span>
                <span className="sp-mon-desc">{m.desc}</span>
                <span className="sp-mon-res">{m.res}</span>
              </div>
            );
          })}
          {monitors.length === 0 && <span className="sp-muted">No monitors detected</span>}
        </div>
      </div>

      <div className="sp-sec">
        <div className="sp-toggle" onClick={function() { onAutoChange(!auto); }}>
          <div className={"sw" + (auto ? " sw-on" : "")}><div className="sw-k" /></div>
          <span>Launch on startup</span>
        </div>
      </div>

      <div className="sp-sec">
        <div className="sp-sec-head">
          <span className="sp-lbl">Profiles</span>
          <button className="btn-ghost btn-xs" onClick={saveProfile}>+ Save current</button>
        </div>
        <div className="sp-profs">
          {cfg.profiles.map(function(p, i) {
            var isActive = cfg.activeProfile === i;
            return (
              <div key={i} className={"sp-prof" + (isActive ? " sp-prof-on" : "")}>
                {editIdx === i ? (
                  <div className="sp-prof-edit">
                    <input className="sf-name sf-name-sm" value={editName}
                      onChange={function(e) { setEditName(e.target.value); }}
                      onKeyDown={function(e) { if (e.key === "Enter") renameProfile(i, editName); }}
                      autoFocus />
                    <button className="btn-primary btn-xs"
                      onClick={function() { renameProfile(i, editName); }}>OK</button>
                  </div>
                ) : (
                  <>
                    <span className="sp-prof-name" onClick={function() { loadProfile(i); }}>{p.name}</span>
                    <div className="sp-prof-ops">
                      <button className="op-btn op-btn-xs" title="Rename"
                        onClick={function() { setEditIdx(i); setEditName(p.name); }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M8.5 1.5l2 2-7 7H1.5V8.5l7-7z" stroke="currentColor" strokeWidth="1.1"/></svg>
                      </button>
                      {cfg.profiles.length > 1 && (
                        <button className="op-btn op-btn-xs op-btn-warn" title="Delete"
                          onClick={function() { deleteProfile(i); }}>
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.1"/></svg>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  var [cfg, setCfg] = useState(null);
  var [cur, setCur] = useState({ w: 0, h: 0, hz: 0 });
  var [rec, setRec] = useState(null);
  var [editing, setEditing] = useState(null);
  var [settings, setSettings] = useState(false);
  var [monitors, setMonitors] = useState([]);
  var [auto, setAuto] = useState(false);
  var [err, setErr] = useState(null);

  function refreshMonitors() {
    return window.api.getMonitors().then(function(m) { setMonitors(m); });
  }

  useEffect(function() {
    (async function() {
      setCfg(await window.api.getCfg());
      setCur(await window.api.getRes());
      setAuto(await window.api.getAuto());
      await refreshMonitors();
    })();
  }, []);

  useEffect(function() {
    var id = setInterval(async function() {
      try { setCur(await window.api.getRes()); } catch (e) {}
    }, 2500);
    return function() { clearInterval(id); };
  }, []);

  useEffect(function() {
    if (!cfg) return;
    return window.api.onApplied(function(data) {
      if (data.ok) {
        setErr(null);
        window.api.getRes().then(function(r) { setCur(r); }).catch(function() {});
      } else {
        var e = data.err || "";
        var msg = "Could not switch resolution.";
        if (e.indexOf("registered_but_failed") !== -1) {
          msg = "Custom resolution was registered with NVIDIA but the display rejected it. Try a different resolution or Hz.";
        } else if (e.indexOf("no_nvidia") !== -1) {
          msg = "Non-standard resolution. NVIDIA GPU not detected for auto-registration. Add this resolution manually in your GPU control panel.";
        } else if (e.indexOf("try_custom") !== -1) {
          msg = "NVIDIA rejected the custom resolution. The display may not support this mode at this refresh rate.";
        } else if (e.indexOf("unsupported") !== -1) {
          msg = "Resolution not supported by display. Tried all methods including NVIDIA custom registration.";
        }
        setErr(msg);
        setTimeout(function() { setErr(null); }, 8000);
      }
    });
  }, [cfg]);

  useEffect(function() {
    if (rec === null) return;
    function handler(e) {
      e.preventDefault();
      var a = accel(e);
      if (!a) return;
      setRec(null);
      doKey(rec, a);
    }
    window.addEventListener("keydown", handler, true);
    return function() { window.removeEventListener("keydown", handler, true); };
  }, [rec, cfg]);

  async function save(next) { setCfg(next); await window.api.saveCfg(next); }

  async function doApply(i) {
    setErr(null);
    await window.api.apply(i);
    var r = await window.api.getRes();
    setCur(r);
  }

  async function doKey(i, key) {
    var n = clone(cfg);
    n.slots[i].key = key;
    await save(n);
  }

  async function doSaveSlot(i, data) {
    var n = clone(cfg);
    data.w = parseInt(data.w, 10) || 0;
    data.h = parseInt(data.h, 10) || 0;
    data.hz = parseInt(data.hz, 10) || 60;
    n.slots[i] = Object.assign({}, n.slots[i], data);
    await save(n);
    setEditing(null);
  }

  async function doReset(i) {
    var n = clone(cfg);
    var oldKey = n.slots[i].key;
    n.slots[i] = { label: "Slot " + (i + 1), w: 0, h: 0, hz: 60, key: oldKey, scale: "default", configured: false };
    await save(n);
  }

  async function doAutoChange(v) { setAuto(v); await window.api.setAuto(v); }

  if (!cfg) return (<div className="app"><div className="loading">{"Loading" + DOTS}</div></div>);

  function isOn(s) {
    return s.configured && Number(s.w) === cur.w && Number(s.h) === cur.h && Number(s.hz) === cur.hz;
  }

  return (
    <div className="app" onClick={function() { if (rec !== null) setRec(null); }}>

      <div className="titlebar">
        <div className="tb-drag">
          <div className="tb-mark" />
          <div className="tb-brand">
            <span className="tb-name">ResolutionSwap</span>
            <span className="tb-by">by adxm.o</span>
          </div>
        </div>
        <div className="tb-right">
          <button className={"tb-btn tb-gear" + (settings ? " tb-gear-on" : "")}
            onClick={function() { setSettings(!settings); }} title="Settings">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button className="tb-btn" onClick={function() { window.api.minimize(); }} title="Minimize">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7" stroke="currentColor" strokeWidth="1.3"/></svg>
          </button>
          <button className="tb-btn tb-x" onClick={function() { window.api.quit(); }} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.3"/></svg>
          </button>
        </div>
      </div>

      {settings && (
        <Settings cfg={cfg} monitors={monitors} onSave={save}
          onClose={function() { setSettings(false); }} auto={auto} onAutoChange={doAutoChange}
          onRefreshMonitors={refreshMonitors} />
      )}

      <div className="readout anim-up">
        <div className="readout-l">
          <span className="readout-dot" />
          <span className="readout-lbl">Display</span>
        </div>
        <div className="readout-r">
          <span className="readout-res">{cur.w + " " + X_CHAR + " " + cur.h}</span>
          <span className="readout-hz">{cur.hz}Hz</span>
        </div>
      </div>

      {err && (
        <div className="err-banner anim-up">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M8 4.5v4M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>{err}</span>
        </div>
      )}

      <div className="grid-wrap">
        <div className="grid">
          {cfg.slots.map(function(s, i) {
            if (editing === i) {
              return <SlotForm key={i} slot={s}
                onSave={function(d) { doSaveSlot(i, d); }}
                onCancel={function() { setEditing(null); }} />;
            }
            return <Slot key={i} s={s} i={i} active={isOn(s)} rec={rec === i}
              delay={40 + i * 60}
              onApply={doApply} onBind={setRec}
              onClear={function(idx) { doKey(idx, ""); }}
              onEdit={setEditing} onReset={doReset} />;
          })}
        </div>
      </div>
    </div>
  );
}
