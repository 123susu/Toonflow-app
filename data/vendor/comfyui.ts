/**
 * Toonflow local ComfyUI provider - MiniMax H3 image-to-video
 * @version 2.0
 */

type VideoMode = "singleImage" | "startEndRequired" | "endFrameOptional" | "startFrameOptional" | "text" | string[];
interface TextModel { name: string; modelName: string; type: "text"; think: boolean }
interface ImageModel { name: string; modelName: string; type: "image"; mode: ("text" | "singleImage" | "multiReference")[] }
interface VideoModel {
  name: string; modelName: string; type: "video"; mode: VideoMode[];
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}
interface TTSModel { name: string; modelName: string; type: "tts"; voices: { title: string; voice: string }[] }
interface VendorConfig {
  id: string; version: string; name: string; author: string; description?: string; icon?: string;
  inputs: { key: string; label: string; type: "text" | "password" | "url"; required: boolean; placeholder?: string }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}
type ReferenceList = { type: "image" | "audio" | "video"; sourceType?: "base64"; base64: string };
interface ImageConfig { prompt: string; referenceList?: ReferenceList[]; size: string; aspectRatio: string }
interface VideoConfig {
  duration: number; resolution: string; aspectRatio: "16:9" | "9:16"; prompt: string;
  referenceList?: ReferenceList[]; audio?: boolean; mode: VideoMode[];
}
interface TTSConfig { text: string; voice: string; speechRate: number; pitchRate: number; volume: number; referenceList?: ReferenceList[] }

declare const axios: any;
declare const FormData: any;
declare const Buffer: any;
declare const crypto: any;
declare const logger: (message: any) => void;
declare const urlToBase64: (url: string) => Promise<string>;
declare const pollTask: (fn: () => Promise<{ completed: boolean; data?: string; error?: string }>, interval?: number, timeout?: number) => Promise<{ completed: boolean; data?: string; error?: string }>;
declare const exports: Record<string, any>;

const vendor: VendorConfig = {
  id: "comfyui",
  version: "2.0",
  name: "ComfyUI（本地）",
  author: "Local",
  description: "调用本机 ComfyUI 的 MiniMax H3 工作流，支持文本或首帧图生带声音视频。ComfyUI 必须保持运行。",
  inputs: [
    { key: "baseUrl", label: "ComfyUI 地址", type: "url", required: true, placeholder: "http://127.0.0.1:8188" },
  ],
  inputValues: { baseUrl: "http://127.0.0.1:8188" },
  models: [
    {
      name: "MiniMax H3（工作流：toolflow-video_minimax_h3_i2v）",
      modelName: "toolflow-video_minimax_h3_i2v",
      type: "video",
      mode: ["startEndRequired", "endFrameOptional", "startFrameOptional", "text"],
      audio: true,
      durationResolutionMap: [{ duration: [5, 10, 15], resolution: ["480p"] }],
    },
  ],
};

