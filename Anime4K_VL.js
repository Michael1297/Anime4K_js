// ==UserScript==
// @name                Bilibili_Anime4K_VL
// @description         Bring Anime4K to Bilibili and ACFun's HTML5 player to clearify 2D anime.
// @namespace           http://net2cn.tk/
// @homepageURL         https://github.com/net2cn/Bilibili_Anime4K/
// @version             0.5.3-vl
// @author              net2cn
// @copyright           bloc97, DextroseRe, NeuroWhAI, and all contributors of Anime4K
// @match               *://www.bilibili.com/video/av*
// @match               *://www.bilibili.com/bangumi/play/ep*
// @match               *://www.bilibili.com/bangumi/play/ss*
// @match               *://www.bilibili.com/video/BV*
// @match               *://www.acfun.cn/bangumi/aa*
// @match               *://*.online-stars.org/*
// @match               *://*.online-star.org/*
// @match               *://www.anilibria.tv/*
// @match               *://online.anidub.com/*
// @match               *://jut-su.net/*
// @match               *://anistar*.*/*
// @match               *://astar*.*/*
// @match               *://kodik.info/*
// @match               *://vk.com/video_ext.php?*
// @match               *://*.animaunt.*/*
// @match               *://*.tigerlips.*/*
// @grant               none
// @license             MIT License
// @run-at              document-idle
// @require             file:///C:/Users/1/IdeaProjects/Bilibili_Anime4K/ShaderRuntime.js
// ==/UserScript==

// NOTE: This VL userscript currently reuses the stable CNN-M x2 pipeline
// as a compatibility baseline for Bilibili/ACFun WebGL playback.


const SHADER_URL = "https://raw.githubusercontent.com/bloc97/Anime4K/7684e9586f8dcc738af08a1cdceb024cc184f426/glsl/Upscale/Anime4K_Upscale_CNN_x2_VL.glsl";


function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);

    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
}

function createProgram(gl, vertexSource, fragmentSource) {
    const program = gl.createProgram();

    //console.log(fragmentSource)

    var vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
    var fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
    }

    var wrapper = { program: program };

    var numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (var i = 0; i < numAttributes; i++) {
        var attribute = gl.getActiveAttrib(program, i);
        wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
    }
    var numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i$1 = 0; i$1 < numUniforms; i$1++) {
        var uniform = gl.getActiveUniform(program, i$1);
        wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }

    return wrapper;
}

function createTexture(gl, filter, data, width, height) {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    if (data instanceof Uint8Array) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    return texture;
}

function bindTexture(gl, texture, unit) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
}

function updateTexture(gl, texture, src) {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
}

function createBuffer(gl, data) {
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return buffer;
}

function bindAttribute(gl, buffer, attribute, numComponents) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, numComponents, gl.FLOAT, false, 0, 0);
}

function bindFramebuffer(gl, framebuffer, texture) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    if (texture) {
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    }
}


const quadVert = `
precision mediump float;

attribute vec2 a_pos;
varying vec2 v_tex_pos;

void main() {
    v_tex_pos = a_pos;
    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);
}
`;

let frag0 = '';

let frag1 = '';

let frag2 = '';

let frag3 = '';

let frag4 = '';

let frag5 = '';

let frag6 = '';

let frag7 = '';

let frag8 = '';

let frag9 = '';

const fragDraw = `
precision mediump float;

uniform sampler2D u_texture;
varying vec2 v_tex_pos;

void main() {
    vec4 color = texture2D(u_texture, vec2(v_tex_pos.x, 1.0 - v_tex_pos.y));
    gl_FragColor = color;
}
`;

async function loadRuntimeShadersOrThrow() {
    const parsed = await BilibiliShaderRuntime.loadAnime4KPassesOrThrow(SHADER_URL, 10);
    [frag0, frag1, frag2, frag3, frag4, frag5, frag6, frag7, frag8, frag9] = parsed.slice(0, 10);
    console.log('Remote GLSL loaded. Blocks:', parsed.length);
}

