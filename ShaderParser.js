(function (global) {
function rewriteDynamicVec4Indexing(shader) {
        return shader.split("\n").map(function (line) {
            const match = line.match(/^(\s*)float\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)\[(i[0-9]+)\.y\s*\*\s*2\s*\+\s*\4\.x\];\s*$/);
            if (!match) {
                return line;
            }
            const indent = match[1];
            const target = match[2];
            const expr = match[3];
            const indexVar = match[4];
            const temp = target + "_vec4";
            return [
                indent + "vec4 " + temp + " = " + expr + ";",
                indent + "float " + target + " = mix(mix(" + temp + ".x, " + temp + ".y, float(" + indexVar + ".x)), mix(" + temp + ".z, " + temp + ".w, float(" + indexVar + ".x)), float(" + indexVar + ".y));",
            ].join("\n");
        }).join("\n");
    }

    function replaceFloatFunction(shader, name, replacement) {
        const signaturePattern = new RegExp("float\\s+" + name + "\\s*\\(\\s*float\\s+a\\s*\\)");
        let result = shader;
        let searchFrom = 0;

        while (true) {
            const tail = result.slice(searchFrom);
            const match = tail.match(signaturePattern);
            if (!match) {
                break;
            }

            const signatureStart = searchFrom + match.index;
            const bodyStart = result.indexOf("{", signatureStart + match[0].length);
            if (bodyStart < 0) {
                break;
            }

            let depth = 0;
            let bodyEnd = -1;
            for (let i = bodyStart; i < result.length; i++) {
                if (result[i] === "{") {
                    depth++;
                } else if (result[i] === "}") {
                    depth--;
                    if (depth === 0) {
                        bodyEnd = i + 1;
                        break;
                    }
                }
            }
            if (bodyEnd < 0) {
                break;
            }

            result = result.slice(0, signatureStart) + replacement + result.slice(bodyEnd);
            searchFrom = signatureStart + replacement.length;
        }

        return result;
    }

    function rewriteWebGL1UnsupportedFunctions(shader) {
        let rewritten = shader;
        rewritten = replaceFloatFunction(rewritten, "APrxLoRcpF1", "float APrxLoRcpF1(float a) {\n return 1.0 / a;\n}");
        rewritten = replaceFloatFunction(rewritten, "APrxLoRsqF1", "float APrxLoRsqF1(float a) {\n return inversesqrt(a);\n}");
        rewritten = replaceFloatFunction(rewritten, "APrxMedRcpF1", "float APrxMedRcpF1(float a) {\n return 1.0 / a;\n}");
        rewritten = replaceFloatFunction(rewritten, "APrxLoSqrtF1", "float APrxLoSqrtF1(float a) {\n return sqrt(a);\n}");
        rewritten = rewritten.replace(
            /texelFetch\s*\(\s*([A-Za-z_][A-Za-z0-9_]*)_raw\s*,\s*sp\s*(?:\+\s*ivec2\s*\(\s*([-+]?[0-9]+)\s*,\s*([-+]?[0-9]+)\s*\))?\s*,\s*0\s*\)\s*\.r\s*\*\s*\1_mul/g,
            function (_match, samplerName, xOffset, yOffset) {
                const x = Number(xOffset || 0) + 0.5;
                const y = Number(yOffset || 0) + 0.5;
                return samplerName + "_tex(vec2((fp + vec2(" + x.toFixed(1) + ", " + y.toFixed(1) + ")) * " + samplerName + "_pt)).r";
            }
        );
        return rewritten;
    }

    function replaceDefine(shader, name, value) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const formatValue = function (rawValue, oldValue) {
            if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
                if (oldValue && oldValue.includes(".") && Number.isInteger(rawValue)) {
                    return rawValue.toFixed(1);
                }
                return String(rawValue);
            }
            return String(rawValue);
        };
        const definePattern = new RegExp(
            "^(\\s*#define\\s+" + escapedName + "\\s+)([^\\r\\n/]*?)(\\s*(?://.*)?)$",
            "m"
        );
        if (definePattern.test(shader)) {
            return shader.replace(definePattern, function (_match, prefix, oldValue, suffix) {
                const formattedValue = formatValue(value, oldValue.trim());
                return prefix + formattedValue + suffix;
            });
        }
        const replacement = "#define " + name + " " + formatValue(value, "");
        return replacement + "\n" + shader;
    }

