const UI_CSS = `
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number{display:flex;align-items:stretch;width:100%;min-width:0;height:34px;overflow:hidden;background:transparent}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-size-multiplier{border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button{display:flex;align-items:center;justify-content:center;flex:0 0 24px;min-width:0;border:0;border-radius:0!important;background:transparent;color:var(--cc-muted);cursor:pointer;padding:0;user-select:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button:hover:enabled{color:var(--cc-text);background:var(--cc-hover)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>button:disabled{opacity:.3;cursor:default}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input{height:100%!important;min-height:0!important;width:0!important;flex:1;min-width:0;border:0!important;border-radius:0!important;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;padding:5px 1px;text-align:center;appearance:textfield;cursor:text;touch-action:none;outline:0!important;box-shadow:none!important}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input::-webkit-inner-spin-button,:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-drag-number>input::-webkit-outer-spin-button{appearance:none;margin:0}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-size-multiplier:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-field-capsule:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-field-capsule>.cc-drag-number{flex:1;border:0;border-radius:0;background:transparent}
.dsh-comfy-ui .cc-shift-controls{display:flex;align-items:center;gap:6px;min-width:0}.dsh-comfy-ui .cc-shift-controls>div{flex:1;min-width:0}.dsh-comfy-ui .cc-shift-controls>.cc-select-trigger,.dsh-comfy-ui .cc-shift-controls>div>.cc-select-trigger{width:100%;min-width:0!important}.dsh-comfy-ui .cc-shift-controls>input{flex:0 0 68px;width:68px!important}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]{grid-template-columns:repeat(6,minmax(0,1fr))}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>*{grid-column:span 2}
.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>.cc-field-select{grid-column:span 3}
@container(max-width:640px){.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]{grid-template-columns:repeat(2,minmax(0,1fr))}.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>*{grid-column:auto}.dsh-comfy-ui .cc-compact-sampling[data-model-sampling="true"]>:nth-child(3){grid-column:1/-1}}
.cc-model-profile-row{display:flex;align-items:end;gap:8px;flex-wrap:wrap}.cc-model-profile-row .cc-model-aux-field{flex:1 1 150px;min-width:0}.cc-model-lora-chip[data-paused="true"]{opacity:.65}.cc-model-negative-saved{font-size:11px;color:var(--cc-muted)}

.dsh-comfy-ui .cc-image-settings-host{width:100%;min-width:0;flex:0 0 auto;container-type:inline-size}
.dsh-comfy-ui .cc-image-settings{border:1px solid var(--cc-border);border-radius:10px;padding:10px 11px;display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);grid-template-rows:minmax(0,1fr) auto;gap:12px;width:100%;min-width:0;min-height:600px;height:660px;flex:0 0 auto;align-self:stretch;overflow:hidden}
.dsh-comfy-ui .cc-image-controls{display:grid;grid-template-rows:auto minmax(0,1fr);gap:10px;min-width:0;min-height:0;overflow:visible}
.dsh-comfy-ui .cc-image-basic{display:flex;flex-direction:column;gap:10px;min-width:0}
.dsh-comfy-ui .cc-image-advanced{min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:auto;scrollbar-gutter:stable;border-top:1px solid var(--cc-border);padding:10px 7px 4px 0}
.dsh-comfy-ui .cc-image-advanced>.cc-details{border:0;padding:0}
.dsh-comfy-ui .cc-image-controls-head,.dsh-comfy-ui .cc-image-preview-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dsh-comfy-ui .cc-image-controls-head strong,.dsh-comfy-ui .cc-image-preview-head strong{font-size:13px}
.dsh-comfy-ui .cc-image-controls :is(input[type=number],input[type=text],.cc-select-trigger){height:34px;min-height:34px;max-width:100%}
.dsh-comfy-ui .cc-image-upscale-options{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:8px;padding-top:10px;align-items:end}
.dsh-comfy-ui .cc-image-upscale-options>label{grid-column:1/-1}
.dsh-comfy-ui .cc-image-preview-hint{color:var(--cc-muted);font-size:11px;line-height:1.5;overflow-wrap:anywhere}
/* Keep image controls rounded even when the host resets native control radii. */
.dsh-comfy-ui .cc-image-settings :is(input[type=number],input[type=text],.cc-select-trigger,.cc-icon-button,.cc-save-row>button,.cc-image-actions>button,.cc-summary){border-radius:6px!important}
.dsh-comfy-ui .cc-image-settings{border-radius:10px!important}
.dsh-comfy-ui .cc-image-settings .cc-save-toggle{border-radius:7px!important}
.dsh-comfy-ui .cc-param-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;align-content:start}
.dsh-comfy-ui .cc-param-wide{grid-column:1/-1;min-width:0}
.dsh-comfy-ui .cc-size-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px minmax(76px,.85fr);gap:7px;align-items:end}
.dsh-comfy-ui .cc-size-row input[type=number]{width:100%;min-width:0}
.dsh-comfy-ui .cc-size-row .cc-icon-button{height:34px;min-height:34px;width:32px;margin:0}
.dsh-comfy-ui .cc-compact-sampling{display:grid;grid-template-columns:minmax(55px,.62fr) minmax(55px,.62fr) minmax(0,1.45fr) minmax(0,1.45fr);gap:7px;align-items:end}
.dsh-comfy-ui .cc-compact-sampling input[type=number]{width:100%;min-width:0}
.dsh-comfy-ui .cc-compact-sampling .cc-field-select{min-width:0}
.dsh-comfy-ui .cc-save-row{display:flex;align-items:center;gap:8px;min-width:0}
.dsh-comfy-ui .cc-save-row input[type=text]{flex:1;min-width:0;width:auto}
.dsh-comfy-ui .cc-save-note{margin:0;padding:0;border:0;border-radius:0;background:transparent;font-size:10.5px;color:var(--cc-muted);line-height:1.5}
.dsh-comfy-ui .cc-save-toggle{width:100%;min-height:36px;display:flex;align-items:center;justify-content:flex-start;gap:8px;min-width:0;padding:8px 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);font-size:12px;cursor:pointer}
.dsh-comfy-ui .cc-save-toggle .cc-switch-track{position:relative;display:inline-block;width:33px;height:19px;border-radius:99px;background:var(--cc-border);flex:none;transition:background .15s}
.dsh-comfy-ui .cc-save-toggle .cc-switch-track:after{content:"";position:absolute;top:3px;left:3px;width:13px;height:13px;border-radius:50%;background:var(--cc-text);transition:transform .15s}
.dsh-comfy-ui .cc-save-toggle[aria-checked=true] .cc-switch-track{background:var(--cc-accent)}
.dsh-comfy-ui .cc-save-toggle[aria-checked=true] .cc-switch-track:after{transform:translateX(14px);background:var(--cc-surface)}
.dsh-comfy-ui .cc-image-actions{grid-column:1/-1;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 -11px -10px;padding:10px 11px;border-top:1px solid var(--cc-border);border-radius:0 0 9px 9px!important;background:var(--cc-surface);min-width:0}
.dsh-comfy-ui .cc-image-preview-panel{display:grid;grid-template-rows:auto minmax(0,1fr);gap:8px;min-width:0;min-height:0;overflow:hidden}
.dsh-comfy-ui .cc-image-preview-stage{min-width:0;min-height:0;width:100%;height:100%;container-type:size;display:flex;align-items:center;justify-content:center}
.dsh-comfy-ui .cc-main-preview{position:relative;width:min(100%,100cqh,900px);aspect-ratio:1/1;flex:none;border:0;border-radius:0;background:transparent;overflow:visible}
.dsh-comfy-ui .cc-preview-image-rect,.dsh-comfy-ui .cc-latent-frame{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);transition:width .16s ease,height .16s ease}.dsh-comfy-ui .cc-preview-image-rect{overflow:hidden;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.12)}.dsh-comfy-ui .cc-preview-image-rect img{width:100%;height:100%;object-fit:contain;display:block}.dsh-comfy-ui .cc-latent-frame{border:2px solid var(--cc-preview-outline,#fff);box-shadow:0 0 0 1px rgba(0,0,0,.18),0 0 6px rgba(255,255,255,.2);pointer-events:none}.dsh-comfy-ui .cc-preview-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--cc-muted);font-size:11px}

@media(max-width:760px){.dsh-comfy-ui .cc-image-settings{height:auto;min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;overflow:visible}.dsh-comfy-ui .cc-image-controls{grid-template-rows:auto 200px}.dsh-comfy-ui .cc-image-preview-panel{min-height:0;grid-template-rows:auto minmax(0,1fr)}.dsh-comfy-ui .cc-image-preview-stage{width:min(100%,900px);height:auto;aspect-ratio:1;place-self:center}.dsh-comfy-ui .cc-image-actions{grid-column:1}}
@container (max-width:800px){.dsh-comfy-ui .cc-image-settings{height:auto;min-height:0;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto;overflow:visible}.dsh-comfy-ui .cc-image-controls{grid-template-rows:auto 200px}.dsh-comfy-ui .cc-image-preview-panel{min-height:0;grid-template-rows:auto minmax(0,1fr)}.dsh-comfy-ui .cc-image-preview-stage{width:min(100%,900px);height:auto;aspect-ratio:1;place-self:center}.dsh-comfy-ui .cc-image-actions{grid-column:1}}
@container (max-width:640px){.dsh-comfy-ui .cc-compact-sampling{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:360px){.dsh-comfy-ui .cc-size-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 32px minmax(60px,.85fr);gap:5px}.dsh-comfy-ui .cc-image-advanced{padding-right:2px;scrollbar-gutter:auto}.dsh-comfy-ui .cc-image-upscale-options{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-ui .cc-task-summary{position:relative;display:flex;align-items:center;gap:7px;padding:4px 7px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font-size:11px;cursor:default}.dsh-comfy-ui .cc-task-dot{width:7px;height:7px;border-radius:50%;background:var(--cc-muted)}.dsh-comfy-ui .cc-task-summary[data-active=true] .cc-task-dot{background:var(--cc-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--cc-accent) 18%,transparent)}.dsh-comfy-ui .cc-task-popover{display:none;position:absolute;left:0;top:calc(100% + 6px);z-index:2147470000;width:min(460px,calc(100vw - 28px));max-height:430px;overflow:auto;padding:8px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-surface);box-shadow:0 14px 38px rgba(0,0,0,.36)}.dsh-comfy-ui .cc-task-summary:hover .cc-task-popover,.dsh-comfy-ui .cc-task-summary:focus-within .cc-task-popover{display:flex;flex-direction:column;gap:5px}.dsh-comfy-ui .cc-task-row{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:7px;align-items:center;width:100%;padding:7px;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cc-text);font:inherit;text-align:left;cursor:pointer}.dsh-comfy-ui .cc-task-row:hover{background:var(--cc-hover)!important}.dsh-comfy-ui .cc-task-row small{color:var(--cc-muted);font-size:9px}.dsh-comfy-ui .cc-progress-indeterminate{height:3px;border-radius:99px;background:var(--cc-border);overflow:hidden;margin-top:4px}.dsh-comfy-ui .cc-progress-indeterminate:after{content:"";display:block;width:35%;height:100%;background:var(--cc-accent);animation:cc-task-slide 1.1s ease-in-out infinite}@keyframes cc-task-slide{0%{transform:translateX(-120%)}100%{transform:translateX(330%)}}
/* Output browser styles are defined in the v0.6.11 block below. */
.dsh-comfy-ui,.dsh-comfy-floating{color:var(--cc-text);font-family:inherit;color-scheme:var(--cc-scheme)}
.dsh-comfy-ui *, .dsh-comfy-floating *{box-sizing:border-box}
.dsh-comfy-ui button,.dsh-comfy-floating button,.dsh-comfy-ui input,.dsh-comfy-floating input,
.dsh-comfy-ui textarea,.dsh-comfy-floating textarea{font-family:inherit}
.dsh-comfy-ui button,.dsh-comfy-floating button{transition:background-color .12s ease,border-color .12s ease;}
.dsh-comfy-ui button:hover:not(:disabled),.dsh-comfy-floating button:hover:not(:disabled){background:var(--cc-hover)!important}
/* Scope pointer/keyboard focus explicitly; host/UA focus must not paint a white ring. */
.dsh-comfy-ui button:is(:hover,:focus,:active),
.dsh-comfy-floating button:is(:hover,:focus,:active){border-color:var(--cc-button-border,var(--cc-border))!important;box-shadow:none!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus:not(:focus-visible),
.dsh-comfy-floating :is(button,input,textarea,summary):focus:not(:focus-visible){outline:none!important;box-shadow:none!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus,
.dsh-comfy-floating :is(button,input,textarea,summary):focus{outline-color:var(--cc-accent)!important;box-shadow:none!important}

.dsh-comfy-ui button:disabled,.dsh-comfy-floating button:disabled{opacity:.42;cursor:not-allowed!important}
.dsh-comfy-ui :is(button,input,textarea,summary):focus-visible,
.dsh-comfy-floating :is(button,input,textarea,summary):focus-visible,
.dsh-comfy-floating [role="option"]:focus-visible{outline:2px solid var(--cc-accent)!important;outline-offset:2px}
.dsh-comfy-ui input::placeholder,.dsh-comfy-floating input::placeholder,
.dsh-comfy-ui textarea::placeholder,.dsh-comfy-floating textarea::placeholder{color:var(--cc-muted);opacity:1}
.dsh-comfy-ui input[type="checkbox"],.dsh-comfy-floating input[type="checkbox"]{accent-color:var(--cc-accent);cursor:pointer}
.dsh-comfy-ui input[type="number"],.dsh-comfy-floating input[type="number"]{min-width:0}
.dsh-comfy-ui :is(input,textarea):hover:not(:disabled),.dsh-comfy-floating :is(input,textarea):hover:not(:disabled){border-color:var(--cc-muted)!important}
.dsh-comfy-ui :is(input,textarea):focus,.dsh-comfy-floating :is(input,textarea):focus{border-color:var(--cc-accent)!important}
.dsh-comfy-ui .cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:12px;
 width:100%;min-height:34px;min-width:0;max-width:100%;text-align:left;white-space:nowrap;}
.dsh-comfy-ui .cc-select-label{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.dsh-comfy-ui .cc-select-caret{flex:none;opacity:.75;font-size:11px;transition:transform .12s ease}
.dsh-comfy-ui .cc-select-trigger[aria-expanded="true"] .cc-select-caret{transform:rotate(180deg)}
.dsh-comfy-floating.cc-select-popup{display:flex;flex-direction:column;overflow:hidden;
 background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:9px!important;
 box-shadow:0 14px 42px rgba(0,0,0,.32);padding:5px;}
.dsh-comfy-floating .cc-option-list{min-height:0;overflow:auto;overscroll-behavior:contain;padding:2px;}
.dsh-comfy-floating .cc-option{display:block;width:100%;padding:8px 10px;border:0;border-radius:5px!important;
 background:transparent;color:var(--cc-text);font-size:12.5px;text-align:left;cursor:pointer;
 overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-height:32px;}
.dsh-comfy-floating .cc-option[aria-selected="true"]{background:var(--cc-accent-bg);color:var(--cc-accent-text);}
.dsh-comfy-floating .cc-option[data-active="true"]{outline:1px solid var(--cc-accent);outline-offset:-1px}
.dsh-comfy-floating .cc-option:hover{background:var(--cc-hover)!important}
.dsh-comfy-floating .cc-select-search{flex:none;width:100%;min-width:0;padding:8px 9px;margin-bottom:4px;
 background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px!important;font-size:12.5px;}
.dsh-comfy-ui .cc-details,.dsh-comfy-floating .cc-details{border-top:1px solid var(--cc-border);padding-top:10px;min-width:0}
.dsh-comfy-ui .cc-summary,.dsh-comfy-floating .cc-summary{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;
 cursor:pointer;list-style:none;color:var(--cc-text);background:var(--cc-control)}
.dsh-comfy-ui .cc-summary::-webkit-details-marker,.dsh-comfy-floating .cc-summary::-webkit-details-marker{display:none}
.dsh-comfy-ui .cc-summary::before,.dsh-comfy-floating .cc-summary::before{content:"›";display:inline-block;font-size:17px;line-height:1;
 transform:rotate(0);transition:transform .12s ease;color:var(--cc-muted)}
.dsh-comfy-ui details[open]>.cc-summary::before,.dsh-comfy-floating details[open]>.cc-summary::before{transform:rotate(90deg)}
.dsh-comfy-ui .cc-summary:hover,.dsh-comfy-floating .cc-summary:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-tab{background:transparent;border:0;border-bottom:2px solid transparent;color:var(--cc-muted)}
.dsh-comfy-ui .cc-tab[aria-selected="true"]{border-bottom-color:var(--cc-accent);color:var(--cc-text)}
.dsh-comfy-ui .cc-tab{border:0;border-radius:0;font-family:inherit;background:transparent}
.dsh-comfy-ui .cc-tab:hover{color:var(--cc-text);background:var(--cc-hover)!important}
.dsh-comfy-ui,.dsh-comfy-ui *, .dsh-comfy-floating,.dsh-comfy-floating *{scrollbar-width:thin;scrollbar-color:var(--cc-border) transparent}
.dsh-comfy-ui ::-webkit-scrollbar,.dsh-comfy-floating ::-webkit-scrollbar{width:8px;height:8px}
.dsh-comfy-ui ::-webkit-scrollbar-thumb,.dsh-comfy-floating ::-webkit-scrollbar-thumb{background:var(--cc-border);border-radius:10px}
.dsh-comfy-ui ::-webkit-scrollbar-track,.dsh-comfy-floating ::-webkit-scrollbar-track{background:transparent}
/* 工具提示跟随 DSH 主题变量；禁用系统原生 title 浮窗。 */
.dsh-comfy-ui .cc-icon-button{position:relative;display:inline-flex;align-items:center;justify-content:center;
 width:32px;height:32px;padding:0;border-radius:7px;flex:none;}
.dsh-comfy-ui .cc-icon-button[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;
 bottom:calc(100% + 9px);left:50%;transform:translate(-50%,3px);opacity:0;pointer-events:none;
 z-index:60;white-space:nowrap;padding:6px 9px;border:1px solid var(--cc-border);
 background:var(--cc-surface);color:var(--cc-text);box-shadow:0 6px 18px rgba(0,0,0,.3);
 font-size:12px;line-height:1.35;border-radius:6px;transition:opacity .12s ease,transform .12s ease;}
.dsh-comfy-ui .cc-icon-button[data-cc-tooltip]:is(:hover,:focus-visible)::after{opacity:1;transform:translate(-50%,0)}
.dsh-comfy-ui .cc-icon-button:disabled::after{display:none}
.dsh-comfy-ui .cc-icon-button[aria-disabled="true"]{opacity:.42;cursor:default}
.dsh-comfy-ui .cc-icon-button.cc-tooltip-right::after{left:auto;right:0;transform:translateY(3px)}
.dsh-comfy-ui .cc-icon-button.cc-tooltip-right:is(:hover,:focus-visible)::after{transform:translateY(0)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon) .cc-icon-stop{display:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon):not(:disabled):is(:hover,:focus-visible) .cc-icon-spinner{display:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-expand-btn,.cc-task-cancel-icon):not(:disabled):is(:hover,:focus-visible) .cc-icon-stop{display:inline-flex}
/* Portal dialogs are siblings of the console, so shared task styles cover both roots. */
:is(.dsh-comfy-ui,.dsh-comfy-floating) :is(.cc-icon-spinner,.cc-icon-stop){align-items:center;justify-content:center;flex:none;line-height:1;vertical-align:middle}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-icon-spinner{display:inline-flex;transform-origin:center;animation:cc-spin 1s linear infinite}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-icon-spinner>svg{display:block;flex:none}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-action{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0;max-width:100%;vertical-align:middle}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-action>button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;min-width:0;max-width:100%;width:auto;margin:0;line-height:1.4}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-primary{flex:0 1 auto;text-align:left}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-label{min-width:0;overflow-wrap:anywhere}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-primary:disabled[aria-busy="true"]{opacity:1;cursor:progress!important;color:var(--cc-muted)}
:is(.dsh-comfy-ui,.dsh-comfy-floating) .cc-task-stop{flex:none;white-space:nowrap}

@keyframes cc-spin{to{transform:rotate(360deg)}}
/* 左列宽度统一（2026-11-10）：画布与它下面每一块提示词卡片必须是同一个宽度，
   不论哪块内部塞了什么（长文件名、固定宽输入框、绝对定位下拉、图片比例），
   一律由左列宽度说了算。子元素统一 100% + border-box，横向溢出由
   cfy-grid 的 overflow-x: clip 兜底。 */
.dsh-comfy-ui .cfy-left{display:flex;flex-direction:column;align-items:stretch;width:100%;max-width:100%;min-width:0;box-sizing:border-box}
.dsh-comfy-ui .cfy-left>*{width:100%;max-width:100%;min-width:0;box-sizing:border-box;align-self:stretch;flex-shrink:0}
.dsh-comfy-ui .cc-prompt-layout{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:stretch}
.dsh-comfy-ui .cc-prompt-layout--chat{grid-template-columns:minmax(0,7fr) minmax(235px,3fr)}
.dsh-comfy-ui .cc-prompt-card{min-width:0}
.dsh-comfy-ui .cc-preview-tags{display:flex;flex-wrap:wrap;gap:6px;align-content:flex-start;min-height:100px;padding:9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control)}
.dsh-comfy-ui .cc-prompt-preview-surface{overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;white-space:normal}
.dsh-comfy-ui .cc-prompt-preview-surface .cc-preview-tags{min-height:0;padding:0;border:0;border-radius:0;background:transparent}
.dsh-comfy-ui .cc-preview-chip{display:inline-flex;align-items:center;max-width:100%;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;color:var(--cc-text);font-size:13px}
.dsh-comfy-ui .cc-preview-chip-text{padding:5px 7px;overflow-wrap:anywhere;white-space:pre-wrap;cursor:ew-resize;user-select:none;touch-action:pan-y;min-width:0}
.dsh-comfy-ui .cc-preview-chip-text[aria-disabled="true"]{cursor:default}
.dsh-comfy-ui .cc-preview-chip-text:focus-visible{outline:2px solid var(--cc-accent);outline-offset:1px}
.dsh-comfy-ui .cc-preview-chip small{color:var(--cc-muted);font-variant-numeric:tabular-nums}
.dsh-comfy-ui .cc-chip-remove{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;padding:4px;margin:0 3px 0 0;width:22px;height:24px;border:0;border-radius:4px;background:transparent;color:var(--cc-muted);cursor:pointer}
.dsh-comfy-ui .cc-chip-remove:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-prompt-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-ui .cc-prompt-input-shell{display:flex;flex-direction:column;min-width:0}
.dsh-comfy-ui .cc-prompt-textarea{min-height:90px;max-width:100%;resize:none!important;border-radius:6px 6px 0 0!important;margin:0;display:block}
.dsh-comfy-ui .cc-prompt-resize-handle{height:19px;min-height:19px;margin-top:-1px;border:1px solid var(--cc-border);
 border-radius:0 0 6px 6px;background:var(--cc-control);color:var(--cc-muted);display:flex;align-items:center;justify-content:center;
 cursor:ns-resize;touch-action:none;user-select:none;outline:none;transition:background .12s ease,color .12s ease,border-color .12s ease}
.dsh-comfy-ui .cc-prompt-resize-handle:hover,.dsh-comfy-ui .cc-prompt-resize-handle:focus-visible,
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"]{background:var(--cc-hover);color:var(--cc-text);border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-prompt-resize-handle .cc-resize-arrows{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle:is(:hover,:focus-visible)[data-dragging="false"] .cc-resize-grip{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle:is(:hover,:focus-visible)[data-dragging="false"] .cc-resize-arrows{display:inline-flex}
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"] .cc-resize-grip{display:none}
.dsh-comfy-ui .cc-prompt-resize-handle[data-dragging="true"] .cc-resize-arrows{display:inline-flex}
.dsh-comfy-ui .cc-resize-grip,.dsh-comfy-ui .cc-resize-arrows{align-items:center;justify-content:center;pointer-events:none}
.dsh-comfy-ui .cc-prompt-layout--chat{align-items:stretch}
.dsh-comfy-ui .cc-chat-panel{min-width:0;min-height:0;height:100%;max-height:none;overflow:hidden}
.dsh-comfy-ui .cc-chat-history{flex:1 1 auto;min-height:0;max-height:none;overflow:auto;overscroll-behavior:contain}
@media(max-width:850px){.dsh-comfy-ui .cc-prompt-layout--chat{grid-template-columns:minmax(0,1fr)}}
@media(prefers-reduced-motion:reduce){.dsh-comfy-ui *, .dsh-comfy-floating *{transition:none!important;animation:none!important}}
@media(max-width:640px){.dsh-comfy-ui .cc-field-select{flex:1 1 140px;min-width:0}}

.dsh-comfy-floating.cc-tag-completion {overflow-y:auto;overscroll-behavior:contain;background:var(--cc-surface);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px;box-shadow:0 6px 22px rgba(0,0,0,.22);padding:4px;box-sizing:border-box}
.dsh-comfy-floating .cc-tag-option {display:flex;flex-direction:column;gap:3px;width:100%;padding:7px 9px;text-align:left;border:0;border-radius:4px;background:transparent;color:var(--cc-text);font:inherit;cursor:pointer;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-tag-option[data-active="true"] {background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-tag-option small {font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-tag-heading,.dsh-comfy-ui .cc-dict-name {display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.dsh-comfy-floating .cc-tag-output,.dsh-comfy-ui .cc-tag-output {font-size:12px;overflow-wrap:anywhere;white-space:pre-wrap}
.dsh-comfy-ui .cc-dictionary{display:flex;flex-direction:column;gap:10px;min-width:0;container-type:inline-size}
.dsh-comfy-ui .cc-dict-toolbar,.dsh-comfy-floating .cc-dict-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:7px;min-width:0}
.dsh-comfy-ui .cc-dict-toolbar>button,.dsh-comfy-floating .cc-dict-toolbar>button,.dsh-comfy-ui .cc-dict-actions>button{width:auto;flex:0 0 auto;white-space:nowrap}
.dsh-comfy-ui .cc-dict-toolbar>.cc-select-trigger,.dsh-comfy-floating .cc-dict-toolbar>.cc-select-trigger{width:auto;flex:0 1 200px;min-width:0!important}
.dsh-comfy-ui .cc-dict-header-main,.dsh-comfy-ui .cc-dict-header-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;min-width:0}
.dsh-comfy-ui .cc-dict-header-actions{margin-left:auto}
.dsh-comfy-ui .cc-dict-header-actions>button{width:auto;flex:none;white-space:nowrap}
.dsh-comfy-ui .cc-dict-target{display:inline-flex;gap:3px;margin-left:7px}
.dsh-comfy-ui .cc-dict-target button{width:auto;white-space:nowrap}
.dsh-comfy-ui .cc-dict-target [aria-pressed="true"]{--cc-button-border:var(--cc-accent);background:var(--cc-accent-bg)!important;border-color:var(--cc-accent)!important}
.dsh-comfy-ui .cc-dict-convert{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:8px 12px;padding:10px 0;border-top:1px solid var(--cc-border);border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-convert .cc-dict-toolbar>input{width:100%;min-width:100px;flex:1 1 160px!important}
.dsh-comfy-ui .cc-dict-translation{grid-column:1/-1;display:flex;flex-direction:column;gap:6px;font-size:13px}
.dsh-comfy-ui .cc-dict-filterbar{display:grid;grid-template-columns:minmax(140px,1fr) minmax(130px,200px) auto;gap:8px;align-items:center;min-width:0}
.dsh-comfy-ui .cc-dict-filterbar>input,.dsh-comfy-ui .cc-dict-filterbar>.cc-select-trigger{width:100%;min-width:0!important}
.dsh-comfy-ui .cc-dict-check,.dsh-comfy-floating .cc-dict-check{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;font-size:12px;color:var(--cc-muted);width:auto}
.dsh-comfy-ui .cc-dict-results{display:grid;grid-template-columns:minmax(0,1fr);gap:0 18px;align-content:start;max-height:500px;overflow-y:auto;min-width:0;scrollbar-gutter:stable}
.dsh-comfy-ui .cc-dict-row{display:flex;gap:8px;align-items:center;min-width:0;padding:6px 0;border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-insert{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;text-align:left;background:transparent;color:var(--cc-text);border:0;border-radius:6px!important;cursor:pointer;padding:4px 6px;font:inherit}
.dsh-comfy-ui .cc-dict-insert:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-dict-primary,.dsh-comfy-ui .cc-dict-meta{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 10px;min-width:0;overflow-wrap:anywhere}
.dsh-comfy-ui .cc-dict-primary .cc-dict-name{display:inline-flex;gap:6px;justify-content:flex-start;font-size:13px}
.dsh-comfy-ui .cc-dict-primary>.cc-tag-output{color:var(--cc-muted)}
.dsh-comfy-ui .cc-dict-meta small{font-size:11px!important;line-height:1.4}
.dsh-comfy-ui .cc-dict-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;flex:0 0 auto;max-width:176px}
.dsh-comfy-ui .cc-dict-actions>button{padding:4px 7px!important;font-size:11px!important}
.dsh-comfy-floating .cc-dict-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}
.dsh-comfy-floating .cc-dict-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-floating .cc-dict-field>input{width:100%!important;min-width:0;max-width:100%}
.dsh-comfy-floating .cc-dict-options{display:flex;align-items:center;flex-wrap:wrap;gap:8px 14px}
.dsh-comfy-floating .cc-dict-options>.cc-select-trigger{width:auto;flex:1 1 160px;min-width:0!important}
.dsh-comfy-floating .cc-dict-json-import{display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0;font-size:12px}
.dsh-comfy-floating .cc-dict-json-import input{width:190px;max-width:100%;min-width:0}
.dsh-comfy-ui .cc-dictionary :is(input:not([type=checkbox]),.cc-select-trigger),.dsh-comfy-floating .cc-dict-field>input:not([type=file]){border-radius:6px!important}
.dsh-comfy-floating .cc-dict-db-path{display:block;overflow-wrap:anywhere;font-size:11px;color:var(--cc-muted);margin-top:4px}
@container (min-width:960px){.dsh-comfy-ui .cc-dict-results{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container (max-width:600px){.dsh-comfy-ui .cc-dict-convert{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(0,1fr) auto}.dsh-comfy-ui .cc-dict-filterbar>input{grid-column:1/-1}.dsh-comfy-ui .cc-dict-header-actions{margin-left:0}}
@container (max-width:400px){.dsh-comfy-ui .cc-dict-row{align-items:stretch;flex-direction:column}.dsh-comfy-ui .cc-dict-actions{max-width:none;justify-content:flex-start}}
@media(max-width:520px){.dsh-comfy-floating .cc-dict-form{grid-template-columns:minmax(0,1fr)}}

.dsh-comfy-ui .cc-dict-maintenance{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,1fr);gap:18px;align-items:start;min-width:0}
.dsh-comfy-ui .cc-dict-list-pane,.dsh-comfy-ui .cc-dict-edit-pane{display:flex;flex-direction:column;gap:12px;min-width:0}
.dsh-comfy-ui .cc-dict-edit-pane{padding-left:18px;border-left:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(100px,1fr) minmax(100px,150px)}
.dsh-comfy-ui .cc-dict-results{display:flex;flex-direction:column;max-height:none;overflow:visible}
.dsh-comfy-ui .cc-dict-table-head,.dsh-comfy-ui .cc-dict-tag-row{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(50px,.6fr);gap:10px;padding:10px 8px;align-items:center;text-align:left;overflow-wrap:anywhere}
.dsh-comfy-ui .cc-dict-table-head{font-size:12px;color:var(--cc-muted);border-bottom:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-tag-row{font:inherit;color:var(--cc-text);background:transparent;border:0;border-bottom:1px solid var(--cc-border);border-radius:5px;cursor:pointer;width:100%}
.dsh-comfy-ui .cc-dict-tag-row:hover{background:var(--cc-hover)}
.dsh-comfy-ui .cc-dict-tag-row[aria-pressed=true]{background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-dict-tag-row small{color:var(--cc-muted)}
.dsh-comfy-ui .cc-dict-pagination>small{margin-right:auto}
.dsh-comfy-ui .cc-dict-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.dsh-comfy-ui .cc-dict-field{display:flex;flex-direction:column;gap:5px;min-width:0}
.dsh-comfy-ui .cc-dict-field input{width:100%;min-width:0}
.dsh-comfy-ui .cc-dict-empty{display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:18px 0}
.dsh-comfy-ui .cc-dict-edit-actions,.dsh-comfy-floating .cc-dict-edit-actions{justify-content:flex-end;padding-top:12px;border-top:1px solid var(--cc-border)}
.dsh-comfy-ui .cc-dict-duplicates,.dsh-comfy-floating .cc-dict-duplicates{display:flex;flex-direction:column;gap:10px;padding:12px 0;overflow-wrap:anywhere}
@container(max-width:760px){.dsh-comfy-ui .cc-dict-maintenance{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-edit-pane{padding:14px 0 0;border-left:0;border-top:1px solid var(--cc-border)}}
@container(max-width:400px){.dsh-comfy-ui .cc-dict-form{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-filterbar{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-dict-table-head,.dsh-comfy-ui .cc-dict-tag-row{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.dsh-comfy-ui .cc-dict-table-head>span:last-child,.dsh-comfy-ui .cc-dict-tag-row>small{display:none}}
.dsh-comfy-ui .cc-model-dock{border:1px solid var(--cc-border);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:10px;min-width:0;container-type:inline-size;background:var(--cc-surface)}
.dsh-comfy-ui .cc-model-dock-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px;min-width:0}
.dsh-comfy-ui .cc-model-base-button{display:flex;align-items:flex-start;gap:9px;min-width:0;padding:7px 9px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:pointer;text-align:left;font:inherit}
.dsh-comfy-ui .cc-model-base-button:hover{border-color:var(--cc-accent);background:var(--cc-hover)}
.dsh-comfy-ui .cc-model-base-text{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;align-self:flex-start}.dsh-comfy-ui .cc-model-base-text strong{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-comfy-ui .cc-model-base-text small{font-size:10px;color:var(--cc-muted);line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-ui .cc-model-main-art{display:flex;flex-direction:column;gap:5px;flex:0 0 76px;min-width:0}
.dsh-comfy-ui .cc-model-dock-art{display:flex;align-items:center;justify-content:center;background:var(--cc-surface);color:var(--cc-muted);border-radius:5px;overflow:hidden;flex:none}
.dsh-comfy-ui .cc-model-dock-art--main{width:76px;height:100px}.dsh-comfy-ui .cc-model-dock-art--lora{width:126px;height:84px;aspect-ratio:3/2}
.dsh-comfy-ui .cc-model-dock-art>img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}
.dsh-comfy-ui .cc-model-profile-panel{display:flex;flex-direction:column;gap:4px;border:1px solid var(--cc-border);border-radius:7px;padding:7px 9px;min-width:0}
.dsh-comfy-ui .cc-model-profile-panel p{margin:0;font-size:10px;line-height:1.4;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-ui .cc-model-recommendation{display:flex;align-items:center;justify-content:space-between;gap:7px;flex-wrap:wrap;font-size:11px;line-height:1.5;color:var(--cc-muted)}
.dsh-comfy-ui .cc-model-recommendation>button{font-size:10px;padding:4px 7px;min-height:26px;flex:none}
.dsh-comfy-ui .cc-model-recommendation>div{display:flex;flex-direction:column;gap:2px;font-size:10px;min-width:0}
.dsh-comfy-ui .cc-model-components{display:flex;flex-wrap:wrap;align-items:flex-start;gap:9px;min-width:0;padding:9px;border:1px solid var(--cc-border);border-radius:8px;overflow:visible}
.dsh-comfy-ui .cc-model-add-component{display:flex;align-items:center;justify-content:center;width:62px;flex:0 0 62px;height:104px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:pointer}
.dsh-comfy-ui .cc-model-add-component:hover{border-color:var(--cc-accent);background:var(--cc-hover)}
.dsh-comfy-ui .cc-model-component{position:relative;display:flex;flex-direction:column;justify-content:center;gap:6px;flex:0 1 300px;width:300px;padding:9px;max-width:100%;min-height:104px;border:1px solid var(--cc-border);border-radius:7px;min-width:165px;background:var(--cc-control)}
.dsh-comfy-ui .cc-model-component>strong{font-size:10px;color:var(--cc-muted)}.dsh-comfy-ui .cc-model-encoder-fields{display:flex;flex-wrap:wrap;align-items:center;gap:8px;min-width:0}.dsh-comfy-ui .cc-model-encoder-fields>div{width:164px;max-width:100%;flex:1 1 150px}
.dsh-comfy-ui .cc-model-component-remove{position:absolute;top:3px;right:3px;width:20px;height:20px;display:flex;align-items:center;justify-content:center;border:0;border-radius:50%;background:var(--cc-surface);color:var(--cc-muted);cursor:pointer;padding:0!important}
.dsh-comfy-ui .cc-model-component-remove:hover{background:var(--cc-hover);color:var(--cc-text)}

.dsh-comfy-ui .cc-model-component-hint{align-self:center;color:var(--cc-muted);font-size:11px;line-height:1.5;min-width:160px}
.dsh-comfy-ui .cc-model-lora-chip{position:relative;display:grid;grid-template-columns:126px minmax(0,1fr);align-items:center;gap:10px;flex:0 1 300px;max-width:100%;min-width:0;padding:9px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font-size:11px}
.dsh-comfy-ui .cc-model-lora-open{border:0;background:transparent;color:var(--cc-text);padding:0;text-align:left;cursor:pointer;min-width:0}
.dsh-comfy-ui .cc-model-lora-controls{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;padding-right:9px}
.dsh-comfy-ui .cc-model-lora-controls>strong{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-ui .cc-model-lora-controls>.cc-select-trigger{min-width:0!important;width:100%;min-height:25px;height:25px;padding:2px 6px;font-size:10px}
.dsh-comfy-ui .cc-model-lora-controls>label{display:flex;gap:5px;align-items:center;color:var(--cc-muted);font-size:10px}
.dsh-comfy-ui .cc-model-lora-controls input{width:0;flex:1;min-width:0;border:1px solid var(--cc-border);border-radius:4px;background:var(--cc-surface);color:var(--cc-text);font:inherit;padding:3px 4px;height:25px}
.dsh-comfy-ui .cc-model-aux{display:flex;align-items:end;flex-wrap:wrap;gap:8px;min-width:0}.dsh-comfy-ui .cc-model-aux>.cc-model-aux-field{flex:0 1 170px}
.dsh-comfy-ui .cc-model-aux-field{display:flex;flex-direction:column;gap:4px;min-width:0}.dsh-comfy-ui .cc-model-aux-field>span{font-size:10px;color:var(--cc-muted)}.dsh-comfy-ui .cc-model-aux-field>.cc-select-trigger{min-width:0!important;max-width:100%;width:100%}

.dsh-comfy-ui .cc-generation-controls-summary{display:flex;align-items:center;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-generation-controls-dialog>div:nth-child(2),.dsh-comfy-floating .cc-post-dialog>div:nth-child(2){gap:10px!important;padding-top:14px!important}
.dsh-comfy-floating .cc-field-capsule{display:flex;align-items:stretch;gap:0;height:34px;min-width:0;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:11px}
.dsh-comfy-floating .cc-field-capsule>span:first-child{display:flex;align-items:center;padding:0 12px;border-right:1px solid var(--cc-border);color:var(--cc-muted);white-space:nowrap;flex:none}
.dsh-comfy-floating .cc-field-capsule>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;flex:1;min-width:0!important;height:32px;border:0!important;border-radius:0!important;background:transparent!important;padding:0 9px!important;font-size:12px!important}
.dsh-comfy-floating .cc-generation-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:8px;padding:0;min-width:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux{display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex:1;min-width:0;padding:0;border:0}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field{flex:0 0 auto;font-size:11px}
.dsh-comfy-floating .cc-generation-toolbar .cc-model-aux-field>.cc-select-trigger{min-width:130px!important}
.dsh-comfy-floating .cc-generation-controls{height:min(736px,calc(100dvh - 168px));display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);gap:0;min-height:0}
.dsh-comfy-floating .cc-control-catalog,.dsh-comfy-floating .cc-control-workspace{border:0;border-radius:0;min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain;background:transparent}
.dsh-comfy-floating .cc-control-catalog{display:flex;flex-direction:column;gap:2px;padding:6px 12px 6px 0;border-right:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-control-workspace{padding:10px 10px 0 14px}
.dsh-comfy-floating .cc-control-catalog>strong{font-size:12px;padding:8px 7px 6px;margin:0}
.dsh-comfy-floating .cc-control-category{font-size:11px;color:var(--cc-muted);padding:10px 7px 4px}
.dsh-comfy-floating .cc-control-add-row{display:flex;align-items:center;justify-content:space-between;text-align:left;gap:8px;width:100%;min-height:36px;padding:7px;border:0;border-radius:5px;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;cursor:pointer;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-control-add-row small{font-size:10px;flex:none;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-add-row:hover:enabled{background:var(--cc-hover)}
.dsh-comfy-floating .cc-control-add-row:disabled{opacity:.5;cursor:default}
.dsh-comfy-floating .cc-control-add-row.is-primary{color:var(--cc-accent-text)}
.dsh-comfy-floating .cc-control-heading{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;padding-bottom:12px}
.dsh-comfy-floating .cc-control-heading>span{font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-grid{display:flex;flex-wrap:wrap;align-items:flex-start;align-content:flex-start;gap:8px;padding:0;min-width:0}
.dsh-comfy-floating .cc-control-tile{position:relative;display:flex;flex-direction:column;align-items:stretch;gap:8px;flex:0 0 176px;max-width:190px;min-width:0;height:144px;min-height:144px;max-height:144px;padding:11px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);box-shadow:none;box-sizing:border-box}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{display:grid;grid-template-columns:92px minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:"art info" "art settings";gap:7px 8px;flex:0 0 276px;max-width:276px;height:144px;min-height:144px;max-height:144px}
.dsh-comfy-floating .cc-control-file{display:grid;grid-template-columns:84px minmax(0,1fr);align-items:start;gap:10px;min-width:0;background:transparent;border:0;color:var(--cc-text);padding:0;text-align:left;cursor:pointer;font:inherit}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-control-file,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-control-file{display:contents}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-model-dock-art{grid-area:art;align-self:stretch;width:92px;height:100%;min-height:96px}
.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-control-file>span:not(.cc-model-dock-art),.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-control-file>span:not(.cc-model-dock-art){grid-area:info;align-self:start}
.dsh-comfy-floating .cc-control-direct{display:flex;flex-direction:column;gap:8px;min-width:0;height:100%;justify-content:flex-start}
.dsh-comfy-floating .cc-control-direct>strong{font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-control-direct>.cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;min-width:0!important;height:56px!important;min-height:56px;border:1px solid var(--cc-border)!important;border-radius:6px!important;background:var(--cc-surface)!important;padding:6px 9px!important;white-space:normal;overflow:hidden}
.dsh-comfy-floating .cc-control-direct .cc-select-label{display:-webkit-box;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:normal;overflow-wrap:anywhere;line-height:1.35;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.dsh-comfy-floating .cc-control-direct .cc-select-caret{flex:none;align-self:center}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file{display:flex;flex-direction:column;align-items:stretch;gap:6px;min-height:0;padding:0;border:0;background:transparent}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-model-dock-art{display:none}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file>span,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file>span{gap:5px}
.dsh-comfy-floating .cc-control-tile[data-kind="vae"] .cc-control-file span>span,.dsh-comfy-floating .cc-control-tile[data-kind="clip"] .cc-control-file span>span{border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);padding:6px 7px;min-height:30px;display:flex;align-items:center}
.dsh-comfy-floating .cc-control-file>span{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-comfy-floating .cc-control-file strong{font-size:12px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-control-file span>span{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-control-file small{font-size:10px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-file .cc-model-dock-art{width:84px;height:84px;flex:none;display:flex;align-items:center;justify-content:center;border-radius:5px;overflow:hidden;background:var(--cc-surface);color:var(--cc-muted)}
.dsh-comfy-floating .cc-control-file .cc-model-dock-art img{width:100%;height:100%;object-fit:cover;object-position:center}
.dsh-comfy-floating .cc-control-lora-settings .cc-field-capsule>span:first-child{padding:0 8px;font-size:10px}
.dsh-comfy-floating .cc-control-lora-settings .cc-drag-number>button{flex-basis:22px}
.dsh-comfy-floating .cc-control-lora-settings{display:flex;flex-direction:column;grid-area:settings;align-self:end;gap:6px;width:100%;min-width:0}
.dsh-comfy-floating .cc-control-pill{width:100%;overflow:hidden}
.dsh-comfy-floating .cc-control-pill-label{color:var(--cc-text)}
.dsh-comfy-floating .cc-control-remove{position:absolute!important;right:-8px!important;top:-8px!important;width:20px!important;height:20px!important;border:1px solid var(--cc-border)!important;border-radius:50%!important;background:var(--cc-surface)!important;color:var(--cc-muted);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;z-index:3}
.dsh-comfy-floating .cc-control-remove:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-floating .cc-control-empty{display:flex;align-items:center;justify-content:center;min-height:180px;width:100%;font-size:12px;color:var(--cc-muted);line-height:1.8;text-align:center;padding:12px}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux{display:flex;flex-wrap:wrap;gap:10px;padding-top:12px;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux-field{display:flex;flex-direction:column;gap:5px;max-width:100%;min-width:0;flex:0 1 210px;font-size:11px}
.dsh-comfy-floating .cc-control-workspace .cc-model-aux-field>.cc-select-trigger{min-width:0!important;width:100%}
@media(max-width:700px){.dsh-comfy-floating .cc-generation-controls{grid-template-columns:145px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-control-catalog,.dsh-comfy-floating .cc-control-workspace{padding:8px}.dsh-comfy-floating .cc-control-tile{flex-basis:100%;max-width:none}.dsh-comfy-floating .cc-control-file .cc-model-dock-art{width:72px;height:48px}}
@media(max-width:460px){.dsh-comfy-floating .cc-generation-controls{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(90px,30%) minmax(0,1fr)}.dsh-comfy-floating .cc-control-catalog{display:flex;flex-flow:row wrap;align-content:flex-start}.dsh-comfy-floating .cc-control-catalog>strong,.dsh-comfy-floating .cc-control-category{width:100%;padding:0;margin:0}.dsh-comfy-floating .cc-control-add-row{width:auto;flex:1 1 95px;padding:7px}.dsh-comfy-floating .cc-control-lora-settings{width:65px}.dsh-comfy-floating .cc-control-tile{padding:10px 20px 10px 8px;gap:7px}}

@media(max-width:700px){.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{flex-shrink:1;max-width:100%}.dsh-comfy-floating .cc-control-lora-settings{width:100%}}
@media(max-width:460px){.dsh-comfy-floating .cc-control-tile[data-kind="lora"],.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"]{grid-template-columns:64px minmax(0,1fr);padding:10px 8px}.dsh-comfy-floating .cc-control-tile[data-kind="lora"] .cc-model-dock-art,.dsh-comfy-floating .cc-control-tile[data-kind="acceleration"] .cc-model-dock-art{width:64px}}

.dsh-comfy-floating .cc-model-add-options{display:flex;flex-direction:column;gap:8px}
@container(max-width:540px){.dsh-comfy-ui .cc-model-dock-main{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-floating .cc-model-library-dialog{max-height:calc(100dvh - 28px)!important}
.dsh-comfy-floating .cc-model-library{height:min(780px,calc(100dvh - 124px));min-height:0;display:flex;flex-direction:column;gap:10px;overflow:hidden}
.dsh-comfy-floating .cc-model-library-toolbar{display:grid;grid-template-columns:minmax(0,1.6fr) 34px minmax(140px,1fr) 78px;align-items:center;gap:8px;flex:none}
.dsh-comfy-floating .cc-model-path{width:100%;min-width:0;height:34px;padding:7px 10px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-text);font:12px ui-monospace,Consolas,monospace;text-overflow:ellipsis}
.dsh-comfy-floating .cc-model-library-search{display:flex;align-items:center;gap:7px;min-width:0;height:34px;padding:0 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-library-search input{width:100%;min-width:0;height:30px;border:0;outline:0;background:transparent;color:var(--cc-text);font:inherit;font-size:12px}
.dsh-comfy-floating .cc-library-icon{position:relative;display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;padding:0!important;flex:none;border-radius:6px}
.dsh-comfy-floating .cc-model-refresh{width:78px;gap:6px}
.dsh-comfy-floating .cc-library-icon[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 7px);right:0;z-index:60;white-space:nowrap;padding:6px 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-surface);color:var(--cc-text);font-size:12px;line-height:1.35;box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;pointer-events:none}
.dsh-comfy-floating .cc-library-icon[data-cc-tooltip]:not(:disabled):is(:hover,:focus-visible)::after{opacity:1}
.dsh-comfy-floating .cc-model-library-body{display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);gap:12px;min-height:0;flex:1}
.dsh-comfy-floating .cc-model-tree,.dsh-comfy-floating .cc-model-inspector{min-width:0;min-height:0;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-surface);overflow:hidden}
.dsh-comfy-floating .cc-model-tree{display:flex;flex-direction:column}
.dsh-comfy-floating .cc-model-tree-nav{position:relative;display:flex;align-items:center;gap:7px;flex:none;padding:7px;border-bottom:1px solid var(--cc-border);z-index:2}
.dsh-comfy-floating .cc-model-tree-nav strong{font-size:12px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-model-tree-nav .cc-library-icon:first-child::after{right:auto;left:0}
.dsh-comfy-floating .cc-model-tree-scroll{overflow:auto;min-height:0;flex:1;padding:6px;overscroll-behavior:contain}
.dsh-comfy-floating .cc-model-tree-row{min-height:36px;display:flex;align-items:center;gap:8px;border:1px solid transparent;border-radius:5px;padding:7px;color:var(--cc-text);background:transparent;font:inherit;font-size:12px;min-width:0;user-select:none}
.dsh-comfy-floating button.cc-model-tree-row{width:100%;cursor:pointer;text-align:left}
.dsh-comfy-floating .cc-model-tree-row:hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-model-tree-row.is-selected{background:var(--cc-accent-bg);border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-tree-row.is-drop{outline:1px solid var(--cc-accent);background:var(--cc-accent-bg)}
.dsh-comfy-floating .cc-model-tree-name{display:flex;flex-direction:column;gap:2px;flex:1;min-width:0}
.dsh-comfy-floating .cc-model-tree-name>span,.dsh-comfy-floating .cc-model-tree-name>small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-model-tree-name>small{color:var(--cc-muted);font-size:10px}
.dsh-comfy-floating .cc-model-tree-meta{color:var(--cc-muted);font-size:10px;flex:none}
.dsh-comfy-floating .cc-model-tree-icon{width:16px;height:16px;display:inline-flex;align-items:center;justify-content:center;color:var(--cc-muted);flex:none}
.dsh-comfy-floating .cc-model-folder-row>.cc-model-tree-icon{color:var(--cc-accent)}
.dsh-comfy-floating .cc-model-library-loading,.dsh-comfy-floating .cc-model-library-empty{display:flex;align-items:center;justify-content:center;gap:8px;color:var(--cc-muted);font-size:12px;padding:24px 10px}
.dsh-comfy-floating .cc-model-library-message{font-size:12px;overflow-wrap:anywhere;max-height:70px;overflow:auto;flex:none}
.dsh-comfy-floating .cc-model-new-folder{display:flex;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--cc-border);flex:none;min-width:0}
.dsh-comfy-floating .cc-model-new-folder input{width:0;flex:1;min-width:0;height:32px;background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:6px;padding:6px 8px;font:inherit;font-size:12px}
.dsh-comfy-floating .cc-model-new-folder button{white-space:nowrap}
.dsh-comfy-floating .cc-model-inspector{display:flex;flex-direction:column;overflow:auto;padding:14px;gap:12px;overscroll-behavior:contain}
.dsh-comfy-floating .cc-model-preview-gallery{display:flex;flex-direction:column;gap:8px;flex:none;min-width:0}
.dsh-comfy-floating .cc-model-preview-controls{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px}
.dsh-comfy-floating .cc-model-local-preview,.dsh-comfy-floating .cc-model-preview-placeholder{height:clamp(280px,46dvh,460px);min-height:280px;flex:none;border-radius:8px;overflow:hidden;background:var(--cc-control)}
.dsh-comfy-floating .cc-model-local-preview img{width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-model-preview-placeholder{border:1px dashed var(--cc-border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--cc-muted);font-size:12px}
.dsh-comfy-floating .cc-model-preview-thumbnails{display:flex;gap:7px;overflow-x:auto;padding:2px;min-width:0}
.dsh-comfy-floating .cc-model-preview-thumbnails>button{flex:none;width:52px;height:60px;padding:0;border:1px solid var(--cc-border);border-radius:6px;overflow:hidden;background:var(--cc-control);cursor:pointer}
.dsh-comfy-floating .cc-model-preview-thumbnails>button[aria-pressed=true]{border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-preview-thumbnails img{width:100%;height:100%;object-fit:cover;display:block}
.dsh-comfy-floating .cc-model-inspector-title{display:flex;flex-direction:column;gap:4px;min-width:0}
.dsh-comfy-floating .cc-model-inspector-title strong{font-size:16px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-inspector-title small{color:var(--cc-muted);font-size:11px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-info-grid{display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px 12px;font-size:12px;margin:0}
.dsh-comfy-floating .cc-model-info-grid dt{color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-info-grid dd{margin:0;overflow-wrap:anywhere;min-width:0}
.dsh-comfy-floating .cc-model-trigger-words{display:flex;gap:4px;flex-wrap:wrap;min-width:0}
.dsh-comfy-floating .cc-model-trigger-words span{padding:3px 6px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-control);font-size:11px;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-model-source-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.dsh-comfy-floating .cc-model-source-line a{color:var(--cc-accent);text-decoration:none}
.dsh-comfy-floating .cc-model-source-line a:hover{text-decoration:underline}
.dsh-comfy-floating .cc-model-inspector-actions{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}
.dsh-comfy-floating .cc-model-library-hint{font-size:10px;color:var(--cc-muted);flex:none}
@media(max-width:820px){.dsh-comfy-ui .cc-model-dock-main{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-model-aux{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-model-library-body{grid-template-columns:minmax(180px,36fr) minmax(0,64fr)}}
@media(max-width:600px){.dsh-comfy-floating .cc-model-library-toolbar{grid-template-columns:minmax(0,1fr) 78px}.dsh-comfy-floating .cc-model-library-body{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(160px,32fr) minmax(0,68fr)}.dsh-comfy-floating .cc-model-local-preview,.dsh-comfy-floating .cc-model-preview-placeholder{height:300px;min-height:300px}.dsh-comfy-floating .cc-model-inspector{padding:10px}.dsh-comfy-floating .cc-model-info-grid{grid-template-columns:70px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-model-library-hint{display:none}}

/* v0.6.33: category pins, indented tree and masonry model gallery. */
.dsh-comfy-floating .cc-model-tree-root{flex:1;min-width:0;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border:0;background:transparent;color:var(--cc-text);font:inherit;font-size:12px;font-weight:600;padding:5px;cursor:pointer}
.dsh-comfy-floating .cc-model-catalog-row{display:flex;align-items:center;gap:5px;min-width:0}
.dsh-comfy-floating .cc-model-catalog-row>.cc-model-tree-row{min-width:0;flex:1}
.dsh-comfy-floating .cc-model-pin{width:auto;flex:none;min-width:40px;height:32px;padding:4px 6px;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);font:inherit;font-size:11px;font-variant-numeric:tabular-nums;cursor:pointer}
.dsh-comfy-floating .cc-model-catalog-open{width:32px;height:32px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);cursor:pointer}
.dsh-comfy-floating .cc-model-pin:hover,.dsh-comfy-floating .cc-model-catalog-open:hover{background:var(--cc-hover)}
.dsh-comfy-floating .cc-model-pin[aria-pressed=true]{color:var(--cc-accent-text);background:var(--cc-accent-bg);border-color:var(--cc-accent);--cc-button-border:var(--cc-accent)}
.dsh-comfy-floating .cc-model-folder-empty{display:block;padding-block:7px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-model-tree-indent{min-width:0}
.dsh-comfy-floating .cc-model-preview-gallery{height:clamp(220px,38dvh,360px);min-height:0;overflow:hidden;flex:none}
.dsh-comfy-floating .cc-model-preview-viewport{height:100%;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;padding:2px;box-sizing:border-box;outline:none}
.dsh-comfy-floating .cc-model-preview-viewport:focus-visible{outline:1px solid var(--cc-accent);outline-offset:-1px;border-radius:6px}
.dsh-comfy-floating .cc-model-preview-masonry{position:relative;min-width:0;width:100%}
.dsh-comfy-floating .cc-model-preview-masonry .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-model-preview-tile{display:block;width:100%;box-sizing:border-box;padding:0;margin:0;overflow:hidden;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);cursor:zoom-in;line-height:0}
.dsh-comfy-floating .cc-model-preview-tile img{display:block;width:100%;height:100%;object-fit:contain}
.dsh-comfy-floating .cc-model-preview-tile:disabled{opacity:1;cursor:default!important}
.dsh-comfy-floating .cc-model-preview-failed{height:100%;display:flex;align-items:center;justify-content:center;padding:12px;font-size:12px;line-height:1.5;color:var(--cc-muted);box-sizing:border-box}
.dsh-comfy-floating .cc-model-preview-viewport>.cc-model-preview-placeholder{height:100%;min-height:0}
@media(max-width:600px){.dsh-comfy-floating .cc-model-preview-gallery{height:clamp(180px,30dvh,280px)}}

/* v0.6.11: polished pinned navigation + output browser */
.dsh-comfy-ui .cc-sticky-shell{position:sticky;top:-14px;z-index:120;display:flex;flex-direction:column;gap:9px;background:color-mix(in srgb,var(--cc-surface) 96%,transparent);margin:-14px -18px 0;padding:14px 18px 0;border-bottom:1px solid var(--cc-border);box-shadow:0 7px 18px rgba(0,0,0,.13);flex-shrink:0}
.dsh-comfy-ui .cc-output-page{position:relative;gap:10px;min-width:0}
.dsh-comfy-ui .cc-output-sticky{position:sticky;z-index:110;display:flex;flex-direction:column;gap:8px;padding:9px;border:1px solid var(--cc-border);border-radius:10px;background:color-mix(in srgb,var(--cc-surface) 97%,transparent);box-shadow:0 7px 22px rgba(0,0,0,.16)}
.dsh-comfy-ui .cc-output-toolbar{display:flex;align-items:center;flex-wrap:nowrap;gap:7px;min-height:34px;min-width:0;overflow-x:auto;scrollbar-width:none}
.dsh-comfy-ui .cc-output-toolbar::-webkit-scrollbar{display:none}
.dsh-comfy-ui .cc-output-view-group{display:inline-flex;align-items:center;gap:3px;padding:3px;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-control)}
.dsh-comfy-ui .cc-output-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:31px;height:31px;flex:none;border:1px solid transparent;border-radius:6px;background:transparent;color:var(--cc-muted);cursor:pointer;transition:background .12s ease,border-color .12s ease,color .12s ease}
.dsh-comfy-ui .cc-output-icon-btn:hover{color:var(--cc-text);background:var(--cc-hover)}
.dsh-comfy-ui .cc-output-icon-btn[aria-pressed=true]{color:var(--cc-accent-text);border-color:var(--cc-accent);background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-output-icon-btn:disabled{opacity:.48;cursor:wait}
.dsh-comfy-ui .cc-output-icon-btn[data-cc-tooltip]::after{top:calc(100% + 7px);bottom:auto;z-index:190}
.dsh-comfy-ui .cc-output-icon-btn:is(:hover,:focus-visible){z-index:5}
.dsh-comfy-ui .cc-output-refresh{margin-left:2px;border:1px solid var(--cc-border);background:var(--cc-control)}
.dsh-comfy-ui .cc-output-refresh-text{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:29px;margin-left:auto;padding:0 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease,color .12s ease}
.dsh-comfy-ui .cc-output-refresh-text:is(:hover,:focus-visible){border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-ui .cc-output-refresh-text:disabled{opacity:.6;cursor:progress}
.dsh-comfy-ui .cc-output-refresh-text+.cc-output-counter{margin-left:0}
/* 0.7.165：历史页批量删除的工具栏按钮与勾选圈。样式比照「刷新」文字按钮，
   danger 变体单独一档，别让「确认删除」看起来和「刷新」同权重。 */
.dsh-comfy-ui .cc-output-mode-btn{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;height:29px;padding:0 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:11.5px;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease,color .12s ease}
.dsh-comfy-ui .cc-output-mode-btn:is(:hover,:focus-visible){border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-ui .cc-output-mode-btn:disabled{opacity:.6;cursor:progress}
.dsh-comfy-ui .cc-output-mode-btn.is-danger{border-color:rgba(220,86,86,.55);background:rgba(220,86,86,.12);color:#ff9494}
.dsh-comfy-ui .cc-output-mode-btn.is-danger:is(:hover,:focus-visible){border-color:#e05757;background:rgba(220,86,86,.22);color:#ffb6b6}
.dsh-comfy-ui .cc-output-check{position:absolute;left:8px;top:8px;z-index:3;display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:8px;background:rgba(12,14,18,.72);color:#cfd6e6;box-shadow:0 2px 8px rgba(0,0,0,.35);pointer-events:none}
.dsh-comfy-ui .cc-output-card.is-selected{border-color:var(--cc-accent);outline:2px solid var(--cc-accent);outline-offset:-2px}
.dsh-comfy-ui .cc-output-card.is-selected .cc-output-check{background:var(--cc-accent);color:var(--cc-accent-text)}
.dsh-comfy-ui .cc-output-counter{margin-left:auto;flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;background:var(--cc-control);font-size:10px;color:var(--cc-muted);white-space:nowrap}
.dsh-comfy-ui .cc-output-quality{flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;margin-left:2px;min-width:0;padding:3px 4px 3px 7px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);font-size:10px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-quality-label{white-space:nowrap;margin-right:1px}
.dsh-comfy-ui .cc-output-quality-btn{height:25px;padding:0 7px;border:1px solid transparent;border-radius:5px;background:transparent;color:var(--cc-muted);font:inherit;font-size:10px;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-quality-btn:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-output-quality-btn[aria-pressed=true]{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text)}
.dsh-comfy-ui .cc-output-control-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch;min-width:0}
.dsh-comfy-ui .cc-output-search-field,.dsh-comfy-ui .cc-output-sort-field,.dsh-comfy-ui .cc-output-control-button{box-sizing:border-box;display:flex;align-items:center;gap:7px;min-width:0;width:100%;height:40px;padding:0 10px;border:1px solid var(--cc-border);border-radius:8px;background:var(--cc-control);color:var(--cc-text);font:inherit;font-size:12px;transition:border-color .12s ease,background .12s ease}
.dsh-comfy-ui .cc-output-search-field:focus-within,.dsh-comfy-ui .cc-output-sort-field:focus-within{border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-output-search-field input,.dsh-comfy-ui .cc-output-sort-field select{flex:1;min-width:0;width:100%;height:100%;border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;color:inherit;font:inherit;font-size:12px}
.dsh-comfy-ui .cc-output-search-field input[type=search]{appearance:none!important;-webkit-appearance:none!important;border-radius:0!important;padding:0!important}
.dsh-comfy-ui .cc-output-search-field input[type=search]:focus,.dsh-comfy-ui .cc-output-search-field input[type=search]:focus-visible{outline:none!important;box-shadow:none!important;border:0!important}
.dsh-comfy-ui .cc-output-search-field input[type=search]::-webkit-search-decoration,.dsh-comfy-ui .cc-output-search-field input[type=search]::-webkit-search-cancel-button,.dsh-comfy-ui .cc-output-filter-input[type=search]::-webkit-search-decoration,.dsh-comfy-ui .cc-output-filter-input[type=search]::-webkit-search-cancel-button{-webkit-appearance:none;display:none}
.dsh-comfy-ui .cc-output-search-field:focus-within{border-color:var(--cc-accent);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc-accent) 34%,transparent)}
.dsh-comfy-ui .cc-output-search-clear{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;flex:none;border:0;border-radius:5px;background:transparent;color:var(--cc-muted);cursor:pointer;padding:0}
.dsh-comfy-ui .cc-output-search-clear:hover{background:var(--cc-hover);color:var(--cc-text)}
.dsh-comfy-ui .cc-output-sort-field .cc-select-trigger{flex:1;min-width:0;width:100%;max-width:100%;height:36px;padding:5px 2px;border:0;background:transparent}
.dsh-comfy-ui .cc-output-sort-field button{max-width:100%;min-width:0}
.dsh-comfy-ui .cc-output-control-button{justify-content:center;cursor:pointer}
.dsh-comfy-ui .cc-output-control-button:hover,.dsh-comfy-ui .cc-output-control-button[aria-expanded=true]{border-color:var(--cc-accent);background:color-mix(in srgb,var(--cc-accent-bg) 60%,var(--cc-control))}
.dsh-comfy-ui .cc-output-count-bubble{border-radius:99px;padding:2px 6px;background:var(--cc-accent-bg);color:var(--cc-accent-text);font-size:10px}
.dsh-comfy-ui .cc-output-filter-anchor{position:relative;min-width:0}
.dsh-comfy-ui .cc-output-filter-flyout{position:absolute;top:100%;left:50%;transform:translateX(-50%);width:min(760px,calc(100vw - 48px));padding-top:7px;z-index:180;background:transparent}
.dsh-comfy-ui .cc-output-filter-panel{max-height:min(70dvh,700px);overflow-y:auto;overscroll-behavior:contain;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:12px;box-shadow:0 20px 55px rgba(0,0,0,.5);min-width:0}
.dsh-comfy-ui .cc-output-filter-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 13px;border-bottom:1px solid var(--cc-border);background:color-mix(in srgb,var(--cc-surface) 96%,transparent);min-width:0}
.dsh-comfy-ui .cc-output-filter-heading,.dsh-comfy-ui .cc-output-filter-head-actions{display:flex;align-items:center;gap:8px;min-width:0;flex-wrap:wrap}
.dsh-comfy-ui .cc-output-filter-heading strong{font-size:13px;font-weight:650}
.dsh-comfy-ui .cc-output-filter-count{padding:2px 7px;border:1px solid color-mix(in srgb,var(--cc-accent) 65%,var(--cc-border));border-radius:99px;font-size:9px;color:var(--cc-accent-text);background:var(--cc-accent-bg)}
.dsh-comfy-ui .cc-output-filter-link{border:0;background:transparent;color:var(--cc-muted);font-size:10px;padding:5px 7px;border-radius:5px;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-filter-link:hover{color:var(--cc-text);background:var(--cc-hover)}
.dsh-comfy-ui .cc-output-filter-body{padding:11px 13px;display:grid;gap:11px;min-width:0}
.dsh-comfy-ui .cc-output-filter-search{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:10px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-input{display:block;width:100%;min-width:0;height:36px;padding:0 10px;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:7px;color:var(--cc-text);font-size:11px;outline:none;box-shadow:none;box-sizing:border-box;appearance:none;-webkit-appearance:none}
.dsh-comfy-ui .cc-output-filter-input:focus-visible{outline:none;box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--cc-accent) 34%,transparent)}
.dsh-comfy-ui .cc-output-filter-input:focus{border-color:var(--cc-accent)}
.dsh-comfy-ui .cc-output-filter-group{display:grid;grid-template-columns:104px minmax(0,1fr);align-items:start;gap:10px;border-top:1px solid var(--cc-border);padding-top:10px;min-width:0}
.dsh-comfy-ui .cc-output-filter-group-title{display:flex;flex-direction:column;gap:3px;padding-top:5px}
.dsh-comfy-ui .cc-output-filter-group-title strong{font-size:11px;font-weight:650;color:var(--cc-text)}
.dsh-comfy-ui .cc-output-filter-group-title small{font-size:9px;line-height:1.45;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-stack{display:flex;flex-direction:column;gap:8px;min-width:0}
.dsh-comfy-ui .cc-output-filter-chips{display:flex;align-items:center;flex-wrap:wrap;gap:5px;min-width:0}
.dsh-comfy-ui .cc-output-filter-chip{min-height:30px;border:1px solid var(--cc-border);background:var(--cc-control);color:var(--cc-muted);border-radius:7px;padding:5px 9px;font-size:10px;line-height:1.25;cursor:pointer;white-space:nowrap}
.dsh-comfy-ui .cc-output-filter-chip:hover{border-color:color-mix(in srgb,var(--cc-accent) 48%,var(--cc-border));color:var(--cc-text)}
.dsh-comfy-ui .cc-output-filter-chip[aria-pressed=true]{border-color:var(--cc-accent);background:var(--cc-accent-bg);color:var(--cc-accent-text);font-weight:650}
.dsh-comfy-ui .cc-output-filter-chip:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-ui .cc-output-filter-custom{display:grid;grid-template-columns:minmax(120px,1fr) auto minmax(120px,1fr);align-items:end;gap:8px;padding:9px;background:color-mix(in srgb,var(--cc-control) 75%,transparent);border:1px solid var(--cc-border);border-radius:8px;min-width:0}
.dsh-comfy-ui .cc-output-filter-custom label{display:flex;flex-direction:column;gap:5px;color:var(--cc-muted);font-size:9px;min-width:0}
.dsh-comfy-ui .cc-output-filter-custom input{width:100%;min-width:0;height:33px;padding:0 8px;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:6px;color:var(--cc-text);font-size:10px;color-scheme:var(--cc-scheme);box-sizing:border-box}
.dsh-comfy-ui .cc-output-filter-range-sep{padding-bottom:9px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-hint{grid-column:1/-1;font-size:9px;color:var(--cc-muted)}
.dsh-comfy-ui .cc-output-filter-error{font-size:10px;color:var(--cc-bad,#e57b7b)}
.dsh-comfy-ui .cc-output-filter-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:9px;color:var(--cc-muted);padding-top:2px}
.dsh-comfy-ui .cc-output-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:9px;min-width:0}
.dsh-comfy-ui .cc-output-masonry{position:relative;min-width:0;width:100%}
.dsh-comfy-ui .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-ui .cc-output-card{position:relative;break-inside:avoid;margin:0;border:1px solid var(--cc-border);border-radius:9px;background:var(--cc-control);overflow:hidden;cursor:pointer;isolation:isolate;transition:border-color .12s ease,box-shadow .12s ease,background .12s ease}
.dsh-comfy-ui .cc-output-card:hover,.dsh-comfy-ui .cc-output-card:focus-visible{border-color:var(--cc-accent);box-shadow:0 7px 20px rgba(0,0,0,.25);outline:none}
.dsh-comfy-ui .cc-output-card img{display:block;width:100%;height:auto;background:var(--cc-control)}
.dsh-comfy-ui .cc-output-grid .cc-output-card img{aspect-ratio:1/1;object-fit:cover}
.dsh-comfy-ui .cc-output-card-meta{position:absolute;left:0;right:0;bottom:0;display:flex;flex-direction:column;gap:2px;min-width:0;padding:24px 8px 7px;color:#fff;background:linear-gradient(180deg,transparent,rgba(0,0,0,.78));pointer-events:none}
.dsh-comfy-ui .cc-output-card-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;font-weight:600;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.dsh-comfy-ui .cc-output-card-sub{display:flex;justify-content:space-between;align-items:center;gap:7px;min-width:0;font-size:9px;color:rgba(255,255,255,.78)}
.dsh-comfy-ui .cc-output-card-state{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.dsh-comfy-ui .cc-output-card-state::before{content:"";width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.9}
/* 0.7.130：历史卡片右上角按钮组（打开位置 / 删除）。平时隐藏，悬停或键盘聚焦才出现，
   避免盖住画面；触屏没有 hover，所以用 @media (hover:none) 常显。 */
.dsh-comfy-ui .cc-output-card-actions{position:absolute;top:8px;right:8px;z-index:3;display:flex;gap:6px;opacity:0;transition:opacity .14s ease}
.dsh-comfy-ui .cc-output-card:hover .cc-output-card-actions,.dsh-comfy-ui .cc-output-card:focus-within .cc-output-card-actions{opacity:1}
.dsh-comfy-ui .cc-output-card-act{display:inline-flex;align-items:center;justify-content:center;width:29px;height:29px;padding:0;border:1px solid rgba(255,255,255,.22);border-radius:7px;background:rgba(14,16,20,.6);color:#fff;cursor:pointer;transition:background .14s ease,border-color .14s ease,transform .06s ease;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.dsh-comfy-ui .cc-output-card-act:hover,.dsh-comfy-ui .cc-output-card-act:focus-visible{background:var(--cc-accent);border-color:var(--cc-accent);color:#fff}
.dsh-comfy-ui .cc-output-card-act.is-danger:hover,.dsh-comfy-ui .cc-output-card-act.is-danger:focus-visible{background:var(--cc-bad,#c0392b);border-color:var(--cc-bad,#c0392b);color:#fff}
.dsh-comfy-ui .cc-output-card-act:active{transform:translateY(1px)}
.dsh-comfy-ui .cc-output-card-act:focus-visible{opacity:1;outline:2px solid var(--cc-accent);outline-offset:2px}
@media (hover:none){.dsh-comfy-ui .cc-output-card-actions{opacity:1}}
.dsh-comfy-ui .cc-output-empty{display:flex;min-height:190px;align-items:center;justify-content:center;flex-direction:column;gap:8px;border:1px dashed var(--cc-border);border-radius:10px;color:var(--cc-muted);text-align:center;padding:20px}
.dsh-comfy-ui .cc-output-empty strong{font-size:12px;color:var(--cc-text)}
.dsh-comfy-ui .cc-output-load-sentinel{display:flex;justify-content:center;align-items:center;gap:8px;min-height:34px;padding:10px;color:var(--cc-muted);font-size:10px}
.dsh-comfy-ui .cc-output-load-sentinel::before{content:"";width:12px;height:12px;border:2px solid var(--cc-border);border-top-color:var(--cc-accent);border-radius:50%;animation:cc-spin .75s linear infinite}

.dsh-comfy-ui .cc-preview-plane{position:absolute;inset:8px}
.dsh-comfy-ui button.cc-main-preview{padding:0;display:block;color:inherit;cursor:zoom-in}
.dsh-comfy-ui .cc-latent-frame{border-style:dashed}
.dsh-comfy-ui .cc-latent-frame>span{position:absolute;white-space:nowrap;color:var(--cc-text);background:var(--cc-control);font-size:11px;line-height:16px;padding:0 3px;border-radius:3px}
.dsh-comfy-ui .cc-latent-width{left:50%;top:-21px;transform:translateX(-50%)}
.dsh-comfy-ui .cc-latent-height{left:-14px;top:50%;transform:translate(-50%,-50%) rotate(-90deg)}
.dsh-comfy-ui .cc-image-advanced>.cc-generate-open{border-radius:6px!important}
.dsh-comfy-floating .cc-post-bridge-prompt{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:12px;border:1px solid rgba(210,140,40,.5);border-radius:8px;background:rgba(210,140,40,.1);margin-bottom:12px}
.dsh-comfy-floating .cc-post-bridge-prompt>div:first-child{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1 1 420px;font-size:12px;line-height:1.55}
.dsh-comfy-floating .cc-post-bridge-prompt>div:first-child>strong{color:#e0a04a;font-size:13px}
.dsh-comfy-floating .cc-post-bridge-actions{display:flex;gap:7px;flex-wrap:wrap;flex:none}
.dsh-comfy-floating .cc-post-bridge-actions>button{width:auto;white-space:nowrap;min-height:32px}
.dsh-comfy-floating .cc-post-toolbar{display:flex;align-items:center;flex-wrap:wrap;gap:10px;padding:0;min-width:0}
.dsh-comfy-floating .cc-post-toolbar>small{flex:1 1 260px;font-size:11px}
.dsh-comfy-floating .cc-post-toolbar .cc-task-action{flex:none;display:flex;align-items:center;gap:6px}
.dsh-comfy-floating .cc-post-toolbar .cc-task-action button{min-height:34px}
.dsh-comfy-floating .cc-post-save-field{flex:0 0 auto;width:auto;max-width:100%}
.dsh-comfy-floating .cc-post-save-field>.cc-select-trigger{flex:0 1 auto!important;width:auto!important;min-width:0!important;max-width:240px}

.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]{position:relative}
.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 6px);left:0;width:260px;padding:7px 9px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-surface);color:var(--cc-text);font-size:11px;line-height:1.45;white-space:normal;box-shadow:0 6px 18px rgba(0,0,0,.28);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .12s;z-index:40}
.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:hover::after,.dsh-comfy-floating .cc-post-save-field[data-cc-tooltip]:focus-within::after{opacity:1;visibility:visible}.dsh-comfy-floating .cc-post-notebook{display:grid;grid-template-columns:minmax(230px,29fr) minmax(0,71fr);height:min(736px,calc(100dvh - 212px));gap:0;min-height:0}
.dsh-comfy-floating .cc-post-add{display:flex;flex-direction:column;gap:0;overflow:auto;border:0;border-right:1px solid var(--cc-border);border-radius:0;background:transparent;padding:0 12px 0 0;min-width:0;min-height:0}
.dsh-comfy-floating .cc-post-side-section{display:flex;flex-direction:column;gap:2px;min-width:0;min-height:0;overflow:auto;padding:6px}
.dsh-comfy-floating .cc-post-side-section>strong{font-size:12px;padding:8px 7px 5px;color:var(--cc-text);flex:none}
.dsh-comfy-floating .cc-post-cells{display:flex;flex-direction:column;gap:10px;border:0;border-radius:0;background:transparent;overflow:auto;min-width:0;min-height:0;padding:10px 10px 10px 14px}
.dsh-comfy-floating .cc-post-cell{flex:none;border:1px solid var(--cc-border)!important;border-left:3px solid var(--cc-accent-bg)!important;border-radius:8px!important;padding:0;margin:0;min-width:0;background:var(--cc-surface)!important;box-shadow:none;overflow:hidden}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-fields{opacity:.55}
.dsh-comfy-floating .cc-post-cell-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:7px 9px;border-bottom:1px solid var(--cc-border);background:var(--cc-control)}
.dsh-comfy-floating .cc-post-cell-index{font:600 10px ui-monospace,Consolas,monospace;color:var(--cc-accent-text);background:var(--cc-accent-bg);border-radius:4px;padding:2px 6px;min-width:26px;text-align:center;flex:none}
.dsh-comfy-floating .cc-post-cell[data-disabled="true"] .cc-post-cell-index{color:var(--cc-muted);background:var(--cc-border)}
.dsh-comfy-floating .cc-post-cell-drag{flex:none;color:var(--cc-muted);cursor:grab;user-select:none;font-size:14px;line-height:1;padding:0 2px}
.dsh-comfy-floating .cc-post-cell-drag:active{cursor:grabbing}
.dsh-comfy-floating .cc-post-cell-title{flex:1;min-width:100px;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-comfy-floating .cc-post-cell-actions{display:flex;gap:3px;flex:none;margin-left:auto}
.dsh-comfy-floating .cc-post-cell-actions button{position:relative;width:26px;min-width:26px;height:26px;min-height:26px;padding:0!important;display:flex;align-items:center;justify-content:center;font-size:11px}

.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]::after{content:attr(data-cc-tooltip);position:absolute;top:calc(100% + 6px);right:0;z-index:50;white-space:nowrap;padding:5px 8px;border:1px solid var(--cc-border);border-radius:5px;background:var(--cc-surface);color:var(--cc-text);font-size:10px;line-height:1.3;box-shadow:0 6px 18px rgba(0,0,0,.25);opacity:0;pointer-events:none;transition:opacity .12s}
.dsh-comfy-floating .cc-post-cell-actions button[data-cc-tooltip]:not(:disabled):is(:hover,:focus-visible)::after{opacity:1}
.dsh-comfy-floating .cc-post-cell-enable{flex:none;height:30px;font-size:11px}
.dsh-comfy-floating .cc-post-cell-enable>span:first-child{padding:0 8px;font-size:10px}
.dsh-comfy-floating .cc-post-cell-enable>.cc-select-trigger{height:28px;min-width:64px!important;padding:0 8px!important;font-size:11px!important}
.dsh-comfy-floating .cc-post-cell-fields{display:flex;flex-direction:column;gap:16px;padding:16px;min-width:0;container-type:inline-size}
.dsh-comfy-floating .cc-post-param-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0}
.dsh-comfy-floating .cc-post-param-group+.cc-post-param-group{padding-top:14px;border-top:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-post-param-group[data-layout="upscale"]{grid-template-columns:minmax(0,1fr) 140px}
.dsh-comfy-floating .cc-post-param-group[data-layout="sampling"]{grid-template-columns:repeat(4,minmax(0,1fr))}
.dsh-comfy-floating .cc-post-param-wide{grid-column:1/-1;min-width:0}
.dsh-comfy-floating .cc-post-cell-fields label{min-width:0;gap:6px}
.dsh-comfy-floating .cc-post-cell-fields :is(input[type=number],.cc-select-trigger){width:100%;height:34px;min-height:34px;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-trigger{display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:100%;overflow:hidden}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-label{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left}
.dsh-comfy-floating .cc-post-cell-fields .cc-select-caret{flex:none}
.dsh-comfy-floating .cc-post-param-actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:8px;grid-column:1/-1;min-width:0}
.dsh-comfy-floating .cc-post-param-actions>button{width:auto;min-height:34px}
.dsh-comfy-floating .cc-post-param-actions :is(button,.cc-task-action){max-width:100%;min-width:0}
.dsh-comfy-floating .cc-post-param-actions .cc-task-action{flex-wrap:wrap}
.dsh-comfy-floating .cc-post-param-actions button{white-space:normal;overflow-wrap:anywhere}
@container(max-width:560px){.dsh-comfy-floating .cc-post-param-group[data-layout="sampling"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
@container(max-width:310px){.dsh-comfy-floating .cc-post-param-group,.dsh-comfy-floating .cc-post-param-group[data-layout]{grid-template-columns:minmax(0,1fr)}.dsh-comfy-floating .cc-post-param-actions{justify-content:flex-start}}

.dsh-comfy-floating .cc-post-check{display:flex;align-items:center;gap:7px;font-size:12px}
.dsh-comfy-floating .cc-post-check input{width:auto}
.dsh-comfy-floating .cc-post-log{white-space:pre-wrap;overflow-wrap:anywhere;max-height:200px;overflow:auto;font-size:11px}
.dsh-comfy-floating .cc-flow-top{display:flex;gap:10px}.dsh-comfy-floating .cc-flow-top>input{flex:1;min-width:0}
.dsh-comfy-floating .cc-flow-editor{display:grid;grid-template-columns:210px minmax(0,1fr);height:65vh;min-height:280px;gap:10px}
.dsh-comfy-floating .cc-flow-sidebar{overflow:auto;display:flex;flex-direction:column;gap:5px;padding-right:5px}
.dsh-comfy-floating .cc-flow-sidebar>button{text-align:left;overflow-wrap:anywhere;flex:none}
.dsh-comfy-floating .cc-flow-scroll{overflow:auto;position:relative;background:var(--cc-bg);border:1px solid var(--cc-border);border-radius:8px}
.dsh-comfy-floating .cc-flow-canvas{position:relative;background-image:radial-gradient(var(--cc-border) 1px,transparent 1px);background-size:20px 20px}
.dsh-comfy-floating .cc-flow-links{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.dsh-comfy-floating .cc-flow-node{position:absolute;width:260px;box-sizing:border-box;background:var(--cc-surface);border:1px solid var(--cc-border);border-radius:8px;padding:9px}
.dsh-comfy-floating .cc-flow-node header{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:move;touch-action:none;overflow-wrap:anywhere;font-size:12px;font-weight:600;padding-bottom:8px;border-bottom:1px solid var(--cc-border)}
.dsh-comfy-floating .cc-flow-node input,.dsh-comfy-floating .cc-flow-node select,.dsh-comfy-floating .cc-flow-sidebar input,.dsh-comfy-floating .cc-post-cell-fields select,.dsh-comfy-floating .cc-stage-toolbar select{background:var(--cc-control);color:var(--cc-text);border:1px solid var(--cc-border);border-radius:5px;padding:4px;box-sizing:border-box;max-width:100%;min-width:0;font:inherit}
.dsh-comfy-floating .cc-flow-output-row{display:flex;gap:6px;justify-content:flex-end}.dsh-comfy-floating .cc-flow-outputs button[aria-pressed=true]{border-color:var(--cc-accent)}
.dsh-comfy-floating .cc-flow-outputs{display:flex;flex-direction:column;align-items:end;margin:8px 0;gap:4px}
.dsh-comfy-floating .cc-flow-node button{color:inherit;background:var(--cc-control);border:1px solid var(--cc-border);border-radius:4px;cursor:pointer}
.dsh-comfy-floating .cc-flow-outputs button{font-size:11px}.dsh-comfy-floating .cc-flow-outputs span{margin-left:8px;color:var(--cc-accent)}
.dsh-comfy-floating .cc-flow-input{display:grid;grid-template-columns:16px minmax(0,1fr);gap:4px;margin-top:8px;font-size:11px}
.dsh-comfy-floating .cc-flow-input label{display:flex;flex-direction:column;gap:3px}.dsh-comfy-floating .cc-flow-input>input,.dsh-comfy-floating .cc-flow-input>select{grid-column:2;min-width:0;width:100%}
.dsh-comfy-floating .cc-port{border:0!important;background:transparent!important;padding:0;color:var(--cc-accent)!important;align-self:start}
.dsh-comfy-floating .cc-stage-toolbar{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:8;display:flex;align-items:center;gap:12px;padding:7px;background:var(--cc-surface);border-radius:7px;max-width:calc(100% - 110px);flex-wrap:wrap}
.dsh-comfy-floating .cc-stage-toolbar label{display:flex;align-items:center;gap:5px;white-space:nowrap}
.dsh-comfy-floating .cc-comparison-host{position:absolute;inset:65px 36px 40px;z-index:2}
.dsh-comfy-floating .cc-stage-comparison{height:100%;display:flex;flex-direction:column;gap:10px}
.dsh-comfy-floating .cc-comparison-tools{display:flex;gap:12px;align-items:center;font-size:12px}
.dsh-comfy-floating .cc-comparison-viewport{flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;touch-action:none}
.dsh-comfy-floating .cc-comparison-pair{position:relative;max-width:100%;max-height:100%;width:auto;height:100%;transform-origin:center}
.dsh-comfy-floating .cc-comparison-pair>img{width:100%;height:100%;object-fit:fill;display:block;pointer-events:none;user-select:none}
.dsh-comfy-floating .cc-comparison-pair>img.cc-comparison-before{position:absolute;inset:0}
.dsh-comfy-floating .cc-comparison-divider{position:absolute;top:0;bottom:0;width:2px;background:#fff;box-shadow:0 0 2px #000;pointer-events:none}
.dsh-comfy-floating .cc-comparison-pair.is-side-by-side{display:flex;width:100%;aspect-ratio:auto!important;height:auto}
.dsh-comfy-floating .cc-comparison-pair.is-side-by-side>img{position:static;width:50%;height:auto;object-fit:contain}
.dsh-comfy-floating .cc-stage-comparison>input[type=range]{width:100%;accent-color:var(--cc-accent)}
@media(max-width:650px){.dsh-comfy-floating .cc-post-notebook,.dsh-comfy-floating .cc-flow-editor{grid-template-columns:135px minmax(0,1fr);gap:8px}.dsh-comfy-floating .cc-post-cell{padding:0}.dsh-comfy-floating .cc-post-add{padding-right:6px}.dsh-comfy-floating .cc-post-add button{padding:6px!important}.dsh-comfy-floating .cc-post-cell-head{gap:7px}.dsh-comfy-floating .cc-post-cell-actions{width:100%}.dsh-comfy-floating .cc-stage-toolbar{max-width:calc(100% - 65px);left:44%}.dsh-comfy-floating .cc-comparison-host{inset:110px 15px 45px}}

.dsh-comfy-floating .cc-output-preview-targets{display:flex;flex-direction:column;gap:8px}
.dsh-comfy-floating .cc-output-preview-target{display:flex;gap:9px;align-items:center;padding:10px 0;border-bottom:1px solid var(--cc-border);min-width:0}
.dsh-comfy-floating .cc-output-preview-target>span{display:flex;flex-direction:column;gap:4px;min-width:0;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-preview-target small{color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-dialog>div:last-child{flex:1;overflow:hidden!important}
.dsh-comfy-floating .cc-preview-editor{display:flex;flex:1;flex-direction:column;gap:10px;height:min(680px,calc(100dvh - 150px));min-height:0}
.dsh-comfy-floating .cc-preview-editor-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:11px;color:var(--cc-muted);flex:none}
.dsh-comfy-floating .cc-preview-editor-scroll{flex:1;min-height:0;overflow:auto;padding:2px;min-width:0}
.dsh-comfy-floating .cc-preview-editor-masonry{position:relative;width:100%;min-width:0}
.dsh-comfy-floating .cc-preview-editor-masonry .cc-masonry-cell{position:absolute;box-sizing:border-box;min-width:0}
.dsh-comfy-floating .cc-preview-editor-image{position:relative;display:block;width:100%;box-sizing:border-box;border:1px solid var(--cc-border);border-radius:8px;padding:0;overflow:hidden;background:var(--cc-control);cursor:pointer;transition:border-color .12s,box-shadow .12s}
.dsh-comfy-floating .cc-preview-editor-image:hover:enabled{border-color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-image.is-selected{border-color:var(--cc-accent)!important;box-shadow:inset 0 0 0 2px var(--cc-accent-bg),0 0 0 2px var(--cc-accent)}
.dsh-comfy-floating .cc-preview-editor-image:focus-visible{outline:2px solid var(--cc-accent);outline-offset:2px}
.dsh-comfy-floating .cc-preview-editor-image img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block}
.dsh-comfy-floating .cc-preview-editor-failed{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:8px;color:var(--cc-muted);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-image.is-selected::after{content:'✓';position:absolute;right:7px;top:7px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--cc-accent);color:var(--cc-accent-text);font-size:11px;font-weight:700;box-shadow:0 1px 4px rgba(0,0,0,.35)}
.dsh-comfy-floating .cc-preview-editor-badge{position:absolute;left:7px;top:7px;padding:2px 6px;border-radius:4px;background:rgba(0,0,0,.62);color:#fff;font-size:10px;line-height:1.4}
.dsh-comfy-floating .cc-preview-editor-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--cc-border);padding-top:12px;flex:none}
.dsh-comfy-floating .cc-preview-editor-selection{flex:1;min-width:120px;font-size:11px;color:var(--cc-muted)}
.dsh-comfy-floating .cc-preview-editor-confirm{display:flex;flex:none;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;border:1px solid var(--cc-accent);border-radius:7px;background:var(--cc-accent-bg);font-size:11px}
.dsh-comfy-floating .cc-preview-editor-confirm>span{flex:1;min-width:120px}
.dsh-comfy-floating.cc-output-inspector{position:fixed;inset:0;z-index:2147483000;display:grid;grid-template-columns:minmax(0,70fr) minmax(300px,30fr);background:rgba(5,7,10,.68);backdrop-filter:brightness(.62) blur(2px);-webkit-backdrop-filter:brightness(.62) blur(2px);color:var(--cc-text);overflow:hidden;overscroll-behavior:none;touch-action:none}
.dsh-comfy-floating .cc-output-inspector-stage{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,.08);user-select:none;touch-action:none;cursor:default}
.dsh-comfy-floating .cc-output-inspector-stage:active{cursor:grabbing}
.dsh-comfy-floating .cc-output-inspector-image{display:block;max-width:calc(100% - 36px);max-height:calc(100% - 36px);width:auto;height:auto;object-fit:contain;transform-origin:center center;will-change:transform;user-select:none;pointer-events:none}
.dsh-comfy-floating .cc-output-inspector-close{position:fixed;left:16px;top:14px;z-index:4;width:38px;height:38px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.16);border-radius:50%;background:rgba(12,12,12,.72);color:#fff;cursor:pointer;backdrop-filter:blur(10px)}
.dsh-comfy-floating .cc-output-inspector-close:hover{background:rgba(36,36,36,.9);border-color:rgba(255,255,255,.34)}
.dsh-comfy-floating .cc-output-inspector-nav{position:absolute;z-index:3;top:50%;transform:translateY(-50%);width:42px;height:58px;display:flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:rgba(0,0,0,.3);color:#fff;cursor:pointer;opacity:.55;transition:opacity .12s ease,background .12s ease}
.dsh-comfy-floating .cc-output-inspector-nav:hover{opacity:1;background:rgba(0,0,0,.58)}
.dsh-comfy-floating .cc-output-inspector-nav.is-prev{left:14px}.dsh-comfy-floating .cc-output-inspector-nav.is-next{right:14px}
.dsh-comfy-floating .cc-output-inspector-zoom{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:2;padding:5px 9px;border-radius:99px;background:rgba(0,0,0,.56);color:rgba(255,255,255,.75);font-size:10px;pointer-events:none;white-space:nowrap}
.dsh-comfy-floating .cc-output-inspector-info{min-width:0;min-height:0;height:100dvh;box-sizing:border-box;overflow-y:auto;overscroll-behavior:contain;padding:22px 20px 28px;background:color-mix(in srgb,var(--cc-surface) 90%,transparent);backdrop-filter:blur(18px) saturate(115%);-webkit-backdrop-filter:blur(18px) saturate(115%);border-left:1px solid color-mix(in srgb,var(--cc-border) 80%,transparent);display:flex;flex-direction:column;gap:15px}
.dsh-comfy-floating .cc-output-info-title{display:flex;flex-direction:column;gap:4px;min-width:0;padding-right:6px}.dsh-comfy-floating .cc-output-info-title strong{font-size:15px;overflow-wrap:anywhere}.dsh-comfy-floating .cc-output-info-title small{font-size:10px;color:var(--cc-muted);overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-info-section{display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid var(--cc-border);min-width:0}.dsh-comfy-floating .cc-output-info-section>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}.dsh-comfy-floating .cc-output-info-section-head>strong{font-size:11px;letter-spacing:.02em}.dsh-comfy-floating .cc-output-info-grid{display:grid;grid-template-columns:92px minmax(0,1fr);gap:7px 9px;font-size:11px}.dsh-comfy-floating .cc-output-info-grid dt{color:var(--cc-muted)}.dsh-comfy-floating .cc-output-info-grid dd{margin:0;overflow-wrap:anywhere}
.dsh-comfy-floating .cc-output-model-list{display:flex;flex-direction:column;gap:6px;max-height:210px;overflow:auto;padding-right:2px;overscroll-behavior:contain}.dsh-comfy-floating .cc-output-model-group{display:grid;grid-template-columns:78px minmax(0,1fr);gap:7px;align-items:start;padding:6px 7px;border:1px solid var(--cc-border);border-radius:7px;background:color-mix(in srgb,var(--cc-control) 86%,transparent);font-size:10px}.dsh-comfy-floating .cc-output-model-group-label{display:flex;align-items:center;gap:5px;color:var(--cc-muted);min-height:24px}.dsh-comfy-floating .cc-output-model-count{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:var(--cc-hover);color:var(--cc-text);font-size:9px}.dsh-comfy-floating .cc-output-model-chips{display:flex;flex-wrap:wrap;gap:4px;min-width:0}.dsh-comfy-floating .cc-output-model-chip{display:inline-flex;align-items:center;max-width:100%;min-height:24px;padding:3px 7px;border-radius:6px;background:var(--cc-surface);border:1px solid color-mix(in srgb,var(--cc-border) 75%,transparent);color:var(--cc-text);font-size:9px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dsh-comfy-floating .cc-output-model-chip.is-primary{border-color:color-mix(in srgb,var(--cc-accent) 42%,var(--cc-border));background:color-mix(in srgb,var(--cc-accent-bg) 58%,var(--cc-surface))}
.dsh-comfy-floating .cc-output-prompt-box{white-space:pre-wrap;overflow-wrap:anywhere;max-height:220px;overflow:auto;padding:9px 10px;border:1px solid var(--cc-border);border-radius:7px;background:var(--cc-control);font:11px/1.5 ui-monospace,Consolas,monospace;color:var(--cc-text)}.dsh-comfy-floating .cc-output-prompt-toolbar{display:flex;align-items:center;gap:5px}.dsh-comfy-floating .cc-output-prompt-translate{height:26px;padding:0 8px;border:1px solid var(--cc-border);border-radius:6px;background:var(--cc-control);color:var(--cc-muted);font:inherit;font-size:9px;cursor:pointer}.dsh-comfy-floating .cc-output-prompt-translate:hover,.dsh-comfy-floating .cc-output-prompt-translate[aria-pressed=true]{border-color:var(--cc-accent);color:var(--cc-text);background:var(--cc-accent-bg)}.dsh-comfy-floating .cc-output-prompt-meta{display:flex;gap:6px;flex-wrap:wrap;font-size:9px;color:var(--cc-muted)}.dsh-comfy-floating .cc-output-prompt-source{display:inline-flex;align-items:center;padding:2px 5px;border-radius:99px;background:var(--cc-hover)}
.dsh-comfy-floating .cc-output-inspector-actions{display:flex;gap:7px;flex-wrap:wrap;padding-top:4px;margin-top:auto}
@media(max-width:760px){.dsh-comfy-floating.cc-output-inspector{grid-template-columns:minmax(0,1fr) minmax(260px,38vw)}.dsh-comfy-floating .cc-output-inspector-info{padding:18px 14px 22px}}
.dsh-comfy-floating.cc-output-inspector.is-image-only{grid-template-columns:minmax(0,1fr)}
.dsh-comfy-floating.cc-output-inspector.is-image-only .cc-output-inspector-image{width:calc(100% - 36px);height:calc(100% - 36px)}
.dsh-comfy-floating .cc-output-inspector-error{position:absolute;padding:12px 18px;border-radius:7px;background:rgba(0,0,0,.55);color:#fff;font-size:13px}

@media(max-width:700px){.dsh-comfy-ui .cc-output-filter-group{grid-template-columns:minmax(0,1fr);gap:5px}.dsh-comfy-ui .cc-output-filter-group-title{padding-top:0}.dsh-comfy-ui .cc-output-filter-flyout{width:min(640px,calc(100vw - 28px))}}
@media(max-width:560px){.dsh-comfy-ui .cc-output-toolbar{gap:4px}.dsh-comfy-ui .cc-output-quality{margin-left:0}.dsh-comfy-ui .cc-output-quality-label{display:none}.dsh-comfy-ui .cc-output-quality-btn{padding:0 5px}.dsh-comfy-ui .cc-output-control-row{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.dsh-comfy-ui .cc-output-search-field,.dsh-comfy-ui .cc-output-sort-field,.dsh-comfy-ui .cc-output-control-button{height:37px;padding:0 6px;font-size:10px;gap:4px}.dsh-comfy-ui .cc-output-filter-flyout{width:min(440px,calc(100vw - 20px))}.dsh-comfy-ui .cc-output-filter-custom{grid-template-columns:minmax(0,1fr)}.dsh-comfy-ui .cc-output-filter-range-sep{display:none}.dsh-comfy-ui .cc-output-filter-hint{grid-column:auto}.dsh-comfy-ui .cc-output-search-field svg,.dsh-comfy-ui .cc-output-sort-field>svg{display:none}.dsh-comfy-ui .cc-output-count-bubble{padding:1px 4px}}

.dsh-comfy-floating .cc-model-guide{display:flex;flex-direction:column;gap:14px;min-height:0;overflow:auto;padding:2px 2px 12px}
.dsh-comfy-floating .cc-model-guide-lead{margin:0;font-size:13px;line-height:1.7;color:var(--cc-text)}
.dsh-comfy-floating .cc-model-guide-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dsh-comfy-floating .cc-model-guide-card{border:1px solid var(--cc-border);border-radius:8px;padding:11px 12px;background:var(--cc-control);min-width:0}
.dsh-comfy-floating .cc-model-guide-card-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px}
.dsh-comfy-floating .cc-model-guide-card-head strong{font-size:13px}.dsh-comfy-floating .cc-model-guide-card-head span{font-size:10px;color:var(--cc-accent);flex:none}
.dsh-comfy-floating .cc-model-guide-card p,.dsh-comfy-floating .cc-model-guide-section p{margin:0;font-size:12px;line-height:1.7;color:var(--cc-muted)}
.dsh-comfy-floating .cc-model-guide-section{border-top:1px solid var(--cc-border);padding-top:10px}
.dsh-comfy-floating .cc-model-guide-section>strong{display:block;font-size:12px;margin-bottom:4px}
.dsh-comfy-floating .cc-model-guide-section ul{margin:0;padding-left:18px;font-size:12px;line-height:1.7;color:var(--cc-muted)}
@media(max-width:700px){.dsh-comfy-floating .cc-model-guide-grid{grid-template-columns:minmax(0,1fr)}}
.dsh-comfy-ui .cc-update-btn{background:var(--cc-accent)!important;color:#fff!important;border-color:var(--cc-accent)!important;font-weight:700}
.dsh-comfy-ui .cc-update-btn:hover{filter:brightness(1.08)}

`;


