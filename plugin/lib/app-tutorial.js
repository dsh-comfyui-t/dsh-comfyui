// ==================== 聚光灯式教程（详见 tutorial-design.md） ====================

const TUTORIALS = {
    basic: { name: "基础教程", steps: [
        {target: "model-dock", title: "生成一张图", text: "生成一张图，先选模型，再写提示词、定尺寸，最后点生成。这个教程只走最基本的一条路。"},
        {target: "model-base", title: "先选底模", text: "这里是当前底模。点开模型库可以换模型；新手建议先用 Anima，下一步会说明不同模型怎么选。"},
        {target: "model-guide", openModelGuide: true, title: "模型怎么选", text: "这里介绍常见模型类型、适合新手的模型和提示词写法。看完点下一步，回到工作台继续。"},
        {target: "prompt-positive", title: "写正向提示词", text: "在正向提示词框里写清主体、动作、场景和风格。先用一两句能看懂的描述，不必一开始堆很多词。"},
        {target: "image-size", title: "定尺寸", text: "比例预设和宽高都能改。先从 1:1、4:3、3:4 这类常见比例开始，尺寸也可以自己调；新手先别用 21:9 或很宽的 banner 比例。倍率先保持 1。"},
        {target: "generate", title: "生成", text: "点「生成」提交当前模型、提示词和尺寸。进度和排队状态显示在右上角。"},
        {target: "image-preview", title: "看结果", text: "生成完成后，最新结果会出现在这里。点图片可以打开大图查看细节。"},
    ]},
    model: { name: "模型与组件", steps: [
        {target: "model-dock", title: "模型配置模块", text: "这里是模型设置：选主模型、确认适配类型、添加生成时需要的组件。"},
        {target: "model-base", title: "底模选择", text: "这里显示当前主模型和预览图。点它可以打开模型库，换底模或其他模型。"},
        {target: "model-library", openModelLibrary: true, title: "打开模型库", text: "模型库用来浏览本地模型目录。选中模型后，在右侧确认预览和文件信息，再点「使用」替换当前底模。"},
        {target: "model-library-left", openModelLibrary: true, title: "左侧目录", text: "左边是模型文件夹和文件列表。上方路径显示当前位置，搜索框按文件名过滤，文件夹可以逐层展开。"},
        {target: "model-library-right", openModelLibrary: true, title: "右侧信息", text: "右边显示选中模型的预览图、大小、来源和「使用」按钮。确认是需要的模型后，再替换当前底模。"},
        {target: "model-profile", title: "适配类型", text: "这里显示当前模型的适配类型。它会影响提示词、采样参数和可用组件；换模型后要重新确认。"},
        {target: "model-profile-select", forceOpenAdapter: true, tooltipSide: "left", title: "选择适配类型", text: "展开后选择模型的适配类型。按模型实际训练方式选；不确定就保留推荐值。"},
        {target: "generation-controls", title: "生成时控制", text: "需要补充 VAE、文本编码器或 LoRA 时，从这里打开生成时控制。"},
        {target: "generation-panel", openGenerationControls: true, title: "生成时控制面板", text: "左边添加组件，右边管理已经添加的组件。"},
        {target: "generation-components", openGenerationControls: true, title: "可添加的组件", text: "左边列出 VAE、文本编码器和 LoRA。点选后从本地模型库选择文件；不需要的组件不用添加。"},
        {target: "generation-added", openGenerationControls: true, title: "已添加的组件", text: "右边显示已添加的组件。LoRA 可以单独开关、调强度或移除；VAE 和文本编码器会替换主模型自带的部分。"},
    ]},
    image: { name: "图片参数与生成", steps: [
        {target: "image-settings", title: "图片参数", text: "这里设置图片尺寸、采样方式、Seed 和保存位置。改这里只影响下一次生成；底部「生成后控制」可以在出图后继续放大、重绘细节或修复人脸。"},
        {target: "image-size", title: "尺寸与倍率", text: "比例和宽高决定基础尺寸；倍率把宽高按倍数放大或缩小，右侧预览会显示最终像素。"},
        {target: "image-sampling", title: "采样参数", text: "步数、CFG、采样器和调度器控制生成过程。没有把握就保留默认值；不同模型适用的范围不同。"},
        {target: "image-save", title: "保存位置", text: "打开「保存输出到本地」后，结果会保存到指定目录。目录留空时使用 ComfyUI 默认输出目录；文件名前缀用于区分本次任务。"},
        {target: "image-preview", title: "结果预览", text: "这里预览最近一次生成的结果，并显示最终尺寸。点击图片可以打开查看器，方便放大检查细节。"},
        {target: "generate", title: "开始生成", text: "确认模型、提示词和参数后点「生成」。进度和排队状态显示在右上角。"},
    ]},
    post: { name: "生成后处理", steps: [
        {target: "post-controls", title: "生成后处理设置", text: "这里是生成时自动执行的后处理设置。点生成后，插件先出图，再按这里的顺序继续处理；按钮后面是已经启用的处理。"},
        {target: "post-panel", openPostControls: true, title: "处理面板", text: "左边选要加的处理，右边排先后顺序，顶部决定最后留下哪些图。"},
        {target: "post-defaults", openPostControls: true, title: "添加处理", text: "左边可以加放大、重绘细节、人脸修复。点一下就加到右边；不需要就不用加。"},
        {target: "post-cells", openPostControls: true, title: "排顺序和改参数", text: "右边从上往下执行。每一步都能单独开关、改参数、上移、下移或删除；排好后再点生成。"},
        {target: "post-save", openPostControls: true, title: "保存哪些图", text: "可以只留最终图，也可以连处理前的原图一起留，或者每一步都留。一般只留最终图；想对比处理前后，就加上原图。"},
    ]},
    output: { name: "输出与查看", steps: [
        {target: "output-toolbar", title: "输出页工具栏", text: "这里切换填充或网格展示，调整预览画质，也可以刷新图库。右上角显示当前筛出的图片数量。"},
        {target: "output-controls", title: "搜索与筛选", text: "按文件名搜索，或按日期、尺寸、保存状态筛选；排序决定先看到哪一批图。"},
        {target: "output-results", title: "查看图片", text: "点图片打开大图查看器；滚动到底部会继续加载更多结果。"},
    ]},
    online: { name: "在线模型库", steps: [
        {target: "online-toolbar", title: "在线模型库", text: "这里选择模型来源、搜索模型，也可以筛选、查看下载任务和设置来源连接。"},
        {target: "online-filters", title: "筛选模型", text: "左边按排序、基底模型、模型类型和时间筛选；设置后结果会按条件更新。"},
        {target: "online-results", title: "查看和下载", text: "点模型卡片查看详情、预览图和下载选项；已经开始的下载任务在「查看下载」里。"},
    ]},
    connect: { name: "自动连接与关闭", steps: [
        {target: "connection-status", title: "自动检测连接", text: "插件会定期检测本机 ComfyUI：已运行就自动连接，停止后自动显示离线。自动检测不会启动或关闭 ComfyUI。"},
        {target: "connection-action", title: "离线时：连接 ComfyUI", text: "离线时点「连接 ComfyUI」，可以选择在浏览器打开或在后台运行。插件会复用已运行的服务；没有运行时才用配置的启动文件启动。"},
        {target: "connection-action", title: "在线时：完全关闭", text: "在线时按钮变为「关闭 ComfyUI」。点击后会立即终止正在生成的图片和全部排队任务，强制结束 ComfyUI 主进程及子进程，不会等待生成完成。"},
        {target: "connection-action", title: "关闭后的影响", text: "未保存的生成结果可能丢失，其他连接该服务的客户端也会断开。已加载模型占用的显存由系统在进程退出后回收；这与只卸载模型、不关闭服务的「释放显存」不同。无法确认进程身份时会安全拒绝关闭。"},
        {target: "connection-settings", title: "配置启动文件", text: "如果 ComfyUI 没有运行，启动前需要先配置本地启动文件。下一步会自动打开「连接设置」。"},
        {target: "start-script", title: "填写启动路径", openSettings: true, text: "这里填写你已经安装的 ComfyUI 启动文件完整路径，例如 D:\\ComfyUI\\ComfyUI_Windows_portable\\run_nvidia_gpu.bat。教程结束后才可以编辑输入框。"},
        {target: "save-connection-settings", title: "保存设置", openSettings: true, text: "填写完成后点击「保存启动设置」。之后无需重复填写；如果 ComfyUI 已经在运行，插件仍会自动连接。"},
    ]},
    startPath: { name: "设置 ComfyUI 启动路径", steps: [
        {target: "connection-action", title: "需要先配置启动路径", text: "没有检测到可用的 ComfyUI 启动文件。插件不会替你安装 ComfyUI，也不会猜测并执行不确定的文件。"},
        {target: "connection-settings", title: "找到连接设置", text: "启动路径在右上角「连接设置」里。点「下一步」会自动打开设置窗口。"},
        {target: "start-script", title: "填写本机启动文件", openSettings: true, text: "这里需要填写启动文件的绝对路径，例如 Windows 便携版的 run_nvidia_gpu.bat，或 Linux 版的启动 .sh 文件。请先记住位置，完成教程后再填写。"},
        {target: "save-connection-settings", title: "保存后连接", openSettings: true, text: "教程结束后输入路径，点击「保存启动设置」，再点击「连接 ComfyUI」。插件会启动服务并自动等待连接成功。"},
    ]},
    prompt: { name: "提示词编辑器", steps: [
        {target: "prompt-module", title: "提示词编辑器", text: "这里编辑正向、负向提示词，支持本地 Tag 补全、预览、撤回重做和 AI 辅助。"},
        {target: "prompt-positive", title: "正向提示词", text: "输入希望画面出现的内容。输入中文或英文 Tag 时会根据本地词库列出匹配项、译名和相关候选；选择候选只替换当前正在输入的 Tag。输入框底部连接着三横线拖拽区，鼠标移上会变成上下双向箭头；按住上下拖动可调整高度，大小会自动记住。"},
        {target: "prompt-negative", title: "负向提示词", text: "这里填写希望模型避免的内容。它与正向提示词一样支持中英文补全、标点规范化和独立高度记忆；底部三横线拖拽区也可独立调整高度。提示词修改都会进入同一套撤回历史。"},
        {target: "prompt-history", title: "撤回与重做", text: "这两个按钮恢复或重做提示词修改。除手动输入外，AI 扩写、对话采用结果、清空、候选补全和已保存提示词等操作也会进入历史；连续输入会适当合并，避免一次只撤回一个字符。"},
        {target: "prompt-preview", title: "切换预览", text: "按「原文 → 标签 → 中文标签 → 原文」循环查看。切换只改变输入框中的内容表现，不改变输入框尺寸、滚动区域或底部拖拽把手；标签预览可以删除单项并调整权重，中文标签只用于查看，不会把中文写回真正发送给 ComfyUI 的提示词。"},
        {target: "prompt-weight-language", title: "权重转语言", text: "把 (tag:1.3) 这类数值权重交给 DSH AI 改成自然语言强调，正负提示词一起处理，不额外扩写。运行时会锁定编辑；悬停加载按钮可停止。结果可撤回。"},
        {target: "prompt-expand", title: "AI 扩写", text: "让 DSH AI 基于当前正向和负向提示词进行扩写。扩写期间提示词暂时锁定，按钮显示加载动画；鼠标移到按钮上会变成停止图标，可以中止本次扩写。成功后整次修改可撤回。"},
        {target: "prompt-chat", title: "对话编辑", text: "点这里会在提示词右侧展开对话编辑区，可以用自然语言提出局部修改要求。下一步会自动展开聊天区供你查看。"},
        {target: "prompt-chat-panel", title: "对话编辑区", openPromptChat: true, text: "在这里描述要怎样改提示词。AI 返回后先看完整正/负提示词，再决定是否采用；点「采用」才会写回提示词，并进入撤回历史。聊天记录只保留到本次 DSH 运行结束。"},
        {target: "prompt-clear", title: "清空提示词", text: "叉号会同时清空正向和负向提示词。清空也可以撤回，误点后用上方撤回恢复。"},
    ]},
};

const TUTORIAL_GROUPS = [
    {key:'workbench', label:'工作台', items:['basic','prompt','model','image','post']},
    {key:'output', label:'输出页面', items:['output']},
    {key:'online', label:'在线图库', items:['online']},
    {key:'connection', label:'连接与启动', items:['connect','startPath']},
];

