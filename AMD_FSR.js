// ==UserScript==
// @name                AMD_FSR
// @description         Bring AMD FSR 1 to HTML5 players for sharper upscaling.
// @homepageURL         https://github.com/Michael1297/Anime4K_js/
// @version             0.6.0-fsr1
// @author              Michael1297
// @copyright           Advanced Micro Devices, agyild, and all contributors
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
// @downloadURL         https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/AMD_FSR.js
// @updateURL           https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/AMD_FSR.js
// @license             MIT License
// @run-at              document-idle
// @require             https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/ShaderParser.js
// @require             https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/ShaderWebEngine.js
// ==/UserScript==

const SHADER_URL = "https://raw.githubusercontent.com/Michael1297/Anime4K_js/refs/heads/master/shaders/FSR.glsl";
const ENABLE_SHADER_DEBUG_LOGS = false;
const FSR_RCAS_SHARPNESS = 0.2; // 0.0 is sharpest, higher values reduce sharpening.

(async function () {
    const mpvPasses = await ShaderParser.loadMpvShaderPassesOrThrow(SHADER_URL, 2, {
        debugLogs: ENABLE_SHADER_DEBUG_LOGS,
        shaderDebugEnabled: ENABLE_SHADER_DEBUG_LOGS,
        returnMetadata: true,
    });
    mpvPasses.forEach(function (pass) {
        pass.shader = ShaderParser.replaceDefine(
            ShaderParser.makeWebGL1Compatible(pass.shader),
            "SHARPNESS",
            FSR_RCAS_SHARPNESS
        );
    });
    await ShaderEngine.run({
        mpvPasses: mpvPasses,
        debugLogs: ENABLE_SHADER_DEBUG_LOGS,
        useNearestIntermediate: true,
        maxScale: 4.0,
    });
})();
