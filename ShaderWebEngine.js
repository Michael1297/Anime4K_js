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

    function setProgramPtUniforms(gl, program, inputWidth, inputHeight, canvasWidth, canvasHeight) {
        const chooseDims = function (samplerName) {
            if (samplerName === "HOOKED" || samplerName === "MAIN") {
                return [Math.max(1, inputWidth), Math.max(1, inputHeight)];
            }
            return [Math.max(1, canvasWidth), Math.max(1, canvasHeight)];
        };
        for (const key of Object.keys(program)) {
            if (!key.endsWith("_pt")) {
                continue;
            }
            const location = program[key];
            if (!location) {
                continue;
            }
            const samplerName = key.slice(0, -3);
            const dims = chooseDims(samplerName);
            gl.uniform2f(location, 1.0 / dims[0], 1.0 / dims[1]);
        }
    }

    function createPipeline(gl, fragPasses, debugLogs) {
        if (debugLogs) {
            console.log("[ShaderPipelineInit]", {
                passCount: fragPasses.length,
                passLengths: fragPasses.map(function (pass) { return (pass || "").length; }),
                gl: getGlDebugInfo(gl),
                url: window.location.href,
            });
            fragPasses.forEach(function (pass, idx) {
                console.log("[ShaderPassHead]", {
                    label: "pass" + idx,
                    snippet: formatShaderSnippet(pass, 20),
                });
            });
        }
        return {
            program0: createProgram(gl, quadVert, fragPasses[0], "pass0"),
            program1: createProgram(gl, quadVert, fragPasses[1], "pass1"),
            program2: createProgram(gl, quadVert, fragPasses[2], "pass2"),
            program3: createProgram(gl, quadVert, fragPasses[3], "pass3"),
            program4: createProgram(gl, quadVert, fragPasses[4], "pass4"),
            program5: createProgram(gl, quadVert, fragPasses[5], "pass5"),
            program6: createProgram(gl, quadVert, fragPasses[6], "pass6"),
            program7: createProgram(gl, quadVert, fragPasses[7], "pass7"),
            program8: createProgram(gl, quadVert, fragPasses[8], "pass8"),
            program9: createProgram(gl, quadVert, fragPasses[9], "pass9"),
            programDraw: createProgram(gl, quadVert, fragDraw, "draw"),
        };
    }

    function createMpvPipeline(gl, mpvPasses, debugLogs) {
        if (debugLogs) {
            console.log("[ShaderMpvPipelineInit]", {
                passCount: mpvPasses.length,
                passes: mpvPasses.map(function (pass, idx) {
                    return {
                        index: idx,
                        save: pass.save,
                        samplers: pass.samplers,
                        description: pass.description,
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
                    save: pass.save,
                    samplers: pass.samplers,
                    description: pass.description,
                    program: createProgram(gl, quadVert, pass.shader, "mpv-pass" + idx + ":" + pass.save),
                };
            }),
            programDraw: createProgram(gl, quadVert, fragDraw, "draw"),
        };
    }

    function RuntimeEngine(config) {
        this.config = config;
        this.fragPasses = config.fragPasses;
        this.mpvPasses = config.mpvPasses || null;
        this.debugLogs = !!config.debugLogs;
        this.useNearestIntermediate = config.useNearestIntermediate !== false;
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
        const width = Math.max(1, Math.round(this.scaler.inputWidth * scale));
        const height = Math.max(1, Math.round(this.scaler.inputHeight * scale));
        gl.canvas.width = width;
        gl.canvas.height = height;
        const empty = new Uint8Array(width * height * 4);
        const passFilter = this.useNearestIntermediate ? gl.NEAREST : gl.LINEAR;
        this.scaler.temp0Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.temp1Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.outputTexture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.mmkernelTexture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman0Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman1Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman2Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman3Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman4Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman5Texture = createTexture(gl, passFilter, empty, width, height);
        this.scaler.luman6Texture = createTexture(gl, passFilter, empty, width, height);
        if (this.mpvPasses) {
            this.scaler.mpvTextures = {};
            this.scaler.mpvTextureSizes = {};
            for (const pass of this.mpvPasses) {
                if (!pass.save || pass.save === "MAIN" || this.scaler.mpvTextures[pass.save]) {
                    continue;
                }
                const passWidth = Math.max(1, this.scaler.inputWidth);
                const passHeight = Math.max(1, this.scaler.inputHeight);
                const passEmpty = new Uint8Array(passWidth * passHeight * 4);
                this.scaler.mpvTextures[pass.save] = createTexture(gl, passFilter, passEmpty, passWidth, passHeight);
                this.scaler.mpvTextureSizes[pass.save] = [passWidth, passHeight];
            }
            this.scaler.mpvTextureSizes.MAIN = [Math.max(1, this.scaler.inputWidth), Math.max(1, this.scaler.inputHeight)];
        }
        if (this.debugLogs) {
            console.log("[ShaderResize]", {
                scale: scale,
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

        if (this.scaler.inputWidth !== this.scaler.inputMov.videoWidth || this.scaler.inputHeight !== this.scaler.inputMov.videoHeight) {
            this.inputVideo(this.scaler.inputMov);
            this.resize(this.scaler.scale);
        }

        try {
            updateTexture(gl, this.scaler.inputTex, this.scaler.inputMov);
        } catch (err) {
            if (this.debugLogs) {
                console.warn("[ShaderSkipFrame]", {
                    reason: "video-upload-failed",
                    message: err && err.message ? err.message : String(err),
                    readyState: this.scaler.inputMov.readyState,
                    videoWidth: this.scaler.inputMov.videoWidth,
                    videoHeight: this.scaler.inputMov.videoHeight,
                });
            }
            return;
        }

        // Anime4K UL/VL model used here is x2; scaling above 2x produces unstable colors/artifacts.
        const autoScale = 1440 / this.scaler.inputMov.videoHeight;
        const newScale = Math.min(2.0, Math.max(1.0, autoScale));
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

        if (this.mpvPasses) {
            const textureMap = { MAIN: this.scaler.inputTex };
            const textureSizes = Object.assign({}, this.scaler.mpvTextureSizes, {
                MAIN: [inputWidth, inputHeight],
            });
            const drawTextureToCanvas = (texture) => {
                bindFramebuffer(gl, null);
                gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
                gl.useProgram(p.programDraw.program);
                bindAttribute(gl, this.scaler.quadBuffer, p.programDraw.a_pos, 2);
                bindTexture(gl, texture, 0);
                gl.uniform1i(p.programDraw.u_texture, 0);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
            };

            let finalTexture = this.scaler.inputTex;
            for (let passIndex = 0; passIndex < p.passes.length; passIndex++) {
                const pass = p.passes[passIndex];
                const targetTexture = pass.save === "MAIN" ? this.scaler.outputTexture : this.scaler.mpvTextures[pass.save];
                if (!targetTexture) {
                    if (this.debugLogs) {
                        console.error("[ShaderMpvMissingTarget]", { passIndex: passIndex, save: pass.save });
                    }
                    return;
                }
                const targetSize = pass.save === "MAIN"
                    ? [canvasWidth, canvasHeight]
                    : (this.scaler.mpvTextureSizes[pass.save] || [inputWidth, inputHeight]);
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
                textureSizes[pass.save] = pass.save === "MAIN"
                    ? [canvasWidth, canvasHeight]
                    : (this.scaler.mpvTextureSizes[pass.save] || [inputWidth, inputHeight]);
                finalTexture = targetTexture;
            }

            drawTextureToCanvas(finalTexture);
            return;
        }

        const runPass = (targetTexture, program, setupUniforms) => {
            bindFramebuffer(gl, this.scaler.framebuffer, targetTexture);
            const fbStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
            if (fbStatus !== gl.FRAMEBUFFER_COMPLETE) {
                if (this.debugLogs) {
                    console.error("[ShaderFramebufferIncomplete]", {
                        status: fbStatus,
                        program: program,
                        targetTexture: targetTexture,
                        canvasWidth: gl.canvas.width,
                        canvasHeight: gl.canvas.height,
                    });
                }
                return;
            }
            gl.useProgram(program.program);
            bindAttribute(gl, this.scaler.quadBuffer, program.a_pos, 2);
            setupUniforms();
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };
        const drawTextureToCanvas = (texture) => {
            bindFramebuffer(gl, null);
            gl.useProgram(p.programDraw.program);
            bindAttribute(gl, this.scaler.quadBuffer, p.programDraw.a_pos, 2);
            bindTexture(gl, texture, 0);
            gl.uniform1i(p.programDraw.u_texture, 0);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
        };

        runPass(this.scaler.luman0Texture, p.program0, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            gl.uniform1i(p.program0.HOOKED, 0);
            setProgramPtUniforms(gl, p.program0, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.luman1Texture, p.program1, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman0Texture, 1);
            gl.uniform1i(p.program1.HOOKED, 0);
            gl.uniform1i(p.program1.LUMAN0, 1);
            setProgramPtUniforms(gl, p.program1, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.luman2Texture, p.program2, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman1Texture, 1);
            gl.uniform1i(p.program2.HOOKED, 0);
            gl.uniform1i(p.program2.LUMAN1, 1);
            setProgramPtUniforms(gl, p.program2, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.luman3Texture, p.program3, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman2Texture, 1);
            gl.uniform1i(p.program3.HOOKED, 0);
            gl.uniform1i(p.program3.LUMAN2, 1);
            setProgramPtUniforms(gl, p.program3, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.luman4Texture, p.program4, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman3Texture, 1);
            gl.uniform1i(p.program4.HOOKED, 0);
            gl.uniform1i(p.program4.LUMAN3, 1);
            setProgramPtUniforms(gl, p.program4, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.luman5Texture, p.program5, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.luman4Texture, 1);
            gl.uniform1i(p.program5.HOOKED, 0);
            gl.uniform1i(p.program5.LUMAN4, 1);
            setProgramPtUniforms(gl, p.program5, inputWidth, inputHeight, canvasWidth, canvasHeight);
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
            setProgramPtUniforms(gl, p.program6, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.mmkernelTexture, p.program7, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            gl.uniform1i(p.program7.HOOKED, 0);
            setProgramPtUniforms(gl, p.program7, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.temp1Texture, p.program8, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.mmkernelTexture, 1);
            gl.uniform1i(p.program8.HOOKED, 0);
            gl.uniform1i(p.program8.MMKERNEL, 1);
            setProgramPtUniforms(gl, p.program8, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        runPass(this.scaler.outputTexture, p.program9, () => {
            bindTexture(gl, this.scaler.inputTex, 0);
            bindTexture(gl, this.scaler.temp1Texture, 1);
            bindTexture(gl, this.scaler.temp0Texture, 2);
            gl.uniform1i(p.program9.HOOKED, 0);
            gl.uniform1i(p.program9.MMKERNEL, 1);
            gl.uniform1i(p.program9.LUMAN0, 2);
            setProgramPtUniforms(gl, p.program9, inputWidth, inputHeight, canvasWidth, canvasHeight);
        });

        drawTextureToCanvas(this.scaler.outputTexture);
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
        const pickBestVideo = function () {
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
                const score = areaScore + readyBonus + playingBonus;
                if (score > bestScore) {
                    best = video;
                    bestScore = score;
                }
            }
            return best;
        };

        while (document.getElementsByTagName("video").length <= 0) {
            await new Promise(function (r) { setTimeout(r, 500); });
        }
        this.mov = pickBestVideo();
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
                self.scaler.pipeline = self.mpvPasses
                    ? createMpvPipeline(self.scaler.gl, self.mpvPasses, self.debugLogs)
                    : createPipeline(self.scaler.gl, self.fragPasses, self.debugLogs);
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
        const hasFixedPasses = config && Array.isArray(config.fragPasses) && config.fragPasses.length >= 10;
        const hasMpvPasses = config && Array.isArray(config.mpvPasses) && config.mpvPasses.length > 0;
        if (!hasFixedPasses && !hasMpvPasses) {
            console.error("Failed to initialize remote mpv shader pipeline:", new Error("config must contain fragPasses or mpvPasses"));
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
