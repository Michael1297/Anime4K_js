(function (global) {
    function chooseNativeControlsOverlay(config) {
        const cfg = config || {};
        if (cfg.nativeControlsOverlayLayer === true) {
            return true;
        }
        if (cfg.nativeControlsOverlayLayer === false) {
            return false;
        }
        const href = (window.location.href || "").toLowerCase().split("#")[0];
        const path = (window.location.pathname || "").toLowerCase();
        return /\.(mp4|m4v|webm|ogv|mov)(\?|$)/.test(path) || /\.(mp4|m4v|webm|ogv|mov)(\?|$)/.test(href);
    }

const quadVert = [
        "precision mediump float;",
        "",
        "attribute vec2 a_pos;",
        "varying vec2 v_tex_pos;",
        "",
        "void main() {",
        "    v_tex_pos = a_pos;",
        "    gl_Position = vec4(2.0 * a_pos.x - 1.0, 1.0 - 2.0 * a_pos.y, 0, 1);",
        "}",
    ].join("\n");

    const fragDraw = [
        "precision mediump float;",
        "",
        "uniform sampler2D u_texture;",
        "varying vec2 v_tex_pos;",
        "",
        "void main() {",
        "    vec4 color = texture2D(u_texture, vec2(v_tex_pos.x, 1.0 - v_tex_pos.y));",
        "    gl_FragColor = color;",
        "}",
    ].join("\n");

    const fragDrawLumaPreserveColor = [
        "precision mediump float;",
        "",
        "uniform sampler2D u_luma;",
        "uniform sampler2D u_source;",
        "varying vec2 v_tex_pos;",
        "",
        "void main() {",
        "    float processedLuma = texture2D(u_luma, v_tex_pos).r;",
        "    vec3 source = texture2D(u_source, v_tex_pos).rgb;",
        "    float sourceLuma = dot(source, vec3(0.2126, 0.7152, 0.0722));",
        "    float cb = (source.b - sourceLuma) / 1.8556;",
        "    float cr = (source.r - sourceLuma) / 1.5748;",
        "    float r = processedLuma + 1.5748 * cr;",
        "    float b = processedLuma + 1.8556 * cb;",
        "    float g = (processedLuma - 0.2126 * r - 0.0722 * b) / 0.7152;",
        "    vec3 color = vec3(r, g, b);",
        "    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);",
        "}",
    ].join("\n");

    function formatShaderSnippet(source, maxLines) {
        const lines = String(source || "").split(/\r?\n/).slice(0, maxLines);
        return lines.map(function (line, idx) {
            return String(idx + 1).padStart(4, " ") + ": " + line;
        }).join("\n");
    }

    function getGlDebugInfo(gl) {
        return {
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER),
            version: gl.getParameter(gl.VERSION),
            shadingLanguageVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
            maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
            maxTextureImageUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
        };
    }

    function createShader(gl, type, source, label) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const stage = type === gl.VERTEX_SHADER ? "vertex" : "fragment";
            const info = gl.getShaderInfoLog(shader) || "Unknown shader compile error";
            const snippet = formatShaderSnippet(source, 40);
            console.error("[ShaderCompileError]", {
                label: label,
                stage: stage,
                infoLog: info,
                snippet: snippet,
            });
            throw new Error("Shader compile failed [" + label + "/" + stage + "]: " + info + "\n" + snippet);
        }
        return shader;
    }

    function createProgram(gl, vertexSource, fragmentSource, label) {
        const program = gl.createProgram();
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource, label);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program) || "Unknown program link error";
            console.error("[ShaderLinkError]", {
                label: label,
                infoLog: info,
            });
            throw new Error("Shader link failed [" + label + "]: " + info);
        }

        const wrapper = { program: program };
        const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttributes; i++) {
            const attribute = gl.getActiveAttrib(program, i);
            wrapper[attribute.name] = gl.getAttribLocation(program, attribute.name);
        }
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < numUniforms; i++) {
            const uniform = gl.getActiveUniform(program, i);
            wrapper[uniform.name] = gl.getUniformLocation(program, uniform.name);
        }
        return wrapper;
    }

    function createTexture(gl, filter, data, width, height) {
        const texture = gl.createTexture();
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
        // Keep video upload deterministic across players/browsers.
        // Browser-default colorspace conversion can alter colors on some HLS stacks.
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }

    function createBuffer(gl, data) {
        const buffer = gl.createBuffer();
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

    function createMpvPipeline(gl, mpvPasses, debugLogs) {
        if (debugLogs) {
            console.log("[ShaderMpvPipelineInit]", {
                passCount: mpvPasses.length,
                passes: mpvPasses.map(function (pass, idx) {
                    return {
                        index: idx,
                        hook: pass.hook,
                        save: pass.save,
                        samplers: pass.samplers,
                        description: pass.description,
                        width: pass.width,
                        height: pass.height,
                        shaderLength: pass.shader.length,
                    };
                }),
                gl: getGlDebugInfo(gl),
                url: window.location.href,
            });
        }
        return {
            passes: mpvPasses.map(function (pass, idx) {
                return {
                    hook: pass.hook,
                    save: pass.save,
                    samplers: pass.samplers,
                    description: pass.description,
                    width: pass.width,
                    height: pass.height,
                    program: createProgram(gl, quadVert, pass.shader, "mpv-pass" + idx + ":" + pass.save),
                };
            }),
            programDraw: createProgram(gl, quadVert, fragDraw, "draw"),
            programDrawLuma: createProgram(gl, quadVert, fragDrawLumaPreserveColor, "draw-luma-preserve-color"),
        };
    }

    function RuntimeEngine(config) {
        this.config = config;
        this.mpvPasses = config.mpvPasses || [];
        this.debugLogs = !!config.debugLogs;
        this.useNearestIntermediate = config.useNearestIntermediate !== false;
        this.targetHeight = config.targetHeight || null;
        this.minScale = Number.isFinite(config.minScale) ? config.minScale : 1.0;
        this.maxScale = Number.isFinite(config.maxScale) ? config.maxScale : 2.0;
        this.scaler = null;
        this.mov = null;
        this.board = null;
        this.scale = 2.0;
        this.currentHref = window.location.href;
        this.updateId = null;
        this.previousDelta = 0;
        this.fpsLimit = 30;
        this.boundVideos = typeof WeakSet !== "undefined" ? new WeakSet() : null;
        this.attemptVideoCrossOrigin = config.attemptVideoCrossOrigin === true;
        this.nativeControlsOverlayLayer = chooseNativeControlsOverlay(config);
    }

    RuntimeEngine.prototype.resetVideoForComposite = function (video) {
        if (!video) {
            return;
        }
        video.style.display = "";
        video.style.opacity = "";
        video.style.pointerEvents = "";
        video.style.clipPath = "";
        video.style.webkitClipPath = "";
        if (this.board) {
            this.board.style.clipPath = "";
            this.board.style.webkitClipPath = "";
        }
    };

    RuntimeEngine.prototype.applyNativeControlsOverlay = function (video) {
        if (!video) {
            return;
        }
        const controlsHeight = Math.max(36, Number(this.config.nativeControlsOverlayHeight) || 72);
        video.controls = true;
        video.style.display = "";
        video.style.opacity = "";
        video.style.pointerEvents = "auto";
        video.style.clipPath = "";
        video.style.webkitClipPath = "";
        if (this.board) {
            this.board.style.pointerEvents = "none";
            this.board.style.clipPath = "inset(0 0 " + controlsHeight + "px 0)";
            this.board.style.webkitClipPath = this.board.style.clipPath;
        }
    };

    RuntimeEngine.prototype.getNativeControlsOverlayContainer = function (video) {
        if (!this.nativeControlsOverlayLayer || !video || !video.parentElement) {
            return video ? video.parentElement : null;
        }
        if (this.nativeControlsOverlayHost && this.nativeControlsOverlayHost.contains(video)) {
            return this.nativeControlsOverlayHost;
        }

        const parent = video.parentElement;
        const host = document.createElement("div");
        host.className = "shader-native-controls-overlay-host";
        host.style.position = "fixed";
        host.style.left = "0";
        host.style.top = "0";
        host.style.width = "100vw";
        host.style.height = "100vh";
        host.style.margin = "0";
        host.style.padding = "0";
        host.style.backgroundColor = "black";
        host.style.overflow = "hidden";
        host.style.zIndex = "2147483647";

        parent.insertBefore(host, video);
        host.appendChild(video);
        this.nativeControlsOverlayHost = host;
        document.documentElement.style.backgroundColor = "black";
        document.body.style.margin = "0";
        document.body.style.backgroundColor = "black";
        document.body.style.overflow = "hidden";
        return host;
    };

    RuntimeEngine.prototype.applyBoardLayerStyling = function (container, video) {
        if (!this.board || !container || !video) {
            return;
        }
        if (this.nativeControlsOverlayLayer) {
            if (!container.style.position || container.style.position === "static") {
                container.style.position = "relative";
            }
            this.board.style.position = "absolute";
            this.board.style.left = "0";
            this.board.style.top = "0";
            this.board.style.width = "100%";
            this.board.style.height = "100%";
            this.board.style.marginLeft = "0";
            this.board.style.marginTop = "0";
            this.board.style.zIndex = "1";
            this.board.style.pointerEvents = "none";
            video.style.position = "absolute";
            video.style.left = "0";
            video.style.top = "0";
            video.style.width = "100%";
            video.style.height = "100%";
            video.style.margin = "0";
            video.style.objectFit = "contain";
            video.style.zIndex = "0";
        } else {
            this.board.style.position = "";
            this.board.style.left = "";
            this.board.style.top = "";
            this.board.style.right = "";
            this.board.style.bottom = "";
            this.board.style.clipPath = "";
            this.board.style.webkitClipPath = "";
            this.board.style.zIndex = "";
            this.board.style.pointerEvents = "";
            if (video.style.zIndex === "0" || video.style.zIndex === "1") {
                video.style.zIndex = "";
            }
            video.style.clipPath = "";
            video.style.webkitClipPath = "";
        }
    };

    RuntimeEngine.prototype.attachBoardNearVideo = function (container, video) {
        if (!this.board || !container || !video) {
            return;
        }
        this.applyBoardLayerStyling(container, video);
        if (this.nativeControlsOverlayLayer) {
            if (this.board.parentNode !== container) {
                container.appendChild(this.board);
            } else if (this.board.previousSibling !== video) {
                container.appendChild(this.board);
            }
        } else if (this.board.parentNode !== container) {
            container.appendChild(this.board);
        } else if (this.board.previousSibling !== video && this.board.parentNode === container) {
            container.appendChild(this.board);
        }
    };

    RuntimeEngine.prototype.tryApplyCrossOriginAnonymous = function (video) {
        if (!this.attemptVideoCrossOrigin || !video) {
            return;
        }
        if (video.crossOrigin) {
            return;
        }
        if (video.readyState > 0 && (video.currentSrc || video.src)) {
            if (this.debugLogs) {
                console.log(
                    "[ShaderCrossOriginSkipped] video already has a URL and started loading; " +
                        "set attemptVideoCrossOrigin earlier (e.g. @run-at document-start) or reload after crossOrigin."
                );
            }
            return;
        }
        try {
            video.crossOrigin = "anonymous";
        } catch (err) {
            if (this.debugLogs) {
                console.warn("[ShaderCrossOriginSkipped] could not set crossOrigin:", err);
            }
        }
    };

    RuntimeEngine.prototype.getVideoSourceKey = function (video) {
        if (!video) {
            return "";
        }
        return [
            video.currentSrc || video.src || "",
            video.videoWidth || 0,
            video.videoHeight || 0,
        ].join("|");
    };

    RuntimeEngine.prototype.findBestVideo = function () {
        const videos = Array.from(document.getElementsByTagName("video"));
        if (videos.length === 0) {
            return null;
        }
        let best = videos[0];
        let bestScore = -1;
        for (const video of videos) {
            const width = video.videoWidth || video.clientWidth || 0;
            const height = video.videoHeight || video.clientHeight || 0;
            const areaScore = width * height;
            const readyBonus = video.readyState >= 2 ? 100000000 : 0;
            const playingBonus = !video.paused ? 1000000 : 0;
            const connectedPenalty = video.isConnected === false ? -1000000000 : 0;
            const score = areaScore + readyBonus + playingBonus + connectedPenalty;
            if (score > bestScore) {
                best = video;
                bestScore = score;
            }
        }
        return best;
    };

    RuntimeEngine.prototype.bindVideoEvents = function (video) {
        if (!video || (this.boundVideos && this.boundVideos.has(video))) {
            return;
        }
        if (this.boundVideos) {
            this.boundVideos.add(video);
        }
        const self = this;
        video.addEventListener("loadedmetadata", function () {
            if (!self.scaler && self.initializeScaler && self.board) {
                self.initializeScaler();
                return;
            }
            if (self.scaler && self.scaler.inputMov === video) {
                self.inputVideo(video);
                self.resize(self.scaler.scale);
                self.scaler.boardLayoutKey = null;
            }
        }, true);
        video.addEventListener("error", function () {
            console.error("ShaderEngine video element error:", video.error);
        }, true);
    };

    RuntimeEngine.prototype.switchInputVideo = function (video, reason) {
        if (!video || !this.scaler) {
            return;
        }
        this.bindVideoEvents(video);
        this.tryApplyCrossOriginAnonymous(video);
        this.mov = video;
        if (video.parentElement && this.board) {
            const container = this.nativeControlsOverlayLayer
                ? this.getNativeControlsOverlayContainer(video)
                : video.parentElement;
            container.style.backgroundColor = "black";
            this.attachBoardNearVideo(container, video);
        }
        this.inputVideo(video);
        this.resize(this.scaler.scale);
        this.scaler.inputSourceKey = this.getVideoSourceKey(video);
        this.scaler.hasRenderedFrame = false;
        this.scaler.boardLayoutKey = null;
        this.board.style.display = "none";
        this.resetVideoForComposite(video);
        if (this.debugLogs) {
            console.log("[ShaderVideoSwitch]", {
                reason: reason,
                currentSrc: video.currentSrc || video.src || "",
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
            });
        }
    };

    RuntimeEngine.prototype.maybeSwitchInputVideo = function () {
        if (!this.scaler) {
            return;
        }
        const current = this.scaler.inputMov;
        const best = this.findBestVideo();
        if (best && best !== current && (!current || current.isConnected === false || !best.paused || best.readyState >= 2)) {
            this.switchInputVideo(best, "video-element-changed");
            return;
        }
        const sourceKey = this.getVideoSourceKey(current);
        if (sourceKey && sourceKey !== this.scaler.inputSourceKey) {
            this.switchInputVideo(current, "video-source-changed");
        }
    };

    RuntimeEngine.prototype.getTargetHeight = function () {
        if (typeof this.targetHeight === "function") {
            return Math.max(1, Number(this.targetHeight(this.scaler.inputMov, this.board)) || 1);
        }
        if (Number.isFinite(this.targetHeight)) {
            return Math.max(1, this.targetHeight);
        }

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const parent = this.board && this.board.parentElement;
        const parentRect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
        if (parentRect && parentRect.height > 0) {
            return Math.max(1, Math.round(parentRect.height * dpr));
        }

        const boardRect = this.board && this.board.getBoundingClientRect ? this.board.getBoundingClientRect() : null;
        if (boardRect && boardRect.height > 0) {
            return Math.max(1, Math.round(boardRect.height * dpr));
        }

        const screenHeight = window.screen ? window.screen.height : 0;
        return Math.max(1, Math.round((screenHeight || 1440) * dpr));
    };

    RuntimeEngine.prototype.inputVideo = function (mov) {
        const gl = this.scaler.gl;
        const width = mov.videoWidth;
        const height = mov.videoHeight;
        this.scaler.inputWidth = width;
        this.scaler.inputHeight = height;
        this.scaler.inputTex = createTexture(gl, gl.LINEAR, new Uint8Array(width * height * 4), width, height);
        this.scaler.inputMov = mov;
        this.scaler.inputSourceKey = this.getVideoSourceKey(mov);
        this.scaler.videoTextureUploadBlocked = false;
        this.scaler.videoCorsBlockedLogged = false;
    };

    RuntimeEngine.prototype.resize = function (scale) {
        const gl = this.scaler.gl;
        const width = Math.max(1, Math.round(this.scaler.inputWidth * scale));
        const height = Math.max(1, Math.round(this.scaler.inputHeight * scale));
        gl.canvas.width = width;
        gl.canvas.height = height;
        const empty = new Uint8Array(width * height * 4);
        const passFilter = this.useNearestIntermediate ? gl.NEAREST : gl.LINEAR;
        this.scaler.outputTexture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.mpvTextureSizes = {};
        this.scaler.mpvPassTargets = [];
        this.scaler.mpvPassTargetSizes = [];
        const plannedSizes = {
            HOOKED: [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)],
            MAIN: [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)],
            LUMA: [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)],
        };
        const resolvePassSize = (pass) => {
            const widthExpr = pass.width || "";
            const heightExpr = pass.height || "";
            if (widthExpr.includes("OUTPUT") || heightExpr.includes("OUTPUT")) {
                return [width, height];
            }
            for (const samplerName of pass.samplers || []) {
                if ((widthExpr.includes(samplerName + ".w") || heightExpr.includes(samplerName + ".h")) && plannedSizes[samplerName]) {
                    return plannedSizes[samplerName];
                }
            }
            return [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)];
        };
        for (const pass of this.mpvPasses) {
            const passSize = resolvePassSize(pass);
            if (pass.save) {
                plannedSizes[pass.save] = passSize;
            }
            if (!pass.save || pass.save === "MAIN") {
                this.scaler.mpvPassTargets.push(this.scaler.outputTexture);
                this.scaler.mpvPassTargetSizes.push([width, height]);
                continue;
            }
            const passWidth = Math.max(1, passSize[0]);
            const passHeight = Math.max(1, passSize[1]);
            const passEmpty = new Uint8Array(passWidth * passHeight * 4);
            const passTexture = createTexture(gl, passFilter, passEmpty, passWidth, passHeight);
            this.scaler.mpvPassTargets.push(passTexture);
            this.scaler.mpvPassTargetSizes.push([passWidth, passHeight]);
            this.scaler.mpvTextureSizes[pass.save] = [passWidth, passHeight];
        }
        this.scaler.mpvTextureSizes.MAIN = [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)];
        if (this.debugLogs) {
            console.log("[ShaderResize]", {
                scale: scale,
                targetHeight: this.getTargetHeight(),
                minScale: this.minScale,
                maxScale: this.maxScale,
                inputWidth: this.scaler.inputWidth,
                inputHeight: this.scaler.inputHeight,
                canvasWidth: gl.canvas.width,
                canvasHeight: gl.canvas.height,
                passFilter: this.useNearestIntermediate ? "NEAREST" : "LINEAR",
            });
        }
    };

    RuntimeEngine.prototype.resizeBoard = function (originRatio, newRatio) {
        if (Math.abs(originRatio - newRatio) <= 0.001) {
            this.board.style.width = "100%";
            this.board.style.height = "100%";
            this.board.style.marginLeft = "0";
            this.board.style.marginTop = "0";
            return;
        }
        if (originRatio > newRatio) {
            const newHeight = (newRatio / originRatio) * 100;
            this.board.style.width = "100%";
            this.board.style.height = newHeight + "%";
            this.board.style.marginLeft = "0";
            this.board.style.marginTop = (100 - newHeight) / 2 + "%";
        } else {
            const newWidth = (originRatio / newRatio) * 100;
            this.board.style.height = "100%";
            this.board.style.width = newWidth + "%";
            this.board.style.marginTop = "0";
            this.board.style.marginLeft = (100 - newWidth) / 2 + "%";
        }
    };

    RuntimeEngine.prototype.getBoardContainerRatio = function () {
        const parent = this.board && this.board.parentElement;
        const rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
        const width = rect && rect.width > 0 ? rect.width : window.innerWidth;
        const height = rect && rect.height > 0 ? rect.height : window.innerHeight;
        return Math.max(1, width) / Math.max(1, height);
    };

    RuntimeEngine.prototype.getBoardLayoutKey = function () {
        const mov = this.scaler && this.scaler.inputMov;
        const vw = mov && mov.videoWidth ? mov.videoWidth : 0;
        const vh = mov && mov.videoHeight ? mov.videoHeight : 0;
        const parent = this.board && this.board.parentElement;
        const rect = parent && parent.getBoundingClientRect ? parent.getBoundingClientRect() : null;
        const pw = rect && rect.width > 0 ? Math.round(rect.width) : Math.round(window.innerWidth);
        const ph = rect && rect.height > 0 ? Math.round(rect.height) : Math.round(window.innerHeight);
        const fs = document.fullscreenElement ? "1" : "0";
        return vw + "x" + vh + "@" + pw + "x" + ph + "@" + fs;
    };

    RuntimeEngine.prototype.maybeResizeBoard = function () {
        if (!this.board || !this.scaler) {
            return;
        }
        const key = this.getBoardLayoutKey();
        if (key === this.scaler.boardLayoutKey) {
            return;
        }
        this.scaler.boardLayoutKey = key;
        const videoRatio = this.scaler.inputMov && this.scaler.inputMov.videoHeight > 0
            ? this.scaler.inputMov.videoWidth / this.scaler.inputMov.videoHeight
            : 16 / 9;
        this.resizeBoard(videoRatio, this.getBoardContainerRatio());
    };

    RuntimeEngine.prototype.renderFrame = async function () {
        if (!this.scaler.inputMov || !this.scaler.inputTex) {
            return;
        }
        const gl = this.scaler.gl;
        const p = this.scaler.pipeline;
        this.maybeSwitchInputVideo();
        const mov = this.scaler.inputMov;

        if (!mov || mov.readyState < 2 || mov.videoWidth <= 0 || mov.videoHeight <= 0) {
            if (this.debugLogs) {
                console.log("[ShaderSkipFrame]", {
                    reason: "video-not-ready",
                    readyState: mov ? mov.readyState : -1,
                    videoWidth: mov ? mov.videoWidth : 0,
                    videoHeight: mov ? mov.videoHeight : 0,
                });
            }
            return;
        }

        if (gl.getError() === gl.INVALID_VALUE) {
            const freshMov = await this.getVideoTag();
            this.inputVideo(freshMov);
        }

        this.maybeResizeBoard();
        this.scaler.isFullscreen = document.fullscreenElement != null;

        if (this.scaler.inputMov.paused) {
            if (!this.scaler.hasRenderedFrame) {
                this.board.style.display = "none";
                this.resetVideoForComposite(this.scaler.inputMov);
            }
            return;
        }

        if (this.scaler.inputWidth !== this.scaler.inputMov.videoWidth || this.scaler.inputHeight !== this.scaler.inputMov.videoHeight) {
            this.inputVideo(this.scaler.inputMov);
            this.resize(this.scaler.scale);
        }

        if (this.scaler.videoTextureUploadBlocked) {
            return;
        }

        try {
            updateTexture(gl, this.scaler.inputTex, this.scaler.inputMov);
        } catch (err) {
            const message = err && err.message ? err.message : String(err);
            const isCrossOriginVideo =
                /cross-origin|cross origin|tainted|CORS|may not be loaded/i.test(message);
            if (isCrossOriginVideo) {
                this.scaler.videoTextureUploadBlocked = true;
                if (!this.scaler.videoCorsBlockedLogged) {
                    this.scaler.videoCorsBlockedLogged = true;
                    console.warn(
                        "[ShaderVideoCORS] WebGL cannot upload this <video> to a texture: the media is " +
                            "cross-origin without permission to read pixels (missing or wrong CORS on the stream/CDN). " +
                            "The player still works; shader upscaling is disabled for this source. " +
                            "Fix requires the host to send Access-Control-Allow-Origin (and often the page to use " +
                            "video.crossOrigin before load), which a userscript cannot reliably patch after the fact.",
                        { currentSrc: this.scaler.inputMov.currentSrc || this.scaler.inputMov.src || "" }
                    );
                }
                this.board.style.display = "none";
                this.resetVideoForComposite(this.scaler.inputMov);
                return;
            }
            if (this.debugLogs) {
                console.warn("[ShaderSkipFrame]", {
                    reason: "video-upload-failed",
                    message: message,
                    readyState: this.scaler.inputMov.readyState,
                    videoWidth: this.scaler.inputMov.videoWidth,
                    videoHeight: this.scaler.inputMov.videoHeight,
                });
            }
            return;
        }

        const autoScale = this.getTargetHeight() / this.scaler.inputMov.videoHeight;
        const newScale = Math.min(this.maxScale, Math.max(this.minScale, autoScale));
        if (this.scaler.scale !== newScale) {
            this.resize(newScale);
            this.scaler.scale = newScale;
        }

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        const inputWidth = this.scaler.inputMov.videoWidth;
        const inputHeight = this.scaler.inputMov.videoHeight;
        const canvasWidth = gl.canvas.width;
        const canvasHeight = gl.canvas.height;

        const textureMap = { MAIN: this.scaler.inputTex };
        const textureSizes = Object.assign({}, this.scaler.mpvTextureSizes, {
            HOOKED: [inputWidth, inputHeight],
            MAIN: [inputWidth, inputHeight],
            LUMA: [inputWidth, inputHeight],
        });
        textureMap.HOOKED = this.scaler.inputTex;
        textureMap.LUMA = this.scaler.inputTex;
        const drawTextureToCanvas = (texture, preserveColorFromSource) => {
            bindFramebuffer(gl, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
            if (preserveColorFromSource && p.programDrawLuma) {
                gl.useProgram(p.programDrawLuma.program);
                bindAttribute(gl, this.scaler.quadBuffer, p.programDrawLuma.a_pos, 2);
                bindTexture(gl, texture, 0);
                bindTexture(gl, this.scaler.inputTex, 1);
                gl.uniform1i(p.programDrawLuma.u_luma, 0);
                gl.uniform1i(p.programDrawLuma.u_source, 1);
            } else {
                gl.useProgram(p.programDraw.program);
                bindAttribute(gl, this.scaler.quadBuffer, p.programDraw.a_pos, 2);
                bindTexture(gl, texture, 0);
                gl.uniform1i(p.programDraw.u_texture, 0);
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        let finalTexture = this.scaler.inputTex;
        for (let passIndex = 0; passIndex < p.passes.length; passIndex++) {
            const pass = p.passes[passIndex];
            const targetTexture = this.scaler.mpvPassTargets[passIndex];
            if (!targetTexture) {
                if (this.debugLogs) {
                    console.error("[ShaderMpvMissingTarget]", { passIndex: passIndex, save: pass.save });
                }
                return;
            }
            const targetSize = this.scaler.mpvPassTargetSizes[passIndex] || [canvasWidth, canvasHeight];
            gl.viewport(0, 0, targetSize[0], targetSize[1]);
            bindFramebuffer(gl, this.scaler.framebuffer, targetTexture);
            const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
                if (this.debugLogs) {
                    console.error("[ShaderFramebufferIncomplete]", {
                        status: fbStatus,
                        passIndex: passIndex,
                        save: pass.save,
                        canvasWidth: gl.canvas.width,
                        canvasHeight: gl.canvas.height,
                    });
                }
                return;
            }
            gl.useProgram(pass.program.program);
            bindAttribute(gl, this.scaler.quadBuffer, pass.program.a_pos, 2);
            let missingSampler = false;
            pass.samplers.forEach(function (samplerName, samplerIndex) {
                const texture = textureMap[samplerName];
                if (!texture) {
                    if (this.debugLogs) {
                        console.error("[ShaderMpvMissingSampler]", {
                            passIndex: passIndex,
                            sampler: samplerName,
                            available: Object.keys(textureMap),
                        });
                    }
                    missingSampler = true;
                    return;
                }
                bindTexture(gl, texture, samplerIndex);
                if (pass.program[samplerName]) {
                    gl.uniform1i(pass.program[samplerName], samplerIndex);
                }
                const ptLocation = pass.program[samplerName + "_pt"];
                const dims = textureSizes[samplerName] || [canvasWidth, canvasHeight];
                if (ptLocation) {
                    gl.uniform2f(ptLocation, 1.0 / Math.max(1, dims[0]), 1.0 / Math.max(1, dims[1]));
                }
            }, this);
            if (missingSampler) {
                return;
            }
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            textureMap[pass.save] = targetTexture;
            textureSizes[pass.save] = targetSize;
            textureMap.HOOKED = targetTexture;
            textureSizes.HOOKED = textureSizes[pass.save];
            if (pass.hook === "LUMA" || pass.save === "LUMA") {
                textureMap.LUMA = targetTexture;
                textureSizes.LUMA = textureSizes[pass.save];
            }
            finalTexture = targetTexture;
        }

        const finalPass = p.passes[p.passes.length - 1];
        drawTextureToCanvas(finalTexture, finalPass && finalPass.save === "LUMA");
        if (!this.scaler.hasRenderedFrame) {
            this.scaler.hasRenderedFrame = true;
            this.board.style.display = "";
            if (this.nativeControlsOverlayLayer) {
                this.applyNativeControlsOverlay(this.scaler.inputMov);
            } else {
                this.scaler.inputMov.style.display = "none";
                this.scaler.inputMov.style.opacity = "";
                this.scaler.inputMov.style.pointerEvents = "";
                this.scaler.inputMov.style.clipPath = "";
                this.scaler.inputMov.style.webkitClipPath = "";
            }
        }

    };

    RuntimeEngine.prototype.getScreenRefreshRate = function (callback, runIndefinitely) {
        let requestId = null;
        let callbackTriggered = false;
        const keepRunning = !!runIndefinitely;
        if (!window.requestAnimationFrame) {
            window.requestAnimationFrame = window.mozRequestAnimationFrame || window.webkitRequestAnimationFrame;
        }
        const times = [];
        const trigger = function (timestamp) {
            times.unshift(timestamp);
            if (times.length > 10) {
                const t0 = times.pop();
                const fps = Math.floor(1000 * 10 / (timestamp - t0));
                if (!callbackTriggered) {
                    callback.call(undefined, fps, times);
                }
                callbackTriggered = !keepRunning;
            }
            requestId = window.requestAnimationFrame(trigger);
        };
        window.requestAnimationFrame(trigger);
        if (!keepRunning) {
            window.setTimeout(function () {
                window.cancelAnimationFrame(requestId);
            }, 500);
        }
    };

    RuntimeEngine.prototype.getVideoTag = async function () {
        while (document.getElementsByTagName("video").length <= 0) {
            await new Promise(function (r) { setTimeout(r, 500); });
        }
        this.mov = this.findBestVideo();
        const self = this;
        this.bindVideoEvents(this.mov);
        const initializeScaler = function () {
            if (!self.scaler) {
                self.scaler = {
                    gl: self.board.getContext("webgl"),
                    inputTex: null,
                    inputMov: null,
                    inputWidth: 0,
                    inputHeight: 0,
                    quadBuffer: null,
                    framebuffer: null,
                    pipeline: null,
                    outputTexture: null,
                    scale: 1.0,
                    inputSourceKey: "",
                    hasRenderedFrame: false,
                    boardLayoutKey: null,
                    isFullscreen: true,
                };
                self.scaler.quadBuffer = createBuffer(self.scaler.gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
                self.scaler.framebuffer = self.scaler.gl.createFramebuffer();
                self.scaler.pipeline = createMpvPipeline(self.scaler.gl, self.mpvPasses, self.debugLogs);
                if (self.debugLogs) {
                    console.log("[ShaderRuntimeInput]", {
                        videoWidth: self.mov.videoWidth,
                        videoHeight: self.mov.videoHeight,
                        canvasWidth: self.board.width,
                        canvasHeight: self.board.height,
                    });
                }
            }
            self.inputVideo(self.mov);
            self.resize(self.scale);
            self.scaler.scale = self.scale;
        };
        this.initializeScaler = initializeScaler;
        return this.mov;
    };

    RuntimeEngine.prototype.injectCanvas = async function () {
        this.mov = await this.getVideoTag();
        this.tryApplyCrossOriginAnonymous(this.mov);
        let div = this.mov.parentElement;
        if (window.location.href.toLowerCase().includes("bilibili.com")) {
            while (div.className !== "bilibili-player-video") {
                await new Promise(function (r) { setTimeout(r, 500); });
            }
            div = this.mov.parentElement;
        }
        if (this.nativeControlsOverlayLayer) {
            div = this.getNativeControlsOverlayContainer(this.mov);
        }
        div.style.backgroundColor = "black";
        if (!this.board) {
            this.board = document.createElement("canvas");
            this.board.style.width = "100%";
            this.board.style.height = "100%";
            this.board.style.display = "none";
            const fallbackWidth = Math.max(1, this.mov.clientWidth || this.mov.videoWidth || 1);
            const fallbackHeight = Math.max(1, this.mov.clientHeight || this.mov.videoHeight || 1);
            this.board.width = this.board.offsetWidth || fallbackWidth;
            this.board.height = this.board.offsetHeight || fallbackHeight;
            if (this.debugLogs) {
                console.log("[ShaderCanvasInit]", {
                    offsetWidth: this.board.offsetWidth,
                    offsetHeight: this.board.offsetHeight,
                    fallbackWidth: fallbackWidth,
                    fallbackHeight: fallbackHeight,
                    finalWidth: this.board.width,
                    finalHeight: this.board.height,
                });
            }
        }
        this.attachBoardNearVideo(div, this.mov);
        if (!this.scaler && this.initializeScaler && this.mov.videoWidth > 0 && this.mov.videoHeight > 0) {
            this.initializeScaler();
        }
        if (!this.scaler || !this.scaler.hasRenderedFrame) {
            this.board.style.display = "none";
            this.resetVideoForComposite(this.mov);
        }
        if (!this.layoutListenersBound) {
            this.layoutListenersBound = true;
            const self = this;
            const bustBoardLayout = function () {
                if (self.scaler) {
                    self.scaler.boardLayoutKey = null;
                }
            };
            window.addEventListener("resize", bustBoardLayout, { passive: true });
            document.addEventListener("fullscreenchange", bustBoardLayout);
        }
    };

    RuntimeEngine.prototype.startRenderLoop = function () {
        const self = this;
        this.getScreenRefreshRate(function (screenRefreshRate) {
            self.fpsLimit = Math.floor((screenRefreshRate + 1) / 2);
            self.fpsLimit = self.fpsLimit < 30 ? 30 : self.fpsLimit;
        });

        const render = async function (currentDelta) {
            self.updateId = requestAnimationFrame(render);
            const delta = currentDelta - self.previousDelta;
            if (self.fpsLimit && delta < 1000 / self.fpsLimit) {
                return;
            }
            if (self.scaler) {
                await self.renderFrame();
            }
            if (self.currentHref !== window.location.href) {
                await self.injectCanvas();
                self.currentHref = window.location.href;
            }
            self.previousDelta = currentDelta;
        };
        this.updateId = requestAnimationFrame(render);
    };

    RuntimeEngine.prototype.start = async function () {
        await this.injectCanvas();
        this.startRenderLoop();
    };

    async function run(config) {
        const hasMpvPasses = config && Array.isArray(config.mpvPasses) && config.mpvPasses.length > 0;
        if (!hasMpvPasses) {
            console.error("Failed to initialize remote mpv shader pipeline:", new Error("config must contain mpvPasses"));
            return;
        }
        const engine = new RuntimeEngine(config);
        try {
            await engine.start();
        } catch (err) {
            console.error("Failed to initialize remote mpv shader pipeline:", err);
        }
    }

    global.ShaderEngine = {
        run: run,
    };
})(window);
