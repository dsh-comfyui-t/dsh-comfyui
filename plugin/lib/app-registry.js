// Registry entries encode distinct text-to-image pipelines; optional tasks are never inferred.
Object.assign(MODEL_PROFILES,{
 "sd2": {
  "label": "SD2.x",
  "family": "sd2",
  "clipType": "stable_diffusion",
  "encoderRoles": [
   "Text Encoder"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 7,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "illustrious": {
  "label": "Illustrious XL",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 6,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "pony": {
  "label": "Pony XL",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 24,
   "cfg": 6,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "noobai": {
  "label": "NoobAI XL",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": false,
  "sizeStep": 16,
  "recommended": {
   "steps": 28,
   "cfg": 5,
   "sampler": "euler",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  }
 },
 "sdxl-turbo": {
  "label": "SDXL Turbo",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 1,
   "cfg": 1,
   "sampler": "euler_ancestral",
   "scheduler": "simple",
   "w": 512,
   "h": 512
  },
  "advanced": "SDTurboScheduler"
 },
 "sdxl-lightning-1": {
  "label": "SDXL Lightning 1-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 1,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 1,
  "x0": true
 },
 "sdxl-lightning-2": {
  "label": "SDXL Lightning 2-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 2,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 2,
  "x0": false
 },
 "sdxl-lightning-4": {
  "label": "SDXL Lightning 4-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 4,
  "x0": false
 },
 "sdxl-lightning-8": {
  "label": "SDXL Lightning 8-step",
  "family": "sdxl",
  "clipType": "sdxl",
  "encoderRoles": [
   "CLIP-L",
   "CLIP-G"
  ],
  "encoders": 2,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "mixed",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "sgm_uniform",
   "w": 1024,
   "h": 1024
  },
  "lightningSteps": 8,
  "x0": false
 },
 "qwen-image": {
  "label": "Qwen-Image",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 4,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-lightning8": {
  "label": "Qwen-Image · Lightning 8-step",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true,
  "acceleration": "Qwen-Image-Lightning-8steps-V1.0"
 },
 "qwen-distill": {
  "label": "Qwen-Image · Distill",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-2512": {
  "label": "Qwen-Image 2512",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 50,
   "cfg": 4,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true
 },
 "qwen-2512-lightning4": {
  "label": "Qwen-Image 2512 · Lightning 4-step",
  "family": "qwen",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3.1,
  "samplingShift": true,
  "acceleration": "Qwen-Image-2512-Lightning-4steps"
 },
 "qwen21": {
  "label": "Qwen-Image 2.1",
  "family": "qwen21",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen3-VL 8B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "textNode": "TextEncodeQwenImage21",
  "cacheNode": "QwenImage21Cache"
 },
 "qwen21-turbo": {
  "label": "Qwen-Image 2.1 Turbo",
  "family": "qwen21",
  "clipType": "qwen_image",
  "encoderRoles": [
   "Qwen3-VL 8B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "textNode": "TextEncodeQwenImage21",
  "cacheNode": "QwenImage21Cache",
  "advanced": "ManualSigmas",
  "fixedSteps": 8,
  "sigmas": "1.0, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0"
 },
 "z-image": {
  "label": "Z-Image Base",
  "family": "z-image",
  "clipType": "lumina2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 4,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3,
  "samplingShift": true
 },
 "z-image-turbo": {
  "label": "Z-Image Turbo",
  "family": "z-image",
  "clipType": "lumina2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 3,
  "samplingShift": true
 },
 "flux2-dev": {
  "label": "FLUX.2 Dev",
  "family": "flux2-dev",
  "clipType": "flux2",
  "encoderRoles": [
   "Mistral 3 Small"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024,
   "guidance": 4
  },
  "advanced": "Flux2Scheduler",
  "basicGuider": true,
  "guidance": true
 },
 "flux2-turbo": {
  "label": "FLUX.2 Dev · Turbo LoRA",
  "family": "flux2-dev",
  "clipType": "flux2",
  "encoderRoles": [
   "Mistral 3 Small"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024,
   "guidance": 4
  },
  "advanced": "Flux2Scheduler",
  "basicGuider": true,
  "guidance": true,
  "acceleration": "FLUX.2 Turbo"
 },
 "flux2-klein4-base": {
  "label": "FLUX.2 Klein 4B Base",
  "family": "flux2-klein4",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein4-distilled": {
  "label": "FLUX.2 Klein 4B Distilled",
  "family": "flux2-klein4",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 4B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein9-base": {
  "label": "FLUX.2 Klein 9B Base",
  "family": "flux2-klein9",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 8B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 20,
   "cfg": 5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "flux2-klein9-distilled": {
  "label": "FLUX.2 Klein 9B Distilled",
  "family": "flux2-klein9",
  "clipType": "flux2",
  "encoderRoles": [
   "Qwen3 8B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 4,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "advanced": "Flux2Scheduler"
 },
 "hidream-full": {
  "label": "HiDream I1 Full",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 50,
   "cfg": 5,
   "sampler": "uni_pc",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 3,
  "samplingShift": true
 },
 "hidream-dev": {
  "label": "HiDream I1 Dev",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 28,
   "cfg": 1,
   "sampler": "lcm",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 6,
  "samplingShift": true
 },
 "hidream-fast": {
  "label": "HiDream I1 Fast",
  "family": "hidream",
  "clipType": "hidream",
  "encoderRoles": [
   "CLIP-L HiDream",
   "CLIP-G HiDream",
   "T5XXL",
   "Llama3.1 8B"
  ],
  "encoders": 4,
  "latent": "EmptySD3LatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 16,
   "cfg": 1,
   "sampler": "lcm",
   "scheduler": "normal",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingSD3",
  "patchShift": 3,
  "samplingShift": true
 },
 "moss-sft": {
  "label": "MOSS-Image SFT",
  "family": "moss",
  "clipType": "moss_image",
  "encoderRoles": [
   "Qwen3.5 9B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 2.5,
   "sampler": "er_sde",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "slgNode": "SkipLayerGuidanceDiTSimple"
 },
 "moss-base": {
  "label": "MOSS-Image Base",
  "family": "moss",
  "clipType": "moss_image",
  "encoderRoles": [
   "Qwen3.5 9B"
  ],
  "encoders": 1,
  "latent": "EmptyFlux2LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 2.5,
   "sampler": "er_sde",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "slgNode": "SkipLayerGuidanceDiTSimple"
 },
 "krea2-turbo": {
  "label": "Krea 2 Turbo",
  "family": "krea2",
  "clipType": "krea2",
  "encoderRoles": [
   "Qwen3-VL 4B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": false,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 8,
   "cfg": 1,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  }
 },
 "krea2-raw": {
  "label": "Krea 2 RAW",
  "family": "krea2",
  "clipType": "krea2",
  "encoderRoles": [
   "Qwen3-VL 4B"
  ],
  "encoders": 1,
  "latent": "EmptyLatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 52,
   "cfg": 4.5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  }
 },
 "chroma": {
  "label": "Chroma / Chroma1-HD",
  "family": "chroma",
  "clipType": "chroma",
  "encoderRoles": [
   "T5XXL"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 26,
   "cfg": 3.5,
   "sampler": "euler",
   "scheduler": "beta",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 1,
  "samplingShift": true,
  "tokenizer": true
 },
 "lumina2": {
  "label": "Lumina Image 2.0",
  "family": "lumina2",
  "clipType": "lumina2",
  "encoderRoles": [
   "Gemma2 2B"
  ],
  "encoders": 1,
  "latent": "EmptySD3LatentImage",
  "negative": true,
  "style": "natural",
  "modes": [
   "checkpoint",
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 16,
  "recommended": {
   "steps": 25,
   "cfg": 4,
   "sampler": "res_multistep",
   "scheduler": "simple",
   "w": 1024,
   "h": 1024
  },
  "patchNode": "ModelSamplingAuraFlow",
  "patchShift": 6,
  "samplingShift": true
 },
 "hunyuan21": {
  "label": "Hunyuan Image 2.1",
  "family": "hunyuan",
  "clipType": "hunyuan_image",
  "encoderRoles": [
   "Qwen2.5-VL 7B",
   "ByT5 Small Glyph"
  ],
  "encoders": 2,
  "latent": "EmptyHunyuanImageLatent",
  "negative": true,
  "style": "natural",
  "modes": [
   "diffusion"
  ],
  "modelOnlyLora": true,
  "sizeStep": 32,
  "recommended": {
   "steps": 20,
   "cfg": 3.5,
   "sampler": "euler",
   "scheduler": "simple",
   "w": 2048,
   "h": 2048
  }
 }
});
Object.assign(MODEL_PROFILES.sdxl,{modes:["checkpoint","diffusion"],encoders:2,clipType:"sdxl",encoderRoles:["CLIP-L","CLIP-G"]});
MODEL_PROFILES["sdxl-lightning-1"].recommended.scheduler="simple";
MODEL_PROFILES["anima-turbo-lora"]={...MODEL_PROFILES["anima-turbo"],label:"Anima Base · Turbo LoRA",acceleration:"Anima Turbo",encoderRoles:["Text Encoder"]};


function normalizeModelConfig(value){
 const v=value&&typeof value==="object"?value:{};
 return {version:1,contentMode:['checkpoint','diffusion'].includes(v.contentMode)?v.contentMode:'unknown',embeddedClip:typeof v.embeddedClip==='boolean'?v.embeddedClip:null,embeddedVae:typeof v.embeddedVae==='boolean'?v.embeddedVae:null,componentOrder:normalizeComponentOrder(v.componentOrder),encoderOverride:v.encoderOverride===true,vaeOverride:v.vaeOverride===true,mode:v.mode==="diffusion"?"diffusion":"checkpoint",profile:v.profile===undefined?"legacy":(Object.prototype.hasOwnProperty.call(MODEL_PROFILES,v.profile)?v.profile:"unknown"),main:String(v.main||""),clip2:String(v.clip2||""),clip3:String(v.clip3||""),clip4:String(v.clip4||""),accelerationLora:String(v.accelerationLora||""),slg:v.slg!==false,encoderMode:v.encoderMode===undefined?"triple":String(v.encoderMode),shift:v.shift??null,dtype:String(v.dtype||"default"),guidance:v.guidance??3.5,clipSkip:v.clipSkip??0,identity:String(v.identity||"")};
}

function normalizeComponentOrder(order){return [...new Set((Array.isArray(order)?order:[]).filter(k=>typeof k==='string'&&(k==='clip'||k==='vae'||k==='acceleration'||k.startsWith('encoder:')&&k.length>8||k.startsWith('lora:')&&k.length>5)&&k.length<4096))].slice(0,256);}


function modelNeedsExternal(config){const c=normalizeModelConfig(config),p=MODEL_PROFILES[c.profile];return c.mode==='diffusion'||c.contentMode==='diffusion'||p.modes.length===1&&p.modes[0]==='diffusion';}

function withModelFileInfo(value,info){const c=normalizeModelConfig({...value,contentMode:info.contentMode,embeddedClip:info.embeddedClip,embeddedVae:info.embeddedVae});if(MODEL_PROFILES[c.profile].family==='sd3'&&c.encoderMode==='embedded'&&(modelNeedsExternal(c)||c.embeddedClip===false))c.encoderMode='triple';return c;}

function modelProfile(config){return MODEL_PROFILES[normalizeModelConfig(config).profile];}


function modelConfigKey(config,ckpt){const c=normalizeModelConfig(config);return JSON.stringify([c.mode,c.mode==="diffusion"?c.main:ckpt,c.identity]);}

function rememberedModelSetup(cache,config,ckpt){
 const c=normalizeModelConfig(config),exact=cache?.[modelConfigKey(c,ckpt)];
 // A legacy unbound configuration may be adopted by the default root, never a different explicit root.
 return exact||(c.identity==='0'?cache?.[modelConfigKey({...c,identity:''},ckpt)]:undefined);
}
// Rewrite only model paths after a successful in-library move. Prompt text and backups stay immutable.

function modelPathChange(oldName,newName,folder=false,options=[],ignoreCase=SIDECAR_PLATFORM==='nt'){
 const slash=value=>String(value||'').replace(/\\/g,'/').replace(/^\.\//,'');
 const compare=value=>ignoreCase?value.toLowerCase():value;
 const old=slash(oldName),next=slash(newName),prefix=old+'/';
 return value=>{if(typeof value!=='string'||!value)return value;const path=slash(value);
  const result=folder?(compare(path).startsWith(compare(prefix))?next+'/'+path.slice(prefix.length):value):
   (compare(path)===compare(old)?next:value);
  return result===value?value:options.find(name=>compare(slash(name))===compare(slash(result)))||result;};
}

function remapModelSetupPaths(item,kind,change,rootId){
 if(!item||typeof item!=='object'||Array.isArray(item))return item;
 const out={...item},c=item.modelConfig&&{...item.modelConfig};
 const mainRootMatches=rootId===undefined||!c?.identity||String(c.identity)===String(rootId);
 if(kind==='checkpoint'&&mainRootMatches&&'ckpt' in out)out.ckpt=change(out.ckpt);
 if(kind==='clip'&&'clip' in out)out.clip=change(out.clip);
 if(kind==='vae'&&'vae' in out)out.vae=change(out.vae);
 if(kind==='upscale'&&'upscaleModel' in out)out.upscaleModel=change(out.upscaleModel);
 if(out.postControls?.cells)out.postControls={...out.postControls,cells:out.postControls.cells.map(cell=>cell.kind==='upscale'&&kind==='upscale'?{...cell,model:change(cell.model)}:cell)};
 if(c){if(kind==='diffusion'&&mainRootMatches)c.main=change(c.main);
  if(kind==='clip')for(const field of ['clip2','clip3','clip4'])if(field in c)c[field]=change(c[field]);
  if(kind==='lora'){if('accelerationLora' in c)c.accelerationLora=change(c.accelerationLora);if(Array.isArray(c.componentOrder))c.componentOrder=normalizeComponentOrder(c.componentOrder).map(k=>k.startsWith('lora:')?'lora:'+change(k.slice(5)):k);}out.modelConfig=c;}
 if(kind==='lora'&&Array.isArray(out.loras))out.loras=out.loras.map(l=>l&&typeof l==='object'?{...l,name:change(l.name)}:l);
 return out;
}

function remapSavedModelPaths(user,kind,change,rootId){
 const keyChange=key=>{try{const parts=JSON.parse(key);if(!Array.isArray(parts)||parts.length!==3)return key;
  if(parts[0]===kind&&(rootId===undefined||!parts[2]||String(parts[2])===String(rootId)))parts[1]=change(parts[1]);
  return JSON.stringify(parts);}catch{return key;}};
 const rewrite=(cache,profile=false)=>{
  if(!cache||typeof cache!=='object'||Array.isArray(cache))return cache;
  const rows=Object.entries(cache).map(([key,value])=>{let next=key;
   if(profile){try{const parts=JSON.parse(key);if(Array.isArray(parts)&&parts.length===2){parts[0]=keyChange(parts[0]);next=JSON.stringify(parts);}}catch{}}
   else next=keyChange(key);
   return [next,remapModelSetupPaths(value,kind,change,rootId),key!==next];});
  // The file that was actually moved wins over an obsolete cache for its destination.
  return Object.fromEntries(rows.sort((a,b)=>Number(a[2])-Number(b[2])).map(([key,value])=>[key,value]));};
 if(user.last)user.last=remapModelSetupPaths(user.last,kind,change,rootId);
 if(Array.isArray(user.presets))user.presets=user.presets.map(p=>remapModelSetupPaths(p,kind,change,rootId));
 if(user.modelConfigs)user.modelConfigs=rewrite(user.modelConfigs);
 if(user.modelProfileConfigs)user.modelProfileConfigs=rewrite(user.modelProfileConfigs,true);
}

function activeModelLoras(loras){return (Array.isArray(loras)?loras:[]).filter(x=>x.enabled!==false&&!(x.id&&!String(x.name||'').trim()));}

function modelEncoderRoles(c){const p=modelProfile(c);return p.family==='sd3'?(c.encoderMode==='t5'?['T5XXL']:c.encoderMode==='dual'?['CLIP-L','CLIP-G']:c.encoderMode==='embedded'?[]:['CLIP-L','CLIP-G','T5XXL']):p.encoderRoles||(p.encoders===2?['CLIP-L','T5XXL']:['Text Encoder']);}

function controlEncoderRoles(config){const c=normalizeModelConfig(config);return modelEncoderRoles(modelProfile(c).family==='sd3'&&c.encoderMode==='embedded'?{...c,encoderMode:'triple'}:c);}

function controlLoraKey(l){return 'lora:'+(l.id||l.name);}

function generationControlEntries(setup){
 const c=normalizeModelConfig(setup.modelConfig),roles=controlEncoderRoles(c),files=[setup.clip,c.clip2,c.clip3,c.clip4],entries=new Map(),order=[];
 const add=key=>{if(!order.includes(key))order.push(key);};
 for(const key of c.componentOrder){if(key==='clip')roles.forEach(role=>add('encoder:'+role));else add(key);}
 roles.forEach((role,index)=>{const key='encoder:'+role;if(order.includes(key)||files[index]||c.encoderOverride&&!c.componentOrder.some(k=>k.startsWith('encoder:')))entries.set(key,{key,kind:'clip',role,index,name:files[index]||'',label:'文本编码器 · '+role});});
 if(order.includes('vae')||setup.vae||c.vaeOverride)entries.set('vae',{key:'vae',kind:'vae',name:setup.vae||'',label:'VAE'});
 if(modelProfile(c).acceleration&&(order.includes('acceleration')||c.accelerationLora))entries.set('acceleration',{key:'acceleration',kind:'lora',name:c.accelerationLora||'',label:'加速 LoRA · '+modelProfile(c).acceleration,acceleration:true});
 for(const lora of setup.loras||[]){const key=controlLoraKey(lora);entries.set(key,{key,kind:'lora',name:lora.name||'',label:'LoRA',lora});}
 return [...order.filter(key=>entries.has(key)),...Array.from(entries.keys()).filter(key=>!order.includes(key))].map(key=>entries.get(key));
}

function generationControlSummary(entries){if(!entries.length)return '0 个控制';const n=kind=>entries.filter(e=>e.kind===kind).length;return [['vae','VAE'],['clip','文本编码器'],['lora','LoRA']].filter(([kind])=>n(kind)).map(([kind,label])=>n(kind)+' '+label).join(' · ');}

/** 拼 ComfyUI API 格式的工作流 */


function imageSizeScaled(w,h,multiplier,alignment=8){
    const m=Math.max(.25,Math.min(4,Number(multiplier)||1));
    const step=m===1?8:Math.max(8,Number(alignment)||8);
    const snap=v=>Math.max(64,Math.min(8192,Math.round(Number(v)/step)*step));
    return {w:snap(Number(w)*m),h:snap(Number(h)*m)};
}

function preciseSizeMultiplier(value,fallback=1){
    const n=String(value??'').trim()===''?NaN:Number(value),backup=Number(fallback);
    return Math.round(Math.max(.25,Math.min(4,Number.isFinite(n)?n:Number.isFinite(backup)?backup:1))*100)/100;
}

function DraggableNumberInput({
    value,onChange,min,max,step=.01,precision=2,dragPerPixel=1/300,
    label='数值',decreaseLabel='减小',increaseLabel='增大',className='',
}){
    const factor=10**precision,clamp=n=>Math.round(Math.max(min,Math.min(max,n))*factor)/factor;
    const fallback=min<=1&&max>=1?1:min;
    const normalize=(v,fb=fallback)=>{const n=String(v??'').trim()===''?NaN:Number(v);return clamp(Number.isFinite(n)?n:Number.isFinite(Number(fb))?Number(fb):fallback);};
    const [draft,setDraft]=React.useState(()=>normalize(value).toFixed(precision)),[dragging,setDragging]=React.useState(false);
    const editing=React.useRef(false),drag=React.useRef(null),input=React.useRef(null),latest=React.useRef(value),text=React.useRef(draft),emitted=React.useRef(null),suppressClick=React.useRef(false);
    latest.current=value;
    function writeDraft(v){text.current=v;setDraft(v);}
    function publish(n){emitted.current=n;latest.current=n;onChange(n);}
    function stop(e){const d=drag.current;if(d&&e?.pointerId!==undefined&&e.pointerId!==d.id)return;drag.current=null;setDragging(false);if(d){if(d.active)suppressClick.current=true;try{d.target.releasePointerCapture(d.id);}catch{}}}
    React.useEffect(()=>{
        const n=normalize(value),local=emitted.current!==null&&Number(value)===emitted.current;emitted.current=null;
        if(!local){stop();writeDraft(n.toFixed(precision));}
        else if(!editing.current&&!drag.current)writeDraft(n.toFixed(precision));
        if(Number(value)!==n)publish(n);
    },[value]);
    function commit(){const n=normalize(text.current,latest.current);editing.current=false;writeDraft(n.toFixed(precision));publish(n);return n;}
    function stepBy(delta){stop();const n=normalize(normalize(text.current,latest.current)+delta);writeDraft(n.toFixed(precision));publish(n);}
    React.useEffect(()=>{const blur=()=>stop(),release=e=>stop(e);window.addEventListener('blur',blur);window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);return()=>{window.removeEventListener('blur',blur);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);const d=drag.current;drag.current=null;if(d)try{d.target.releasePointerCapture(d.id);}catch{}};},[]);
    function begin(e){
        if(e.button!==0||drag.current)return;suppressClick.current=false;
        const d={x:e.clientX,base:normalize(text.current,latest.current),id:e.pointerId,target:e.currentTarget,active:false};drag.current=d;
    }
    function move(e){
        const d=drag.current;if(!d||e.pointerId!==d.id)return;
        if(e.buttons!==undefined&&!(e.buttons&1)){stop();return;}
        const dx=e.clientX-d.x;if(!d.active&&Math.abs(dx)<4)return;
        if(!d.active){d.active=true;try{d.target.setPointerCapture(d.id);}catch{stop();return;}editing.current=false;input.current?.blur();setDragging(true);}
        const n=normalize(d.base+dx*dragPerPixel);writeDraft(n.toFixed(precision));publish(n);
    }
    function finish(e){const d=drag.current;if(!d||e.pointerId!==d.id)return;stop(e);if(!d.active)suppressClick.current=false;}
    const arrow=(direction,text)=>h('button',{type:'button','aria-label':direction<0?decreaseLabel:increaseLabel,'data-cc-tooltip':direction<0?'减小 '+step:'增大 '+step,
        disabled:direction<0?normalize(value)<=min:normalize(value)>=max,
        onPointerDown:e=>{if(e.button===0)e.preventDefault();},onClick:()=>stepBy(direction*step)},h(PromptIcon,{name:direction<0?'chevronLeft':'chevronRight',size:12}));
    return h('div',{className:'cc-drag-number'+(className?' '+className:''),'data-dragging':dragging},
        arrow(-1,decreaseLabel),
        h('input',{ref:input,type:'number',step,min,max,'aria-label':label,value:draft,title:'左右拖动调整；点击输入数值',
            onPointerDown:begin,onPointerMove:move,onPointerUp:finish,onPointerCancel:stop,onLostPointerCapture:stop,
            onClick:e=>{if(suppressClick.current){e.preventDefault();suppressClick.current=false;}},
            onFocus:()=>{editing.current=true;},onChange:e=>{writeDraft(e.target.value);const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=min&&n<=max)publish(normalize(n));},onBlur:commit,
            onKeyDown:e=>{if(e.key==='Enter'){e.preventDefault();commit();e.currentTarget.blur();}else if(e.key==='Escape'){e.preventDefault();stop();writeDraft(normalize(latest.current).toFixed(precision));editing.current=false;e.currentTarget.blur();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepBy(e.key==='ArrowUp'?step:-step);}}}),
        arrow(1,increaseLabel));
}


// ==================== 统一视觉令牌（详见根目录 design.md）====================
// 不能假定 DSH 和操作系统采用同一主题：读取宿主实际的文字/背景颜色，
// 把配色显式传递给 portaled 浮层。所有控件都使用同一套 --cc-* 令牌。

function rgbOf(value) {
    const m = String(value || "").match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d*\.?\d+))?/i);
    if (!m) return null;
    return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) };
}

