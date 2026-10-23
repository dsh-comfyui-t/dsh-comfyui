# train.ps1 -- julst2 style LoRA retrain driver.
#
# Host rule (AGENTS.md sec.1 + handover 7.1): Windows PowerShell 5.1 decodes a
# BOM-less .ps1 as GBK, so this file is PURE ASCII. Every path that may contain
# non-ASCII characters arrives as a command-line parameter (Unicode-safe).
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File train.ps1 -Smoke
#   powershell -ExecutionPolicy Bypass -File train.ps1 -Steps 1200 -SaveEvery 100
#   powershell -ExecutionPolicy Bypass -File train.ps1 -Steps 2000 `
#       -ResumeFrom <OUTDIR>\julst2-001200.safetensors   (OUTDIR must be passed in; see -OutDir)
#
# The script never writes to existing weight files: the output name is derived
# from -Name and a clobber assert runs before training starts.

param(
  [string]$Ckpt        = 'D:\paint\ComfyUI\models\diffusion_models\anima-aesthetic-v1.1.safetensors',
  [string]$Vae         = 'D:\paint\ComfyUI\models\vae\qwen_image_vae.safetensors',
  [string]$Qwen3       = 'D:\paint\ComfyUI\models\text_encoders\qwen_3_06b_base.safetensors',
  [string]$TrainDataDir = '',
  [string]$DatasetConfig = '',
  [string]$OutDir      = '',
  [string]$Name        = 'julst2',
  [string]$ResumeFrom  = '',
  [string]$NetworkModule = 'networks.lora_anima',
  [int]$Dim            = 32,
  [int]$Alpha          = 16,
  [int]$Reso           = 768,
  [int]$Steps          = 1200,
  [int]$SaveEvery      = 100,
  [int]$SaveLast       = 400,
  [string]$Lr          = '4e-5',
  [string]$TeLr        = '2e-5',
  [int]$Seed           = 20261020,
  [int]$GradAcc        = 2,
  [int]$BucketMax      = 1024,
  [string]$MinSnr      = '5',
  [string]$NoiseOffset = '0.03',
  [switch]$Smoke,
  [switch]$RefreshLatents,
  [string]$VPy         = 'D:\paint\venv312\Scripts\python.exe',
  [string]$Trainer     = 'D:\paint\sd-scripts\anima_train_network.py'
)

$ErrorActionPreference = 'Continue'
# 8GB card at 768 fragments and spills: enable expandable_segments
if (-not $env:PYTORCH_CUDA_ALLOC_CONF) { $env:PYTORCH_CUDA_ALLOC_CONF = 'expandable_segments:True' }
$env:HF_HUB_OFFLINE       = '1'
$env:TRANSFORMERS_OFFLINE = '1'

function Fail([string]$m) { Write-Host ("FATAL: " + $m); exit 1 }

if ($OutDir -eq '') { Fail '-OutDir is required (pass the Chinese-named output dir from the command line)' }
if ($DatasetConfig -eq '' -and $TrainDataDir -eq '') { Fail '-DatasetConfig or -TrainDataDir is required' }

foreach ($p in @($Ckpt, $Vae, $Qwen3, $Trainer, $VPy)) {
  if (-not (Test-Path -LiteralPath $p)) { Fail ("required file missing: " + $p) }
}
if ($DatasetConfig -ne '') {
  if (-not (Test-Path -LiteralPath $DatasetConfig)) { Fail ("dataset config missing: " + $DatasetConfig) }
} else {
  if (-not (Test-Path -LiteralPath $TrainDataDir)) { Fail ("train_data_dir missing: " + $TrainDataDir) }
}
if ($ResumeFrom -ne '' -and -not (Test-Path -LiteralPath $ResumeFrom)) {
  Fail ("resume weights missing: " + $ResumeFrom)
}
if ($Steps -lt 1) { Fail ("-Steps must be >= 1 (got " + $Steps + ")") }
if ($SaveEvery -lt 1) { Fail ("-SaveEvery must be >= 1 (got " + $SaveEvery + ")") }
if ($SaveLast -lt $SaveEvery) { Fail "-SaveLast must be >= -SaveEvery" }

if ($Smoke) { $Steps = 20; $SaveEvery = 20; $SaveLast = 20 }
$runTag = if ($Smoke) { $Name + '_smoke' } else { $Name }
$outAbs = Join-Path $OutDir $runTag

