// Identity configuration for fridge.run
//
// fridge.run is served by GitHub Pages: static files, no server-side code.
// A static page CANNOT enforce identity - anything it checks in JavaScript can
// be bypassed by reading the source. So this page does not pretend to.
//
// Instead the "Login with fridge.run" button hands off to a Google Apps Script
// web app, which authenticates against Google server-side. The script reads
// Session.getEffectiveUser().getEmail() - a value the browser cannot forge -
// and checks it against an allowlist before returning anything or accepting a
// write. The trust boundary is Apps Script, not this page.
//
// Set this to the /exec URL of the deployed Apps Script web app.
// Leave it empty and the button explains that IAM is not yet wired up, rather
// than pretending to sign you in.
window.__FRIDGE_IAM__ = Object.assign(
  {
    // e.g. 'https://script.google.com/macros/s/AKfycb.../exec'
    endpoint: 'https://script.google.com/macros/s/AKfycbzp_s0qlMPrYVVHwQ_zv_jZs_i1K2Iptqlazm9I_q-OwJ01FdIpB1kJhDD50NqGgXxT/exec',
    // Shown to the user so it is obvious which identity system is in play.
    providerName: 'Google'
  },
  window.__FRIDGE_IAM__ || {}
);