function ErrorLogModal({logs,theme,onClose}) {
    const text=JSON.stringify(logs,null,2);
    const copy=async()=>{
        try{await navigator.clipboard.writeText(text);}catch{
            const area=document.createElement('textarea');area.value=text;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();
        }
    };
    const download=()=>{
        const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
        const a=document.createElement('a');a.href=url;a.download='dsh-comfy-error-log-'+new Date().toISOString().slice(0,10)+'.json';a.click();
        setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return h(OverlayModal,{title:'错误日志',width:760,theme,onClose},
        h('div',{style:{display:'flex',flexDirection:'column',gap:10,minHeight:0}},
            h('div',{style:{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',fontSize:12}},
                h('span',{style:S.dim},'本设备：'+errorLogDeviceId()+' · 已记录 '+logs.length+' / '+ERROR_LOG_MAX+' 条'),
                h('button',{type:'button',style:S.btn2,onClick:copy,disabled:!logs.length},'复制给开发者'),
                h('button',{type:'button',style:S.btn2,onClick:download,disabled:!logs.length},'下载 JSON'),
                h('button',{type:'button',style:S.btn2,onClick:()=>{if(window.confirm('清空本设备错误日志？')){clearClientErrors();onClose();}}},'清空')),
            h('p',{style:{...S.dim,margin:0,lineHeight:1.6}},'日志只保存在当前设备浏览器，不会自动上传。复制或下载后发给开发者；已对 token、API key、密码等字段做脱敏。'),
            !logs.length
                ? h('div',{style:{...S.card,color:'var(--cc-muted)'}},'当前设备还没有记录到错误。')
                : h('div',{style:{display:'flex',flexDirection:'column',gap:8,maxHeight:'52vh',overflow:'auto'}},
                    logs.slice().reverse().slice(0,100).map((entry,index)=>
                        h('details',{key:entry.ts+index,className:'cc-error-log-row'},
                            h('summary',{style:{cursor:'pointer',fontSize:12,lineHeight:1.5}},
                                h('strong',null,entry.message||'未知错误'),
                                h('span',{style:{color:'var(--cc-muted)'}},' · '+(entry.context||'')),
                                h('small',{style:{display:'block',color:'var(--cc-muted)'}},entry.ts+(entry.extra?' · '+entry.extra:''))),
                            entry.stack?h('pre',{style:{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:11,color:'var(--cc-muted)',margin:'6px 0 0'}},entry.stack):null)))
        ));
}

function ComfyUpdateModal({info,busy,error,theme,onClose,onUpdate}) {
    const current=info?.current||'未知',latest=info?.latest||'未知',blocked=!!info?.busy;
    return h(OverlayModal,{title:'更新 ComfyUI',width:560,theme,onClose},
        h('div',{style:{display:'flex',flexDirection:'column',gap:11,fontSize:13,lineHeight:1.65}},
            h('div',{style:{fontWeight:700,fontSize:14}},'ComfyUI 有新版本可用'),
            h('div',null,'当前版本：',h('strong',null,'v'+current),'  →  最新版本：',h('strong',null,'v'+latest)),
            h('p',{style:{margin:0,color:'var(--cc-muted)'}},'更新会先停止 ComfyUI，切换到最新版本、安装依赖并重新启动。models、output 和 custom_nodes 不会被删除；对 ComfyUI 源码做过的本地修改会被覆盖。'),
            blocked?h('div',{style:{color:'var(--cc-warn)'}},'还有任务在队列中，请等待生成完成后再更新。'):null,
            info?.error?h('div',{style:{color:'var(--cc-bad)'}},'检查更新失败：'+info.error):null,
            error?h('div',{style:{color:'var(--cc-bad)'}},error):null,
            h('div',{style:{display:'flex',justifyContent:'flex-end',gap:8,marginTop:4}},
                h('button',{type:'button',style:S.btn2,disabled:busy,onClick:onClose},'取消'),
                h('button',{type:'button',style:S.btn,disabled:busy||blocked,onClick:onUpdate},busy?'正在更新…':'更新')))
    );
}

function ModelTypeGuide({theme,onClose}) {
    const cards=[
        {name:'Anima',tag:'推荐新手',body:'动漫、插画风格，参数简单。自然语言和标签都支持。常用 1024×1024、20–30 步、CFG 4；Turbo 版用 8 步、CFG 1。提示词可以先写主体和场景，再加风格、光线标签，不需要堆很多质量词。'},
        {name:'SDXL / Illustrious / Pony',tag:'动漫与 2D',body:'生态成熟、LoRA 多。多用 1024 左右尺寸，提示词以逗号分隔的标签为主：主体、外观、动作、场景、风格；负向提示词写不想出现的内容。'},
        {name:'FLUX.1 / FLUX.2',tag:'写实与文字',body:'写实、文字和复杂场景表现好，显存占用也更高。提示词用完整自然语言句子；FLUX 通常不需要负向提示词，参数按模型推荐值来。'},
        {name:'SD3.5 / Qwen-Image / Z-Image',tag:'通用与中文',body:'通用写实、插画和中文文字都能做。用自然语言描述主体、场景、构图和风格；不同模型的步数、CFG 和分辨率要求不同，先看推荐值。'},
    ];
    return h(OverlayModal,{title:'模型怎么选',width:980,theme,guideTarget:'model-guide',onClose},
        h('div',{className:'cc-model-guide'},
            h('p',{className:'cc-model-guide-lead'},'先选风格方向，再看模型。新手建议从 ',h('strong',null,'Anima'),' 开始：动漫插画、参数简单，出问题也容易判断。'),
            h('div',{className:'cc-model-guide-grid'},...cards.map(card=>h('section',{key:card.name,className:'cc-model-guide-card'},
                h('div',{className:'cc-model-guide-card-head'},h('strong',null,card.name),h('span',null,card.tag)),
                h('p',null,card.body)))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'其他常见类型'),
                h('ul',null,
                    h('li',null,'SD1.5 / SD2.x：512–768 左右，标签式提示词，模型小、LoRA 多，适合轻量或旧模型。'),
                    h('li',null,'HiDream / Chroma / Lumina：偏插画或艺术风格，用自然语言描述，参数按各自模型推荐。'),
                    h('li',null,'Hunyuan Image / MOSS / Krea 2：较新的通用模型，写实或设计场景；显存和参数要求更高，先看推荐值。'))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'提示词怎么写'),
                h('ul',null,
                    h('li',null,'标签式（SD1.5、SDXL、Illustrious、Pony）：主体、外观、动作、场景、风格用逗号分开；负向写不想出现的内容。'),
                    h('li',null,'自然语言（FLUX、SD3.5、Qwen-Image、Z-Image）：用完整句子说清主体、环境、光线和构图，不需要堆标签。'),
                    h('li',null,'Anima：自然语言和标签可以混用；先用一句主体和场景，再加风格、光线标签，写清楚后再逐步加细节。'))),
            h('section',{className:'cc-model-guide-section'},h('strong',null,'新手先这样用'),
                h('p',null,'选 Anima Base，尺寸从 1024 左右或常见比例开始，步数 20–30、CFG 先用推荐值。第一张只写“主体 + 场景 + 风格”三句话，满意后再加细节或 LoRA。'))));
}

function spotlightGeometry(rect, vw, vh) {
    if (!rect || rect.width < 1 || rect.height < 1 || rect.bottom < 0 || rect.top > vh || rect.right < 0 || rect.left > vw) return null;
    const pad = 5;
    const left = Math.max(3, rect.left - pad), top = Math.max(3, rect.top - pad);
    return {left, top, width: Math.max(1, Math.min(vw - left - 3, rect.right - rect.left + pad * 2)),
        height: Math.max(1, Math.min(vh - top - 3, rect.bottom - rect.top + pad * 2))};
}

function tooltipGeometry(box, vw, vh, side = "auto") {
    const margin = 12, width = Math.min(380, Math.max(1, vw - margin * 2));
    if (!box) return {position: "fixed", width: "calc(100vw - 24px)", maxWidth: 380,
        maxHeight:"calc(100dvh - 24px)", left: "50%", top: "50%", transform: "translate(-50%, -50%)"};
    const sideLeft = box.left - width - margin, sideRight = box.left + box.width + margin;
    if (side === "left" && sideLeft >= margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideLeft, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(120, Math.min(420, vh - top - margin))};
    }
    if (side === "right" && sideRight + width <= vw - margin) {
        const top = Math.max(margin, Math.min(box.top, vh - 220));
        return {position: "fixed", left: sideRight, top, width, maxWidth: "calc(100vw - 24px)", maxHeight: Math.max(120, Math.min(420, vh - top - margin))};
    }
    const left = Math.max(margin, Math.min(vw - width - margin, box.left + box.width / 2 - width / 2));
    const placeAbove = box.top > vh * .55;
    const below = box.top + box.height + 14, above = box.top - 300;
    const top = placeAbove ? Math.max(margin, above) : Math.max(margin, Math.min(below, Math.max(margin, vh - 220)));
    const maxHeight = Math.max(120, Math.min(420, vh - top - margin));
    return {position: "fixed", left, top, width, maxWidth: "calc(100vw - 24px)", maxHeight};
}
/** 教程浮层不允许用户直接点击高亮目标；仅底部三个导航按钮可操作。 */

function SpotlightTutorial({guide, stepIndex, onBack, onNext, onSkip, theme, rootRef}) {
    const step = TUTORIALS[guide]?.steps[stepIndex];
    const [focusBox, setFocusBox] = React.useState(null);
    const tipRef = React.useRef(null);
    React.useEffect(() => {
        if (!step || typeof document === "undefined") return;
        let timer = null, frame = null;
        const measure = () => {
            const target = document.querySelector('[data-cc-guide="' + step.target + '"]');
            const rect = target && target.getBoundingClientRect();
            setFocusBox(spotlightGeometry(rect, window.innerWidth, window.innerHeight));
        };
        const update = () => {
            const target = document.querySelector('[data-cc-guide="' + step.target + '"]');
            if (!target) { setFocusBox(null); return; }
            const rect = target.getBoundingClientRect();
            const vh = window.innerHeight, top = 64, bottom = 24;
            if (rect.top < top || rect.bottom > vh - bottom) {
                if (target.scrollIntoView) {
                    const block = rect.height > vh - top - bottom ? "start" : "center";
                    target.scrollIntoView({block, inline: "nearest", behavior: "auto"});
                }
                if (frame) cancelAnimationFrame(frame);
                frame = requestAnimationFrame(measure);
            } else measure();
        };
        update();
        timer = setTimeout(update, 90); // Portal 中的主弹窗可能晚一帧完成挂载。
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => { clearTimeout(timer); if (frame) cancelAnimationFrame(frame);
            window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
    }, [guide, stepIndex, step?.target, step?.openSettings]);
    React.useEffect(() => {
        if (typeof document === "undefined") return;
        const before = document.activeElement;
        const tip = tipRef.current;
        const buttons = () => tip ? [...tip.querySelectorAll("button:not([disabled])")] : [];
        const focus = () => { const b = buttons(); if (b.length) (b.find(x => x.dataset.guideNext === "true") || b[0]).focus(); };
        focus();
        const focusTimer = setTimeout(focus, 0); // 设置弹窗可能在同一帧挂载并尝试抢焦点。
        const enforceFocus = (e) => {
            if (tip && !tip.contains(e.target)) {
                e.stopPropagation();
                const b = buttons();
                if (b.length && document.activeElement !== b[0]) b[0].focus();
            }
        };
        document.addEventListener("focusin", enforceFocus, true);
        const trap = (e) => {
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.(); return; }
            if (e.key !== "Tab") {
                if (!tip?.contains(e.target) || !["Enter", " "].includes(e.key)) {
                    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation?.();
                }
                return;
            }
            e.stopPropagation(); e.stopImmediatePropagation?.();
            const b = buttons(); if (!b.length) { e.preventDefault(); return; }
            const i = b.indexOf(document.activeElement);
            if (e.shiftKey && i <= 0) { e.preventDefault(); b[b.length - 1].focus(); }
            else if (!e.shiftKey && (i === b.length - 1 || i < 0)) { e.preventDefault(); b[0].focus(); }
        };
        const blockScroll = (e) => { if (!tip?.contains(e.target)) e.preventDefault(); };
        document.addEventListener("keydown", trap, true);
        document.addEventListener("wheel", blockScroll, {capture:true, passive:false});
        document.addEventListener("touchmove", blockScroll, {capture:true, passive:false});
        return () => {
            clearTimeout(focusTimer);
            document.removeEventListener("focusin", enforceFocus, true);
            document.removeEventListener("keydown", trap, true);
            document.removeEventListener("wheel", blockScroll, true);
            document.removeEventListener("touchmove", blockScroll, true);
            if (before?.isConnected && before.focus) before.focus();
        };
    }, [guide, stepIndex]);
    if (!step) return null;
    const count = TUTORIALS[guide].steps.length;
    return floating(h("div", {className:"dsh-comfy-floating cc-tutorial-overlay", role:"presentation",
        style:Object.assign({}, popupVars(theme), {position:"fixed", inset:0, zIndex:2147482500,
            background:focusBox ? "transparent" : "rgba(0,0,0,.76)", pointerEvents:"auto", touchAction:"auto"}),
        onPointerDown:(e)=>{e.stopPropagation();e.preventDefault();},
        onClick:(e)=>{if (!tipRef.current?.contains(e.target)) {e.stopPropagation();e.preventDefault();}}},
        focusBox ? h("div", {"data-cc-spotlight":step.target, "aria-hidden":"true", style:{
            position:"fixed", ...focusBox, borderRadius:10, border:"2px solid var(--cc-accent)",
            boxShadow:"0 0 0 200vmax rgba(0,0,0,.76), 0 0 0 4px rgba(255,255,255,.18)",
            pointerEvents:"none"}}) : null,
        h("section", {ref:tipRef, role:"dialog", "aria-modal":"true", "aria-label":TUTORIALS[guide].name,
            className:"cc-tutorial-tooltip", style:Object.assign({}, tooltipGeometry(focusBox, window.innerWidth, window.innerHeight, step.tooltipSide), {
                zIndex:1, overflowY:"auto", overscrollBehavior:"contain",
                padding:"16px", borderRadius:12, background:"var(--cc-surface)", color:"var(--cc-text)",
                border:"1px solid var(--cc-border)", boxShadow:"0 16px 48px rgba(0,0,0,.55)",
                display:"flex", flexDirection:"column", gap:10, touchAction:"auto"}),
            onPointerDown:(e)=>e.stopPropagation(), onClick:(e)=>e.stopPropagation()},
            h("div", {style:{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}},
                h("strong", {style:{fontSize:14}}, step.title),
                h("span", {style:S.dim}, (stepIndex+1)+" / "+count)),
            h("p", {style:{margin:0,fontSize:13,lineHeight:1.7,overflowWrap:"anywhere"}}, step.text),
            h("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:4}},
                h("button", {type:"button",style:S.btn2,onClick:onSkip}, "跳过"),
                h("div", {style:{display:"flex",gap:7}},
                    h("button", {type:"button",style:S.btn2,disabled:stepIndex===0,onClick:onBack,
                        "aria-label":"上一步"}, "←"),
                    h("button", {type:"button",style:S.btn,onClick:onNext,"data-guide-next":"true"},
                        stepIndex+1===count ? "完成 →" : "下一步 →"))))));
}

