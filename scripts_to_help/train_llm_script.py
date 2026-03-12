from unsloth import FastLanguageModel
import os, math, time, gc, random
from typing import Dict, Any, List, Tuple

import torch
assert torch.cuda.is_available(), "CUDA required"
device = torch.device("cuda")
# torch.backends.cuda.matmul.allow_tf32 = True
# torch.backends.cudnn.allow_tf32 = True
# torch.set_float32_matmul_precision("medium")

import pandas as pd
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, get_cosine_schedule_with_warmup

from torch.amp import GradScaler, autocast
from torch.nn.attention import sdpa_kernel, SDPBackend
import bitsandbytes as bnb

# ---- Paths and hparams
# MODEL_ID = "unsloth/gemma-3-1b-it"
MODEL_ID = "unsloth/Qwen3-VL-2B-Instruct" 
PARQUET_PATH  = r"C:\Users\yineh\OneDrive\Masaüstü\instruct_arabam_dataset_manual_only.parquet"
OUT_DIR  = "Qwen3-VL-2B_unsloth_lora_runtime_fast"
MAX_SEQ_LEN   = 2048
LR            = 1e-04
EPOCHS        = 1
BATCH_SIZE    = 1
GRAD_ACCUM    = 1
WARMUP_RATIO  = 0.05
WEIGHT_DECAY  = 0.00
LORA_R        = 32
LORA_ALPHA    = 32
LORA_DROPOUT  = 0.00
SEED          = 3407

random.seed(SEED); torch.manual_seed(SEED); torch.cuda.manual_seed_all(SEED)

# ---- Load raw data
assert os.path.exists(PARQUET_PATH), f"Missing {PARQUET_PATH}"
df = pd.read_parquet(PARQUET_PATH)[["system","user","assistant"]].fillna({"system":"","user":"","assistant":""})
df = df[(df["user"].str.len()>0) & (df["assistant"].str.len()>0)].reset_index(drop=True)

# ---- Tokenizer and model
tok = AutoTokenizer.from_pretrained(MODEL_ID, use_fast=True)
tok.padding_side = "right"
if tok.pad_token is None:
    tok.pad_token = tok.eos_token
model, _ = FastLanguageModel.from_pretrained(
    model_name     = MODEL_ID,
    max_seq_length = MAX_SEQ_LEN,
    dtype          = None,
    load_in_4bit   = True,
)

# Vision kısmını tamamen dondur
vt = getattr(getattr(model, "model", model), "vision_tower", None)
if vt is not None:
    for p in vt.parameters(): p.requires_grad = False

# LoRA hedefleri
model = FastLanguageModel.get_peft_model(
    model,
    r            = LORA_R,
    lora_alpha   = LORA_ALPHA,
    lora_dropout = LORA_DROPOUT,
    bias         = "none",
    target_modules=["q_proj","k_proj","v_proj","o_proj","gate_proj","up_proj","down_proj"],
)

try: model.config._attn_implementation = "sdpa"
except: pass

# ---- Dataset
class ChatRows(Dataset):
    def __init__(self, frame: pd.DataFrame): self.df = frame
    def __len__(self): return len(self.df)
    def __getitem__(self, i: int):
        r = self.df.iloc[i]
        return (r["system"], r["user"], r["assistant"])

train_ds = ChatRows(df)

# ---- Collate
def collate(batch: List[Tuple[str,str,str]]) -> Dict[str, torch.Tensor]:
    systems, users, assistants = zip(*batch)

    full_texts, prompt_texts = [], []
    for s,u,a in zip(systems, users, assistants):
        msgs_full = []
        if s.strip(): msgs_full.append({"role":"system","content":s})
        msgs_full.append({"role":"user","content":u})
        msgs_full.append({"role":"assistant","content":a})
        full_texts.append(tok.apply_chat_template(msgs_full, tokenize=False, add_generation_prompt=False))

        msgs_prompt = []
        if s.strip(): msgs_prompt.append({"role":"system","content":s})
        msgs_prompt.append({"role":"user","content":u})
        prompt_texts.append(tok.apply_chat_template(msgs_prompt, tokenize=False, add_generation_prompt=True))

    enc_full   = tok(full_texts,   truncation=True, max_length=MAX_SEQ_LEN, padding=True, return_tensors="pt")
    enc_prompt = tok(prompt_texts, truncation=True, max_length=MAX_SEQ_LEN, padding=True, return_tensors="pt")

    input_ids = enc_full["input_ids"]
    attn      = enc_full["attention_mask"]
    prompt_l  = enc_prompt["attention_mask"].sum(dim=1)

    labels = input_ids.clone()
    for b in range(labels.size(0)):
        labels[b, :prompt_l[b]] = -100
        labels[b, attn[b] == 0] = -100

    return {"input_ids": input_ids, "attention_mask": attn, "labels": labels}

loader = DataLoader(
    train_ds,
    batch_size  = BATCH_SIZE,
    shuffle     = True,
    num_workers = 0,
    pin_memory  = True,
    collate_fn  = collate,
)

# ---- Optimizer & schedule
trainable = [p for p in model.parameters() if p.requires_grad]
optimizer = bnb.optim.PagedAdamW8bit(trainable, lr=LR, weight_decay=WEIGHT_DECAY)

steps_per_epoch = math.ceil(len(train_ds) / BATCH_SIZE / GRAD_ACCUM)
num_steps = steps_per_epoch * EPOCHS
warmup_steps = max(1, int(num_steps * WARMUP_RATIO))
scheduler = get_cosine_schedule_with_warmup(optimizer, warmup_steps, num_steps)

model.to(device).train()
scaler = GradScaler("cuda", enabled=True)

print("Starting train. GPU:", torch.cuda.get_device_name())

# ---- Train
global_step = 0; acc_loss = 0.0; t0 = time.time()
for epoch in range(EPOCHS):
    for i, batch in enumerate(loader):
        batch = {k: v.to(device, non_blocking=True) for k,v in batch.items()}

        with sdpa_kernel([SDPBackend.FLASH_ATTENTION, SDPBackend.EFFICIENT_ATTENTION, SDPBackend.MATH]):
            with autocast(device_type="cuda", dtype=torch.bfloat16):
                out = model(input_ids=batch["input_ids"], attention_mask=batch["attention_mask"])
                logits = out.logits
                loss = torch.nn.functional.cross_entropy(
                    logits[:, :-1, :].contiguous().view(-1, logits.size(-1)),
                    batch["labels"][:, 1:].contiguous().view(-1),
                    ignore_index=-100,
                ) / GRAD_ACCUM

        scaler.scale(loss).backward()
        acc_loss += loss.item() * GRAD_ACCUM

        if (i + 1) % GRAD_ACCUM == 0:
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(trainable, 1.0)
            scaler.step(optimizer)
            scaler.update()
            optimizer.zero_grad(set_to_none=True)
            scheduler.step()
            global_step += 1
            if global_step % 10 == 0:
                print(f"step {global_step}/{num_steps} loss {acc_loss/10:.4f} lr {scheduler.get_last_lr()[0]:.2e} t {time.time()-t0:.1f}s")
                acc_loss = 0.0

        if torch.cuda.memory_reserved() / torch.cuda.get_device_properties(0).total_memory > 0.95:
            torch.cuda.empty_cache(); gc.collect()

# ---- Save adapter + tokenizer
os.makedirs(OUT_DIR, exist_ok=True)
model.save_pretrained(OUT_DIR, safe_serialization=True)
tok.save_pretrained(OUT_DIR)
print("Saved to", OUT_DIR)
