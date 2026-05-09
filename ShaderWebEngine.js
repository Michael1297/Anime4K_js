(function (global) {
const quadVert = [
        "precision mediump float;",
        "",
        "attribute vec2 a_pos;",
        "varying vec2 v_tex_pos;",
        "",
        "void main() {",
        "    v_tex_pos = a_pos;",
        "    gl_Position = vec4(1.0 - 2.0 * a_pos, 0, 1);",
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
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program));
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

    function createPipeline(gl, fragPasses) {
        return {
            program0: createProgram(gl, quadVert, fragPasses[0]),
            program1: createProgram(gl, quadVert, fragPasses[1]),
            program2: createProgram(gl, quadVert, fragPasses[2]),
            program3: createProgram(gl, quadVert, fragPasses[3]),
            program4: createProgram(gl, quadVert, fragPasses[4]),
            program5: createProgram(gl, quadVert, fragPasses[5]),
            program6: createProgram(gl, quadVert, fragPasses[6]),
            program7: createProgram(gl, quadVert, fragPasses[7]),
            program8: createProgram(gl, quadVert, fragPasses[8]),
            program9: createProgram(gl, quadVert, fragPasses[9]),
            programDraw: createProgram(gl, quadVert, fragDraw),
        };
    }

    function RuntimeEngine(config) {
        this.config = config;
        this.fragPasses = config.fragPasses;
        this.scaler = null;
        this.mov = null;
        this.board = null;
        this.scale = 2.0;
        this.currentHref = window.location.href;
        this.updateId = null;
        this.previousDelta = 0;
        this.fpsLimit = 30;
    }

    RuntimeEngine.prototype.inputVideo = function (mov) {
        const gl = this.scaler.gl;
        const width = mov.videoWidth;
        const height = mov.videoHeight;
        this.scaler.inputWidth = width;
        this.scaler.inputHeight = height;
        this.scaler.inputTex = createTexture(gl, gl.LINEAR, new Uint8Array(width * height * 4), width, height);
        this.scaler.inputMov = mov;
    };

    RuntimeEngine.prototype.resize = function (scale) {
        const gl = this.scaler.gl;
        const width = Math.round(this.scaler.inputWidth * scale);
        const height = Math.round(this.scaler.inputHeight * scale);
        gl.canvas.width = width;
        gl.canvas.height = height;
        const empty = new Uint8Array(width * height * 4);
        this.scaler.temp0Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.temp1Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.outputTexture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.mmkernelTexture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman0Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman1Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman2Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman3Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman4Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman5Texture = createTexture(gl, gl.LINEAR, empty, width, height);
        this.scaler.luman6Texture = createTexture(gl, gl.LINEAR, empty, width, height);
    };

    RuntimeEngine.prototype.resizeBoard = function (originRatio, newRatio) {
        if (Math.abs(originRatio - newRatio) <= 0.001) {
            return;
        }
        if (originRatio > newRatio) {
            const newHeight = (newRatio / originRatio) * 100;
            this.board.style.height = newHeight + "%";
            this.board.style.marginTop = (100 - newHeight) / 3 + "%";
        } else {
            const newWidth = (originRatio / newRatio) * 100;
            this.board.style.width = newWidth + "%";
            this.board.style.marginLeft = (100 - newWidth) / 2 + "%";
        }
    };

    RuntimeEngine.prototype.renderFrame = async function () {
        if (!this.scaler.inputMov || !this.scaler.inputTex) {
            return;
        }
        const gl = this.scaler.gl;
        const p = this.scaler.pipeline;

        if (gl.getError() === gl.INVALID_VALUE) {
            const freshMov = await this.getVideoTag();
            this.inputVideo(freshMov);
        }

        const videoRatio = this.scaler.inputMov.videoWidth / this.scaler.inputMov.videoHeight;
        if (document.fullscreenElement != null) {
            if (!this.scaler.isFullscreen) {
                this.resizeBoard(videoRatio, this.scaler.screenRatio);
                this.scaler.isFullscreen = true;
            }
        } else if (this.scaler.isFullscreen) {
            this.board.style.width = "100%";
            this.board.style.height = "100%";
            this.board.style.marginLeft = null;
            this.board.style.marginTop = null;
            this.resizeBoard(videoRatio, this.scaler.playerRatio);
            this.scaler.isFullscreen = false;
        }

        if (this.scaler.inputMov.paused) {
            return;
        }

        updateTexture(gl, this.scaler.inputTex, this.scaler.inputMov);

        const newScale = 1440 / this.scaler.inputMov.videoHeight;
        if (this.scaler.scale !== newScale) {
            this.scaler.scale = newScale;
        }

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.STENCIL_TEST);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        const runPass = (targetTexture, program, setupUniforms) => {
            bindFramebuffer(gl, this.scaler.framebuffer, targetTexture);
            gl.useProgram(program.program);
            bindAttribute(gl, this.scaler.quadBuffer, program.a_pos, 2);
            setupUniforms();
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        runPass(this.scaler.luman0Texture, p.program0, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            gl.uniform1i(p.program0.HOOKED, 0);
            gl.uniform2f(p.program0.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.luman1Texture, p.program1, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman0Texture, 1);
            gl.uniform1i(p.program1.HOOKED, 0);
            gl.uniform1i(p.program1.LUMAN0, 1);
            gl.uniform2f(p.program1.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.luman2Texture, p.program2, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman1Texture, 1);
            gl.uniform1i(p.program2.HOOKED, 0);
            gl.uniform1i(p.program2.LUMAN1, 1);
            gl.uniform2f(p.program2.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.luman3Texture, p.program3, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman2Texture, 1);
            gl.uniform1i(p.program3.HOOKED, 0);
            gl.uniform1i(p.program3.LUMAN2, 1);
            gl.uniform2f(p.program3.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.luman4Texture, p.program4, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman3Texture, 1);
            gl.uniform1i(p.program4.HOOKED, 0);
            gl.uniform1i(p.program4.LUMAN3, 1);
            gl.uniform2f(p.program4.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.luman5Texture, p.program5, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman4Texture, 1);
            gl.uniform1i(p.program5.HOOKED, 0);
            gl.uniform1i(p.program5.LUMAN4, 1);
            gl.uniform2f(p.program5.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.temp0Texture, p.program6, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman0Texture, 1);
            bindTexture(gl, this.scaler.luman1Texture, 2);
            bindTexture(gl, this.scaler.luman2Texture, 3);
            bindTexture(gl, this.scaler.luman3Texture, 4);
            bindTexture(gl, this.scaler.luman4Texture, 5);
            bindTexture(gl, this.scaler.luman5Texture, 6);
            gl.uniform1i(p.program6.HOOKED, 0);
            gl.uniform1i(p.program6.LUMAN0, 1);
            gl.uniform1i(p.program6.LUMAN1, 2);
            gl.uniform1i(p.program6.LUMAN2, 3);
            gl.uniform1i(p.program6.LUMAN3, 4);
            gl.uniform1i(p.program6.LUMAN4, 5);
            gl.uniform1i(p.program6.LUMAN5, 6);
            gl.uniform2f(p.program6.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.mmkernelTexture, p.program7, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            gl.uniform1i(p.program7.HOOKED, 0);
            gl.uniform2f(p.program7.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.temp1Texture, p.program8, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.mmkernelTexture, 1);
            gl.uniform1i(p.program8.HOOKED, 0);
            gl.uniform1i(p.program8.MMKERNEL, 1);
            gl.uniform2f(p.program8.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        runPass(this.scaler.outputTexture, p.program9, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.temp1Texture, 1);
            bindTexture(gl, this.scaler.temp0Texture, 2);
            gl.uniform1i(p.program9.HOOKED, 0);
            gl.uniform1i(p.program9.MMKERNEL, 1);
            gl.uniform1i(p.program9.LUMAN0, 2);
            gl.uniform2f(p.program9.HOOKED_pt, 1.0 / gl.canvas.width, 1.0 / gl.canvas.height);
        });

        bindFramebuffer(gl, null);
        gl.useProgram(p.programDraw.program);
        bindAttribute(gl, this.scaler.quadBuffer, p.programDraw.a_pos, 2);
        bindTexture(gl, this.scaler.outputTexture, 0);
        gl.uniform1i(p.programDraw.u_texture, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
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
        this.mov = document.getElementsByTagName("video")[0];
        const self = this;
        this.mov.addEventListener("loadedmetadata", function () {
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
                    temp0Texture: null,
                    temp1Texture: null,
                    outputTexture: null,
                    mmkernelTexture: null,
                    luman0Texture: null,
                    luman1Texture: null,
                    luman2Texture: null,
                    luman3Texture: null,
                    luman4Texture: null,
                    luman5Texture: null,
                    luman6Texture: null,
                    scale: 1.0,
                    screenRatio: window.screen.width / window.screen.height,
                    playerRatio: 16 / 9,
                    isFullscreen: true,
                };
                self.scaler.quadBuffer = createBuffer(self.scaler.gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]));
                self.scaler.framebuffer = self.scaler.gl.createFramebuffer();
                self.scaler.pipeline = createPipeline(self.scaler.gl, self.fragPasses);
            }
            self.inputVideo(self.mov);
            self.resize(self.scale);
            self.scaler.scale = self.scale;
        }, true);
        this.mov.addEventListener("error", function () {
            alert("Can't get video, sorry.");
        }, true);
        return this.mov;
    };

    RuntimeEngine.prototype.injectCanvas = async function () {
        this.mov = await this.getVideoTag();
        let div = this.mov.parentElement;
        if (window.location.href.toLowerCase().includes("bilibili.com")) {
            while (div.className !== "bilibili-player-video") {
                await new Promise(function (r) { setTimeout(r, 500); });
            }
            div = this.mov.parentElement;
        }
        div.style.backgroundColor = "black";
        if (!this.board) {
            this.board = document.createElement("canvas");
            this.board.style.width = "100%";
            this.board.style.height = "100%";
            this.board.width = this.board.offsetWidth;
            this.board.height = this.board.offsetHeight;
        }
        div.appendChild(this.board);
        this.mov.style.display = "none";
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
        if (!config || !Array.isArray(config.fragPasses) || config.fragPasses.length < 10) {
            console.error("Failed to initialize remote mpv shader pipeline:", new Error("fragPasses must contain 10 compiled fragment strings"));
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
