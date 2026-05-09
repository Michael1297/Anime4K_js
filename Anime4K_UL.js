// ==UserScript==
// @name                Anime4K_UL
// @description         Bring Anime4K to Bilibili and ACFun's HTML5 player to clearify 2D anime.
// @homepageURL         https://github.com/Michael1297/Anime4K_js/
// @version             0.6.0-ul
// @author              Michael1297
// @copyright           bloc97, DextroseRe, NeuroWhAI, and all contributors of Anime4K
// @match               *://www.bilibili.com/video/av*
// @match               *://www.bilibili.com/bangumi/play/ep*
// @match               *://www.bilibili.com/bangumi/play/ss*
// @match               *://www.bilibili.com/video/BV*
// @match               *://www.acfun.cn/bangumi/aa*
// @match               *://*.online-stars.org/*
// @match               *://*.online-star.org/*
// @match               *://*.anilibria.tv/*
// @match               *://*.online.anidub.com/*
// @match               *://*.jut-su.net/*
// @match               *://*.anistar*.*/*
// @match               *://*.astar*.*/*
// @match               *://*.kodik.info/*
// @match               *://*.vk.com/video_ext.php?*
// @match               *://*.animaunt.*/*
// @grant               none
// @downloadURL         https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/Anime4K_UL.js
// @updateURL           https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/Anime4K_UL.js
// @license             MIT License
// @run-at              document-idle
// @require             https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/ShaderParser.js
// @require             https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/ShaderWebEngine.js
// ==/UserScript==

const SHADER_URL = "https://raw.githubusercontent.com/bloc97/Anime4K/7684e9586f8dcc738af08a1cdceb024cc184f426/glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl";
const ENABLE_SHADER_DEBUG_LOGS = false;

(async function () {
    const mpvPasses = await ShaderParser.loadMpvShaderPassesOrThrow(SHADER_URL, 25, {
        debugLogs: ENABLE_SHADER_DEBUG_LOGS,
        shaderDebugEnabled: ENABLE_SHADER_DEBUG_LOGS,
        returnMetadata: true,
    });
    await ShaderEngine.run({
        mpvPasses: mpvPasses,
        debugLogs: ENABLE_SHADER_DEBUG_LOGS,
        useNearestIntermediate: true,
    });
})();