// Current-tag parsing keeps existing separators, escapes and weight wrappers intact.

function promptTagRange(value, start, end = start) {
    value = String(value || "");
    if (!Number.isInteger(start) || start !== end || start < 0 || start > value.length) return null;
    const escaped = i => {let n=0;while(i>0 && value[--i]==="\\")n++;return n%2===1;};
    let left=start, right=start;
    const sep=(c,i)=>[",","，","\n","\r"].includes(c) && !escaped(i);
    while(left>0 && !sep(value[left-1],left-1))left--;
    while(right<value.length && !sep(value[right],right))right++;
    while(left<right && /\s/.test(value[left]))left++;
    while(right>left && /\s/.test(value[right-1]))right--;
    // Weight groups may span several comma-separated tags; only strip syntax at edges.
    while(left<right && /[([]/.test(value[left]) && !escaped(left))left++;
    while(right>left && /[)\]]/.test(value[right-1]) && !escaped(right-1))right--;
    const segment=value.slice(left,right), weight=segment.match(/(?<!\\):\s*[-+]?\d*(?:\.\d*)?\s*$/);
    if(weight)right=left+weight.index;
    while(right>left && /\s/.test(value[right-1]))right--;
    if(start<left || start>right || right<=left)return null;
    const query=value.slice(left,Math.min(start,right)).trim();
    // Do not treat LoRA syntax, scheduled prompts, BREAK or other control syntax as tags.
    if(!query || /[<>:|\[\]]/.test(query) || /^BREAK$/i.test(query))return null;
    return {start:left,end:right,query};
}

function replacePromptTag(value, range, item, underscores = false) {
    let output=String(item.output || "");
    if(item.kind === "tag") {
        if(!underscores)output=output.replace(/_/g," ");
        // Raw Danbooru names may contain literal parentheses. Prompt grammar needs escapes.
        output=output.replace(/(?<!\\)([()[\]])/g,"\\$1");
    }
    return {value:value.slice(0,range.start)+output+value.slice(range.end),caret:range.start+output.length};
}

function completionGeometry(point, vw, vh) {
    const width=Math.max(1,Math.min(430,vw-16));
    const below=vh-point.bottom-8, above=point.top-8;
    const height=Math.max(1,Math.min(280,Math.max(below,above)));
    return {left:Math.max(8,Math.min(vw-width-8,point.left)),width,
        top:below>=height?Math.max(8,point.bottom):Math.max(8,point.top-height),maxHeight:height};
}

function promptCaretPoint(node) {
    const rect=node.getBoundingClientRect();
    if(typeof document==="undefined" || !window.getComputedStyle)return rect;
    const style=window.getComputedStyle(node),mirror=document.createElement("div");
    for(const k of ["fontFamily","fontSize","fontWeight","fontStyle","lineHeight","letterSpacing","wordSpacing",
        "paddingTop","paddingRight","paddingBottom","paddingLeft","borderTopWidth","borderLeftWidth","boxSizing","tabSize"])
        mirror.style[k]=style[k];
    Object.assign(mirror.style,{position:"fixed",visibility:"hidden",whiteSpace:"pre-wrap",overflowWrap:"break-word",
        left:rect.left+"px",top:rect.top+"px",width:node.clientWidth+"px",height:"auto"});
    mirror.textContent=node.value.slice(0,node.selectionStart);
    const marker=document.createElement("span");marker.textContent="\u200b";mirror.appendChild(marker);
    document.body.appendChild(mirror);
    const at=marker.getBoundingClientRect();mirror.remove();
    const top=Math.max(rect.top,Math.min(rect.bottom-20,at.top-node.scrollTop));
    return {left:Math.max(rect.left,Math.min(rect.right,at.left-node.scrollLeft)),top,bottom:top+(parseFloat(style.lineHeight)||20)};
}

const COMPLETION_RELATIONS={exact:"精确",prefix:"前缀",alias:"别名",same_concept:"同义项",equivalent:"等价",
    similar:"相近",broader:"上位",narrower:"更具体",related:"相关",opposite:"相反",implies:"蕴含 →",more_specific:"更具体 ←",entry:"词条"};

async function dictionaryRequest(path, body, method = body === undefined ? "GET" : "POST", signal) {
    await requireCompatibleSidecar(EXPANDER + "/dictionary/" + path);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    const abort=()=>controller.abort();
    if(signal?.aborted)controller.abort();
    signal?.addEventListener("abort",abort,{once:true});
    try {
        const r=await fetch(EXPANDER+"/dictionary/"+path,{method,signal:controller.signal,
            headers:{...instanceHeaders(),...(body===undefined?{}:{"Content-Type":"application/json"})},
            ...(body===undefined?{}:{body:JSON.stringify(body)})});
        const data=await r.json();
        if(!r.ok)throw new Error(data.error || "词库请求失败");
        return data;
    } finally {clearTimeout(timer);signal?.removeEventListener("abort",abort);}
}

async function migrateLegacyDictionary() {
    const stored=window.localStorage.getItem(LS_KEY);
    let legacy;
    try {legacy=stored?JSON.parse(stored):{};} catch(e) {throw new Error("旧设置无法解析；请先导出浏览器数据");}
    const backupKey="dsh-comfyui-console/legacy-backup/v1";
    // A failed backup stops migration. Never mark success before server commit.
    if(!window.localStorage.getItem(backupKey)) {
        window.localStorage.setItem(backupKey,stored || "{}");
        if(window.localStorage.getItem(backupKey)!==(stored || "{}"))throw new Error("无法保留旧词库备份");
    }
    const result=await dictionaryRequest("migrate/legacy",{frags:legacy.frags || {}});
    USER.dictionaryMigration={digest:result.digest,version:1};
    lsWrite({dictionaryMigration:USER.dictionaryMigration});
    // Keep frags, presets, last, tutorial state and the full backup unchanged.
    return result;
}

function useTagCompletion({updatePrompt,promptRef,expandPhaseRef,theme,enabled=true,underscores=false,category=""}) {
    const [popup,setPopup]=React.useState(null),[active,setActive]=React.useState(0);
    const request=React.useRef({seq:0,timer:null,controller:null});
    const composing=React.useRef(false),latest=React.useRef(null),menuRef=React.useRef(null);
    function close() {
        request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();
        latest.current=null;setPopup(null);
    }
    function inspect(kind,node) {
        if(!enabled || composing.current || expandPhaseRef.current!=="idle" || !node || node.disabled){close();return;}
        const range=promptTagRange(node.value,node.selectionStart,node.selectionEnd);
        if(!range){close();return;}
        const value=node.value, caret=node.selectionStart, seq=++request.current.seq;
        clearTimeout(request.current.timer);request.current.controller?.abort();setPopup(null);
        latest.current={kind,node,value,range,caret};
        request.current.timer=setTimeout(async()=>{
            const controller=new AbortController();request.current.controller=controller;
            try {
                const data=await dictionaryRequest("search?q="+encodeURIComponent(range.query)+"&limit=30&completion=1&category="+encodeURIComponent(category),undefined,"GET",controller.signal);
                if(seq!==request.current.seq || controller.signal.aborted || expandPhaseRef.current!=="idle" ||
                    composing.current || node.value!==value || node.selectionStart!==caret || node.selectionStart!==node.selectionEnd ||
                    promptTagRange(node.value,node.selectionStart,node.selectionEnd)?.start!==range.start)return;
                if(!data.items?.length)return;
                setActive(0);setPopup({...latest.current,items:data.items,
                    geometry:completionGeometry(promptCaretPoint(node),window.innerWidth,window.innerHeight)});
            } catch(e) {/* Offline dictionary leaves the ordinary editor fully usable. */}
        },130);
    }
    function choose(item) {
        const cur=latest.current;
        if(!cur || composing.current || expandPhaseRef.current!=="idle")return;
        const {node,kind,range,value}=cur;
        if(node.value!==value || node.selectionStart!==cur.caret || node.selectionEnd!==cur.caret || promptRef.current[kind]!==value){close();return;}
        const next=replacePromptTag(value,range,item,underscores);
        close();updatePrompt({[kind]:next.value},"action");
        setTimeout(()=>{if(node.isConnected){node.focus();node.setSelectionRange(next.caret,next.caret);}},0);
    }
    function keys(e) {
        if(composing.current || e.isComposing || e.nativeEvent?.isComposing || e.keyCode===229)return;
        if(!popup || expandPhaseRef.current!=="idle")return;
        if(["ArrowDown","ArrowUp","Enter","Tab","Escape"].includes(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();e.stopPropagation();
            if(e.key==="Escape")close();
            else if(e.key==="ArrowDown" || e.key==="ArrowUp")setActive(i=>(i+(e.key==="ArrowDown"?1:-1)+popup.items.length)%popup.items.length);
            else choose(popup.items[active]);
        }
    }
    React.useEffect(()=>{
        if(typeof document==="undefined")return;
        const outside=e=>{if(latest.current?.node===e.target || menuRef.current?.contains(e.target))return;close();};
        const reposition=()=>{if(latest.current?.node && popup)setPopup(p=>p?{...p,geometry:completionGeometry(promptCaretPoint(latest.current.node),window.innerWidth,window.innerHeight)}:null);};
        document.addEventListener("pointerdown",outside,true);
        window.addEventListener("resize",reposition);window.addEventListener("scroll",reposition,true);
        return ()=>{document.removeEventListener("pointerdown",outside,true);window.removeEventListener("resize",reposition);window.removeEventListener("scroll",reposition,true);};
    },[!!popup]);
    React.useEffect(()=>{menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({block:"nearest"});},[active]);
    React.useEffect(()=>()=>{request.current.seq++;clearTimeout(request.current.timer);request.current.controller?.abort();},[]);
    return {
        close,
        props(kind) {return {
            role:"combobox","aria-autocomplete":"list","aria-controls":"cc-tag-completion",
            "aria-expanded":!!popup && popup.kind===kind,
            "aria-activedescendant":popup?.kind===kind?"cc-tag-option-"+active:undefined,
            onKeyDown:keys,onKeyUp:e=>{if(["ArrowLeft","ArrowRight","Home","End"].includes(e.key))inspect(kind,e.currentTarget);},
            onClick:e=>inspect(kind,e.currentTarget),onScroll:()=>close(),
            onBlur:()=>close(),
            onCompositionStart:()=>{composing.current=true;close();},
            onCompositionEnd:e=>{composing.current=false;inspect(kind,e.currentTarget);},
            onSelect:e=>{if(latest.current && (e.currentTarget.selectionStart!==latest.current.caret || e.currentTarget.selectionEnd!==latest.current.caret))inspect(kind,e.currentTarget);},
        };},
        changed:inspect,
        render() {return popup && expandPhaseRef.current==="idle" && enabled ? floating(h("div",{
            id:"cc-tag-completion",ref:menuRef,role:"listbox","aria-label":"Tag 候选",
            className:"dsh-comfy-floating cc-tag-completion",style:{...theme,position:"fixed",zIndex:2147480600,...popup.geometry},
            onMouseDown:e=>e.preventDefault()},
            popup.items.map((item,i)=>h("button",{key:item.id,id:"cc-tag-option-"+i,role:"option",type:"button",tabIndex:-1,
                "aria-selected":i===active,"data-active":i===active?"true":"false",className:"cc-tag-option",
                onMouseEnter:()=>setActive(i),onClick:()=>choose(item)},
                h("span",{className:"cc-tag-heading"},h("strong",null,item.label),h("small",null,item.kind==="snippet"?"片段":COMPLETION_RELATIONS[item.relation] || item.relation)),
                h("span",{className:"cc-tag-output"},item.output),
                item.sense && item.sense!==item.label?h("small",{className:"cc-tag-sense"},"义项："+item.sense):null,
                item.translations?.some(t=>t!==item.label)?h("small",{className:"cc-tag-sense"},"其他译名："+item.translations.filter(t=>t!==item.label).join(" / ")):null,
                h("small",null,item.category+" · "+item.source+(item.confidence<.6?" · 候选译名":"")))))) : null;},
    };
}



// ==================== 主组件 ====================
/** Reuse the existing spinner icon and button theme for cancellable tasks. */

function TaskAction({busy=false,stopping=false,label,busyLabel,onStart,onStop,disabled=false,style=S.btn2}) {
    return h("span",{className:"cc-task-action"},
        h("button",{type:"button",className:"cc-task-primary",style,disabled:disabled||busy||stopping,onClick:onStart,"aria-busy":busy||stopping},
            busy||stopping?h("span",{className:"cc-icon-spinner","aria-hidden":"true"},h(PromptIcon,{name:"spinner",size:13})):null,
            h("span",{className:"cc-task-label"},stopping?"正在停止…":busy?(busyLabel||label):label)),
        busy||stopping?h("button",{type:"button",className:"cc-task-stop",style:S.btn2,disabled:stopping||!onStop,onClick:onStop,"aria-label":"停止"+label},
            h(PromptIcon,{name:"stop",size:13}),h("span",null,"停止")):null);
}


function OutputPreviewPicker({item,theme,onClose,onSaved}){
    const [data,setData]=React.useState(null),[error,setError]=React.useState(''),[selected,setSelected]=React.useState(''),[busy,setBusy]=React.useState(false);
    const alive=React.useRef(true),posting=React.useRef(false);
    const source={path:item.path||'',image:item.imageInfo,prompt_id:item.promptId};
    const key=row=>JSON.stringify([row.kind,row.name,row.root_id]);
    React.useEffect(()=>{alive.current=true;const ctl=new AbortController();
        jpost(EXPANDER+'/outputs/preview-targets',source,30000,ctl.signal).then(r=>{if(!alive.current)return;setData(r);if(r.items.length===1)setSelected(key(r.items[0]));}).catch(e=>{if(alive.current&&!ctl.signal.aborted)setError(errText(e));});
        return()=>{alive.current=false;ctl.abort();};
    },[outputKey(item)]);
    async function save(){if(posting.current)return;const target=data?.items.find(r=>key(r)===selected);if(!target)return;posting.current=true;setBusy(true);setError('');
        try{const saved=await jpost(EXPANDER+'/outputs/add-preview',{...source,target},60000);if(alive.current){onSaved(target,saved);onClose();}}
        catch(e){if(alive.current)setError(errText(e));}finally{posting.current=false;if(alive.current)setBusy(false);}}
    return h(OverlayModal,{title:'加入模型预览图',theme,width:620,zIndex:2147483500,onClose:()=>{if(!posting.current)onClose();}},
        error?h('div',{role:'alert',style:S.bad},error):null,
        !data&&!error?h('div',{role:'status'},h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:15})),' 正在核验这张图片使用的模型…'):null,
        data?h(React.Fragment,null,h('span',{style:S.dim},'选择这张图片实际使用的模型'),
            data.items.length?h('div',{className:'cc-output-preview-targets'},data.items.map(row=>h('label',{key:key(row),className:'cc-output-preview-target'},
                h('input',{type:'radio',name:'preview-target',checked:selected===key(row),disabled:busy,onChange:()=>setSelected(key(row))}),h('span',null,h('strong',null,row.name),h('small',null,(row.label||row.kind)+' · '+row.path))))):h('div',{role:'status',style:S.dim},'没有可确认的本地模型。'),
            data.warnings?.length?h('details',null,h('summary',{className:'cc-summary'},'部分模型不可选'),data.warnings.map((w,i)=>h('div',{key:i,style:S.dim},w))):null):null,
        h('div',{className:'cc-dict-toolbar',style:{justifyContent:'flex-end'}},h('button',{type:'button',style:S.btn2,onClick:onClose,disabled:busy},'取消'),h('button',{type:'button',style:S.btn,onClick:save,disabled:busy||!selected},busy?'正在保存…':'保存预览图')));
}


