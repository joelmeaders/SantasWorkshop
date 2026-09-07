# Service-worker caching

Both Angular hosting targets use the Angular service worker to announce a new
release and update the app shell safely. The app shell includes `index.html`,
the main bundle, and the styles bundle. The main and styles patterns also match
the un-hashed bundles used by the deployable test build.

Lazy route chunks and static assets are cached only after the browser requests
them, which keeps the initial service-worker download small. API safety is a
separate rule: these manifests have no `dataGroups` and no remote URL patterns,
so Firebase/Auth/Functions/Storage responses are not service-worker-cached.
`VERSION_READY` confirms that a new app version is available, not that every
lazy route or changed imported chunk can run offline. An offline cold start is
supported only for the already cached app shell and previously requested lazy
assets; a newly requested route still needs the network.

On a first install there is no previous worker or cached version, so the page
must complete one normal network load before offline behavior can be assessed.
For a later release, wait for `VERSION_READY`, then use the in-app refresh
prompt. Do not hard-refresh during installation or while a form submission is
in flight. If a release is rolled back, deploy the complete previous build
including its matching `ngsw.json`, worker, and hashed bundles; do not mix
manifest and bundle files from different releases.

Hosting sends `no-cache` for the normal baseline, one-year immutable caching
for content-hashed CSS and JavaScript, and a one-hour bounded cache for static
images, fonts, SVGs, and assets. The production build check verifies hashed
bundles, service-worker output, and these cache rules. The test build check
allows its intentionally un-hashed bundles but still requires generated
`ngsw.json` and `ngsw-worker.js`.