function luminance(c) {
    if (!c) return 0;
    const linear = (v) => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; };
    return .2126 * linear(c.r) + .7152 * linear(c.g) + .0722 * linear(c.b);
}

function contrastRatio(a, b) {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function mixHex(a, b, ratio) {
    const n = (x, y) => Math.round(x * (1 - ratio) + y * ratio).toString(16).padStart(2, "0");
    return "#" + n(a.r, b.r) + n(a.g, b.g) + n(a.b, b.b);
}

function hostPalette(root) {
    if (!root || typeof window === "undefined" || !window.getComputedStyle) return {};
    const fg = rgbOf(window.getComputedStyle(root.parentElement || root).color);
    let bg = null;
    for (let n = root; n && n.nodeType === 1; n = n.parentElement) {
        const c = rgbOf(window.getComputedStyle(n).backgroundColor);
        if (c && c.a >= .95) { bg = c; break; }
    }
    const dark = bg ? luminance(bg) < .18 : fg ? luminance(fg) > .45
        : !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (!bg) bg = dark ? {r: 24, g: 27, b: 33} : {r: 248, g: 249, b: 251};
    const ink = (fg && contrastRatio(fg, bg) >= 4.5) ? fg
        : dark ? {r: 236, g: 239, b: 244} : {r: 32, g: 38, b: 48};
    const white = {r:255,g:255,b:255}, black = {r:0,g:0,b:0};
    const lift = dark ? white : black;
    return {
        "--cc-bg": mixHex(bg, bg, 0),
        "--cc-text": mixHex(ink, ink, 0),
        "--cc-muted": mixHex(ink, bg, .37),
        "--cc-surface": mixHex(bg, lift, dark ? .075 : .025),
        "--cc-control": mixHex(bg, lift, dark ? .12 : .035),
        "--cc-hover": mixHex(bg, lift, dark ? .18 : .075),
        "--cc-border": mixHex(bg, ink, dark ? .24 : .19),
        "--cc-accent": dark ? "#8ab7ff" : "#2568bd",
        "--cc-accent-bg": dark ? "#243a56" : "#e2edfc",
        "--cc-accent-text": dark ? "#e7f0ff" : "#174b8b",
        "--cc-ok": dark ? "#75d7a5" : "#15754b",
        "--cc-bad": dark ? "#ff9298" : "#b52f3c",
        "--cc-warn": dark ? "#f2c477" : "#895800",
        "--cc-preview-outline": dark ? "#ffffff" : "#111111",
        "--cc-scheme": dark ? "dark" : "light",
        colorScheme: dark ? "dark" : "light",
    };
}