function ModelPreviewEditor({model,theme,onClose,onChanged}){
    const [previews,setPreviews]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false),[selectedKey,setSelectedKey]=React.useState(''),[confirmDelete,setConfirmDelete]=React.useState(false),[dimensions,setDimensions]=React.useState({}),[failed,setFailed]=React.useState({}),[retry,setRetry]=React.useState(0);
    const task=React.useRef({seq:0,ctl:null,posting:false}),editorRef=React.useRef(null),confirmRef=React.useRef(null),deleteRef=React.useRef(null),restoreFocus=React.useRef(false);
    const keyOf=p=>p?String(p.id||p.url):'',modelKey=JSON.stringify([model.kind,model.name,model.root_id]);
    React.useEffect(()=>{
        const seq=++task.current.seq,ctl=new AbortController();task.current.ctl?.abort();task.current.ctl=ctl;task.current.posting=false;
        setPreviews(null);setError('');setBusy(false);setConfirmDelete(false);setSelectedKey('');setDimensions({});setFailed({});restoreFocus.current=false;
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(model.kind)+'&name='+encodeURIComponent(model.name)+'&root_id='+encodeURIComponent(model.root_id),20000,ctl.signal)
            .then(r=>{if(task.current.seq!==seq||ctl.signal.aborted)return;const rows=r.previews||[];setPreviews(rows);setSelectedKey(keyOf(rows[0]));})
            .catch(e=>{if(task.current.seq===seq&&!ctl.signal.aborted)setError(errText(e));});
        return()=>{if(task.current.seq===seq){task.current.seq++;task.current.ctl?.abort();task.current.ctl=null;task.current.posting=false;}};
    },[modelKey,retry]);
    React.useEffect(()=>{if(confirmDelete)confirmRef.current?.focus();},[confirmDelete]);
    React.useEffect(()=>{if(!restoreFocus.current)return;restoreFocus.current=false;
        const editor=editorRef.current,target=editor?.querySelector('button[aria-pressed="true"]')||editor?.closest('[role="dialog"]')?.querySelector('[aria-label="关闭弹窗"]');target?.focus({preventScroll:true});
    },[previews]);
    async function manage(action,id){
        if(task.current.posting||!id||!previews?.some(p=>p.id===id))return;
        const seq=task.current.seq,ctl=new AbortController();task.current.ctl?.abort();task.current.ctl=ctl;task.current.posting=true;
        setBusy(true);setError('');setConfirmDelete(false);
        try{const r=await jpost(EXPANDER+'/models/previews/manage',{...model,action,id},20000,ctl.signal);
            if(task.current.seq!==seq||ctl.signal.aborted)return;
            const rows=r.previews||[];restoreFocus.current=true;setPreviews(rows);setSelectedKey(prev=>rows.some(p=>keyOf(p)===prev)?prev:keyOf(rows[0]));onChanged?.(r);
        }catch(e){if(task.current.seq===seq&&!ctl.signal.aborted){setError(errText(e));deleteRef.current?.focus();}}
        finally{if(task.current.seq===seq){task.current.posting=false;task.current.ctl=null;setBusy(false);}}
    }
    const rows=previews||[],selected=rows.find(p=>keyOf(p)===selectedKey)||null,selectedIndex=rows.indexOf(selected),isPrimary=selectedIndex===0;
    const status=text=>h('div',{role:'status',style:S.dim},h('span',{className:'cc-icon-spinner'},h(PromptIcon,{name:'spinner',size:15})),' '+text);
    return h(OverlayModal,{title:'编辑预览图 · '+String(model.name).split(/[\\/]/).pop().replace(/\.(safetensors|ckpt|pt|pth|bin|gguf|onnx|sft)$/i,''),className:'cc-preview-editor-dialog',theme,width:1100,zIndex:2147481000,onClose:()=>{if(!task.current.posting)onClose();}},
        h('div',{ref:editorRef,className:'cc-preview-editor','aria-busy':busy||previews===null&&!error},
            error?h('div',{role:'alert',style:S.bad},error,previews===null?h('button',{type:'button',style:S.btn2,onClick:()=>setRetry(v=>v+1)},'重新读取'):null):null,
            previews===null&&!error?status('正在读取预览图…'):null,
            previews!==null?h('div',{className:'cc-preview-editor-summary'},h('span',null,rows.length?`共 ${rows.length} 张预览图 · 点击选择`:'暂无预览图')):null,
            rows.length?h('div',{className:'cc-preview-editor-scroll'},h(OutputMasonry,{
                items:rows.map(p=>({...p,width:dimensions[p.url]?.width||p.width||3,height:dimensions[p.url]?.height||p.height||4})),
                minColumnWidth:220,maxColumns:4,className:'cc-preview-editor-masonry',
                renderCard:(p,i)=>{
                    const k=keyOf(p),ratio=Math.min(6,Math.max(.12,(p.height||4)/(p.width||3)));
                    return h('button',{key:k,type:'button',className:'cc-preview-editor-image'+(k===selectedKey?' is-selected':''),'aria-pressed':k===selectedKey,'aria-label':'选择预览图 '+(i+1),disabled:busy,style:{aspectRatio:'1 / '+ratio},onClick:()=>{setSelectedKey(k);setConfirmDelete(false);}},
                        failed[p.url]?h('span',{className:'cc-preview-editor-failed'},'预览图加载失败'):h('img',{src:EXPANDER+p.url,alt:'模型预览图 '+(i+1),loading:'lazy',onError:()=>setFailed(v=>({...v,[p.url]:true})),onLoad:e=>{const {naturalWidth:width,naturalHeight:height}=e.currentTarget;if(width&&height)setDimensions(v=>v[p.url]?.width===width&&v[p.url]?.height===height?v:{...v,[p.url]:{width,height}});}}),
                        i===0?h('span',{className:'cc-preview-editor-badge'},'首预览'):null);
                }
            })):previews?h('div',{className:'cc-model-library-empty'},'暂无预览图'):null,
            rows.length?h('div',{className:'cc-preview-editor-actions'},
                h('span',{className:'cc-preview-editor-selection'},selected?`已选第 ${selectedIndex+1} 张`:'未选择图片'),
                h('button',{type:'button',style:S.btn2,disabled:busy||!selected?.id||isPrimary,onClick:()=>manage('primary',selected.id)},isPrimary?'当前首预览':'设为首预览'),
                h('button',{ref:deleteRef,type:'button',style:S.btn2,disabled:busy||!selected?.id,onClick:()=>setConfirmDelete(true)},'删除选中图片')):null,
            confirmDelete&&selected?h('div',{className:'cc-preview-editor-confirm',role:'alert'},h('span',null,'删除选中的预览图？'),h('button',{type:'button',style:S.btn2,disabled:busy,onClick:()=>{setConfirmDelete(false);deleteRef.current?.focus();}},'取消'),h('button',{ref:confirmRef,type:'button',style:S.btn2,disabled:busy,onClick:()=>manage('delete',selected.id)},'确认删除')):null,
            busy?status('正在更新预览图…'):null));
}


function ModelImageViewer({items,index,onIndex,name,theme,onClose}){
    return h(OutputInspector,{item:{id:items[index].url,url:EXPANDER+items[index].url,filename:name+" 大图 "+(index+1)},
        theme,onClose,onPrev:()=>onIndex((index-1+items.length)%items.length),onNext:()=>onIndex((index+1)%items.length),
        canPrev:items.length>1,canNext:items.length>1,imageOnly:true,label:"模型预览大图",counter:(index+1)+" / "+items.length});
}
// Workbench artwork reads the existing local attachment API; it never hashes or fetches a source.

const MODEL_DOCK_ASSETS=new Map();

function ModelDockAsset({kind,name,rootId,revision=0,variant,onMeta}) {
    const identity=/^\d+$/.test(String(rootId??''))?String(rootId):'',key=JSON.stringify([kind,name,identity,revision]);
    const [record,setRecord]=React.useState(null),[failed,setFailed]=React.useState('');
    const data=record?.key===key?record.data:null;
    React.useEffect(()=>{
        setFailed('');
        if(!name){setRecord(null);return;}
        const ctl=new AbortController(),cached=MODEL_DOCK_ASSETS.get(key);
        if(cached&&Date.now()-cached.time<60000){setRecord({key,data:cached.data});return;}
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(kind)+'&name='+encodeURIComponent(name)+(identity!==''?'&root_id='+identity:''),20000,ctl.signal)
            .then(data=>{if(ctl.signal.aborted)return;MODEL_DOCK_ASSETS.set(key,{time:Date.now(),data});if(MODEL_DOCK_ASSETS.size>80)MODEL_DOCK_ASSETS.delete(MODEL_DOCK_ASSETS.keys().next().value);setRecord({key,data});})
            .catch(()=>{if(!ctl.signal.aborted)setRecord({key,data:null});});
        return()=>ctl.abort();
    },[key]);
    React.useEffect(()=>{if(typeof onMeta==='function')onMeta(data||null);},[data,onMeta]);
    const local=data?.preview?.url||data?.previews?.[0]?.url;
    const url=typeof local==='string'&&local.startsWith('/models/preview?')?EXPANDER+local:'';
    const art=h('span',{className:'cc-model-dock-art cc-model-dock-art--'+variant},url&&failed!==url?h('img',{src:url,alt:(variant==='main'?'主模型':kind==='clip'?'文本编码器':kind==='vae'?'VAE':'LoRA')+' 本地预览图',decoding:'async',onError:()=>setFailed(url)}):h(PromptIcon,{name:'image',size:variant==='main'?26:20}));
    if(variant!=='main')return art;
    return h('span',{className:'cc-model-main-art'},art);
}


/** 本地生成页的底模缩略图。
 *  与 A 线 ModelDockAsset 共用 /models/detail 接口和 MODEL_DOCK_ASSETS 缓存，
 *  但**尺寸由行内样式决定**：A 线的 .cc-model-dock-art--main 被 CSS 钉死成 76×100，
 *  塞不进生成页那个窄栏，而它的宽度又写在 UI_CSS 里、变量定义不在本文件，改 CSS 代价大于收益。 */
