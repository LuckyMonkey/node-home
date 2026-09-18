// Identity for fridge.run.
//
// Keycloak on this network's own domain - not Google, not a third-party IdP.
// Keycloak is first in line: identity is resolved on the public internet, and
// only then does SSH over the tailnet become relevant.
//
// `clientId` names a PUBLIC OAuth client. That is not an oversight: this site is
// static GitHub Pages and cannot keep a secret, so it is not given one. PKCE
// (S256) is what protects the flow instead.
window.__FRIDGE_IAM__ = Object.assign(
  {
    issuer: 'https://auth.fridge.run/realms/fridge',
    clientId: 'fridge-run-web',
    redirectUri: 'https://fridge.run/login/',
    providerName: 'fridge.run'
  },
  window.__FRIDGE_IAM__ || {}
);
