(function (global) {
function buildFragmentShaderFromBlock(blockLines) {
        const directives = [];
        const body = [];
        const defines = new Map();

        for (const line of blockLines) {
            if (line.startsWith("//!")) {
                directives.push(line);
                continue;
            }
            if (line.trim().startsWith("#define ")) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    defines.set(parts[1], parts.slice(2).join(" "));
                }
                continue;
            }
            let replaced = line;
            for (const kv of defines.entries()) {
                replaced = replaced.replaceAll(kv[0], kv[1]);
            }
            body.push(replaced);
        }

        const samplers = new Set();
        for (const line of directives) {
            if (line.startsWith("//!HOOK ") || line.startsWith("//!BIND ")) {
                samplers.add(line.split(/\s+/).pop());
            }
        }

        const variables = Array.from(samplers).sort();
        const header = ["precision mediump float;", ""];
        for (const v of variables) {
            header.push("uniform sampler2D " + v + ";");
        }
        header.push("uniform vec2 HOOKED_pt;");
        header.push("varying vec2 v_tex_pos;");
        header.push("");

        for (const v of variables) {
            header.push("vec4 " + v + "_tex(vec2 pos) {");
            header.push("    return texture2D(" + v + ", pos);");
            header.push("}");
            header.push("vec4 " + v + "_texOff(vec2 off) {");
            header.push("    return texture2D(" + v + ", v_tex_pos + off * HOOKED_pt);");
            header.push("}");
        }
        header.push("");

        let shader = header.join("\n") + body.join("");
        shader = shader.replace("vec4 hook()", "void main()");
        shader = shader.replaceAll("return", "gl_FragColor =");
        shader = shader.replace(/\b[A-Z0-9_]+_pos\b/g, "v_tex_pos");
        shader = shader.replace(/\b[A-Z0-9_]+_pt\b/g, "HOOKED_pt");
        shader = shader.replace(/\b[A-Z0-9_]+_size\b/g, "1.0");
        return shader;
    }

    function parseMpvShader(rawShader) {
        const lines = rawShader.split(/\r?\n/);
        const blocks = [];
        let current = [];

        for (const line of lines) {
            if (line.startsWith("//!DESC ")) {
                if (current.length) {
                    blocks.push(current);
                }
                current = [line + "\n"];
            } else if (current.length) {
                current.push(line + "\n");
            }
        }
        if (current.length) {
            blocks.push(current);
        }

        return blocks.map(buildFragmentShaderFromBlock);
    }

    async function fetchParsed(url) {
        console.log("Loading remote mpv shader:", url);
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
            throw new Error("Failed to fetch mpv shader: HTTP " + resp.status);
        }
        const raw = await resp.text();
        return parseMpvShader(raw);
    }

    async function loadMpvShaderPassesOrThrow(url, expectedCount) {
        const parsed = await fetchParsed(url);
        if (parsed.length < expectedCount) {
            throw new Error("Parsed only " + parsed.length + " mpv shader passes, expected at least " + expectedCount);
        }
        return parsed;
    }

    global.ShaderParser = {
        loadMpvShaderPassesOrThrow: loadMpvShaderPassesOrThrow,
    };
})(window);
