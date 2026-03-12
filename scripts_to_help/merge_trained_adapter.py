# merge_qwen3_bf16.py
import os, torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel



BASE_FP16   = "unsloth/Qwen3-VL-2B-Instruct"   # full HF model
ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\Qwen3-VL-2B_unsloth_lora_runtime_fast"
OUT_MERGED  = r"C:\Users\yineh\OneDrive\Masaüstü\Qwen3-VL-2B-Instruct-SFT-merged-bf16"
torch.set_grad_enabled(False)

tok = AutoTokenizer.from_pretrained(BASE_FP16, use_fast=True)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token

# load base in bfloat16 so the merged weights stay bfloat16
base = AutoModelForCausalLM.from_pretrained(
    BASE_FP16,
    torch_dtype=torch.bfloat16,
    device_map="cuda",          # if VRAM is tight use "cpu"
    low_cpu_mem_usage=True,
)

# attach LoRA and merge into base
model = PeftModel.from_pretrained(base, ADAPTER_DIR)
model = model.merge_and_unload()           # applies LoRA into the backbone
model.to(torch.bfloat16)                   # be explicit
model.config.pad_token_id = tok.pad_token_id

# save merged model and tokenizer
model.save_pretrained(OUT_MERGED, safe_serialization=True)
tok.save_pretrained(OUT_MERGED)
print("Merged bf16 model saved to", OUT_MERGED)




# merge_qwen3_vl_bf16.py
import os
import torch
from transformers import Qwen3VLForConditionalGeneration, AutoProcessor
from peft import PeftModel

BASE_FP16   = "unsloth/Qwen3-VL-2B-Instruct"   # full HF model
ADAPTER_DIR = r"C:\Users\yineh\OneDrive\Masaüstü\Qwen3-VL-2B_unsloth_lora_runtime_fast"
OUT_MERGED  = r"C:\Users\yineh\OneDrive\Masaüstü\Qwen3-VL-2B-Instruct-SFT-merged-bf16"

torch.set_grad_enabled(False)

# For VL models you usually use AutoProcessor, which wraps tokenizer + image processor
processor = AutoProcessor.from_pretrained(BASE_FP16)
tok = processor.tokenizer

if tok.pad_token is None:
    tok.pad_token = tok.eos_token

# Load base model as Qwen3 VL, in bf16
base = Qwen3VLForConditionalGeneration.from_pretrained(
    BASE_FP16,
    dtype=torch.bfloat16,     # use dtype, torch_dtype is deprecated
    device_map="cuda",        # or "auto" if you use accelerate, or "cpu" if needed
)

# Attach LoRA and merge
model = PeftModel.from_pretrained(
    base,
    ADAPTER_DIR,
    torch_dtype=torch.bfloat16,   # ok here, peft still uses torch_dtype
)

model = model.merge_and_unload()  # apply LoRA into backbone
model.to(torch.bfloat16)
model.config.pad_token_id = tok.pad_token_id

# Save merged model and processor
model.save_pretrained(OUT_MERGED, safe_serialization=True)
processor.save_pretrained(OUT_MERGED)

print("Merged bf16 model saved to", OUT_MERGED)
