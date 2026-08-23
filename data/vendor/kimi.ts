/**
 * Toonflow AI供应商模板 - 月之暗面 Kimi
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

interface ImageConfig {
  prompt: string;
  imageBase64: string[];
  size: "1K" | "2K" | "4K";
  aspectRatio: `${number}:${number}`;
}

interface VideoConfig {
  duration: number;
  resolution: string;
  aspectRatio: "16:9" | "9:16";
  prompt: string;
  imageBase64?: string[];
  audio?: boolean;
  mode: VideoMode[];
}

interface TTSConfig {
  text: string;
  voice: string;
  speechRate: number;
  pitchRate: number;
  volume: number;
}

// ============================================================
// 全局声明
// ============================================================

declare const createOpenAICompatible: any;
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
  id: "kimi",
  version: "2.0",
  author: "Toonflow",
  name: "月之暗面 Kimi",
  description:
    "月之暗面 Kimi 官方 API，支持 Kimi K3 的长上下文、视觉理解、工具调用和深度推理。\n\n[前往开放平台](https://platform.kimi.com/)",
  icon: "",
  inputs: [
    { key: "apiKey", label: "API密钥", type: "password", required: true },
    {
      key: "baseUrl",
      label: "请求地址",
      type: "url",
      required: true,
      placeholder: "示例：https://api.moonshot.cn/v1",
    },
  ],
  inputValues: {
    apiKey: "",
    baseUrl: "https://api.moonshot.cn/v1",
  },
  models: [{ name: "Kimi K3", modelName: "kimi-k3", type: "text", think: true }],
};

// ============================================================
// 适配器函数
// ============================================================

const textRequest = (model: TextModel, think: boolean, thinkLevel: 0 | 1 | 2 | 3) => {
  if (!vendor.inputValues.apiKey) throw new Error("缺少API Key");
  const apiKey = vendor.inputValues.apiKey.replace(/^Bearer\s+/i, "");

  // Kimi K3 始终启用思考。关闭思考时使用 low 作为最接近的低延迟模式。
  const effortMap: Record<0 | 1 | 2 | 3, "low" | "high" | "max"> = {
    0: "low",
    1: "low",
    2: "high",
    3: "max",
  };
  const reasoningEffort = think ? effortMap[thinkLevel] : "low";

  return createOpenAICompatible({
    baseURL: vendor.inputValues.baseUrl.replace(/\/+$/, ""),
    apiKey,
    fetch: async (url: string, options?: RequestInit) => {
      const rawBody = JSON.parse((options?.body as string) ?? "{}");
      return await fetch(url, {
        ...options,
        body: JSON.stringify({
          ...rawBody,
          reasoning_effort: reasoningEffort,
        }),
      });
    },
  }).chatModel(model.modelName);
};

const imageRequest = async (_config: ImageConfig, _model: ImageModel): Promise<string> => "";

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
