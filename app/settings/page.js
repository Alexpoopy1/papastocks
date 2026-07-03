"use client";

import { useEffect, useState } from "react";
import { getPrefs, setPref, applyPrefsToDocument } from "@/lib/store";

const THEMES = [
  { id: "manus", name: "Manus Dark", dots: ["#161618", "#1c1c20", "#ece9e2"] },
  { id: "light", name: "Daylight", dots: ["#f7f6f3", "#ffffff", "#1c1c1e"] },
  { id: "midnight", name: "Midnight Blue", dots: ["#0b1020", "#121a30", "#6ea8ff"] },
  { id: "forest", name: "Forest", dots: ["#101613", "#17201b", "#58c98b"] },
  { id: "highcontrast", name: "High Contrast", dots: ["#000", "#1a1a1a", "#ffd60a"] }
];

export default function Settings() {
  const [prefs, setPrefs] = useState(null);
  const [notifState, setNotifState] = useState("default");
  const [toast, setToast] = useState("");

  useEffect(() => {
    setPrefs(getPrefs());
    if (typeof Notification !== "undefined") setNotifState(Notification.permission);
  }, []);

  function update(k, v) {
    setPref(k, v);
    const next = getPrefs();
    setPrefs(next);
    applyPrefsToDocument();
  }

  function say(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      say("Notifications need the app added to your Home Screen first 📲");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifState(perm);
    if (perm === "granted") {
      update("notifications", true);
      say("Notifications are on! 🔔");
    } else {
      say("Notifications were not allowed.");
    }
  }

  async function testNotification() {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg && Notification.permission === "granted") {
        reg.showNotification("👋 Hello Papa!", {
          body: "This is what a stock alert will look like.",
          icon: "/icon-192.png"
        });
        say("Test sent!");
      } else {
        say("Turn on notifications first.");
      }
    } catch {
      say("Couldn’t send a test on this device.");
    }
  }

  if (!prefs) return <div className="spin" />;

  return (
    <>
      <h1 className="greeting serif">Settings</h1>
      <p className="subgreet">Make it comfy, Papa.</p>

      <div className="section-title">Theme</div>
      <div className="theme-grid">
        {THEMES.map((t) => (
          <button
            key={t.id}
            className={`theme-swatch ${prefs.theme === t.id ? "selected" : ""}`}
            style={{ background: t.dots[0], color: t.dots[2] }}
            onClick={() => update("theme", t.id)}
          >
            <span className="swatch-dots">
              {t.dots.map((d, i) => <i key={i} style={{ background: d }} />)}
            </span>
            <span style={{ fontWeight: 700, fontSize: ".85rem" }}>{t.name}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Reading comfort</div>
      <div className="setting-row">
        <div>
          <div className="lbl">Big text</div>
          <div className="hint">Larger letters everywhere</div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={!!prefs.bigText} onChange={(e) => update("bigText", e.target.checked)} />
          <span className="knob" />
        </label>
      </div>

      <div className="section-title">Notifications</div>
      <div className="setting-row">
        <div>
          <div className="lbl">Stock alerts</div>
          <div className="hint">
            {notifState === "granted" ? "Allowed on this device ✅" : "Tap to allow alerts on this device"}
          </div>
        </div>
        {notifState === "granted" ? (
          <label className="switch">
            <input type="checkbox" checked={!!prefs.notifications} onChange={(e) => update("notifications", e.target.checked)} />
            <span className="knob" />
          </label>
        ) : (
          <button className="btn-ghost" onClick={enableNotifications}>Allow</button>
        )}
      </div>

      <div className="setting-row">
        <div>
          <div className="lbl">Alert me on moves of</div>
          <div className="hint">Up or down, in one day</div>
        </div>
        <div className="pill-row">
          {[2, 3, 5].map((n) => (
            <button
              key={n}
              className={`pill ${Number(prefs.moveThreshold) === n ? "active" : ""}`}
              onClick={() => update("moveThreshold", n)}
            >
              {n}%
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <div>
          <div className="lbl">Send a test alert</div>
          <div className="hint">See how it looks</div>
        </div>
        <button className="btn-ghost" onClick={testNotification}>Test 🔔</button>
      </div>

      <div className="section-title">Add to Home Screen</div>
      <div className="card">
        <p style={{ lineHeight: 1.6, fontSize: ".92rem" }}>
          📲 On your iPhone or iPad:
          <br />1. Open this app in <b>Safari</b>
          <br />2. Tap the <b>Share</b> button (square with arrow)
          <br />3. Tap <b>“Add to Home Screen”</b>
          <br /><br />
          It becomes a real app icon — and that’s also what lets notifications work on iOS!
        </p>
      </div>

      <p className="disclaimer">PapaStocks v1.0 · Made with ❤️ for Papa</p>
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
