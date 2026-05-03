import * as esbuild from "esbuild";
import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const srcDir = path.join(projectRoot, "src");

async function copyStaticAssets() {
	await cp(path.join(srcDir, "index.html"), path.join(distDir, "index.html"));
	await cp(path.join(projectRoot, "build", "ocr", "public-ppocrv5-chinese-japanese"), path.join(distDir, "assets", "ocr", "server"), { recursive: true });
	await cp(path.join(projectRoot, "build", "ocr", "public-ppocrv5-mobile-japanese"), path.join(distDir, "assets", "ocr", "mobile"), { recursive: true });
	await cp(path.join(projectRoot, "build", "ocr", "kanjidnn-ja-handwritten"), path.join(distDir, "assets", "handwritten", "kanjidnn"), { recursive: true });
	await cp(path.join(projectRoot, "build", "lookup"), path.join(distDir, "assets", "lookup"), { recursive: true });
	const ortDistDir = path.join(projectRoot, "node_modules", "onnxruntime-web", "dist");
	const ortTargetDir = path.join(distDir, "vendor", "onnxruntime");
	await mkdir(ortTargetDir, { recursive: true });
	for (const fileName of await readdir(ortDistDir)) {
		if (!fileName.startsWith("ort-wasm") || (!fileName.endsWith(".wasm") && !fileName.endsWith(".mjs"))) {
			continue;
		}
		await cp(path.join(ortDistDir, fileName), path.join(ortTargetDir, fileName));
	}
}

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

await esbuild.build({
	entryPoints: [path.join(srcDir, "index.ts"), path.join(srcDir, "workers", "ocr.worker.ts"), path.join(srcDir, "workers", "handwritten-classifier.worker.ts")],
	bundle: true,
	format: "esm",
	outdir: distDir,
	entryNames: "[dir]/[name]",
	assetNames: "assets/[name]-[hash]",
	platform: "browser",
	target: ["chrome113", "safari16.4", "firefox115"],
	sourcemap: true,
	logLevel: "info",
	loader: {
		".ts": "ts",
		".css": "css",
		".txt": "text",
		".json": "json",
	},
	define: {
		__BUILD_TIME__: JSON.stringify(new Date().toISOString()),
	},
});

await copyStaticAssets();
