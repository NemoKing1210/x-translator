import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

const RAW_BASE =
  'https://raw.githubusercontent.com/NemoKing1210/x-translator/main';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2, pure_getters: true },
      mangle: true,
      format: { comments: false },
    },
    cssMinify: true,
    target: 'es2018',
    reportCompressedSize: true,
  },
  esbuild: {
    legalComments: 'none',
  },
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: {
          '': 'X Translator',
          ru: 'X Translator',
          'zh-CN': 'X Translator',
          es: 'X Translator',
          'pt-BR': 'X Translator',
          de: 'X Translator',
          fr: 'X Translator',
          ja: 'X Translator',
        },
        namespace: 'https://github.com/NemoKing1210/x-translator',
        version: pkg.version,
        description: {
          '': 'Translate X posts in place on x.com',
          ru: 'Переводит посты X прямо на x.com',
          'zh-CN': '在 x.com 上就地翻译 X 帖子',
          es: 'Traduce publicaciones de X en x.com',
          'pt-BR': 'Traduz posts do X diretamente no x.com',
          de: 'Übersetzt X-Posts direkt auf x.com',
          fr: 'Traduit les posts X directement sur x.com',
          ja: 'x.com 上で X の投稿をその場で翻訳',
        },
        author: 'NemoKing1210',
        tag: ['x', 'twitter', 'translate'],
        homepageURL: 'https://github.com/NemoKing1210/x-translator',
        supportURL: 'https://github.com/NemoKing1210/x-translator/issues',
        updateURL: `${RAW_BASE}/x-translator.user.js`,
        downloadURL: `${RAW_BASE}/x-translator.user.js`,
        license: 'MIT',
        icon: 'https://abs.twimg.com/favicons/twitter.3.ico',
        match: [
          'https://x.com/*',
          'https://www.x.com/*',
          'https://twitter.com/*',
          'https://www.twitter.com/*',
        ],
        connect: [
          'translate.googleapis.com',
          'api-free.deepl.com',
          'api.deepl.com',
          'api.cognitive.microsofttranslator.com',
          'api.openai.com',
          'translate.api.cloud.yandex.net',
          'libretranslate.com',
          '*',
        ],
        'run-at': 'document-idle',
        noframes: true,
      },
      server: {
        prefix: 'dev:',
      },
      build: {
        fileName: 'x-translator.user.js',
        metaFileName: true,
      },
    }),
  ],
});
