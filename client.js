/**
 * Client half of `dsh-custom-plugins-switch`.
 *
 * Registers one compact bar into the frame's `shell.overlay` layer. The bar only
 * shows while the Plugins page is the active main panel and holds the two bulk
 * actions: enable, or disable, every plugin bundle the user installed into this
 * profile. It reads and writes through the existing `pluginManager` Remote, so
 * the Host owns the profile files and the page's own cards follow along.
 */
window.__ModuleLoader__.load({
  id: 'dsh-custom-plugins-switch',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'customPluginsSwitch'
    /** The Plugins page's main panel key: the bar shows only there. */
    const PANEL_ID = 'plugins'
    /**
     * This bundle's own package name. It counts as a custom plugin, but the bulk
     * actions leave it alone: switching it off would take away the very buttons
     * that switch everything back on.
     */
    const SELF_NAME = 'dsh-custom-plugins-switch'
    /**
     * Profile bundles that are part of DSH itself. The Plugins page keeps them
     * off its Installed group even when the profile declares them as
     * dependencies, so the bulk actions leave them alone too.
     */
    const BUILTIN_PROFILE_BUNDLES = new Set([
      '@deepseek-ai/dsh-base',
      '@deepseek-ai/dsh-web-app',
      '@deepseek-ai/dsh-headless',
      '@deepseek-ai/dsh-sdk-app',
      '@deepseek-ai/dsh-acp-app',
      '@deepseek-ai/dsh-sdk-minimal'
    ])

    /** Simplified Chinese is the key source of truth for this plugin's own text. */
    const zh = {
      label: '自定义插件',
      summary: '已启用 {on} / 共 {total}',
      enableAll: '全部启用',
      disableAll: '全部停用',
      enableAllHint: '启用所有已停用的自定义插件；本插件自身保持启用，以便随时恢复',
      disableAllHint: '停用所有已启用的自定义插件；本插件自身保持启用，以便随时恢复',
      empty: '没有已安装的自定义插件',
      loading: '正在读取插件列表…',
      running: '正在处理 {done}/{total}…',
      allEnabled: '自定义插件已全部启用',
      allDisabled: '自定义插件已全部停用',
      enabledSome: '已启用 {count} 个自定义插件',
      disabledSome: '已停用 {count} 个自定义插件',
      restart: '{count} 个需重启 DSH 后生效',
      overridden: '{count} 个被更高优先级的配置覆盖',
      failed: '{count} 个失败：{names}',
      loadFailed: '读取插件列表失败：{reason}',
      callFailed: 'Host 调用失败',
      separator: '；'
    }
    const en = {
      label: 'Custom plugins',
      summary: '{on} of {total} enabled',
      enableAll: 'Enable all',
      disableAll: 'Disable all',
      enableAllHint: 'Enables every disabled custom plugin; this plugin stays enabled so you can undo it',
      disableAllHint: 'Disables every enabled custom plugin; this plugin stays enabled so you can undo it',
      empty: 'No user-installed plugins',
      loading: 'Reading the plugin list…',
      running: 'Working on {done}/{total}…',
      allEnabled: 'Every custom plugin is already enabled',
      allDisabled: 'Every custom plugin is already disabled',
      enabledSome: 'Enabled {count} custom plugins',
      disabledSome: 'Disabled {count} custom plugins',
      restart: '{count} need a DSH restart',
      overridden: '{count} are overridden by a higher-priority layer',
      failed: '{count} failed: {names}',
      loadFailed: 'Could not read the plugin list: {reason}',
      callFailed: 'the Host call failed',
      separator: '; '
    }

    /** Theme tokens only, so the bar reads correctly in both themes. */
    const CSS = [
      '.cps-bar{position:fixed;right:24px;bottom:24px;z-index:30;display:flex;align-items:center;gap:10px;',
      'box-sizing:border-box;max-width:calc(100vw - 48px);padding:6px 8px 6px 12px;',
      'border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-overlay);',
      'color:var(--dsw-alias-label-primary);pointer-events:auto;font-size:12px;line-height:18px;',
      'box-shadow:0 6px 20px color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent)}',
      '.cps-text{display:flex;flex-direction:column;min-width:0;max-width:320px}',
      '.cps-title{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.cps-meta{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:16px;overflow-wrap:anywhere}',
      '.cps-error{color:var(--dsw-alias-state-error-primary)}',
      '.cps-warn{color:var(--dsw-alias-state-warn-primary)}',
      '.cps-button{flex:none;font:inherit;font-size:12px;line-height:18px;padding:4px 10px;border-radius:8px;',
      'border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);',
      'color:var(--dsw-alias-label-primary);cursor:pointer;white-space:nowrap}',
      '.cps-button:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}',
      '.cps-button:disabled{opacity:.45;cursor:default}',
      '.cps-button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.cps-primary{border-color:color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);',
      'background:color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-overlay));',
      'color:var(--dsw-alias-brand-primary)}',
      '.cps-primary:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-brand-primary) 20%, var(--dsw-alias-bg-overlay))}'
    ].join('')

    /**
     * Whether a bundle is one the user installed into this profile: the Plugins
     * page's Installed group is exactly the non-official, non-built-in bundles,
     * and a bundle without files on disk cannot be switched either way.
     * @param bundle - one bundle as `pluginManager.listBundles` reports it.
     * @returns whether the bulk actions own this bundle.
     */
    function isCustomPlugin(bundle) {
      if (bundle === null || typeof bundle !== 'object') return false
      if (bundle.official === true) return false
      if (typeof bundle.name !== 'string' || bundle.name === '') return false
      if (BUILTIN_PROFILE_BUNDLES.has(bundle.name)) return false
      return bundle.installed === true
    }

    /** The Host refuses to address a read-only bundle through the profile patch. */
    function addressable(bundle) {
      return bundle.readOnlyReason === undefined
    }

    /** A bundle the Host already reports a problem for is not enabled again. */
    function enableable(bundle) {
      return addressable(bundle) && bundle.error === undefined
    }

    /** A sentence for anything thrown or reported: a Remote error, an Error, a string. */
    function reasonOf(error) {
      if (error === null || error === undefined) return ''
      if (typeof error === 'string') return error
      if (typeof error.message === 'string' && error.message !== '') return error.message
      if (typeof error.code === 'string') return error.code
      try {
        return JSON.stringify(error)
      } catch (_error) {
        return String(error)
      }
    }

    /**
     * Read the profile's custom plugins and what each bulk action would touch.
     * @param remote - the Client's Remote handle.
     * @returns the counts and the two target lists, by bundle name.
     */
    async function readCustom(remote) {
      const answer = await remote.pluginManager.listBundles()
      if (answer === null || typeof answer !== 'object' || answer.ok !== true) {
        throw new Error(reasonOf(answer === null || typeof answer !== 'object' ? answer : answer.error) || 'listBundles')
      }
      const bundles = Array.isArray(answer.value) ? answer.value : []
      const custom = bundles.filter(isCustomPlugin)
      const switchable = custom.filter((bundle) => bundle.name !== SELF_NAME)
      return {
        total: custom.length,
        enabled: custom.filter((bundle) => bundle.enabled === true).length,
        toEnable: switchable.filter((bundle) => bundle.enabled !== true && enableable(bundle)).map((bundle) => bundle.name),
        toDisable: switchable.filter((bundle) => bundle.enabled === true && addressable(bundle)).map((bundle) => bundle.name)
      }
    }

    /**
     * The sentence one bulk run leaves behind, built from the Host's own outcomes.
     * @param outcome - the folded per-bundle results.
     * @param enabled - which direction the run went.
     * @param t - the plugin's translate seat.
     * @returns the sentence, empty when the run had nothing to say.
     */
    function bulkMessage(outcome, enabled, t) {
      const parts = []
      const switched = outcome.applied + outcome.restart
      if (switched === 0 && outcome.overridden === 0) parts.push(t(enabled ? 'allEnabled' : 'allDisabled'))
      else if (switched > 0) parts.push(t(enabled ? 'enabledSome' : 'disabledSome', { count: String(switched) }))
      if (outcome.restart > 0) parts.push(t('restart', { count: String(outcome.restart) }))
      if (outcome.overridden > 0) parts.push(t('overridden', { count: String(outcome.overridden) }))
      if (outcome.failed.length > 0) {
        const shown = outcome.failed.slice(0, 3).join(', ') + (outcome.failed.length > 3 ? '…' : '')
        parts.push(t('failed', { count: String(outcome.failed.length), names: shown }))
      }
      return parts.join(t('separator'))
    }

    /**
     * Switch every named bundle, one Host call at a time so the manager's own
     * profile writes never overlap, and fold the answers into one outcome.
     * @param remote - the Client's Remote handle.
     * @param names - the bundle names to switch.
     * @param enabled - the state every named bundle should end in.
     * @param t - the plugin's translate seat.
     * @param progress - called with how many bundles have been attempted.
     * @returns the folded outcome and its sentence.
     */
    async function toggleAll(remote, names, enabled, t, progress) {
      const outcome = { applied: 0, restart: 0, overridden: 0, failed: [] }
      for (let index = 0; index < names.length; index += 1) {
        const name = names[index]
        progress(index, names.length)
        let answer
        try {
          answer = await remote.pluginManager.setBundleEnabled(name, enabled)
        } catch (_error) {
          outcome.failed.push(name)
          continue
        }
        if (answer === null || typeof answer !== 'object' || answer.ok !== true) {
          outcome.failed.push(name)
          continue
        }
        const result = answer.value === null || typeof answer.value !== 'object' ? {} : answer.value
        if (result.application === 'failed') outcome.failed.push(name)
        else if (result.application === 'restart-required') outcome.restart += 1
        else if (result.application === 'overridden') outcome.overridden += 1
        else outcome.applied += 1
      }
      progress(names.length, names.length)
      return Object.assign(outcome, { message: bulkMessage(outcome, enabled, t) })
    }

    /**
     * Interpret whatever a panel-info source yields: the value a selector hook
     * selected, or the snapshot itself when the hook ignores its selector.
     * @param value - one panel-info source's value.
     * @returns whether the Plugins page is active, or undefined when unreadable.
     */
    function interpretPanel(value) {
      if (typeof value === 'boolean') return value
      if (value !== null && typeof value === 'object' && 'activePanelId' in value) return value.activePanelId === PANEL_ID
      return undefined
    }

    /**
     * Ask the slot system's standard `usePanelInfo` hook, which shares its
     * selection source with `ctx.layout.panelInfo`; either hook shape is accepted.
     * @param usePanelInfo - the hook the slot passes to its entries, when present.
     * @returns whether the Plugins page is active, or undefined when unreadable.
     */
    function readPanelHook(usePanelInfo) {
      if (typeof usePanelInfo !== 'function') return undefined
      try {
        return interpretPanel(
          usePanelInfo((snapshot) =>
            snapshot === null || snapshot === undefined ? undefined : snapshot.activePanelId === PANEL_ID
          )
        )
      } catch (_error) {
        return undefined
      }
    }

    /**
     * Follow the layout's active main panel and publish whether the Plugins page
     * is the one on screen. The bar is a frame-wide overlay entry, so it hides
     * itself everywhere else and never floats over the Conversation.
     * @param layout - the `layout` Client service this plugin injects.
     * @returns the store the bar binds with `useSyncExternalStore`.
     */
    function createPanelWatch(layout) {
      let snapshot = { active: false }
      const listeners = new Set()
      const info = layout === undefined || layout === null ? undefined : layout.panelInfo
      const publish = (active) => {
        if (active === snapshot.active) return
        snapshot = { active }
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch (_error) {
            /* one broken listener must not stop the others */
          }
        }
      }
      const read = () => {
        if (info === undefined || info === null || typeof info.getSnapshot !== 'function') {
          publish(false)
          return
        }
        let current
        try {
          current = info.getSnapshot()
        } catch (_error) {
          publish(false)
          return
        }
        publish(interpretPanel(current) === true)
      }
      let off
      try {
        if (info !== undefined && info !== null && typeof info.subscribe === 'function') off = info.subscribe(read)
      } catch (_error) {
        off = undefined
      }
      read()
      return {
        subscribe(listener) {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        },
        getSnapshot() {
          return snapshot
        },
        dispose() {
          if (typeof off === 'function') {
            try {
              off()
            } catch (_error) {
              /* the layout may already be gone */
            }
          }
          off = undefined
          listeners.clear()
        }
      }
    }

    /**
     * The plugin's translate seat. A namespace the registry does not hold makes a
     * lookup return the key itself, so the Chinese source strings stand in rather
     * than leaving raw keys on screen.
     * @param locale - the Client's locale service.
     * @returns the translate function the bar reads its copy through.
     */
    function createTranslate(locale) {
      const bound = locale.bind(NS)
      return (key, params) => {
        const value = bound(key, params)
        if (typeof value === 'string' && value !== key) return value
        const template = zh[key]
        if (template === undefined) return key
        return template.replace(/\{(\w+)\}/g, (match, name) =>
          params !== undefined && params[name] !== undefined ? String(params[name]) : match
        )
      }
    }

    /** The bar's initial view: reading the profile, nothing known yet. */
    const INITIAL_VIEW = { status: 'loading', data: null, message: null, tone: 'info', done: 0, total: 0 }

    /**
     * The bulk bar: the two buttons, the count they act on, and the outcome of
     * the last run.
     * @param props - the slot's injected props: translate seat, panel watch, Remote, locale and change feed.
     * @returns the bar, or null while the Plugins page is not on screen.
     */
    function CustomPluginsSwitch(props) {
      const { t, panel, remote, locale, subscribeChanged } = props
      const stored = React.useSyncExternalStore(panel.subscribe, panel.getSnapshot).active
      const hooked = readPanelHook(props.usePanelInfo)
      /* The slot's own hook wins; the layout service is the fallback source. */
      const active = hooked === undefined ? stored : hooked
      /* Reading the snapshot re-renders the bar when the language changes. */
      React.useSyncExternalStore(
        React.useCallback((listener) => locale.subscribe(listener), [locale]),
        React.useCallback(() => locale.getSnapshot(), [locale])
      )
      const [view, setView] = React.useState(INITIAL_VIEW)
      const viewRef = React.useRef(view)
      viewRef.current = view
      /* A synchronous guard: two clicks in one tick must not start two runs. */
      const busyRef = React.useRef(false)

      const load = React.useCallback(() => {
        let cancelled = false
        readCustom(remote).then(
          (data) => {
            if (!cancelled) setView({ status: 'ready', data, message: null, tone: 'info', done: 0, total: 0 })
          },
          (error) => {
            if (cancelled) return
            setView((current) => ({
              status: 'error',
              data: current.data,
              message: t('loadFailed', { reason: reasonOf(error) }),
              tone: 'error',
              done: 0,
              total: 0
            }))
          }
        )
        return () => {
          cancelled = true
        }
      }, [remote, t])

      React.useEffect(() => {
        if (!active) return undefined
        return load()
      }, [active, load])

      React.useEffect(() => {
        if (!active) return undefined
        let off
        try {
          off = subscribeChanged(() => {
            if (viewRef.current.status === 'running') return
            load()
          })
        } catch (_error) {
          off = undefined
        }
        return () => {
          if (typeof off === 'function') {
            try {
              off()
            } catch (_error) {
              /* the connection may already be gone */
            }
          }
        }
      }, [active, load, subscribeChanged])

      const run = React.useCallback(
        async (enabled) => {
          const data = viewRef.current.data
          if (data === null || busyRef.current) return
          const names = enabled ? data.toEnable : data.toDisable
          busyRef.current = true
          setView((current) => ({ ...current, status: 'running', message: null, done: 0, total: names.length }))
          try {
            const outcome = await toggleAll(remote, names, enabled, t, (done, total) => {
              setView((current) => (current.status === 'running' ? { ...current, done, total } : current))
            })
            let fresh = null
            try {
              fresh = await readCustom(remote)
            } catch (_error) {
              fresh = null
            }
            setView((current) => ({
              status: 'ready',
              data: fresh === null ? current.data : fresh,
              message: outcome.message,
              tone: outcome.failed.length > 0 ? 'error' : outcome.restart > 0 ? 'warn' : 'info',
              done: 0,
              total: 0
            }))
          } finally {
            busyRef.current = false
          }
        },
        [remote, t]
      )

      if (!active) return null
      const data = view.data
      const total = data === null ? 0 : data.total
      const running = view.status === 'running'
      const meta =
        running
          ? t('running', { done: String(view.done), total: String(view.total) })
          : view.status === 'loading'
            ? t('loading')
            : view.message !== null
              ? view.message
              : total === 0
                ? t('empty')
                : t('summary', { on: String(data.enabled), total: String(total) })
      const metaClass =
        'cps-meta' + (view.tone === 'error' && !running ? ' cps-error' : view.tone === 'warn' && !running ? ' cps-warn' : '')
      return h(
        'div',
        { className: 'cps-root' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        h(
          'div',
          { className: 'cps-bar', role: 'group', 'aria-label': t('label'), 'data-plugin': 'custom-plugins-switch' },
          h(
            'div',
            { className: 'cps-text' },
            h('span', { className: 'cps-title' }, t('label')),
            h('span', { className: metaClass, role: 'status', 'aria-live': 'polite' }, meta)
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'cps-button cps-primary',
              title: t('enableAllHint'),
              disabled: running || data === null || data.toEnable.length === 0,
              onClick: () => {
                void run(true)
              }
            },
            t('enableAll')
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'cps-button',
              title: t('disableAllHint'),
              disabled: running || data === null || data.toDisable.length === 0,
              onClick: () => {
                void run(false)
              }
            },
            t('disableAll')
          )
        )
      )
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.pluginManager', 'layout'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'custom-plugins-switch: dictionaries')
        const t = createTranslate(ctx.locale)
        const panel = createPanelWatch(ctx.layout)
        ctx.effect(() => () => panel.dispose(), 'custom-plugins-switch: panel watch')
        const locale = ctx.locale
        const remote = ctx.remote
        const subscribeChanged = (listener) => ctx.remote.$on('plugin-manager/changed', listener)
        ctx.slots.inject('shell.overlay', () =>
          ctx.slots.register(
            {
              name: 'shell.overlay',
              id: 'custom-plugins-switch',
              order: 800,
              locale: NS,
              inject: () => ({ t, panel, locale, remote, subscribeChanged })
            },
            CustomPluginsSwitch
          )
        )
      }
    }
  }
})