function buildFragmentShaderFromBlock(blockLines, options) {
        const opts = options || {};
        const directives = [];
        const body = [];

        for (const line of blockLines) {
            if (line.startsWith("//!")) {
                directives.push(line);
                continue;
            }
            // Keep original #define lines and macros untouched.
            // Function-like macros (e.g. go_0(x,y)) must stay in shader source.
            body.push(line);
        }

        const samplers = new Set();
        for (const line of directives) {
            const directive = line.trim();
            if (!directive.startsWith("//!BIND ")) {
                continue;
            }
            const tokens = directive.split(/\s+/);
            const name = tokens[tokens.length - 1];
            if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
                samplers.add(name);
            }
        }
        if (samplers.size === 0) {
            throw new Error("No valid //!BIND samplers found in shader block. Directives: " + directives.join(" | "));
        }

        const readDirectiveValue = function (prefix) {
            for (const line of directives) {
                const directive = line.trim();
                if (directive.startsWith(prefix)) {
                    return directive.slice(prefix.length).trim();
                }
            }
            return "";
        };

        const hook = readDirectiveValue("//!HOOK ");
        const variables = Array.from(samplers).sort();
        const header = [
            "#ifdef GL_FRAGMENT_PRECISION_HIGH",
            "precision highp float;",
            "#else",
            "precision mediump float;",
            "#endif",
            "",
        ];
        if (typeof opts.shaderDebugEnabled === "boolean") {
            header.push("#define SHADER_DEBUG " + (opts.shaderDebugEnabled ? "1" : "0"));
            header.push("");
        }
        for (const v of variables) {
            header.push("uniform sampler2D " + v + ";");
        }
        for (const v of variables) {
            header.push("uniform vec2 " + v + "_pt;");
            header.push("#define " + v + "_pos v_tex_pos");
            header.push("#define " + v + "_size (vec2(1.0) / " + v + "_pt)");
        }
        header.push("varying vec2 v_tex_pos;");
        header.push("");

        for (const v of variables) {
            const shouldConvertToLuma = hook === "LUMA" && (v === "HOOKED" || v === "MAIN" || v === "LUMA");
            header.push("vec4 " + v + "_tex(vec2 pos) {");
            if (shouldConvertToLuma) {
                header.push("    vec4 color = texture2D(" + v + ", pos);");
                header.push("    float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));");
                header.push("    return vec4(luma, luma, luma, color.a);");
            } else {
                header.push("    return texture2D(" + v + ", pos);");
            }
            header.push("}");
            header.push("vec4 " + v + "_texOff(vec2 off) {");
            if (shouldConvertToLuma) {
                header.push("    vec4 color = texture2D(" + v + ", v_tex_pos + off * " + v + "_pt);");
                header.push("    float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));");
                header.push("    return vec4(luma, luma, luma, color.a);");
            } else {
                header.push("    return texture2D(" + v + ", v_tex_pos + off * " + v + "_pt);");
            }
            header.push("}");
        }
        header.push("");

        let shader = header.join("\n") + body.join("");
        shader = shader.replace(/\b[A-Z0-9_]+_pos\b/g, "v_tex_pos");
        for (const v of variables) {
            const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            shader = shader.replace(new RegExp("\\b" + escaped + "_pos\\b", "g"), "v_tex_pos");
        }
        shader = rewriteDynamicVec4Indexing(shader);
        shader = rewriteWebGL1UnsupportedFunctions(shader);
        if (shader.includes("vec4 hook()")) {
            shader += "\n\nvoid main() {\n    gl_FragColor = hook();\n}";
        }
        return {
            shader: shader,
            samplers: variables,
            save: readDirectiveValue("//!SAVE ") || readDirectiveValue("//!HOOK "),
            hook: hook,
            description: readDirectiveValue("//!DESC "),
            width: readDirectiveValue("//!WIDTH "),
            height: readDirectiveValue("//!HEIGHT "),
            directives: directives,
        };
    }

    function parseMpvShader(rawShader, options) {
        const opts = options || {};
        const lines = rawShader.split(/\r?\n/);
        const blocks = [];
        let current = [];
        const hasShaderBody = function (block) {
            return block.some(function (line) {
                return !line.startsWith("//!") && line.trim().length > 0;
            });
        };

        for (const line of lines) {
            const startsBlock = line.startsWith("//!HOOK ") || line.startsWith("//!DESC ");
            if (startsBlock) {
                if (current.length && hasShaderBody(current)) {
                    blocks.push(current);
                    current = [];
                }
                current.push(line + "\n");
            } else if (current.length || line.startsWith("//!")) {
                current.push(line + "\n");
            }
        }
        if (current.length) {
            blocks.push(current);
        }

        return blocks.map(function (block, idx) {
            const built = buildFragmentShaderFromBlock(block, opts);
            if (opts.debugLogs) {
                console.log("[ShaderParserBlock]", {
                    blockIndex: idx,
                    samplers: built.samplers,
                    directives: built.directives,
                    shaderLength: built.shader.length,
                });
            }
            if (opts.returnMetadata) {
                return built;
            }
            return built.shader;
        });
    }

    async function fetchParsed(url, options) {
        const opts = options || {};
        console.log("Loading remote mpv shader:", url);
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
            throw new Error("Failed to fetch mpv shader: HTTP " + resp.status);
        }
        const raw = await resp.text();
        return parseMpvShader(raw, opts);
    }

    async function loadMpvShaderPassesOrThrow(url, expectedCount, options) {
        const parsed = await fetchParsed(url, options);
        if (parsed.length < expectedCount) {
            throw new Error("Parsed only " + parsed.length + " mpv shader passes, expected at least " + expectedCount);
        }
        return parsed;
    }

    global.ShaderParser = {
        loadMpvShaderPassesOrThrow: loadMpvShaderPassesOrThrow,
        makeWebGL1Compatible: rewriteWebGL1UnsupportedFunctions,
        replaceDefine: replaceDefine,
    };
})(window);
