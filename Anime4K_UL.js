// ==UserScript==
// @name                Bilibili_Anime4K_UL
// @description         Bring Anime4K to Bilibili and ACFun's HTML5 player to clearify 2D anime.
// @namespace           http://net2cn.tk/
// @homepageURL         https://github.com/net2cn/Bilibili_Anime4K/
// @version             0.5.3-ul
// @author              net2cn
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
// @license             MIT License
// @run-at              document-idle
// @require             file:///C:/Users/1/IdeaProjects/Bilibili_Anime4K/ShaderParser.js
// @require             file:///C:/Users/1/IdeaProjects/Bilibili_Anime4K/ShaderWebEngine.js
// ==/UserScript==

const SHADER_URL = "https://raw.githubusercontent.com/bloc97/Anime4K/7684e9586f8dcc738af08a1cdceb024cc184f426/glsl/Upscale/Anime4K_Upscale_CNN_x2_UL.glsl";

(async function () {
    const parsed = await ShaderParser.loadMpvShaderPassesOrThrow(SHADER_URL, 10);
    const fragPasses = parsed.slice(0, 10);
    await ShaderEngine.run({
        fragPasses: fragPasses,
    });
})();