function Scaler(gl) {
    this.gl = gl;

    this.inputTex = null;
    this.inputMov = null;
    this.inputWidth = 0;
    this.inputHeight = 0;

    this.quadBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
    this.framebuffer = gl.createFramebuffer();

    console.log('Compiling shaders...')
    this.program0 = createProgram(gl, quadVert, frag0);
    this.program1 = createProgram(gl, quadVert, frag1);
    this.program2 = createProgram(gl, quadVert, frag2);
    this.program3 = createProgram(gl, quadVert, frag3);
    this.program4 = createProgram(gl, quadVert, frag4);
    this.program5 = createProgram(gl, quadVert, frag5);
    this.program6 = createProgram(gl, quadVert, frag6);
    this.program7 = createProgram(gl, quadVert, frag7);
    this.program8 = createProgram(gl, quadVert, frag8);
    this.program9 = createProgram(gl, quadVert, frag9);
    this.programDraw = createProgram(gl, quadVert, fragDraw);

    this.temp0Texture = null;
    this.temp1Texture = null;
    this.outputTexture = null;
    this.mmkernelTexture = null;

    this.luman0Texture = null;
    this.luman1Texture = null;
    this.luman2Texture = null;
    this.luman3Texture = null;
    this.luman4Texture = null;
    this.luman5Texture = null;
    this.luman6Texture = null;

    this.scale = 1.0;
    this.screenRatio = window.screen.width/window.screen.height;
    this.playerRatio = 16/9 // Assuming default player ratio is 16:9 (this is true for Bilibili and ACFun).
    this.isLoggedPaused = false;
    this.isFullscreen = true;   // Setting this to true to resize the board on start.
    console.log("Default screen aspect ratio is set to " + this.screenRatio)
}

Scaler.prototype.inputImage = function (img) {
    const gl = this.gl;

    this.inputWidth = img.width;
    this.inputHeight = img.height;

    this.inputTex = createTexture(gl, gl.LINEAR, img);
    this.inputMov = null;
}

Scaler.prototype.inputVideo = function (mov) {
    const gl = this.gl;

    const width = mov.videoWidth;
    const height = mov.videoHeight;

    this.inputWidth = width;
    this.inputHeight = height;

    let emptyPixels = new Uint8Array(width * height * 4);
    this.inputTex = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.inputMov = mov;
}

Scaler.prototype.resize = function (scale) {
    const gl = this.gl;

    const width = Math.round(this.inputWidth * scale);
    const height = Math.round(this.inputHeight * scale);

    gl.canvas.width = width;
    gl.canvas.height = height;

    let emptyPixels = new Uint8Array(width * height * 4);

    this.temp0Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.temp1Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.outputTexture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.mmkernelTexture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);

    this.luman0Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman1Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman2Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman3Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman4Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman5Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
    this.luman6Texture = createTexture(gl, gl.LINEAR, emptyPixels, width, height);
}

Scaler.prototype.resizeBoard = function(originRatio, newRatio){
    if (Math.abs(originRatio-newRatio) > 0.001){    // To prevent precision-caused problem.
        console.log("Video ratio mismatched!")
        console.log("Video Ratio: " + originRatio)
        console.log("Screen ratio: " + newRatio)
        if(originRatio>newRatio){   // Not-so-wide screen, change height.
            let newHeight = newRatio/originRatio*100
            console.log("Setting new height precentage: " + newHeight + "%")
            globalBoard.style.height = newHeight + "%"
            globalBoard.style.marginTop = (100-newHeight)/3 + "%"
        } else {    // Wide screen, change width.
            let newWidth = originRatio/newRatio*100
            console.log("Setting new width precentage: " + newWidth + "%")
            globalBoard.style.width = newWidth + "%"
            globalBoard.style.marginLeft = (100-newWidth)/2 + "%"
        }
    }
}