# --- clobber assert: never overwrite an existing run output ---
$final = Join-Path $outAbs ($runTag + '.safetensors')
if ((Test-Path -LiteralPath $final) -and -not $Smoke) {
  Fail ("output already exists, choose another -Name/-OutDir: " + $final)
}

$logDir = Join-Path (Join-Path $OutDir '_logs') $runTag
New-Item -ItemType Directory -Force -Path $outAbs, $logDir | Out-Null
$stdout = Join-Path $OutDir ('train-' + $runTag + '.log')

$argList = New-Object System.Collections.Generic.List[string]
$argList.Add("--pretrained_model_name_or_path=$Ckpt")
$argList.Add("--vae=$Vae")
$argList.Add("--qwen3=$Qwen3")
if ($DatasetConfig -ne '') { $argList.Add("--dataset_config=$DatasetConfig") }
else                       { $argList.Add("--train_data_dir=$TrainDataDir") }
$argList.Add("--output_dir=$outAbs")
$argList.Add("--output_name=$runTag")
$argList.Add("--logging_dir=$logDir")
if ($ResumeFrom -ne '') { $argList.Add("--network_weights=$ResumeFrom") }
$argList.Add("--network_module=$NetworkModule")
$argList.Add("--network_dim=$Dim")
$argList.Add("--network_alpha=$Alpha")
$argList.Add("--resolution=$Reso,$Reso")
$argList.Add('--train_batch_size=1')
$argList.Add("--gradient_accumulation_steps=$GradAcc")
$argList.Add("--max_train_steps=$Steps")
$argList.Add("--save_every_n_steps=$SaveEvery")
$argList.Add("--save_last_n_steps=$SaveLast")
$argList.Add("--learning_rate=$Lr")
$argList.Add("--unet_lr=$Lr")
$argList.Add("--text_encoder_lr=$TeLr")
$argList.Add('--lr_scheduler=cosine_with_restarts')
$argList.Add('--lr_scheduler_num_cycles=1')
$argList.Add('--lr_warmup_steps=80')
$argList.Add('--optimizer_type=AdamW')
$argList.Add('--mixed_precision=fp16')
$argList.Add('--save_precision=fp16')
$argList.Add('--save_model_as=safetensors')
$argList.Add('--gradient_checkpointing')
$argList.Add('--cache_latents')
if (-not $RefreshLatents) { $argList.Add('--cache_latents_to_disk')
# 8GB: freeze TE + cache TE outputs (DiT-only, same shape as julinst)
$argList.Add('--network_train_unet_only')
$argList.Add('--cache_text_encoder_outputs')
$argList.Add('--cache_text_encoder_outputs_to_disk') }
$argList.Add("--max_bucket_reso=$BucketMax")
$argList.Add('--min_bucket_reso=512')
$argList.Add('--bucket_reso_steps=64')
$argList.Add('--no_half_vae')
$argList.Add('--keep_tokens=1')
$argList.Add('--caption_extension=.txt')
$argList.Add("--min_snr_gamma=$MinSnr")
$argList.Add("--noise_offset=$NoiseOffset")
$argList.Add("--seed=$Seed")
$argList.Add('--max_data_loader_n_workers=2')
$argList.Add('--persistent_data_loader_workers')
$argList.Add('--sdpa')
$argList.Add('--log_with=tensorboard')

Write-Host '=== julst2 retrain pre-flight ==='
$argList | ForEach-Object { Write-Host ('  ' + $_) }
Write-Host ''
Write-Host ("stdout log: " + $stdout)
Write-Host ''

$t0 = Get-Date
& $VPy $Trainer @argList 2>&1 | Tee-Object -FilePath $stdout
$code = $LASTEXITCODE
$dt = (Get-Date) - $t0

Write-Host ''
Write-Host ("exit=" + $code + "  elapsed=" + $dt.ToString('hh\:mm\:ss'))
if ($code -ne 0) { Write-Host 'TRAINING FAILED -- read the log above; nothing was overwritten.'; exit $code }

# report real speed so the next run can be planned from measurement, not guesses
$last = Select-String -Path $stdout -Pattern 'steps:.*it/s' | Select-Object -Last 1
if ($last) { Write-Host ('speed: ' + $last.Line.Trim()) }
Write-Host ("outputs: " + (Get-ChildItem $outAbs -Filter '*.safetensors' | ForEach-Object { $_.Name }) -join ', ')
Write-Host 'NEXT: run acceptance.py against the checkpoint you want to judge, then copy only the winner into ComfyUI models\loras.'
