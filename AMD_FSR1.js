// ==UserScript==
// @name                Bilibili_AMD_FSR1
// @description         Bring AMD FSR1 to Bilibili and ACFun's HTML5 player for sharper upscaling.
// @namespace           http://net2cn.tk/
// @homepageURL         https://github.com/net2cn/Bilibili_Anime4K/
// @version             0.5.3-fsr1
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

const SHADER_URL = "https://gist.githubusercontent.com/agyild/82219c545228d70c5604f865ce0b0ce5/raw/2623d743b9c23f500ba086f05b385dcb1557e15d/FSR.glsl";

function buildFsr1Passes(parsed) {
    if (parsed.length < 2) {
        throw new Error("Parsed only " + parsed.length + " shader blocks, expected at least 2 for FSR1");
    }
    const frag0 = parsed[0];
    const frag1 = parsed[1].replaceAll("EASUTEX", "LUMAN0");
    const nop2 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D LUMAN1;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    const nop3 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D LUMAN2;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    const nop4 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D LUMAN3;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    const nop5 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D LUMAN4;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    const nop6 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D LUMAN0;\nuniform sampler2D LUMAN1;\nuniform sampler2D LUMAN2;\nuniform sampler2D LUMAN3;\nuniform sampler2D LUMAN4;\nuniform sampler2D LUMAN5;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    const nop7 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=vec4(texture2D(HOOKED,v_tex_pos).rr,0.0,0.0);}";
    const nop8 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D MMKERNEL;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(MMKERNEL,v_tex_pos);}";
    const nop9 = "precision mediump float;\nuniform sampler2D HOOKED;\nuniform sampler2D MMKERNEL;\nuniform sampler2D LUMAN0;\nuniform vec2 HOOKED_pt;\nvarying vec2 v_tex_pos;\nvoid main(){gl_FragColor=texture2D(HOOKED,v_tex_pos);}";
    return [frag0, frag1, nop2, nop3, nop4, nop5, nop6, nop7, nop8, nop9];
}

(async function () {
    const parsed = await ShaderParser.loadMpvShaderPassesOrThrow(SHADER_URL, 2);
    const fragPasses = buildFsr1Passes(parsed);
    await ShaderEngine.run({
        fragPasses: fragPasses,
    });
})();