Scaler.prototype.render = async function () {
    if (!this.inputMov || !this.inputTex) {
        return;
    }

    // Nasty trick to fix video quailty changing bug.
    if (this.gl.getError() == this.gl.INVALID_VALUE) {
        console.log('glError detected! Fetching new viedo tag... (This may happen due to resolution change)')
        let newMov = await getVideoTag()
        this.inputVideo(newMov)
    }

    let videoRatio = this.inputMov.videoWidth/this.inputMov.videoHeight
    if (document.fullscreenElement!=null) {  // To prevent float precision caused problem.
        if(!this.isFullscreen){
            console.log("Fullscreen detected.")
            this.resizeBoard(videoRatio, this.screenRatio)
            this.isFullscreen = true
        }
    } else {
        if(this.isFullscreen){
            console.log("Fullscreen deactivated.")
            // Reset all style.
            globalBoard.style.width = "100%"
            globalBoard.style.height = "100%"
            globalBoard.style.marginLeft = null
            globalBoard.style.marginTop = null
            // Then re-calculate board ratio.
            this.resizeBoard(videoRatio, this.playerRatio)
            this.isFullscreen = false
        }
    }

    // Check if video is paused.
    if (this.inputMov.paused){
        // If paused we stop rendering new frames.
        if(!this.isLoggedPaused){
            console.log("Video paused.")
            this.isLoggedPaused = true
        }
        return
    } else {
        // Else we continue rendering new frames.
        if(this.isLoggedPaused){
            console.log("Video continued.")
            this.isLoggedPaused = false
        }
    }

    if (this.inputMov) {
        updateTexture(this.gl, this.inputTex, this.inputMov);
    }

    // Automatic change scale according to original video resolution.
    // Upscaled to 1440p.
    let newScale = 1440 / this.inputMov.videoHeight;
    if (this.scale != newScale){
        this.scale = newScale;
        console.log('Setting scale to ' + this.scale);
    }

    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.STENCIL_TEST);

    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);

    // Frag0
    bindFramebuffer(this.gl, this.framebuffer, this.luman0Texture); // SAVE LUMAN0
    this.gl.useProgram(this.program0.program);
    bindAttribute(this.gl, this.quadBuffer, this.program0.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program0.HOOKED, 0);
    this.gl.uniform2f(this.program0.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag1
    bindFramebuffer(this.gl, this.framebuffer, this.luman1Texture); // SAVE LUMAN1
    this.gl.useProgram(this.program1.program);
    bindAttribute(this.gl, this.quadBuffer, this.program1.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program1.HOOKED, 0);
    bindTexture(this.gl, this.luman0Texture, 1); // LUMAN0
    this.gl.uniform1i(this.program1.LUMAN0, 1);
    this.gl.uniform2f(this.program1.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag2
    bindFramebuffer(this.gl, this.framebuffer, this.luman2Texture); // SAVE LUMAN2
    this.gl.useProgram(this.program2.program);
    bindAttribute(this.gl, this.quadBuffer, this.program2.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program2.HOOKED, 0);
    bindTexture(this.gl, this.luman1Texture, 1); // LUMAN1
    this.gl.uniform1i(this.program2.LUMAN1, 1);
    this.gl.uniform2f(this.program2.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag3
    bindFramebuffer(this.gl, this.framebuffer, this.luman3Texture); // SAVE LUMAN3
    this.gl.useProgram(this.program3.program);
    bindAttribute(this.gl, this.quadBuffer, this.program3.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program3.HOOKED, 0);
    bindTexture(this.gl, this.luman2Texture, 1); // LUMAN2
    this.gl.uniform1i(this.program3.LUMAN2, 1);
    this.gl.uniform2f(this.program3.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag4
    bindFramebuffer(this.gl, this.framebuffer, this.luman4Texture); // SAVE LUMAN4
    this.gl.useProgram(this.program4.program);
    bindAttribute(this.gl, this.quadBuffer, this.program4.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program4.HOOKED, 0);
    bindTexture(this.gl, this.luman3Texture, 1); // LUMAN3
    this.gl.uniform1i(this.program4.LUMAN3, 1);
    this.gl.uniform2f(this.program4.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag5
    bindFramebuffer(this.gl, this.framebuffer, this.luman5Texture); // SAVE LUMAN5
    this.gl.useProgram(this.program5.program);
    bindAttribute(this.gl, this.quadBuffer, this.program5.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program5.HOOKED, 0);
    bindTexture(this.gl, this.luman4Texture, 1); // LUMAN4
    this.gl.uniform1i(this.program5.LUMAN4, 1);
    this.gl.uniform2f(this.program5.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag6
    bindFramebuffer(this.gl, this.framebuffer, this.temp0Texture); // SAVE LUMAN0
    this.gl.useProgram(this.program6.program);
    bindAttribute(this.gl, this.quadBuffer, this.program6.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program6.HOOKED, 0);
    bindTexture(this.gl, this.luman0Texture, 1); // LUMAN0
    this.gl.uniform1i(this.program6.LUMAN0, 1);
    bindTexture(this.gl, this.luman1Texture, 2); // LUMAN1
    this.gl.uniform1i(this.program6.LUMAN1, 2);
    bindTexture(this.gl, this.luman2Texture, 3); // LUMAN2
    this.gl.uniform1i(this.program6.LUMAN2, 3);
    bindTexture(this.gl, this.luman3Texture, 4); // LUMAN3
    this.gl.uniform1i(this.program6.LUMAN3, 4);
    bindTexture(this.gl, this.luman4Texture, 5); // LUMAN4
    this.gl.uniform1i(this.program6.LUMAN4, 5);
    bindTexture(this.gl, this.luman5Texture, 6); // LUMAN5
    this.gl.uniform1i(this.program6.LUMAN5, 6);
    this.gl.uniform2f(this.program6.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag7
    bindFramebuffer(this.gl, this.framebuffer, this.mmkernelTexture); // SAVE MMKERNEL
    this.gl.useProgram(this.program7.program);
    bindAttribute(this.gl, this.quadBuffer, this.program7.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program7.HOOKED, 0);
    this.gl.uniform2f(this.program7.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag8
    bindFramebuffer(this.gl, this.framebuffer, this.temp1Texture); // SAVE MMKERNEL
    this.gl.useProgram(this.program8.program);
    bindAttribute(this.gl, this.quadBuffer, this.program8.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program8.HOOKED, 0);
    bindTexture(this.gl, this.mmkernelTexture, 1); // MMKERNEL
    this.gl.uniform1i(this.program8.MMKERNEL, 1);
    this.gl.uniform2f(this.program8.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Frag9
    bindFramebuffer(this.gl, this.framebuffer, this.outputTexture); // SAVE
    this.gl.useProgram(this.program9.program);
    bindAttribute(this.gl, this.quadBuffer, this.program9.a_pos, 2);

    bindTexture(this.gl, this.inputTex, 0); // HOOKED NATIVE
    this.gl.uniform1i(this.program9.HOOKED, 0);
    bindTexture(this.gl, this.temp1Texture, 1); // MMKERNEL
    this.gl.uniform1i(this.program9.MMKERNEL, 1);
    bindTexture(this.gl, this.temp0Texture, 2); // LUMAN0
    this.gl.uniform1i(this.program9.LUMAN0, 2);
    this.gl.uniform2f(this.program9.HOOKED_pt, 1.0 / this.gl.canvas.width, 1.0 / this.gl.canvas.height);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

    // Draw
    bindFramebuffer(this.gl, null);
    this.gl.useProgram(this.programDraw.program);
    bindAttribute(this.gl, this.quadBuffer, this.programDraw.a_pos, 2);
    bindTexture(this.gl, this.outputTexture, 0); // luman0
    this.gl.uniform1i(this.programDraw.u_texture, 0);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
}

// Parameters.
let globalScaler = null;
let globalMovOrig = null;
let globalBoard = null;
let globalScale = 2.0;
let globalCurrentHref=window.location.href

let globalUpdateId, globalPreviousDelta = 0;
let globalFpsLimit = 30;    // Limit fps to 30 fps. Change here if you want more frames to be rendered. (But usually 30 fps is pretty enough for most anime as they are mostly done on threes.)

function getScreenRefreshRate(callback, runIndefinitely = false){
    let requestId = null;
    let callbackTriggered = false;
    runIndefinitely = runIndefinitely || false;

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
    }

    let DOMHighResTimeStampCollection = [];

    let triggerAnimation = function(DOMHighResTimeStamp){
        DOMHighResTimeStampCollection.unshift(DOMHighResTimeStamp);

        if (DOMHighResTimeStampCollection.length > 10) {
            let t0 = DOMHighResTimeStampCollection.pop();
            let fps = Math.floor(1000 * 10 / (DOMHighResTimeStamp - t0));

            if(!callbackTriggered){
                callback.call(undefined, fps, DOMHighResTimeStampCollection);
            }

            if(runIndefinitely){
                callbackTriggered = false;
            }else{
                callbackTriggered = true;
            }
        }

        requestId = window.requestAnimationFrame(triggerAnimation);
    };

    window.requestAnimationFrame(triggerAnimation);

    // Stop after half second if it shouldn't run indefinitely
    if(!runIndefinitely){
        window.setTimeout(function(){
            window.cancelAnimationFrame(requestId);
            requestId = null;
        }, 500);
    }
}

async function injectCanvas() {
    console.log('Injecting canvas...')

    // Create a canvas (since video tag do not support WebGL).
    globalMovOrig = await getVideoTag()

    let div = globalMovOrig.parentElement
    if(window.location.href.toLowerCase().includes("bilibili.com")){
        console.log("Working on bilibili.com.")
        while(div.className!="bilibili-player-video") {
            await new Promise(r => setTimeout(r, 500));
        }
        div = globalMovOrig.parentElement
    }
    div.style.backgroundColor = "black" // Patch for ACFun.

    if (!globalBoard){
        console.log("globalBoard not exists. Creating new one.")

        globalBoard = document.createElement('canvas');
        // Make it visually fill the positioned parent
        globalBoard.style.width = '100%';
        globalBoard.style.height = '100%';
        // ...then set the internal size to match
        globalBoard.width = globalBoard.offsetWidth;
        globalBoard.height = globalBoard.offsetHeight;
        // Add it back to the div where contains the video tag we use as input.
    }
    console.log("Adding new canvas.")
    div.appendChild(globalBoard)

    // Hide original video tag, we don't need it to be displayed.
    globalMovOrig.style.display = 'none'
}

async function getVideoTag() {
    while(document.getElementsByTagName("video").length <= 0) {
        await new Promise(r => setTimeout(r, 500));
    }

    globalMovOrig=document.getElementsByTagName("video")[0]

    globalMovOrig.addEventListener('loadedmetadata', function () {
        globalScaler = !globalScaler?new Scaler(globalBoard.getContext('webgl')):globalScaler;
        globalScaler.inputVideo(globalMovOrig);
        globalScaler.resize(globalScale);
        globalScaler.scale = globalScale;
    }, true);
    globalMovOrig.addEventListener('error', function () {
        alert("Can't get video, sorry.");
    }, true);

    return globalMovOrig
}

async function doFilter() {
    // Setting our parameters for filtering.
    // scale: multipliers that we need to zoom in.
    // Here's the fun part. We create a pixel shader for our canvas
    console.log('Enabling filter...')

    // Auto detect refresh rate.
    getScreenRefreshRate(function(screenRefreshRate){
        globalFpsLimit = Math.floor((screenRefreshRate+1) / 2);
        globalFpsLimit = globalFpsLimit<30?30:globalFpsLimit;   // If refresh rate is below 30 fps we round it up to 30.
        console.log("Framerate limit is set to " + globalFpsLimit + " FPS.");
    });

    // Do it! Filter it! Profit!
    async function render(currentDelta) {
        // Notice that limiting the framerate here did increase performance.
        globalUpdateId = requestAnimationFrame(render);
        let delta = currentDelta - globalPreviousDelta;

        if (globalFpsLimit && delta < 1000/globalFpsLimit){
            return;
        }

        if (globalScaler) {
            globalScaler.render();
        }

        if (globalCurrentHref!=window.location.href){
            console.log("Page changed!")
            await injectCanvas()
            globalCurrentHref=window.location.href
        }

        globalPreviousDelta = currentDelta
    }

    globalUpdateId = requestAnimationFrame(render);
}

(async function () {
    console.log('Bilibili_Anime4K starting...')
    try {
        await loadRuntimeShadersOrThrow()
    } catch (err) {
        console.error('Failed to initialize remote GLSL pipeline:', err)
        return
    }
    await injectCanvas()
    doFilter()
})();
