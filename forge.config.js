module.exports = {
  packagerConfig: {
    asar: true,
    icon: './assets/icon',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          maintainer: 'Joel Wickard',
          homepage: 'https://github.com/joelwickard/moog-muse-manager',
          categories: ['Audio', 'Music'],
          description: 'A desktop application to manage sound patches and step-sequencer files for the Moog Muse synthesizer',
          icon: './assets/icon.png',
          mimeType: ['audio/midi'],
          bin: 'moog-muse-manager',
          section: 'sound',
          priority: 'optional',
          depends: ['libgtk-3-0', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils', 'libatspi2.0-0', 'libuuid1', 'libsecret-1-0', 'libasound2']
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        icon: './assets/icon.icns',
      },
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-vite',
      config: {
        build: [
          {
            entry: 'src/main/main.ts',
            config: 'vite.main.config.ts',
          },
          {
            entry: 'src/preload/preload.ts',
            config: 'vite.preload.config.ts',
          }
        ],
        renderer: [
          {
            name: 'renderer',
            config: 'vite.renderer.config.ts',
          }
        ]
      },
    },
  ],
}; 