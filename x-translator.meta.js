// ==UserScript==
// @name               X Translator
// @name:ru            X Translator
// @name:zh-CN         X Translator
// @name:es            X Translator
// @name:pt-BR         X Translator
// @name:de            X Translator
// @name:fr            X Translator
// @name:ja            X Translator
// @namespace          https://github.com/NemoKing1210/x-translator
// @version            1.1.1
// @author             NemoKing1210
// @description        Translate X posts in place on x.com
// @description:ru     Переводит посты X прямо на x.com
// @description:zh-CN  在 x.com 上就地翻译 X 帖子
// @description:es     Traduce publicaciones de X en x.com
// @description:pt-BR  Traduz posts do X diretamente no x.com
// @description:de     Übersetzt X-Posts direkt auf x.com
// @description:fr     Traduit les posts X directement sur x.com
// @description:ja     x.com 上で X の投稿をその場で翻訳
// @license            MIT
// @icon               https://abs.twimg.com/favicons/twitter.3.ico
// @homepage           https://github.com/NemoKing1210/x-translator
// @homepageURL        https://github.com/NemoKing1210/x-translator
// @source             https://github.com/NemoKing1210/x-translator.git
// @supportURL         https://github.com/NemoKing1210/x-translator/issues
// @downloadURL        https://raw.githubusercontent.com/NemoKing1210/x-translator/main/x-translator.user.js
// @updateURL          https://raw.githubusercontent.com/NemoKing1210/x-translator/main/x-translator.user.js
// @match              https://x.com/*
// @match              https://www.x.com/*
// @match              https://twitter.com/*
// @match              https://www.twitter.com/*
// @tag                x
// @tag                twitter
// @tag                translate
// @connect            translate.googleapis.com
// @connect            api-free.deepl.com
// @connect            api.deepl.com
// @connect            api.cognitive.microsofttranslator.com
// @connect            api.openai.com
// @connect            translate.api.cloud.yandex.net
// @connect            libretranslate.com
// @connect            *
// @grant              GM_addStyle
// @grant              GM_getValue
// @grant              GM_registerMenuCommand
// @grant              GM_setValue
// @grant              GM_xmlhttpRequest
// @run-at             document-idle
// @noframes
// ==/UserScript==