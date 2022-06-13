const path = require('path')
const child_process = require('child_process')
const electron = require('electron')
const esbuild = require('esbuild')
const { copy } = require('esbuild-plugin-copy')

const isDev = !process.argv.includes('--prod')

const electronRunner = (() => {
  let handle = null
  return {
    restart () {
      console.info('Restarting Electron process.')

      if (handle) handle.kill()
      handle = child_process.spawn(electron, ['.'], {
        stdio: 'inherit'
      })
    }
  }
})()

const nativeNodeModulesPlugin = {
  name: 'native-node-modules',
  setup(build) {
    // If a ".node" file is imported within a module in the "file" namespace, resolve 
    // it to an absolute path and put it into the "node-file" virtual namespace.
    build.onResolve({ filter: /\.node$/, namespace: 'file' }, args => ({
      path: require.resolve(args.path, { paths: [args.resolveDir] }),
      namespace: 'node-file',
    }))

    // Files in the "node-file" virtual namespace call "require()" on the
    // path from esbuild of the ".node" file in the output directory.
    build.onLoad({ filter: /.*/, namespace: 'node-file' }, args => ({
      contents: `
        import path from ${JSON.stringify(args.path)}
        try { module.exports = require(path) }
        catch {}
      `,
    }))

    // If a ".node" file is imported within a module in the "node-file" namespace, put
    // it in the "file" namespace where esbuild's default loading behavior will handle
    // it. It is already an absolute path since we resolved it to one above.
    build.onResolve({ filter: /\.node$/, namespace: 'node-file' }, args => ({
      path: args.path,
      namespace: 'file',
    }))

    // Tell esbuild's default loading behavior to use the "file" loader for
    // these ".node" files.
    let opts = build.initialOptions
    opts.loader = opts.loader || {}
    opts.loader['.node'] = 'file'
  },
}

const preloadBuild = esbuild.build({
  entryPoints: ['../ipc/preload.ts'],
  bundle: true,
  platform: 'node',
  external: ['electron'],
  outfile: 'dist/preload.js',
  watch: isDev
})

const mainBuild = esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: !isDev,
  platform: 'node',
  external: ['electron', 'uiohook-napi', 'robotjs', 'electron-overlay-window'],
  outfile: 'dist/main.js',
  define: {
    'process.env.STATIC': (isDev) ? '"../build/icons"' : '"."',
    'process.env.VITE_DEV_SERVER_URL': (isDev) ? '"http://localhost:8080"' : 'null'
  },
  plugins: [
    nativeNodeModulesPlugin,
    copy({
      assets: [{
        from: ['./**/*.wasm'],
        to: ['.']
      }]
    }), 
  ],
  watch: (isDev)
    ? { onRebuild (error) { if (!error) electronRunner.restart() } }
    : false
})

Promise.all([
  preloadBuild,
  mainBuild
])
.then(() => { if (isDev) electronRunner.restart() })
.catch(() => process.exit(1))
