"use client";

/* Light haptic tick that works everywhere possible:
   - Android / Chrome: navigator.vibrate
   - iPhone Safari (iOS 18+): programmatically toggling an Apple HTML
     <input type="checkbox" switch> fires the system's light haptic.  */

let switchEl = null;

export function haptic() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(10);
      return;
    }
    if (!switchEl) {
      switchEl = document.createElement("input");
      switchEl.type = "checkbox";
      switchEl.setAttribute("switch", "");
      switchEl.style.cssText =
        "position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
      switchEl.tabIndex = -1;
      switchEl.setAttribute("aria-hidden", "true");
      document.body.appendChild(switchEl);
    }
    switchEl.click();
  } catch {}
}
