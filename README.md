# dsh-custom-plugins-switch

Two buttons on the Harness **Plugins** page that switch every plugin *you installed yourself* on or off in one click.

- **全部启用 / Enable all** — enables every custom plugin bundle that is currently off.
- **全部停用 / Disable all** — disables every custom plugin bundle that is currently on.

## Where it appears

The bar is registered into the frame-wide `shell.overlay` slot, but it renders only while the **Plugins**
page is the active main panel: on the Conversation and on every other page it hides itself, and there is
nothing to dismiss.

## What counts as a custom plugin

The bar acts on exactly the cards the Plugins page lists under **已安装插件 / Installed**: bundles with
`official: false` that are installed in the profile. It never touches

- the built-in profile bundles (`@deepseek-ai/dsh-base`, `dsh-web-app`, `dsh-headless`, `dsh-sdk-app`, `dsh-acp-app`, `dsh-sdk-minimal`),
- official and bundled experimental bundles (the page's **实验性插件** group),
- bundles the Host marks read-only, not installed, or already reporting a problem.

This plugin's own bundle is a custom plugin too, but the bulk actions leave it enabled: switching it off
would take away the buttons that switch everything back on. The count line therefore keeps reporting it,
and both buttons explain the exception in their tooltip.

Each click calls the same Host method the page's own per-plugin switch uses
(`pluginManager.setBundleEnabled`), one bundle at a time, and reports how many were switched,
how many still need a DSH restart, and which ones failed.

## Files

| File | Role |
| --- | --- |
| `package.json` | Bundle manifest: `dsh.bundle.patch` plus the web Client module |
| `cordis.patch.yml` | Inserts the bundle's one Host row |
| `index.js` | Host half (no behaviour; the Client module owns the UI) |
| `client.js` | Client module: the floating bar registered into `shell.overlay` |
| `locale/*.json` | Plugin title and description shown by Plugin Manager |
| `icon.svg` | Original artwork for the plugin's list entry |
