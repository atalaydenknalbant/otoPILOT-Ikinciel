**Created by:** Atalay Denknalbant and Mehmet Şirin Güldaş

# 🚗 otoPILOT İkinciel

<img width="960" height="725" alt="bandicam2026-05-1921-33-54-479-ezgif com-video-to-gif-converter" src="https://github.com/user-attachments/assets/8cbd9388-7e32-49e1-828c-cab85d64c4d2" />





otoPILOT İkinciel is an AI-powered used-car search engine. It lets users search vehicle listings with natural language, converts the request into structured JSON filters with a local WebGPU model, and then uses those filters to crawl car listing data from **arabam.com**.

The app also includes a manual search mode, so users can search cars directly with filters even while the AI model is loading or if WebGPU is unavailable.

## 🤖 AI Model

This project uses:

`Qwen3-2B-text-from-vl-int4-webgpu`

The model is a Qwen3 2B text model converted for browser-side WebGPU inference with int4 ONNX weights. It is fine-tuned and instructed for one focused task:

**Convert Turkish natural-language car search queries into JSON filters only.**

Example user request:

```text
İstanbul'da 2020'den yeni, 3.000.000 TL altında, boyasız otomatik BMW 3 Serisi bul
```

Expected model behavior:

```json
{
  "ana_kategori": ["Otomobil"],
  "marka": "BMW",
  "model": "3 Serisi",
  "searchText": "",
  "minFiyat": null,
  "maxFiyat": 3000000,
  "minYil": 2020,
  "maxYil": null,
  "minKm": null,
  "maxKm": null,
  "renkler": [],
  "vites": ["Otomatik"],
  "yakit_tipi": [],
  "il": ["İstanbul"],
  "boya_degişen_parca": ["Boyasız"],
  "arac_durumu": [],
  "agir_hasar_kayitli": "",
  "siralama": "",
  "takasa_uygun": ""
}
```

## ⚠️ WebGPU Warning

AI parsing runs in the user's browser with **WebGPU**, so the device GPU matters.

High-end GPUs will load the model and return results faster. Low-end GPUs, unsupported browsers, or disabled WebGPU support can make model loading slow or prevent AI search from running. Manual filter search can still be used without the AI model.

Recommended browser: latest Chrome or Edge with WebGPU enabled.

## 🕷️ arabam.com Crawling

After the AI model creates JSON filters, the backend maps those filters to arabam.com-compatible search parameters and crawls listing data.

The backend handles:

- natural filter normalization
- arabam.com category and model mapping
- listing scraping
- favorite and advert scraping endpoints
- cancellation for active searches

## 🔎 Search Modes

The website supports two search paths:

- **AI Search:** user writes a natural-language Turkish query, Qwen3 converts it to JSON filters, then the backend crawls matching arabam.com listings.
- **Manual Search:** user selects filters directly and searches cars without waiting for the AI model.

## 📦 Requirements

- Node.js
- npm
- Git LFS
- A WebGPU-capable browser for AI search

The ONNX model data file is stored with Git LFS. After cloning, make sure LFS files are pulled:

```bash
git lfs install
git lfs pull
```

## 🚀 Run Backend

Open a terminal in the backend folder:

```bash
cd Backend
npm install
node main.js
```

The backend runs on:

```text
http://127.0.0.1:8080
```

## 🌐 Run Frontend

Open a second terminal in the frontend web folder:

```bash
cd Frontend/web
npm install
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

## 🧠 How The AI Flow Works

1. User enters a Turkish natural-language car search.
2. Frontend loads `Qwen3-2B-text-from-vl-int4-webgpu` locally in the browser.
3. Transformers.js runs the model with WebGPU.
4. The model returns only JSON filters.
5. The frontend sends those filters to the backend scrape endpoint.
6. Backend crawls arabam.com and returns matching car listings.
7. Frontend displays the results.

## 📁 Important Folders

```text
Backend/
  main.js                         Express API entry point
  scrape.js                       arabam.com search crawler
  favorite.js                     favorite scraping logic
  advert.js                       advert scraping logic

Frontend/web/
  app/                            Next.js app routes and pages
  lib/client-llm.ts               WebGPU Qwen3 model loader and JSON parser
  public/models/                  local ONNX model files
  public/vendor/                  local Transformers.js / ONNX Runtime assets

scripts_to_help/
  create_dataset_script.py
  correct_corrupt_jsons_script.py
  train_llm_script.py

Model_finetune_data/
  fine-tuning and dataset files
```

## 🛠️ Development Notes

- Ollama parsing has been removed from the active flow.
- AI parsing now runs in the frontend with the local WebGPU ONNX model.
- Backend `/parse` is disabled for active AI parsing and kept only as a compatibility/error response.
- The model is intentionally narrow: it should return structured JSON filters, not conversational answers.
- If the AI model fails to load, use manual search or test on a stronger WebGPU-capable device.

## ✅ Current Model Asset

The active browser model is located at:

```text
Frontend/web/public/models/Qwen3-2B-text-from-vl-int4-webgpu
```

The large ONNX weight file is tracked with Git LFS:

```text
Frontend/web/public/models/Qwen3-2B-text-from-vl-int4-webgpu/onnx/model.onnx_data
```
