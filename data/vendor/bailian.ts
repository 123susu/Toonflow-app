/**
 * Toonflow AI供应商模板 - 阿里云百炼
 * @version 2.0
 */

// ============================================================
// 类型定义
// ============================================================

type VideoMode =
  | "singleImage"
  | "startEndRequired"
  | "endFrameOptional"
  | "startFrameOptional"
  | "text"
  | (`videoReference:${number}` | `imageReference:${number}` | `audioReference:${number}`)[];

interface TextModel {
  name: string;
  modelName: string;
  type: "text";
  think: boolean;
}

interface ImageModel {
  name: string;
  modelName: string;
  type: "image";
  mode: ("text" | "singleImage" | "multiReference")[];
  associationSkills?: string;
}

interface VideoModel {
  name: string;
  modelName: string;
  type: "video";
  mode: VideoMode[];
  associationSkills?: string;
  audio: "optional" | false | true;
  durationResolutionMap: { duration: number[]; resolution: string[] }[];
}

interface TTSModel {
  name: string;
  modelName: string;
  type: "tts";
  voices: { title: string; voice: string }[];
}

interface VendorConfig {
  id: string;
  version: string;
  name: string;
  author: string;
  description?: string;
  icon?: string;
  inputs: {
    key: string;
    label: string;
    type: "text" | "password" | "url";
    required: boolean;
    placeholder?: string;
  }[];
  inputValues: Record<string, string>;
  models: (TextModel | ImageModel | VideoModel | TTSModel)[];
}

type ReferenceList =
  | { type: "image"; sourceType?: "base64"; base64: string }
  | { type: "audio"; sourceType?: "base64"; base64: string }
  | { type: "video"; sourceType?: "base64"; base64: string };

interface ImageConfig {
  prompt: string;
  referenceList?: Extract<ReferenceList, { type: "image" }>[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  referenceList?: ReferenceList[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
  referenceList?: Extract<ReferenceList, { type: "audio" }>[];
}

declare const logger: (msg: string) => void;
declare const exports: {
  vendor: VendorConfig;
  textRequest: (m: TextModel, t: boolean, tl: 0 | 1 | 2 | 3) => any;
  imageRequest: (c: ImageConfig, m: ImageModel) => Promise<string>;
  videoRequest: (c: VideoConfig, m: VideoModel) => Promise<string>;
  ttsRequest: (c: TTSConfig, m: TTSModel) => Promise<string>;
  checkForUpdates?: () => Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }>;
  updateVendor?: () => Promise<string>;
};

// ============================================================
// 供应商配置
// ============================================================

const vendor: VendorConfig = {
  id: "bailian",
  version: "2.0",
  author: "Toonflow",
  name: "阿里云百炼",
  description:
    "阿里云百炼官方接口，支持千问 Qwen-Image 3.0 系列文生图及 1-3 张参考图编辑。默认使用华北2（北京）公共域名，也可替换为业务空间专属域名。\n\n[前往百炼控制台](https://bailian.console.aliyun.com/)",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    {
      key: "baseUrl",
      label: "请求地址",
      type: "url",
      required: true,
      placeholder: "示例：https://dashscope.aliyuncs.com",
    },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://dashscope.aliyuncs.com",
  },
  models: [
    {
      name: "Qwen-Image 3.0 Pro",
      modelName: "qwen-image-3.0-pro",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      associationSkills: "文生图、1-3张参考图编辑，旗舰画质",
    },
    {
      name: "Qwen-Image 3.0",
      modelName: "qwen-image-3.0",
      type: "image",
      mode: ["text", "singleImage", "multiReference"],
      associationSkills: "文生图、1-3张参考图编辑，兼顾质量与速度",
    },
  ],
};

// ============================================================
// 辅助工具
// ============================================================

const getBaseUrl = (): string => vendor.inputValues.baseUrl.replace(/\/+$/, "");

