import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webappRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(webappRoot, 'node_modules', 'onnxruntime-web', 'dist')
const targetDir = path.join(webappRoot, 'public', 'ort')
const transformersWebSrc = path.join(webappRoot, 'node_modules', '@huggingface', 'transformers', 'dist', 'transformers.web.js')
const transformersWebDstDir = path.join(webappRoot, 'public', 'vendor')
const ortWebgpuBundleSrc = path.join(webappRoot, 'node_modules', 'onnxruntime-web', 'dist', 'ort.webgpu.bundle.min.mjs')
const ortCommonEsmSrcDir = path.join(webappRoot, 'node_modules', 'onnxruntime-common', 'dist', 'esm')
const ortCommonEsmDstDir = path.join(webappRoot, 'public', 'vendor', 'onnxruntime-common')

const files = [
  'ort-wasm-simd-threaded.asyncify.mjs',
  'ort-wasm-simd-threaded.asyncify.wasm',
]

await fs.mkdir(targetDir, { recursive: true })

for (const name of files) {
  const src = path.join(sourceDir, name)
  const dst = path.join(targetDir, name)
  await fs.copyFile(src, dst)
}

await fs.mkdir(transformersWebDstDir, { recursive: true })
await fs.copyFile(transformersWebSrc, path.join(transformersWebDstDir, 'transformers.web.js'))
await fs.copyFile(ortWebgpuBundleSrc, path.join(transformersWebDstDir, 'ort.webgpu.bundle.min.mjs'))
await fs.mkdir(ortCommonEsmDstDir, { recursive: true })
await fs.cp(ortCommonEsmSrcDir, ortCommonEsmDstDir, { recursive: true, force: true })

console.log(`Copied ORT assets to ${targetDir}`)