function LocalCkptThumb({name,kind="checkpoint",width=40,height=52}) {
    const key=JSON.stringify([kind,name,"",0]);
    const [record,setRecord]=React.useState(null),[failed,setFailed]=React.useState('');
    React.useEffect(()=>{
        if(!name){setRecord(null);return;}
        const ctl=new AbortController(),cached=MODEL_DOCK_ASSETS.get(key);
        if(cached&&Date.now()-cached.time<60000){setRecord({key,data:cached.data});return;}
        jget(EXPANDER+'/models/detail?kind='+encodeURIComponent(kind)+'&name='+encodeURIComponent(name),20000,ctl.signal)
            .then(data=>{if(ctl.signal.aborted)return;MODEL_DOCK_ASSETS.set(key,{time:Date.now(),data});setRecord({key,data});})
            .catch(()=>{if(!ctl.signal.aborted)setRecord({key,data:null});});
        return()=>ctl.abort();
    },[key]);
    const data=record?.key===key?record.data:null;
    const local=data?.preview?.url||data?.previews?.[0]?.url;
    const url=typeof local==='string'&&local.startsWith('/models/preview?')?EXPANDER+local:'';
    return h("span",{style:{flex:"0 0 auto",width:width+"px",height:height+"px",borderRadius:"6px",overflow:"hidden",
            display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(127,127,127,.14)",color:"rgba(127,127,127,.72)"}},
        url&&failed!==url
            ?h("img",{src:url,alt:"底模预览图",decoding:"async",loading:"lazy",
                style:{width:"100%",height:"100%",objectFit:"cover",objectPosition:"center",display:"block"},
                onError:()=>setFailed(url)})
            :h(PromptIcon,{name:"image",size:18}));
}


function LocalModelPreview({previews,preview,name,loading=false,theme}) {
    const list=previews?.length?previews:preview?[preview]:[],viewport=React.useRef(null);
    const key=list.map(p=>p.url).join("|"),[opened,setOpened]=React.useState(null),[failed,setFailed]=React.useState({}),[dimensions,setDimensions]=React.useState({});
    React.useEffect(()=>{setOpened(null);setFailed({});if(viewport.current)viewport.current.scrollTop=0;},[key]);
    const items=list.map(item=>({...item,width:dimensions[item.url]?.width||3,height:dimensions[item.url]?.height||4}));
    return h("div",{className:"cc-model-preview-gallery"},
        h("div",{className:"cc-model-preview-viewport",ref:viewport,tabIndex:0,role:"region","aria-label":"模型预览图片区"},
            list.length?h(OutputMasonry,{items,minColumnWidth:140,maxColumns:3,className:"cc-model-preview-masonry",renderCard:(item,i)=>h("button",{key:item.url,type:"button",className:"cc-model-preview-tile","aria-label":"查看大图 "+(i+1),disabled:!!failed[item.url],style:{aspectRatio:1/Math.min(6,Math.max(.12,item.height/item.width))},onClick:()=>setOpened(i)},
                failed[item.url]?h("span",{className:"cc-model-preview-failed"},"预览图无法显示"):h("img",{src:EXPANDER+item.url,alt:name+" 模型预览图"+(i?" "+(i+1):""),loading:i===0?"eager":"lazy",decoding:"async",
                    onLoad:e=>{const {naturalWidth:width,naturalHeight:height}=e.currentTarget;if(width&&height)setDimensions(v=>v[item.url]?.width===width&&v[item.url]?.height===height?v:{...v,[item.url]:{width,height}});},
                    onError:()=>setFailed(v=>({...v,[item.url]:true}))}))}):
                h("div",{className:"cc-model-preview-placeholder"},h(PromptIcon,{name:"image",size:30}),h("span",null,loading?"正在读取预览图…":"暂无本地预览图"))),
        opened!==null&&list[opened]?h(ModelImageViewer,{items:list,index:opened,onIndex:setOpened,name,theme,onClose:()=>setOpened(null)}):null);
}

/** Stable identity shared by the output preview, library and masonry renderer.
 * Keep this outside Console: OutputMasonry is a separate React component. */

function outputKey(x){return x?.id||x?.path||x?.promptId||x?.url||x?.filename||"unknown-output";}

function mergeOutputCollections(sessionItems,savedItems){
    const keys=new Set(),merged=[];
    for(const x of [...(sessionItems||[]),...(savedItems||[])]){
        const key=x?.path||x?.url||x?.id||x?.promptId;
        if(!key||keys.has(key))continue;
        keys.add(key);merged.push(x);
    }
    merged.sort((a,b)=>(Number(b?.createdAt)||Number(b?.mtime)*1000||0)-(Number(a?.createdAt)||Number(a?.mtime)*1000||0));
    return merged;
}

/** Row-first masonry: next image enters the shortest available column, rather than filling one entire column before the next. */

function outputMasonryLayout(items,availableWidth,gap=8,minColumnWidth=220,maxColumns=Infinity){
    const width=Math.max(180,availableWidth||900),cols=Math.max(1,Math.min(maxColumns,Math.floor((width+gap)/(minColumnWidth+gap))));
    const cellWidth=(width-gap*(cols-1))/cols,heights=Array(cols).fill(0),positions=[];
    for(const item of items){
        let col=0;for(let j=1;j<cols;j++)if(heights[j]<heights[col])col=j;
        const w=Number(item.width)>0?Number(item.width):1,h=Number(item.height)>0?Number(item.height):1;
        const imageHeight=cellWidth*Math.min(6,Math.max(.12,h/w));
        positions.push({left:col*(cellWidth+gap),top:heights[col],width:cellWidth});
        heights[col]+=imageHeight+gap;
    }
    return {positions,height:Math.max(0,...heights)- (items.length?gap:0),columns:cols};
}

function OutputMasonry({items,renderCard,minColumnWidth=220,maxColumns=Infinity,className=""}){
    const ref=React.useRef(null),[width,setWidth]=React.useState(0);
    React.useEffect(()=>{
        const el=ref.current;if(!el)return;
        const update=()=>setWidth(el.clientWidth||0);update();
        if(typeof ResizeObserver==='undefined')return;
        const observer=new ResizeObserver(update);observer.observe(el);return()=>observer.disconnect();
    },[]);
    const layout=outputMasonryLayout(items,width,8,minColumnWidth,maxColumns);
    return h("div",{ref,className:"cc-output-masonry"+(className?" "+className:""),style:{height:layout.height+"px"}},
        ...items.map((x,i)=>h("div",{key:outputKey(x),className:"cc-masonry-cell",style:{left:layout.positions[i].left,top:layout.positions[i].top,width:layout.positions[i].width}},renderCard(x,i))));
}



function OutputPromptSection({title,text}){
    const [chinese,setChinese]=React.useState(false);
    const available=text!==undefined&&text!==null,value=available?String(text||''):'';
    const parts=available?splitPromptPreview(value):[];
    const renderTranslated=items=>{
        let end=0,translated='',dictionaryCount=0,machineCount=0,originalCount=0;
        for(let i=0;i<parts.length;i++){
            const part=parts[i],entry=items[i]||null,label=entry?.text||part.text;
            if(entry?.source==='dictionary')dictionaryCount++;
            else if(entry?.source==='machine')machineCount++;
            else originalCount++;
            translated+=value.slice(end,part.start)+(part.weight===1?label:'('+label+':'+part.weight+')');end=part.end;
        }
        translated+=value.slice(end);
        return h(React.Fragment,null,
            chinese&&items.length?h('div',{className:'cc-output-prompt-meta'},
                dictionaryCount?h('span',{className:'cc-output-prompt-source'},'词库中文 '+dictionaryCount):null,
                machineCount?h('span',{className:'cc-output-prompt-source'},'内置翻译 '+machineCount):null,
                originalCount?h('span',{className:'cc-output-prompt-source'},'保留原文 '+originalCount):null):null,
            h('div',{className:'cc-output-prompt-box'},available?(chinese?(translated||'（空）'):(value||'（空）')):'无法从图片元数据恢复'));
    };
    return h('section',{className:'cc-output-info-section'},
        h('div',{className:'cc-output-info-section-head'},h('strong',null,title),available?h('div',{className:'cc-output-prompt-toolbar'},
            h('button',{type:'button',className:'cc-output-prompt-translate','aria-pressed':chinese,
                title:'中文查看：优先使用本地词库中的 Tag 中文；未命中的短语和自然语言交给内置离线翻译引擎。',
                onClick:()=>setChinese(v=>!v)},chinese?'原文':'中文')):null),
        chinese&&available?h(PromptChinesePreview,{texts:parts.map(p=>p.text)},renderTranslated):renderTranslated([]));
}


function OutputInspector({item,theme,onStage,onClose,onPrev,onNext,canPrev,canNext,children,imageOnly=false,label="输出图片查看器",counter=""}){
    const viewerRef=React.useRef(null),stageRef=React.useRef(null),dragRef=React.useRef(null),actions=React.useRef({}),[scale,setScale]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[failed,setFailed]=React.useState(false);
    const [comparing,setComparing]=React.useState(false),[beforeStage,setBeforeStage]=React.useState(0);
    const stages=item?.stages||[],activeStage=item?.activeStage??stages[stages.length-1]?.index;
    actions.current={onClose,onPrev,onNext,canPrev,canNext};
    const reset=()=>{setScale(1);setPan({x:0,y:0});dragRef.current=null;};
    React.useEffect(()=>{reset();setFailed(false);},[outputKey(item),item?.url]);
    React.useEffect(()=>{if(scale===1)setPan({x:0,y:0});},[scale]);
    React.useEffect(()=>{
        if(typeof document==='undefined')return;
        const oldOverflow=document.body?.style?.overflow||'',oldActive=document.activeElement,viewer=viewerRef.current;
        if(document.body)document.body.style.overflow='hidden';viewer?.focus();
        const key=e=>{
            const current=actions.current;
            if(e.defaultPrevented || document.activeElement?.closest('[role="dialog"]')&&!viewer?.contains(document.activeElement))return;
            if(e.key==='Escape'){e.preventDefault();e.stopPropagation();current.onClose();return;}
            if(e.key==='Tab'){
                const controls=[...viewer.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0);
                const first=controls[0],last=controls[controls.length-1];
                if(!first){e.preventDefault();viewer.focus();}else if(e.shiftKey&&(!viewer.contains(document.activeElement)||document.activeElement===first||document.activeElement===viewer)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(!viewer.contains(document.activeElement)||document.activeElement===last||document.activeElement===viewer)){e.preventDefault();first.focus();}
                return;
            }
            const tag=String(e.target?.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;
            if(e.key==='ArrowLeft'&&current.canPrev){e.preventDefault();e.stopPropagation();current.onPrev();}
            else if(e.key==='ArrowRight'&&current.canNext){e.preventDefault();e.stopPropagation();current.onNext();}
            else if((e.key==='0'||e.key==='Home')&&(e.ctrlKey||e.metaKey)){e.preventDefault();reset();}
        };
        const blur=()=>{dragRef.current=null;};
        document.addEventListener('keydown',key,true);window.addEventListener('blur',blur);
        return()=>{document.removeEventListener('keydown',key,true);window.removeEventListener('blur',blur);if(document.body)document.body.style.overflow=oldOverflow;if(oldActive?.focus&&oldActive.isConnected)oldActive.focus({preventScroll:true});};
    },[]);
    React.useEffect(()=>{
        const node=stageRef.current;if(!node)return;
        const wheel=e=>{e.preventDefault();e.stopPropagation();if(e.deltaY)setScale(value=>Math.max(1,Math.min(16,value*(e.deltaY<0?1.14:1/1.14))));};
        node.addEventListener('wheel',wheel,{passive:false});return()=>node.removeEventListener('wheel',wheel);
    },[]);
    const pointerDown=e=>{if(scale<=1||e.button!==0)return;dragRef.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture?.(e.pointerId);};
    const pointerMove=e=>{const d=dragRef.current;if(!d||d.id!==e.pointerId)return;setPan({x:d.px+(e.clientX-d.x),y:d.py+(e.clientY-d.y)});};
    const pointerUp=e=>{if(dragRef.current?.id===e.pointerId)dragRef.current=null;if(e.currentTarget.hasPointerCapture?.(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
    return floating(h("div",{ref:viewerRef,tabIndex:-1,className:"dsh-comfy-floating cc-output-inspector"+(imageOnly?" is-image-only":""),style:{...(theme||{})},role:"dialog","aria-modal":"true","aria-label":label},
        h("button",{type:"button",className:"cc-output-inspector-close","aria-label":"关闭图片查看器","data-cc-tooltip":"关闭",onClick:onClose},h(PromptIcon,{name:"x",size:20})),
        h("section",{className:"cc-output-inspector-stage",ref:stageRef,onDoubleClick:reset,onPointerDown:pointerDown,onPointerMove:pointerMove,onPointerUp:pointerUp,onPointerCancel:pointerUp,onLostPointerCapture:()=>{dragRef.current=null;}},
            canPrev?h("button",{type:"button",className:"cc-output-inspector-nav is-prev","aria-label":"上一张",onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();onPrev();}},h(PromptIcon,{name:"chevronLeft",size:23})):null,
            item?.note&&stages.length<2?h('div',{className:'cc-stage-toolbar'},item.note):null,
            stages.length>1?h('div',{className:'cc-stage-toolbar',onPointerDown:e=>e.stopPropagation()},h('select',{'aria-label':'查看处理阶段',value:activeStage,onChange:e=>{const stage=stages.find(s=>s.index===Number(e.target.value));if(stage)onStage?.(stageOutput(item,stage));}},stages.map(s=>h('option',{key:s.node||s.index,value:s.index},s.label))),h('label',null,h('input',{type:'checkbox',checked:comparing,onChange:e=>setComparing(e.target.checked)}),'对比'),comparing?h('select',{'aria-label':'对比基准阶段',value:beforeStage,onChange:e=>setBeforeStage(Number(e.target.value))},stages.map(s=>h('option',{key:s.node||s.index,value:s.index},s.label))):null,item?.note?h('small',null,item.note):null):null,
            comparing&&stages.length>1?h('div',{className:'cc-comparison-host',onPointerDown:e=>e.stopPropagation(),onWheel:e=>e.stopPropagation()},h(PostCompare,{before:stageOutput(item,stages.find(s=>s.index===beforeStage)||stages[0]),after:{...item,label:stages.find(s=>s.index===activeStage)?.label||'当前阶段'}})):h("img",{className:"cc-output-inspector-image",src:item?.url,alt:item?.filename||"输出图片",draggable:false,onError:()=>setFailed(true),style:{transform:`translate3d(${pan.x}px,${pan.y}px,0) scale(${scale})`}}), 
            failed?h("span",{role:"status",className:"cc-output-inspector-error"},"图片无法显示"):null,
            canNext?h("button",{type:"button",className:"cc-output-inspector-nav is-next","aria-label":"下一张",onPointerDown:e=>e.stopPropagation(),onClick:e=>{e.stopPropagation();onNext();}},h(PromptIcon,{name:"chevronRight",size:23})):null,
            h("div",{className:"cc-output-inspector-zoom"},counter?counter+" · ":"",scale===1?"适应窗口":Math.round(scale*100)+"%"," · 滚轮缩放",scale>1?" · 拖拽移动":""," · 双击复位")),
        !imageOnly?h("aside",{className:"cc-output-inspector-info"},children):null));
}


/**
 * 隐藏「整页」滚动条，但不改动任何模块/列表内部的滚动条，也不禁用滚轮。
 * 插件根、它的宿主滚动祖先和 document.scrollingElement 才属于页面级容器。
 * 宿主容器跨页面复用，因此标记与样式保留到 DSH 本次运行结束。
 */

const PAGE_SCROLL_ATTR = "data-cc-page-scrollbar";

function installPageScrollbarHiding(root) {
    if (typeof document === "undefined" || !root) return () => {};
    const styleId = "cc-page-scrollbar-hide-style";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent =
            "[" + PAGE_SCROLL_ATTR + "]{scrollbar-width:none!important;-ms-overflow-style:none!important}" +
            "[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}" +
            "[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar-track,[" + PAGE_SCROLL_ATTR + "]::-webkit-scrollbar-thumb{background:transparent!important;border:0!important}";
        document.head.appendChild(style);
    }
    const mark = (el) => {
        if (!el || el.nodeType !== 1) return;
        try { el.setAttribute(PAGE_SCROLL_ATTR, "1"); } catch { /* ignore */ }
    };
    mark(root);
    for (let el = root.parentElement; el; el = el.parentElement) mark(el);
    const scrolling = document.scrollingElement || document.documentElement;
    if (scrolling) mark(scrolling);
    return () => {
        // 插件根会随面板卸载，清掉它的标记；宿主页面容器保留隐藏状态。
        try { root.removeAttribute(PAGE_SCROLL_ATTR); } catch { /* ignore */ }
    };
}


const CONSOLE_TAB_KEY="dsh-comfyui-console/last-tab";

const CONSOLE_PAGES=[["output", "历史"], ["online", "在线模型库"]];

const CONSOLE_TABS=CONSOLE_PAGES.map(([key])=>key);

function readLastConsoleTab(){
    try{const value=window.localStorage.getItem(CONSOLE_TAB_KEY);return CONSOLE_TABS.includes(value)?value:"output";}catch(e){return "gen";}
}


const POST_KINDS={upscale:'超分放大',resample:'二次采样',face:'FaceDetailer 面部细化',workflow:'自定义工作流'};

const POST_SAVE_OPTIONS=[{value:'final',label:'只保存最终输出'},{value:'original',label:'保存最终输出和原图'},{value:'all',label:'保存每个阶段'}];

const POST_INTERFACES=[['image','当前步骤图片','IMAGE'],['original','最初原图','IMAGE'],['model','模型','MODEL'],['clip','CLIP','CLIP'],['vae','VAE','VAE'],['positive','正面条件','CONDITIONING'],['negative','负面条件','CONDITIONING'],['pos','正面提示词','STRING'],['neg','负面提示词','STRING'],['latent','当前图片 Latent','LATENT'],['seed','Seed','INT'],['steps','步数','INT'],['cfg','CFG','FLOAT'],['sampler','采样器','STRING'],['scheduler','调度器','STRING'],['width','当前宽度','INT'],['height','当前高度','INT']];

const postClone=x=>JSON.parse(JSON.stringify(x));

function normalizePost(last={}){
 if(last.postControls?.version===1&&Array.isArray(last.postControls.cells))return postClone(last.postControls);
 return {version:1,save:'final',cells:last.upscale?[{id:'legacy-upscale',kind:'upscale',enabled:true,model:last.upscaleModel||'',factor:Number(last.upscaleFactor)||4}]:[]};
}

function newPostCell(kind){return {id:'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),kind,enabled:true,...({upscale:{model:'',factor:2},resample:{denoise:.3,inherit:true,steps:20,cfg:7,sampler:'euler',scheduler:'normal'},face:{detector:'bbox/face_yolov8m.pt',samModel:'',samDevice:'AUTO',segmDetector:'',sam_threshold:.93,sam_dilation:0,denoise:.4,guide_size:512,max_size:1024,bbox_threshold:.5,feather:5,inherit:true,steps:20,cfg:7},workflow:{workflow:{name:'新工作流',nodes:[],output:null}}}[kind]||{})};}

const FACE_RECOMMENDED={bbox:'bbox/face_yolov8m.pt',sam:'sam_vit_b_01ec64.pth',segm:'segm/person_yolov8n-seg.pt'};

function postFaceNames(info,role){const names=comboOptions(info,role==='sam'?'SAMLoader':'UltralyticsDetectorProvider','model_name');return names.filter(n=>typeof n==='string'&&!/^put_/i.test(n.split('/').pop())&&(role==='bbox'?/^(bbox|segm)\//.test(n):role==='segm'?n.startsWith('segm/'):true));}

function postFaceOptions(info,role,current){const names=postFaceNames(info,role),all=[...new Set([...names,FACE_RECOMMENDED[role],...(current?[current]:[])])];return [...(role!=='bbox'?[{value:'',label:'不使用'}]:[]),...all.map(name=>({value:name,label:names.includes(name)?name:(name===FACE_RECOMMENDED[role]?'未加载 · ':'未找到 · ')+name}))];}

function postFaceInstallation(cells){const models={bbox:[],sam:[],segm:[]};for(const c of cells.filter(c=>c.kind==='face'&&c.enabled!==false)){for(const [role,name] of [['bbox',c.detector],['sam',c.samModel],['segm',c.segmDetector]])if(name&&!models[role].includes(name))models[role].push(name);}if(!models.bbox.length)models.bbox.push(FACE_RECOMMENDED.bbox);return models;}

function movePostCell(cells,index,delta){const to=index+delta;if(to<0||to>=cells.length)return cells;const out=[...cells];[out[index],out[to]]=[out[to],out[index]];return out;}

function postPortType(spec,field){const d=spec?.input?.required?.[field]||spec?.input?.optional?.[field];return Array.isArray(d?.[0])||d?.[0]==='COMBO'?'STRING':d?.[0];}

function postDefaults(spec){const out={};for(const [key,desc] of Object.entries(spec?.input?.required||{})){if(desc[1]?.default!==undefined)out[key]=desc[1].default;else if(Array.isArray(desc[0]))out[key]=desc[0][0];else if(desc[0]==='COMBO')out[key]=desc[1]?.options?.[0];else if(desc[0]==='BOOLEAN')out[key]=false;else if(desc[0]==='STRING')out[key]='';}return out;}

function postWorkflowErrors(wf,info){
 const errors=[],nodes=wf?.nodes||[],map=new Map(nodes.map(n=>[n.id,n]));if(!String(wf?.name||'').trim())errors.push('请命名工作流');if(!nodes.length)errors.push('请添加节点');if(nodes.length>100)errors.push('工作流最多 100 个节点');if(map.size!==nodes.length)errors.push('节点 ID 重复');
 const sourceType=v=>v.interface?POST_INTERFACES.find(x=>x[0]===v.interface)?.[2]:info[map.get(v.node)?.type]?.output?.[v.slot];
 for(const n of nodes){const spec=info[n.type];if(!spec){errors.push('缺少节点 '+n.type);continue;}if(spec.output_node||/^(Save|Preview)/i.test(n.type)){errors.push('保存及预览由插件管理，请选择处理节点');continue;}
  for(const [key,d] of Object.entries(spec.input?.required||{}))if(!(key in n.inputs))errors.push(n.type+' 缺少 '+key);
  for(const [key,v] of Object.entries(n.inputs||{})){const typ=postPortType(spec,key);if(!typ){errors.push(n.type+' 未知输入 '+key);continue;}if(v&&typeof v==='object'){if(!v.interface&&!map.has(v.node))errors.push('连接的节点已不存在');const from=sourceType(v);if(!from||!(typ==='*'||from==='*'||typ===from||typ==='FLOAT'&&from==='INT'))errors.push(n.type+' · '+key+' 连接类型不匹配');}else{const d=spec.input?.required?.[key]||spec.input?.optional?.[key];const options=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;if(options&&!options.includes(v))errors.push(n.type+' · '+key+' 选项无效');if(['INT','FLOAT'].includes(typ)&&(v===''||v===null||!Number.isFinite(Number(v))||typ==='INT'&&!Number.isInteger(Number(v))||d[1]?.min!==undefined&&Number(v)<d[1].min||d[1]?.max!==undefined&&Number(v)>d[1].max))errors.push(n.type+' · '+key+' 数值无效');}}
 }
 const seen=new Set(),visiting=new Set();function walk(id){if(visiting.has(id)){errors.push('工作流不能循环连接');return;}if(seen.has(id))return;visiting.add(id);for(const v of Object.values(map.get(id)?.inputs||{}))if(v&&typeof v==='object'&&v.node)walk(v.node);visiting.delete(id);seen.add(id);}nodes.forEach(n=>walk(n.id));
 if(!wf?.output||!map.has(wf.output.node)||info[map.get(wf.output.node)?.type]?.output?.[wf.output.slot]!=='IMAGE')errors.push('请指定 IMAGE 处理结果');return [...new Set(errors)];
}

function stageOutput(item,s){return {...item,...s,url:s.path?savedOutputUrl(s.path):s.url||viewUrl(s.imageInfo),params:s.params||item.params,stages:item.stages,activeStage:s.index};}

function PostCompare({before,after}){
 const [split,setSplit]=React.useState(50),[zoom,setZoom]=React.useState(1),[pan,setPan]=React.useState({x:0,y:0}),[size,setSize]=React.useState({w:0,h:0}),[beforeSize,setBeforeSize]=React.useState(null),[error,setError]=React.useState('');const drag=React.useRef(null),viewport=React.useRef(null);
 React.useEffect(()=>{const el=viewport.current;if(!el)return;const wheel=e=>{e.preventDefault();e.stopPropagation();setZoom(v=>Math.max(1,Math.min(8,v*(e.deltaY<0?1.1:1/1.1))));};el.addEventListener('wheel',wheel,{passive:false});return()=>el.removeEventListener('wheel',wheel);},[]);
 React.useEffect(()=>{setZoom(1);setPan({x:0,y:0});setError('');setBeforeSize(null);setSize({w:0,h:0});drag.current=null;},[before.url,after.url]);
 const same=!beforeSize||!size.w||Math.abs(beforeSize.w/beforeSize.h-size.w/size.h)<.01;
 return h('div',{className:'cc-stage-comparison',onWheel:e=>{if(e.target.tagName==='INPUT')return;e.stopPropagation();setZoom(v=>Math.max(1,Math.min(8,v*(e.deltaY<0?1.1:1/1.1))));}},
 h('div',{className:'cc-comparison-tools'},h('span',null,before.label+' ↔ '+after.label),h('button',{type:'button',style:S.btn2,onClick:()=>{setZoom(1);setPan({x:0,y:0});}},'复位'),h('span',null,Math.round(zoom*100)+'%')),
 h('div',{className:'cc-comparison-viewport',ref:viewport,onPointerDown:e=>{if(zoom<=1||e.button!==0)return;drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:e=>{const d=drag.current;if(d&&d.id===e.pointerId)setPan({x:d.px+e.clientX-d.x,y:d.py+e.clientY-d.y});},onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;},onLostPointerCapture:()=>{drag.current=null;}},
 h('div',{className:'cc-comparison-pair'+(!same?' is-side-by-side':''),style:{aspectRatio:size.w?size.w/size.h:'1',transform:`translate(${pan.x}px,${pan.y}px) scale(${zoom})`}},
 h('img',{src:after.url,alt:after.label,draggable:false,onLoad:e=>setSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight}),onError:()=>setError('处理结果图片无法读取')}),
 h('img',{className:'cc-comparison-before',src:before.url,alt:before.label,draggable:false,style:same?{clipPath:`inset(0 ${100-split}% 0 0)`}:{},onLoad:e=>setBeforeSize({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight}),onError:()=>setError('处理前图片无法读取')}),same?h('span',{className:'cc-comparison-divider',style:{left:split+'%'}}):null)),
 same?h('input',{type:'range',min:0,max:100,value:split,'aria-label':'图片对比分隔线',onChange:e=>setSplit(Number(e.target.value))}):h('small',null,'图片比例不同，使用并排对比'),error?h('span',{role:'alert'},error):null);
}

function WorkflowEditor({workflow,info,theme,onSave,onClose}){
 const [draft,setDraft]=React.useState(()=>postClone(workflow)),[query,setQuery]=React.useState(''),[source,setSource]=React.useState(null),[error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);const start=React.useRef(JSON.stringify(workflow)),drag=React.useRef(null),area=React.useRef(null),ports=React.useRef(new Map());const [anchors,setAnchors]=React.useState({});
 React.useEffect(()=>{const box=area.current?.querySelector('.cc-flow-canvas')?.getBoundingClientRect();if(!box)return;const next={};for(const [key,el] of ports.current){if(!el?.isConnected)continue;const b=el.getBoundingClientRect();next[key]={x:b.left+b.width/2-box.left,y:b.top+b.height/2-box.top};}setAnchors(old=>JSON.stringify(old)===JSON.stringify(next)?old:next);},[draft]);
 const update=(id,patch)=>{if(!busy)setDraft(d=>({...d,nodes:d.nodes.map(n=>n.id===id?{...n,...patch}:n)}));};
 const changeInput=(node,key,value)=>update(node.id,{inputs:{...node.inputs,[key]:value}});
 const close=()=>{if(busy)return;if(JSON.stringify(draft)!==start.current&&!window.confirm('工作流尚未保存，放弃修改？'))return;onClose();};
 const types=Object.keys(info).filter(t=>!info[t]?.output_node&&!Object.values(info[t]?.input?.required||{}).some(d=>d[0]==='COMFY_AUTOGROW_V3')&&!/^(Save|Preview)/i.test(t)&&(info[t].display_name||t).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>a.localeCompare(b,'en')).slice(0,100);
 const add=type=>{const id='n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),inputs=postDefaults(info[type]);for(const [k,d] of Object.entries(info[type].input?.required||{}))if(d[0]==='IMAGE')inputs[k]={interface:'image'};setDraft(d=>({...d,nodes:[...d.nodes,{id,type,inputs,x:100+d.nodes.length*300,y:35}]}));};
 function connectionOptions(type){return [{value:'',label:'未连接'},...POST_INTERFACES.filter(x=>type===x[2]||type==='*'||type==='FLOAT'&&x[2]==='INT').map(x=>({value:'@'+x[0],label:'插件 · '+x[1]})),...draft.nodes.flatMap(n=>(info[n.type]?.output||[]).map((t,i)=>({n,t,i})).filter(x=>x.t===type||type==='*'||x.t==='*'||type==='FLOAT'&&x.t==='INT').map(x=>({value:n.id+':'+x.i,label:(info[n.type]?.display_name||n.type)+' · '+(info[n.type]?.output_name?.[x.i]||x.t)+' ['+n.id.slice(-4)+']'})))];}
 function connect(n,key){if(!source)return;const target=postPortType(info[n.type],key),from=source.interface?POST_INTERFACES.find(x=>x[0]===source.interface)?.[2]:info[draft.nodes.find(x=>x.id===source.node)?.type]?.output?.[source.slot];if(from!==target&&from!=='*'&&target!=='*'&&!(target==='FLOAT'&&from==='INT')){setError('接口类型不匹配：'+from+' → '+target);return;}changeInput(n,key,source);setSource(null);setError('');}
 const lines=draft.nodes.flatMap(n=>Object.entries(n.inputs).filter(([k,v])=>v?.node||v?.interface).map(([k,v])=>{const to=anchors[n.id+':in:'+k];if(!to)return null;const from=v.interface?{x:14,y:to.y}:anchors[v.node+':out:'+v.slot];if(!from)return null;return h('g',{key:n.id+k},h('path',{d:`M ${from.x} ${from.y} C ${from.x+65} ${from.y},${to.x-65} ${to.y},${to.x} ${to.y}`,fill:'none',stroke:'var(--cc-accent)',strokeWidth:2}),v.interface?h('text',{x:from.x+4,y:from.y-7,fill:'var(--cc-text)',fontSize:10},POST_INTERFACES.find(x=>x[0]===v.interface)?.[1]||v.interface):null);}));
 const field=(n,key,d)=>{const val=n.inputs[key],type=postPortType(info[n.type],key),linked=val&&typeof val==='object',opts=connectionOptions(type),selected=linked?(val.interface?'@'+val.interface:val.node+':'+val.slot):'';const choose=value=>{if(!value){const next={...n.inputs};delete next[key];update(n.id,{inputs:next});return;}changeInput(n,key,value.startsWith('@')?{interface:value.slice(1)}:{node:value.slice(0,value.lastIndexOf(':')),slot:Number(value.slice(value.lastIndexOf(':')+1))});};const values=Array.isArray(d[0])?d[0]:d[0]==='COMBO'?d[1]?.options:null;
 return h('div',{key,className:'cc-flow-input'},h('button',{type:'button',className:'cc-port',ref:el=>ports.current.set(n.id+':in:'+key,el),'aria-label':'连接 '+n.id+' '+key,onClick:()=>connect(n,key)},'●'),h('label',null,key+' · '+type,h('select',{'aria-label':n.id+' '+key+' 接口',value:selected,onChange:e=>choose(e.target.value)},opts.map(o=>h('option',{key:o.value,value:o.value},o.label)))),!linked?(values?h('select',{'aria-label':n.id+' '+key,value:val??'',onChange:e=>changeInput(n,key,e.target.value)},h('option',{value:''},'选择'),values.map(v=>h('option',{key:v,value:v},v))):['INT','FLOAT','STRING','BOOLEAN'].includes(type)?type==='BOOLEAN'?h('input',{type:'checkbox','aria-label':n.id+' '+key,checked:!!val,onChange:e=>changeInput(n,key,e.target.checked)}):h('input',{type:['INT','FLOAT'].includes(type)?'number':'text',step:type==='INT'?1:d[1]?.step||.01,value:val??'','aria-label':n.id+' '+key,onChange:e=>changeInput(n,key,['INT','FLOAT'].includes(type)?Number(e.target.value):e.target.value)}):null):null);
 };
 async function save(){const errs=postWorkflowErrors(draft,info);if(errs.length){setError(errs.join('；'));return;}setBusy(true);try{const r=await jpost(EXPANDER+'/post/workflows',{workflow:draft},20000);onSave(r.workflow);onClose();}catch(e){setError(errText(e));}finally{setBusy(false);}}
 return h(OverlayModal,{title:'自定义工作流编辑器',theme,width:1400,zIndex:2147481500,onClose:close},
 h('div',{className:'cc-flow-top'},h('input',{'aria-label':'工作流名称',style:S.inp,disabled:busy,value:draft.name,onChange:e=>setDraft(d=>({...d,name:e.target.value}))}),h('button',{type:'button',style:S.btn,disabled:busy,onClick:save},busy?'正在保存…':'保存并关闭')),
 error?h('div',{role:'alert',style:S.bad},error):null,
 h('fieldset',{className:'cc-flow-editor',disabled:busy,style:{border:0,padding:0,margin:0,minWidth:0}},h('aside',{className:'cc-flow-sidebar'},h('strong',null,'插件接口'),h('small',null,source?'已选接口，点击节点输入端口连接':'点击接口或输出端口，再点击输入端口连接'),POST_INTERFACES.map(x=>h('button',{key:x[0],type:'button',style:S.btn2,'aria-pressed':source?.interface===x[0],onClick:()=>setSource({interface:x[0]})},x[1]+' · '+x[2])),h('input',{type:'search','aria-label':'搜索工作流节点',placeholder:'搜索节点',value:query,onChange:e=>setQuery(e.target.value)}),types.map(t=>h('button',{type:'button',key:t,style:S.btn2,onClick:()=>add(t)},'+ '+(info[t].display_name||t)))),
 h('div',{className:'cc-flow-scroll',ref:area},h('div',{className:'cc-flow-canvas',style:{width:Math.max(1200,...draft.nodes.map(n=>n.x+300)),height:Math.max(750,...draft.nodes.map(n=>n.y+180+Object.keys({...info[n.type]?.input?.required,...info[n.type]?.input?.optional}).length*80))}},
 h('svg',{className:'cc-flow-links'},...lines),
 draft.nodes.map(n=>h('section',{key:n.id,className:'cc-flow-node',style:{left:n.x,top:n.y}},h('header',{onPointerDown:e=>{if(busy||e.button!==0||e.target.closest('button'))return;drag.current={id:n.id,x:e.clientX,y:e.clientY,px:n.x,py:n.y};e.currentTarget.setPointerCapture(e.pointerId);},onPointerMove:e=>{const d=drag.current;if(d?.id===n.id)update(n.id,{x:Math.max(0,d.px+e.clientX-d.x),y:Math.max(0,d.py+e.clientY-d.y)});},onPointerUp:()=>{drag.current=null;},onPointerCancel:()=>{drag.current=null;}},info[n.type]?.display_name||n.type,h('button',{type:'button','aria-label':'删除工作流节点 '+n.id,onClick:()=>setDraft(d=>({...d,nodes:d.nodes.filter(x=>x.id!==n.id).map(x=>({...x,inputs:Object.fromEntries(Object.entries(x.inputs).filter(([k,v])=>v?.node!==n.id))})),output:d.output?.node===n.id?null:d.output}))},'×')),
 h('div',{className:'cc-flow-outputs'},(info[n.type]?.output||[]).map((t,i)=>h('div',{key:i,className:'cc-flow-output-row'},h('button',{type:'button',ref:el=>ports.current.set(n.id+':out:'+i,el),'aria-pressed':source?.node===n.id&&source?.slot===i,'aria-label':n.id+' 输出 '+i,onClick:()=>setSource({node:n.id,slot:i})},(info[n.type]?.output_name?.[i]||t)+' ●'),t==='IMAGE'?h('button',{type:'button','aria-label':'设为处理结果 '+n.id+' '+i,'aria-pressed':draft.output?.node===n.id&&draft.output?.slot===i,onClick:()=>setDraft(d=>({...d,output:{node:n.id,slot:i}}))},draft.output?.node===n.id&&draft.output?.slot===i?'✓ 处理结果':'→ 结果'):null))),
 Object.entries(info[n.type]?.input?.required||{}).map(([k,d])=>field(n,k,d)),h('details',null,h('summary',null,'可选输入'),Object.entries(info[n.type]?.input?.optional||{}).map(([k,d])=>field(n,k,d)))))))),
 h('small',null,'连接当前图片或插件参数，并指定一个 IMAGE 输出为处理结果。关闭未保存的窗口会提示放弃修改。'));
}

let postBridgePromptSkipped=false;

function PostControlsModal({value,onChange,theme,onClose,upscalers,samplers,schedulers,onInstalled}){
 const [info,setInfo]=React.useState({}),[error,setError]=React.useState(''),[loading,setLoading]=React.useState(true),[install,setInstall]=React.useState(null),[editing,setEditing]=React.useState(null),[library,setLibrary]=React.useState([]),[bridgeSkipped,setBridgeSkipped]=React.useState(postBridgePromptSkipped),[bridgeBusy,setBridgeBusy]=React.useState(false),[bridgeCopied,setBridgeCopied]=React.useState(false);const bridgeCopyRef=React.useRef(false),bridgeActionRef=React.useRef(false);const alive=React.useRef(true),busy=React.useRef(false),drag=React.useRef(null);
 React.useEffect(()=>{const ctl=new AbortController();alive.current=true;Promise.allSettled([jget(COMFY+'/object_info',30000,ctl.signal),jget(EXPANDER+'/post/dependencies',10000,ctl.signal),jget(EXPANDER+'/post/workflows',10000,ctl.signal)]).then(results=>{if(ctl.signal.aborted)return;const [a,b,c]=results;if(a.status==='fulfilled')setInfo(a.value);else setError('节点列表读取失败：'+errText(a.reason));if(b.status==='fulfilled')setInstall(b.value);else{setInstall({message:'安装状态无法读取'});setError('安装状态读取失败：'+errText(b.reason));}if(c.status==='fulfilled')setLibrary(c.value.items||[]);else setError('工作流列表读取失败：'+errText(c.reason));setLoading(false);});return()=>{alive.current=false;ctl.abort();};},[]);
 React.useEffect(()=>{if(!install?.running)return;let stopped=false,querying=false;const ctl=new AbortController();const timer=setInterval(async()=>{if(querying)return;querying=true;try{const r=await jget(EXPANDER+'/post/dependencies',10000,ctl.signal);if(!stopped&&alive.current)setInstall(r);}catch(e){if(!stopped&&alive.current)setError('安装状态读取失败：'+errText(e));}finally{querying=false;}},1500);return()=>{stopped=true;clearInterval(timer);ctl.abort();};},[install?.running]);
 const cells=value.cells,patch=(id,data)=>onChange({...value,cells:cells.map(c=>c.id===id?{...c,...data}:c)}),remove=id=>onChange({...value,cells:cells.filter(c=>c.id!==id)});
 const addCell=(kind,wf)=>{if(cells.length>=24)return;const c=newPostCell(kind);if(kind==='upscale')c.model=upscalers[0]||'';if(wf)c.workflow=postClone(wf);onChange({...value,cells:[...cells,c]});};
 async function setup(modelsOnly=false,selectedCells=value.cells){if(busy.current||bridgeActionRef.current)return;busy.current=true;setError('');try{if(install?.faceModelsVersion!==1)throw Error('请更新并重启 Sidecar，以支持 BBOX / SAM / SEGM 模型安装');const r=await jpost(EXPANDER+'/post/dependencies/install',{models:postFaceInstallation(selectedCells),modelsOnly:modelsOnly===true},15000);if(alive.current){setInstall(r);onInstalled?.();}}catch(e){if(alive.current)setError(errText(e));}finally{busy.current=false;}}
 async function copyBridgeOnly(){
  if(bridgeCopyRef.current)return;bridgeCopyRef.current=true;
  try{const r=await jpost(EXPANDER+'/post/bridge/install',{},15000);if(alive.current){setInstall(r);setBridgeCopied(true);}}
  catch(e){if(alive.current)setError(errText(e));}
 }
 React.useEffect(()=>{
  if(loading||!install||install.online!==false||install.bridge)return;
  if(install.bridgeCurrent){setBridgeCopied(true);return;}
  copyBridgeOnly();
 },[loading,install]);
 async function installBridge(){
  if(bridgeActionRef.current||busy.current||install?.running)return;bridgeActionRef.current=true;setBridgeBusy(true);setError('');
  try{
   const copied=await jpost(EXPANDER+'/post/bridge/install',{},15000);
   if(alive.current)setInstall(copied);
   if(!alive.current)return;
   const stopped=await jpost(EXPANDER+'/comfy/stop',{},60000);
   if(!stopped?.ok)throw new Error(stopped?.message||'ComfyUI 关闭失败，未继续启动');
   BG.shutdown();
   if(!alive.current)return;
   const started=await jpost(EXPANDER+'/comfy/start',{mode:'background'},160000);
   if(!started?.ok)throw new Error(started?.message||'ComfyUI 启动失败，请在连接设置中重试');
   let ok=false;
   for(let i=0;i<75;i++){
    await new Promise(r=>setTimeout(r,2000));
    if(!alive.current)return;
    try{const state=await jget(EXPANDER+'/post/dependencies',10000);setInstall(state);if(state.bridge){ok=true;break;}}catch(e){}
   }
   if(ok){
    try{const latest=await jget(COMFY+'/object_info',30000);setInfo(latest);}catch(e){}
    postBridgePromptSkipped=false;setBridgeSkipped(false);onInstalled?.();
   }else setError('桥接节点已复制，但 ComfyUI 尚未加载；请查看安装记录或稍后重启。');
  }catch(e){if(alive.current)setError(errText(e));}
  finally{bridgeActionRef.current=false;if(alive.current)setBridgeBusy(false);}
 }
 const num=(c,key,label,min,max,step=.01)=>h('label',{style:S.field},h('span',{style:S.label},label),h('input',{style:{...S.inp,width:'100%'},type:'number',min,max,step,value:c[key]??(key==='sam_threshold'?.93:key==='sam_dilation'?0:''),'aria-label':label+' '+c.id,onChange:e=>patch(c.id,{[key]:e.target.value===''?'':Number(e.target.value)})}));
 const select=(c,key,label,options)=>h('label',{style:S.field},h('span',{style:S.label},label),h(SelectMenu,{theme,label:label+' '+c.id,value:c[key]??(key==='samDevice'?'AUTO':''),options,onChange:v=>patch(c.id,{[key]:v}),minWidth:0,forceSearch:true}));
 const inherited=c=>h('label',{style:S.field},h('span',{style:S.label},'采样参数'),h(SelectMenu,{theme,label:'采样参数 '+c.id,minWidth:0,value:c.inherit===false?'custom':'inherit',options:[{value:'inherit',label:'继承当前参数'},{value:'custom',label:'自定义参数'}],onChange:v=>patch(c.id,{inherit:v==='inherit'})}));
 async function refreshFaceModels(){setError('');try{const latest=await jget(COMFY+'/object_info',30000);if(alive.current)setInfo(latest);const state=await jget(EXPANDER+'/post/dependencies',10000);if(alive.current)setInstall(state);}catch(e){if(alive.current)setError('模型列表刷新失败：'+errText(e));}}
 React.useEffect(()=>{if(install?.running===false&&!loading)refreshFaceModels();},[install?.running]);
 const faceStatus=c=>[['BBOX','bbox',c.detector],['SAM','sam',c.samModel],['SEGM','segm',c.segmDetector]].map(([label,role,name])=>{const item=install?.models?.[role];return label+'：'+(!name?'未启用':postFaceNames(info,role).includes(name)?'已识别':item?.default===name&&item.fileExists?'文件已安装，待加载':item?.default===name&&item.fileExists===false?'未安装':'待确认');}).join(' · ');
 const faceSelect=(c,key,label,role)=>select(c,key,label,postFaceOptions(info,role,c[key]));
 return h(OverlayModal,{title:'生成后控制',className:'cc-post-dialog cc-model-library-dialog',theme,width:1280,guideTarget:'post-panel',onClose},
 error?h('div',{role:'alert',style:S.bad},error):null,
 !loading&&install&&install.online===true&&!install.bridge&&!bridgeSkipped?h('div',{className:'cc-post-bridge-prompt',role:'status'},
  h('div',null,h('strong',null,'缺少 DSH 图像桥接节点'),h('span',null,'AI 阶段顺序、动态尺寸/倍率需要 DSHPostScale、DSHPostStage、DSHPostImageSize。安装后必须重启 ComfyUI 才会加载，正在生成的任务会被中断。')),
  h('div',{className:'cc-post-bridge-actions'},
   h('button',{type:'button',style:S.btn,disabled:bridgeBusy,onClick:installBridge},bridgeBusy?'正在安装并重启 ComfyUI…':'重启 ComfyUI 并安装'),
   h('button',{type:'button',style:S.btn2,disabled:bridgeBusy,onClick:()=>{postBridgePromptSkipped=true;setBridgeSkipped(true);}},'暂时跳过'))):null,
 h('div',{className:'cc-post-toolbar'},h('div',{className:'cc-post-save-field cc-field-capsule','data-cc-guide':'post-save','data-cc-tooltip':'关闭“保存输出到本地”时仅生成 Temp 预览。',title:'关闭“保存输出到本地”时仅生成 Temp 预览。'},h('span',null,'最终保存'),h(SelectMenu,{theme,label:'最终保存选项',value:value.save,options:POST_SAVE_OPTIONS,onChange:save=>onChange({...value,save}),minWidth:0})),h(TaskAction,{busy:!!install?.running,label:'检查并安装缺失组件',busyLabel:'安装中…',onStart:()=>setup(false),onStop:async()=>{try{setInstall(await jpost(EXPANDER+'/post/dependencies/cancel',{},10000));}catch(e){setError(errText(e));}}})),
 h('div',{role:'status',style:S.dim},bridgeBusy?'正在安装并重启 ComfyUI…':bridgeCopied&&!install?.online?'桥接节点已复制，启动 ComfyUI 后生效':install?.message||'正在检查本地安装'),
 install?.log?h('details',null,h('summary',null,'安装记录'),h('pre',{className:'cc-post-log'},install.log)):null,
 bridgeSkipped&&install?.online&&!install.bridge?h('button',{type:'button',style:S.btn2,disabled:bridgeBusy||install?.running,onClick:()=>{postBridgePromptSkipped=false;setBridgeSkipped(false);}},'安装桥接节点'):null,
 h('div',{className:'cc-post-notebook'},h('aside',{className:'cc-post-add','aria-label':'生成后控制列表'},
 h('section',{className:'cc-post-side-section cc-post-section-defaults','data-cc-guide':'post-defaults'},h('strong',null,'默认生成后控制'),
  ...Object.entries(POST_KINDS).filter(([kind])=>kind!=='workflow').map(([kind,label])=>h('button',{key:kind,type:'button',className:'cc-control-add-row',disabled:cells.length>=24,onClick:()=>addCell(kind)},h('span',null,label),h('small',null,'添加'))))),
 h('div',{className:'cc-post-cells','data-cc-guide':'post-cells'},!cells.length?h('div',{className:'cc-model-library-empty'},'从左侧添加生成后控制'):null,
 cells.map((c,i)=>h('section',{key:c.id,className:'cc-post-cell','data-kind':c.kind,'data-disabled':c.enabled===false,onDragOver:e=>e.preventDefault(),onDrop:e=>{e.preventDefault();const from=drag.current;drag.current=null;if(from==null||from===i)return;const next=[...cells],cell=next.splice(from,1)[0];next.splice(i,0,cell);onChange({...value,cells:next});}},
 h('header',{className:'cc-post-cell-head'},
  h('span',{className:'cc-post-cell-index','aria-hidden':'true'},String(i+1).padStart(2,'0')),
  h('span',{className:'cc-post-cell-drag',draggable:true,title:'拖动排序',role:'button',tabIndex:0,'aria-label':'拖动排序 '+(i+1),onDragStart:e=>{drag.current=i;e.dataTransfer.setData('text/plain',c.id);},onDragEnd:()=>{drag.current=null;}},'⠿'),
  h('strong',{className:'cc-post-cell-title'},c.kind==='workflow'?c.workflow?.name||POST_KINDS.workflow:POST_KINDS[c.kind]),
  h('div',{className:'cc-post-cell-enable cc-field-capsule'},h('span',{className:'cc-control-pill-label'},'启用'),h(SelectMenu,{theme,label:'启用控制 '+(i+1),minWidth:0,value:c.enabled!==false?'on':'off',options:[{value:'on',label:'ON'},{value:'off',label:'OFF'}],onChange:v=>patch(c.id,{enabled:v==='on'})})),
  h('div',{className:'cc-post-cell-actions'},[['↑','上移',-1],['↓','下移',1]].map(([icon,label,delta])=>h('button',{key:label,type:'button',style:S.btn2,'aria-label':label+'控制 '+(i+1),'data-cc-tooltip':label,disabled:delta<0?i===0:i===cells.length-1,onClick:()=>onChange({...value,cells:movePostCell(cells,i,delta)})},icon)),h('button',{type:'button',style:S.btn2,'aria-label':'删除控制 '+(i+1),'data-cc-tooltip':'删除',onClick:()=>remove(c.id)},h(PromptIcon,{name:'trash',size:15})))),
 h('div',{className:'cc-post-cell-fields'},
 c.kind==='upscale'?h('div',{className:'cc-post-param-group','data-layout':'upscale'},select(c,'model','放大模型',upscalers),num(c,'factor','倍率',.1,8,.01)):null,
 c.kind==='resample'||c.kind==='face'?h(React.Fragment,null,
  h('div',{className:'cc-post-param-group'},num(c,'denoise','降噪强度',c.kind==='face'?.0001:0,1),inherited(c)),
  c.inherit===false?h('div',{className:'cc-post-param-group','data-layout':c.kind==='resample'?'sampling':'pair'},num(c,'steps','步数',1,10000,1),num(c,'cfg','CFG',0,100),c.kind==='resample'?select(c,'sampler','采样器',samplers):null,c.kind==='resample'?select(c,'scheduler','调度器',schedulers):null):null):null,
 c.kind==='face'?h('div',{className:'cc-post-param-group'},
  h('span',{className:'cc-post-param-wide',style:S.label},'检测与细化'),
  h('div',{className:'cc-post-param-wide'},faceSelect(c,'detector','BBOX · 面部定位','bbox')),
  faceSelect(c,'samModel','SAM · 精细轮廓（可选）','sam'),faceSelect(c,'segmDetector','SEGM · 分割遮罩（可选）','segm'),
  c.samModel&&c.segmDetector?h('span',{className:'cc-post-param-wide',style:S.dim},'已启用 SAM，按官方逻辑优先使用 SAM；SEGM 选择保留。'):null,
  c.samModel?h(React.Fragment,null,h('div',{className:'cc-post-param-wide'},select(c,'samDevice','SAM 运行设备',comboOptions(info,'SAMLoader','device_mode').length?comboOptions(info,'SAMLoader','device_mode'):['AUTO','Prefer GPU','CPU'])),num(c,'sam_threshold','SAM 阈值',0,1),num(c,'sam_dilation','SAM 遮罩扩张',-512,512,1)):null,
  h('span',{className:'cc-post-param-wide',style:S.dim,role:'status'},faceStatus(c)),
  h('div',{className:'cc-post-param-actions'},h(TaskAction,{busy:!!install?.running,label:'安装所选检测模型',busyLabel:'安装中…',onStart:()=>setup(true,[{...c,enabled:true}]),onStop:async()=>{try{setInstall(await jpost(EXPANDER+'/post/dependencies/cancel',{},10000));}catch(e){setError(errText(e));}}}),h('button',{type:'button',style:S.btn2,onClick:refreshFaceModels},'刷新模型列表')),
  num(c,'guide_size','细化尺寸',64,16384,8),num(c,'max_size','最大尺寸',64,16384,8),num(c,'bbox_threshold','检测阈值',0,1),num(c,'feather','羽化',0,100,1),
  !info.FaceDetailer?h('span',{className:'cc-post-param-wide',style:S.warn},'当前服务未加载 FaceDetailer，请安装后重启 ComfyUI。'):null):null,
 c.kind==='workflow'?h('div',{className:'cc-post-param-group'},
  library.length?h('div',{className:'cc-post-param-wide'},h('label',{style:S.field},h('span',{style:S.label},'使用已保存工作流'),h(SelectMenu,{theme,label:'已保存工作流 '+c.id,minWidth:0,forceSearch:true,value:library.some(w=>w.id===c.workflow?.id)?c.workflow.id:'',options:[{value:'',label:'选择已保存工作流'},...library.map(w=>({value:w.id,label:w.name}))],onChange:id=>{const wf=library.find(w=>w.id===id);if(wf)patch(c.id,{workflow:postClone(wf)});}}))):null,
  h('div',{className:'cc-post-param-actions'},
   h('button',{type:'button',style:S.btn2,disabled:loading||!Object.keys(info).length,onClick:()=>setEditing(c.id)},'编辑工作流'),
   c.workflow?.id?h('button',{type:'button',style:S.btn2,onClick:async()=>{if(!window.confirm('从已保存工作流中删除？当前单元格副本会保留。'))return;try{await jpost(EXPANDER+'/post/workflows/delete',{id:c.workflow.id},10000);setLibrary(rows=>rows.filter(w=>w.id!==c.workflow.id));patch(c.id,{workflow:{...c.workflow,id:undefined}});}catch(e){setError(errText(e));}}},'删除已保存工作流'):null)):null))))),
 editing?(()=>{const cell=cells.find(c=>c.id===editing);return cell?h(WorkflowEditor,{workflow:cell.workflow,info,theme,onClose:()=>setEditing(null),onSave:w=>{patch(cell.id,{workflow:w});setLibrary(rows=>[w,...rows.filter(r=>r.id!==w.id)]);}}):null;})():null);
}



/* ==================== 原 A 线组件（已并入原线，0.7.129）====================
 * PreviewConsole（历史页 / 在线模型库）与 PBG（后台任务管理器）原先在
 * lib/preview_console.js 里，但那只是物理拆文件：它依赖本文件 98 个顶层符号
 * （h / React / S / USER / COMFY / jget / jpost / errText / PromptIcon ……），
 * 逻辑上从未独立。为去依赖化与分发，整体并回原线，不再有中间层模块。
 * 备份见 lib/preview_console.js.bak-0.7.129。
 */