const workflowTemplate: Record<string, any> = {
  "92": { inputs: { filename_prefix: "video/MiniMax_H3", format: "auto", codec: "auto", video: ["105:91", 0] }, class_type: "SaveVideo", _meta: { title: "保存视频" } },
  "114": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "加载图像" } },
  "124": { inputs: { image: "" }, class_type: "LoadImage", _meta: { title: "加载尾帧" } },
  "115": { inputs: { aspect_ratio: "16:9 (Widescreen)", megapixels: 0.4, multiple: 32 }, class_type: "ResolutionSelector", _meta: { title: "分辨率选择器" } },
  "105:11": { inputs: { vae_name: "minimax_h3_video_vae_fp16.safetensors" }, class_type: "VAELoader", _meta: { title: "加载视频 VAE" } },
  "105:24": { inputs: { vae_name: "minimax_h3_audio_vae_fp32.safetensors" }, class_type: "VAELoader", _meta: { title: "加载音频 VAE" } },
  "105:23": { inputs: { samples: ["105:14", 0], vae: ["105:24", 0] }, class_type: "VAEDecodeAudio", _meta: { title: "音频解码" } },
  "105:10": { inputs: { samples: ["105:14", 0], vae: ["105:11", 0] }, class_type: "VAEDecode", _meta: { title: "视频解码" } },
  "105:17": { inputs: { sampler_name: "res_multistep" }, class_type: "KSamplerSelect", _meta: { title: "采样器" } },
  "105:9": { inputs: { scheduler: "simple", steps: 20, denoise: 1, model: ["105:6", 0] }, class_type: "BasicScheduler", _meta: { title: "调度器" } },
  "105:14": { inputs: { noise: ["105:15", 0], guider: ["105:16", 0], sampler: ["105:17", 0], sigmas: ["105:9", 0], latent_image: ["105:104", 1] }, class_type: "SamplerCustomAdvanced", _meta: { title: "高级采样" } },
  "105:16": { inputs: { model: ["105:6", 0], conditioning: ["105:104", 0] }, class_type: "BasicGuider", _meta: { title: "引导器" } },
  "105:6": { inputs: { unet_name: "minimax_h3_fl2va_pruned_int8_convrot.safetensors", weight_dtype: "default" }, class_type: "UNETLoader", _meta: { title: "加载 UNet" } },
  "105:13": { inputs: { clip_name: "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors", type: "minimax", device: "default" }, class_type: "CLIPLoader", _meta: { title: "加载 CLIP" } },
  "105:15": { inputs: { noise_seed: 1 }, class_type: "RandomNoise", _meta: { title: "随机种子" } },
  "105:91": { inputs: { fps: 24, bit_depth: 8, images: ["105:10", 0], audio: ["105:23", 0] }, class_type: "CreateVideo", _meta: { title: "创建视频" } },
  "105:104": { inputs: { prompt: "", width: ["115", 0], height: ["115", 1], length: ["105:107", 1], clip: ["105:13", 0], vae: ["105:11", 0] }, class_type: "MiniMaxH3ImageToVideo", _meta: { title: "MiniMax H3 Image to Video" } },
  "105:107": { inputs: { expression: "max(5, round(a * 24)) + (5 - (max(5, round(a * 24)) % 17)) % 17", "values.a": ["105:111", 0] }, class_type: "ComfyMathExpression", _meta: { title: "时长转帧数" } },
  "105:111": { inputs: { value: 5 }, class_type: "PrimitiveFloat", _meta: { title: "视频时长" } },
};

const textRequest = () => { throw new Error("此供应商不支持文本模型"); };
const imageRequest = async (_config: ImageConfig, _model: ImageModel): Promise<string> => { throw new Error("此供应商不支持图片模型"); };

