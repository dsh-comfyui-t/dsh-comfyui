# comfyui-cards · 训练与评测脚本（随技能分发）

这些就是技能 §11–§17 实际用到的工具，**换机器可直接用**，不必再向作者要。
唯一要改的是路径：模型、sd-scripts、Python、素材目录。

## 里面有什么

| 文件 | 作用 | 谁在用 |
|---|---|---|
| `train.ps1` | 参数化训练启动器（角色 / 画风 LoRA 都走它）：拼 `anima_train_network.py` 参数、设 `PYTORCH_CUDA_ALLOC_CONF`、落日志、**开跑前做 clobber 断言**（输出已存在就拒跑） | §11 §12 §13 |
| `dataset-character.toml` | 角色 / 画风 LoRA 数据集模板（`resolution` / `num_repeats` / `caption_dropout_rate`） | §11 §12 §13 |
| `dataset-lllite.toml` | LLLite 数据集模板（`image_dir` + `conditioning_data_dir` 成对） | §14 |
| `make-lora-sheet.py` | 若干张出图裁成一条对比带：`python make-lora-sheet.py out.png "tag1=a.png" "tag2=b.png"` | §15 |
| `make-lora-sheet-full.py` | 同上但保留整幅（不按框裁切），看取景漂移用 | §15 |
| `style_check.py` | 画风尺子：以素材自身为基准量各轴 z 值，超出素材自身波动就是跑偏 | §15 §17 |

## 换机第一次跑（照抄改路径）

```powershell
# 1) 训练器与依赖（上游，无需私有件）
git clone https://github.com/kohya-ss/sd-scripts D:\ai\sd-scripts
& D:\ai\venv\Scripts\python.exe -m pip install -r D:\ai\sd-scripts\requirements.txt

# 2) 模型放 ComfyUI 的 models 下（实测大小见技能 §11，可用来核对下载对不对）
#    diffusion_models\anima-aesthetic-v1.1.safetensors   4,182,230,656 B
#    text_encoders\qwen_3_06b_base.safetensors           1,192,135,096 B
#    vae\qwen_image_vae.safetensors                      253,806,246 B

# 3) 数据集：复制模板改 image_dir，打标（.txt 与图同名）

# 4) 先冒烟（20 步，几分钟，验证全链路）
powershell -ExecutionPolicy Bypass -File .\train.ps1 -Smoke `
  -Ckpt  D:\ComfyUI\models\diffusion_models\anima-aesthetic-v1.1.safetensors `
  -Vae   D:\ComfyUI\models\vae\qwen_image_vae.safetensors `
  -Qwen3 D:\ComfyUI\models\text_encoders\qwen_3_06b_base.safetensors `
  -VPy   D:\ai\venv\Scripts\python.exe `
  -Trainer D:\ai\sd-scripts\anima_train_network.py `
  -DatasetConfig .\dataset-character.toml -OutDir D:\runs -Name myfirst

# 5) 正式：去掉 -Smoke，参数照技能 §12 表
```

**注意**：`train.ps1` 的默认值指向作者机器（`D:\paint\...`）。换机器**必须显式传** `-Ckpt -Vae -Qwen3 -VPy -Trainer`；少传任何一个，脚本会在开跑前 `Fail` 并打印 `required file missing: <路径>`，不会静默跑错。

## 两条硬规则（踩过）

1. `.ps1` 保持**纯 ASCII 无 BOM**：PS 5.1 会把无 BOM 的 ps1 当 GBK 解码，写中文必炸。中文路径走命令行参数。
2. 一台机器同时只允许一个训练器；开训前关掉 ComfyUI（8 GB 卡上 3 个 CUDA 上下文会互抢）。