const getHeaders = (): Record<string, string> => {
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "").trim();
  if (!apiKey) throw new Error("缺少阿里云百炼 API Key");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
};

const roundToMultipleOf8 = (value: number): number => Math.max(8, Math.round(value / 8) * 8);

/**
 * 百炼接口需要 width*height。Qwen-Image 3.0 最大为 2048*2048，
 * 因此项目中的 4K 档位按 2K 上限处理。
 */
const resolveImageSize = (size: ImageConfig["size"], aspectRatio: string): string => {
  const [rawWidth, rawHeight] = aspectRatio.split(":").map(Number);
  const ratio = rawWidth > 0 && rawHeight > 0 ? Math.max(1 / 8, Math.min(8, rawWidth / rawHeight)) : 1;
  const longEdge = size === "1K" ? 1024 : 2048;

  let width: number;
  let height: number;
  if (ratio >= 1) {
    width = longEdge;
    height = roundToMultipleOf8(longEdge / ratio);
  } else {
    height = longEdge;
    width = roundToMultipleOf8(longEdge * ratio);
  }

  // 官方要求总像素不少于 512*512。
  const minArea = 512 * 512;
  if (width * height < minArea) {
    const scale = Math.sqrt(minArea / (width * height));
    width = Math.min(2048, roundToMultipleOf8(width * scale));
    height = Math.min(2048, roundToMultipleOf8(height * scale));
  }

  return `${width}*${height}`;
};

const normalizeImage = (base64: string): string =>
  base64.startsWith("data:") || /^https?:\/\//i.test(base64) ? base64 : `data:image/png;base64,${base64}`;

const readErrorMessage = (data: any, fallback: string): string =>
  data?.message || data?.output?.message || data?.code || fallback;

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (_model: TextModel, _think: boolean, _thinkLevel: 0 | 1 | 2 | 3) => null;

const imageRequest = async (config: ImageConfig, model: ImageModel): Promise<string> => {
  const content: Array<{ image?: string; text?: string }> = (config.referenceList || [])
    .filter((item) => item.type === "image" && item.base64)
    .slice(0, 3)
    .map((item) => ({ image: normalizeImage(item.base64) }));
  content.push({ text: config.prompt });

  const body = {
    model: model.modelName,
    input: {
      messages: [{ role: "user", content }],
    },
    parameters: {
      prompt_extend: true,
      prompt_extend_mode: "direct",
      enable_thinking: true,
      n: 1,
      size: resolveImageSize(config.size, config.aspectRatio),
      watermark: false,
    },
  };

  logger(`[百炼图片生成] 模型=${model.modelName} 尺寸=${body.parameters.size} 参考图=${content.length - 1}`);
  const response = await fetch(`${getBaseUrl()}/api/v1/services/aigc/multimodal-generation/generation`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.code) {
    throw new Error(`百炼图片生成失败：${readErrorMessage(data, `${response.status} ${response.statusText}`)}`);
  }

  const imageUrl = data?.output?.choices?.[0]?.message?.content?.find((item: any) => item?.image)?.image;
  if (!imageUrl) throw new Error("百炼图片生成成功，但响应中没有图片地址");
  return imageUrl;
};

const videoRequest = async (_config: VideoConfig, _model: VideoModel): Promise<string> => "";

const ttsRequest = async (_config: TTSConfig, _model: TTSModel): Promise<string> => "";

const checkForUpdates = async (): Promise<{ hasUpdate: boolean; latestVersion: string; notice: string }> => ({
  hasUpdate: false,
  latestVersion: "2.0",
  notice: "",
});

const updateVendor = async (): Promise<string> => "";

// ============================================================
// 导出
// ============================================================

exports.vendor = vendor;
exports.textRequest = textRequest;
exports.imageRequest = imageRequest;
exports.videoRequest = videoRequest;
exports.ttsRequest = ttsRequest;
exports.checkForUpdates = checkForUpdates;
exports.updateVendor = updateVendor;

export {};