const videoRequest = async (config: VideoConfig, _model: VideoModel): Promise<string> => {
  const baseUrl = (vendor.inputValues.baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error("请填写 ComfyUI 地址");
  const workflow = JSON.parse(JSON.stringify(workflowTemplate));
  workflow["105:104"].inputs.prompt = config.prompt || "";
  workflow["105:111"].inputs.value = Math.max(1, Number(config.duration) || 5);
  workflow["105:15"].inputs.noise_seed = Math.floor(Math.random() * 9007199254740991);
  workflow["115"].inputs.aspect_ratio = config.aspectRatio === "9:16" ? "9:16 (Portrait Widescreen)" : "16:9 (Widescreen)";

  const uploadImage = async (image: ReferenceList, role: "first" | "last") => {
    const match = image.base64.match(/^data:([^;]+);base64,(.+)$/s);
    if (!match) throw new Error(`${role === "first" ? "首帧" : "尾帧"}图片不是有效的 Base64 Data URL`);
    const mime = match[1];
    const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
    const filename = `toonflow_h3_${role}_${Date.now()}_${Math.floor(Math.random() * 100000)}.${extension}`;
    const form = new FormData();
    form.append("image", Buffer.from(match[2], "base64"), { filename, contentType: mime });
    form.append("type", "input");
    form.append("overwrite", "true");
    const upload = await axios.post(`${baseUrl}/upload/image`, form, { headers: form.getHeaders(), maxBodyLength: Infinity });
    const uploadedName = upload.data?.subfolder ? `${upload.data.subfolder}/${upload.data.name}` : upload.data?.name;
    if (!uploadedName) throw new Error(`ComfyUI 上传图片未返回文件名: ${JSON.stringify(upload.data)}`);
    logger(`[ComfyUI] ${role === "first" ? "首帧" : "尾帧"}已上传: ${uploadedName}`);
    return uploadedName;
  };

  const images = (config.referenceList || []).filter((item) => item.type === "image" && item.base64);
  const runtimeMode = (config as any).mode;
  const selectedMode = typeof runtimeMode === "string"
    ? runtimeMode
    : Array.isArray(runtimeMode)
      ? runtimeMode.find((mode: unknown) => typeof mode === "string") || ""
      : "";
  let firstImage: ReferenceList | undefined;
  let lastImage: ReferenceList | undefined;
  if (selectedMode === "startEndRequired" && images.length < 2) {
    throw new Error("首尾帧（两张必填）模式需要上传首帧和尾帧");
  }
  if (selectedMode === "endFrameOptional" && images.length < 1) {
    throw new Error("首尾帧（尾帧可选）模式至少需要上传首帧");
  }
  if (selectedMode === "startFrameOptional" && images.length < 1) {
    throw new Error("首尾帧（首帧可选）模式至少需要上传尾帧");
  }
  if (images.length >= 2) {
    firstImage = images[0];
    lastImage = images[1];
  } else if (images.length === 1 && selectedMode === "startFrameOptional") {
    lastImage = images[0];
  } else if (images.length === 1) {
    firstImage = images[0];
  }

  if (firstImage) {
    workflow["114"].inputs.image = await uploadImage(firstImage, "first");
    workflow["105:104"].inputs.first_frame = ["114", 0];
  } else {
    delete workflow["114"];
    delete workflow["105:104"].inputs.first_frame;
  }
  if (lastImage) {
    workflow["124"].inputs.image = await uploadImage(lastImage, "last");
    workflow["105:104"].inputs.last_frame = ["124", 0];
  } else {
    delete workflow["124"];
    delete workflow["105:104"].inputs.last_frame;
  }

  const clientId = crypto.randomUUID();
  logger(`[ComfyUI] 提交 MiniMax H3，时长 ${workflow["105:111"].inputs.value}s，画幅 ${config.aspectRatio}`);
  let queued: any;
  try {
    queued = await axios.post(`${baseUrl}/prompt`, { prompt: workflow, client_id: clientId });
  } catch (error: any) {
    const detail = error?.response?.data ? JSON.stringify(error.response.data) : error?.message;
    throw new Error(`ComfyUI 工作流提交失败: ${detail}`);
  }
  const promptId = queued.data?.prompt_id;
  if (!promptId) throw new Error(`ComfyUI 未返回 prompt_id: ${JSON.stringify(queued.data)}`);
  logger(`[ComfyUI] 任务 ID: ${promptId}`);

  const result = await pollTask(async () => {
    const response = await axios.get(`${baseUrl}/history/${encodeURIComponent(promptId)}`);
    const history = response.data?.[promptId];
    if (!history) return { completed: false };
    const status = history.status;
    if (status?.status_str === "error" || status?.completed === false) {
      const messages = status?.messages || [];
      const executionError = messages.find((item: any) => item?.[0] === "execution_error");
      return { completed: true, error: `ComfyUI 执行失败: ${JSON.stringify(executionError || status)}` };
    }
    if (!status?.completed) return { completed: false };

    const candidates: any[] = [];
    const collect = (value: any) => {
      if (!value) return;
      if (Array.isArray(value)) { value.forEach(collect); return; }
      if (typeof value !== "object") return;
      if (typeof value.filename === "string") candidates.push(value);
      Object.values(value).forEach(collect);
    };
    collect(history.outputs?.["92"] || history.outputs);
    const file = candidates.find((item) => /\.(mp4|webm|mov|mkv)$/i.test(item.filename)) || candidates[0];
    if (!file?.filename) return { completed: true, error: `ComfyUI 已完成，但没有找到视频输出: ${JSON.stringify(history.outputs)}` };
    const query = `filename=${encodeURIComponent(file.filename)}&subfolder=${encodeURIComponent(file.subfolder || "")}&type=${encodeURIComponent(file.type || "output")}`;
    return { completed: true, data: `${baseUrl}/view?${query}` };
  }, 3000, 30 * 60 * 1000);

  if (result.error) throw new Error(result.error);
  if (!result.data) throw new Error("ComfyUI 任务超时或没有返回视频");
  logger(`[ComfyUI] 下载生成视频: ${result.data}`);
  return await urlToBase64(result.data);
};

const ttsRequest = async (_config: TTSConfig, _model: TTSModel): Promise<string> => { throw new Error("此供应商不支持语音模型"); };

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
export {};
