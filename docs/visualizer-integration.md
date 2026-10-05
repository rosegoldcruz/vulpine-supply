# Visualizer integration

The cabinet design experience from `origin/aeon/configurator` is integrated at `/visualizer`. The existing homepage, stationary scroll hero, supply sections, and inquiry form remain the main site. Visualizer is the last category in the homepage navigation, with a visible link on mobile.

The integration imports the design components, catalog images, 3D kitchen assets, AR and PDF endpoints, and visualizer quote support. It preserves the current hero dependencies and site pages rather than replacing the homepage with branch content. `/configurator` and its summary route redirect to the corresponding visualizer paths, retaining query parameters.

The hero now loads fifteen material models: 1, 2, and 4–16. Retired material 3 is removed. The fifteen entries use consecutive stream indices, yielding five staggered groups of three. The finished-unit output and seven-second supply marquee retain their existing behavior.

Verification covers navigation order, the preserved homepage, all fifteen hero model requests, cabinet style/finish/hardware selection, 3D preview, design summary, quote form prefill, redirect parameters, mobile navigation and overflow, PDF output, AR GLB generation, and the existing inquiry consent tests. Database integration tests require DATABASE_URL and are skipped when it is absent. Camera AR requires a supported device and user permission; generated AR assets are checked independently.
