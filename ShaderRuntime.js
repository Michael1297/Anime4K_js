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

    function parseAnime4KShader(rawShader) {
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
        console.log("Loading remote GLSL:", url);
        const resp = await fetch(url, { cache: "no-store" });
        if (!resp.ok) {
            throw new Error("Failed to fetch GLSL: HTTP " + resp.status);
        }
        const raw = await resp.text();
        return parseAnime4KShader(raw);
    }

    async function loadAnime4KPassesOrThrow(url, expectedCount) {
        const parsed = await fetchParsed(url);
        if (parsed.length < expectedCount) {
            throw new Error("Parsed only " + parsed.length + " shader blocks, expected at least " + expectedCount);
        }
        return parsed;
    }

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

    global.BilibiliShaderRuntime = {
        loadAnime4KPassesOrThrow: loadAnime4KPassesOrThrow,
        buildFsr1Passes: buildFsr1Passes,
    };
})(window);
