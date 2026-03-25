import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTheme, ThemeMode } from "./hooks/useTheme";
import { useI18n } from "./hooks/useI18n";
import { ChevronDown, Save, Trash2, Plus, Sun, Moon, Monitor } from "lucide-react";
import "./SettingsPanel.css";

interface AIModelConfig {
  endpoint: string;
  api_key: string | null;
  model: string;
  size?: string;
  use_custom_endpoint: boolean;
}

interface ModelPreset {
  name: string;
  endpoint: string;
  api_key: string | null;
  model: string;
  size?: string;
}

interface BackgroundRemovalConfig {
  enabled: boolean;
  api_type: "InferenceApi" | "Gradio";
  model_id: string;
  payload_template: string | null;
  api_token: string | null;
}

interface AppConfig {
  text_model: AIModelConfig;
  image_model: AIModelConfig;
  icon_storage: "InFolder" | "Centralized";
  text_presets: ModelPreset[];
  image_presets: ModelPreset[];
  parallel_generation: boolean;
  concurrency_limit: number;
  bg_removal: BackgroundRemovalConfig;
}

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsMessageType = "info" | "success" | "error";

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<SettingsMessageType>("info");
  const [appVersion, setAppVersion] = useState("...");
  const [activeTab, setActiveTab] = useState<"image" | "text" | "postprocess" | "appearance" | "about">("image");

  // 主题
  const { mode, setMode } = useTheme();

  // 国际化
  const { t, locale, setLocale } = useI18n();

  const setInfoMessage = (text: string) => {
    setMessageType("info");
    setMessage(text);
  };

  const setSuccessMessage = (text: string) => {
    setMessageType("success");
    setMessage(text);
  };

  const setErrorMessage = (text: string) => {
    setMessageType("error");
    setMessage(text);
  };

  // 图像模型配置
  const [imageApiKey, setImageApiKey] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [imageEndpoint, setImageEndpoint] = useState("");
  const [imageSize, setImageSize] = useState("1024x1024");

  // 文本模型配置
  const [textApiKey, setTextApiKey] = useState("");
  const [textModel, setTextModel] = useState("");
  const [textEndpoint, setTextEndpoint] = useState("");

  // 预设相关
  const [imagePresets, setImagePresets] = useState<ModelPreset[]>([]);
  const [textPresets, setTextPresets] = useState<ModelPreset[]>([]);
  const [selectedImagePreset, setSelectedImagePreset] = useState<string>("");
  const [selectedTextPreset, setSelectedTextPreset] = useState<string>("");
  const [showImagePresetDropdown, setShowImagePresetDropdown] = useState(false);
  const [showTextPresetDropdown, setShowTextPresetDropdown] = useState(false);

  // 自定义名称输入弹窗状态
  const [showNameInput, setShowNameInput] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [pendingPresetType, setPendingPresetType] = useState<"image" | "text" | null>(null);

  // 图标存储位置
  const [iconStorage, setIconStorage] = useState<"InFolder" | "Centralized">("InFolder");

  // 并行生成设置
  const [parallelGeneration, setParallelGeneration] = useState(false);
  const [concurrencyLimit, setConcurrencyLimit] = useState(3);

  // 背景移除设置
  const [bgRemovalEnabled, setBgRemovalEnabled] = useState(false);
  const [bgRemovalApiType, setBgRemovalApiType] = useState<"InferenceApi" | "Gradio">("Gradio");
  const [bgRemovalModelId, setBgRemovalModelId] = useState("briaai/BRIA-RMBG-2.0");
  const [bgRemovalTemplate, setBgRemovalTemplate] = useState<string | null>(null);
  const [bgRemovalApiToken, setBgRemovalApiToken] = useState("");
  const [bgTestingConnection, setBgTestingConnection] = useState(false);

  // 预设 Space 列表 (已验证可用)
  const BG_REMOVAL_PRESETS: { name: string; type: "Gradio" | "InferenceApi"; model: string; template: string | null }[] = [
    {
      name: "BRIA RMBG 2.0",
      type: "Gradio",
      model: "briaai/BRIA-RMBG-2.0",
      template: '{"data": ["{{IMAGE}}"], "api_name": "/image"}'
    },
    {
      name: "BRIA RMBG 1.4",
      type: "Gradio",
      model: "briaai/BRIA-RMBG-1.4",
      template: '{"data": ["{{IMAGE}}"], "api_name": "/predict"}'
    },
    {
      name: "not-lain/background-removal",
      type: "Gradio",
      model: "not-lain/background-removal",
      template: '{"data": ["{{IMAGE}}"], "api_name": "/png"}'
    },
    {
      name: "KenjieDec/RemBG",
      type: "Gradio",
      model: "KenjieDec/RemBG",
      template: '{"data": ["{{IMAGE}}", "isnet-general-use", 0, 0], "api_name": "/inference"}'
    },
  ];

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadPresets();
      loadAppVersion();
    }
  }, [isOpen]);

  const loadAppVersion = async () => {
    try {
      const version = await getVersion();
      setAppVersion(`v${version}`);
    } catch (error) {
      console.error("Failed to load app version:", error);
      setAppVersion("unknown");
    }
  };

  const loadConfig = async () => {
    try {
      const cfg = await invoke<AppConfig>("get_config");

      // 图像模型
      setImageApiKey(cfg.image_model?.api_key || "");
      setImageModel(cfg.image_model?.model || "");
      setImageEndpoint(cfg.image_model?.endpoint || "");
      setImageSize(cfg.image_model?.size || "1024x1024");

      // 文本模型
      setTextApiKey(cfg.text_model?.api_key || "");
      setTextModel(cfg.text_model?.model || "");
      setTextEndpoint(cfg.text_model?.endpoint || "");

      // 图标存储
      setIconStorage(cfg.icon_storage || "InFolder");

      // 并行生成
      setParallelGeneration(cfg.parallel_generation || false);
      setConcurrencyLimit(cfg.concurrency_limit || 3);

      // 背景移除
      if (cfg.bg_removal) {
        setBgRemovalEnabled(cfg.bg_removal.enabled || false);
        setBgRemovalApiType(cfg.bg_removal.api_type || "Gradio");
        setBgRemovalModelId(cfg.bg_removal.model_id || "briaai/BRIA-RMBG-2.0");
        setBgRemovalTemplate(cfg.bg_removal.payload_template || null);
        setBgRemovalApiToken(cfg.bg_removal.api_token || "");
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      setErrorMessage(t('settings.loadConfigFailed').replace('{error}', String(error)));
    }
  };

  const loadPresets = async () => {
    try {
      const imgPresets = await invoke<ModelPreset[]>("list_model_presets", { presetType: "image" });
      const txtPresets = await invoke<ModelPreset[]>("list_model_presets", { presetType: "text" });
      setImagePresets(imgPresets);
      setTextPresets(txtPresets);
    } catch (error) {
      console.error("Failed to load presets:", error);
    }
  };

  const buildCurrentConfig = (): AppConfig => ({
    text_model: {
      endpoint: textEndpoint.trim(),
      api_key: textApiKey.trim() || null,
      model: textModel.trim(),
      use_custom_endpoint: true,
    },
    image_model: {
      endpoint: imageEndpoint.trim(),
      api_key: imageApiKey.trim() || null,
      model: imageModel.trim(),
      size: imageSize,
      use_custom_endpoint: true,
    },
    icon_storage: iconStorage,
    text_presets: textPresets,
    image_presets: imagePresets,
    parallel_generation: parallelGeneration,
    concurrency_limit: concurrencyLimit,
    bg_removal: {
      enabled: bgRemovalEnabled,
      api_type: bgRemovalApiType,
      model_id: bgRemovalModelId,
      payload_template: bgRemovalTemplate,
      api_token: bgRemovalApiToken.trim() || null,
    },
  });

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      await invoke("save_config", { config: buildCurrentConfig() });
      setSuccessMessage(t('settings.configSaved'));
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      setErrorMessage(t('settings.saveFailed').replace('{error}', String(error)));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAsPreset = (type: "image" | "text") => {
    setPendingPresetType(type);
    setPresetNameInput("");
    setShowNameInput(true);
  };

  const confirmSavePreset = async () => {
    if (!pendingPresetType || !presetNameInput.trim()) return;

    const type = pendingPresetType;
    const name = presetNameInput.trim();

    const preset: ModelPreset = type === "image"
      ? { name, endpoint: imageEndpoint, api_key: imageApiKey || null, model: imageModel, size: imageSize }
      : { name, endpoint: textEndpoint, api_key: textApiKey || null, model: textModel };

    try {
      await invoke("save_config", { config: buildCurrentConfig() });
      await invoke("save_model_preset", { presetType: type, preset });
      setSuccessMessage(t('settings.presetSaved').replace('{name}', name));
      await loadPresets();
      if (type === "image") setSelectedImagePreset(name);
      else setSelectedTextPreset(name);

      // 关闭弹窗
      setShowNameInput(false);
      setPendingPresetType(null);
    } catch (error) {
      setErrorMessage(t('settings.presetSaveFailed').replace('{error}', String(error)));
    }
  };

  const handleDeletePreset = async (type: "image" | "text", name: string) => {
    if (!confirm(t('settings.deleteConfirm').replace('{name}', name))) return;

    try {
      await invoke("delete_model_preset", { presetType: type, name });
      setSuccessMessage(t('settings.presetDeleted'));
      await loadPresets();
      if (type === "image" && selectedImagePreset === name) setSelectedImagePreset("");
      if (type === "text" && selectedTextPreset === name) setSelectedTextPreset("");
    } catch (error) {
      setErrorMessage(t('settings.presetDeleteFailed').replace('{error}', String(error)));
    }
  };

  const handleSelectPreset = (type: "image" | "text", preset: ModelPreset) => {
    if (type === "image") {
      setImageEndpoint(preset.endpoint);
      setImageApiKey(preset.api_key || "");
      setImageModel(preset.model);
      setImageSize(preset.size || "1024x1024");
      setSelectedImagePreset(preset.name);
      setShowImagePresetDropdown(false);
    } else {
      setTextEndpoint(preset.endpoint);
      setTextApiKey(preset.api_key || "");
      setTextModel(preset.model);
      setSelectedTextPreset(preset.name);
      setShowTextPresetDropdown(false);
    }
  };

  const handleTestConnection = async (type: "image" | "text") => {
    const key = type === "image" ? imageApiKey : textApiKey;
    const endpoint = type === "image" ? imageEndpoint : textEndpoint;
    const model = type === "image" ? imageModel : textModel;

    if (!endpoint || !model) {
      setErrorMessage(t('settings.fillEndpointFirst'));
      return;
    }

    try {
      setInfoMessage(t('settings.testingConnection'));
      await invoke<string>("test_api_connection", {
        apiKey: key || "",
        endpoint,
        model
      });
      setSuccessMessage(t('settings.connectionSuccessSimple'));
    } catch (error) {
      const rawError = String(error);
      const displayedError = locale === 'zh-CN'
        ? rawError
            .split('Connection failed').join('连接失败')
            .split('Connection refused').join('连接被拒绝')
            .split('timed out').join('请求超时')
            .split('Network').join('网络')
            .split('HTTP').join('状态码')
        : rawError;
      setErrorMessage(t('settings.connectionFailed').replace('{error}', displayedError));
    }
  };

  const handleThemeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  if (!isOpen) return null;

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('settings.title')}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* 标签切换 */}
        <div className="settings-tabs">
          <button
            className={`tab-btn ${activeTab === "image" ? "active" : ""}`}
            onClick={() => setActiveTab("image")}
          >
            {t('settings.tabs.image')}
          </button>
          <button
            className={`tab-btn ${activeTab === "text" ? "active" : ""}`}
            onClick={() => setActiveTab("text")}
          >
            {t('settings.tabs.text')}
          </button>
          <button
            className={`tab-btn ${activeTab === "postprocess" ? "active" : ""}`}
            onClick={() => setActiveTab("postprocess")}
          >
            {t('settings.tabs.postprocess')}
          </button>
          <button
            className={`tab-btn ${activeTab === "appearance" ? "active" : ""}`}
            onClick={() => setActiveTab("appearance")}
          >
            {t('settings.tabs.appearance')}
          </button>
          <button
            className={`tab-btn ${activeTab === "about" ? "active" : ""}`}
            onClick={() => setActiveTab("about")}
          >
            {t('settings.tabs.about')}
          </button>
        </div>

        <div className="settings-content">
          {/* 图像模型配置 */}
          {activeTab === "image" && (
            <div className="model-config">
              <div className="config-section-header">
                <h3>{t('settings.imageModel.title')}</h3>
                <p className="config-desc">{t('settings.imageModel.desc')}</p>
              </div>

              {/* 预设选择器 */}
              <div className="preset-section">
                <div className="preset-selector">
                  <button
                    className="preset-trigger"
                    onClick={() => setShowImagePresetDropdown(!showImagePresetDropdown)}
                  >
                    <span>{selectedImagePreset || t('settings.imageModel.selectPreset')}</span>
                    <ChevronDown size={16} />
                  </button>
                  {showImagePresetDropdown && (
                    <div className="preset-dropdown">
                      {imagePresets.length === 0 ? (
                        <div className="preset-empty">{t('settings.imageModel.noPreset')}</div>
                      ) : (
                        imagePresets.map(p => (
                          <div key={p.name} className="preset-item">
                            <span onClick={() => handleSelectPreset("image", p)}>{p.name}</span>
                            <button className="preset-delete" onClick={() => handleDeletePreset("image", p.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button className="preset-save-btn" onClick={() => handleSaveAsPreset("image")} title={t('settings.imageModel.savePresetTitle')}>
                  <Plus size={16} />
                  <span>{t('settings.imageModel.savePreset')}</span>
                </button>
              </div>

              {/* Endpoint */}
              <div className="setting-group">
                <label>{t('settings.imageModel.endpoint')}</label>
                <input
                  type="text"
                  placeholder={t('settings.imageModel.endpointPlaceholder')}
                  value={imageEndpoint}
                  onChange={(e) => setImageEndpoint(e.target.value)}
                />
                <span className="field-hint">{t('settings.imageModel.endpointHint')}</span>
              </div>

              {/* API Key */}
              <div className="setting-group">
                <label>
                  {t('settings.imageModel.apiKey')}
                  {imageApiKey && <span className="key-status">✓</span>}
                </label>
                <input
                  type="password"
                  placeholder={t('settings.imageModel.apiKeyPlaceholder')}
                  value={imageApiKey}
                  onChange={(e) => setImageApiKey(e.target.value)}
                />
              </div>

              {/* Model */}
              <div className="setting-group">
                <label>{t('settings.imageModel.model')}</label>
                <input
                  type="text"
                  placeholder={t('settings.imageModel.modelPlaceholder')}
                  value={imageModel}
                  onChange={(e) => setImageModel(e.target.value)}
                />
              </div>

              {/* Size */}
              <div className="setting-group">
                <label>{t('settings.imageModel.size')}</label>
                <select
                  value={imageSize}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="settings-select"
                >
                  <option value="1024x1024">{t('settings.imageModel.sizeStandard')}</option>
                  <option value="512x512">{t('settings.imageModel.sizeFast')}</option>
                  <option value="256x256">{t('settings.imageModel.sizeSmall')}</option>
                </select>
              </div>

              <div className="test-connection-row">
                <button
                  className="btn secondary test-btn"
                  onClick={() => handleTestConnection("image")}
                  disabled={!imageEndpoint || !imageModel}
                >
                  {t('settings.imageModel.testConnection')}
                </button>
                {activeTab === "image" && message && <span className={`test-result ${messageType === "success" ? "test-result-success" : messageType === "error" ? "test-result-error" : "test-result-info"}`}>{message}</span>}
              </div>

              {/* 并行生成设置 */}
              <div className="config-section-header section-divider">
                <h3>{t('settings.iconStorage.title')}</h3>
                <p className="config-desc">{t('settings.iconStorage.desc')}</p>
              </div>

              <div className="setting-group">
                <label>{t('settings.iconStorage.mode')}</label>
                <select
                  value={iconStorage}
                  onChange={(e) => setIconStorage(e.target.value as "InFolder" | "Centralized")}
                  className="settings-select"
                >
                  <option value="InFolder">{t('settings.iconStorage.inFolder')}</option>
                  <option value="Centralized">{t('settings.iconStorage.centralized')}</option>
                </select>
                <span className="field-hint">
                  {iconStorage === "Centralized"
                    ? t('settings.iconStorage.centralizedHint')
                    : t('settings.iconStorage.inFolderHint')}
                </span>
              </div>

              <div className="config-section-header section-divider">
                <h3>{t('settings.generation.title')}</h3>
              </div>

              <div className="setting-group">
                <label>{t('settings.generation.mode')}</label>
                <div className="toggle-row">
                  <span className="toggle-label">{t('settings.generation.parallel')}</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={parallelGeneration}
                      onChange={(e) => setParallelGeneration(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p className="setting-hint">
                  {parallelGeneration ? t('settings.generation.parallelHint') : t('settings.generation.sequentialHint')}
                </p>
              </div>

              {parallelGeneration && (
                <div className="setting-group">
                  <label>{t('settings.generation.concurrency')}</label>
                  <div className="input-row">
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={concurrencyLimit}
                      onChange={(e) => setConcurrencyLimit(Math.max(1, Math.min(10, parseInt(e.target.value) || 3)))}
                      className="number-input"
                    />
                    <span className="input-hint">{t('settings.generation.concurrencyHint')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 文本模型配置 */}
          {activeTab === "text" && (
            <div className="model-config">
              <div className="config-section-header">
                <h3>{t('settings.textModel.title')}</h3>
                <p className="config-desc">{t('settings.textModel.desc')}</p>
              </div>

              {/* 预设选择器 */}
              <div className="preset-section">
                <div className="preset-selector">
                  <button
                    className="preset-trigger"
                    onClick={() => setShowTextPresetDropdown(!showTextPresetDropdown)}
                  >
                    <span>{selectedTextPreset || t('settings.textModel.selectPreset')}</span>
                    <ChevronDown size={16} />
                  </button>
                  {showTextPresetDropdown && (
                    <div className="preset-dropdown">
                      {textPresets.length === 0 ? (
                        <div className="preset-empty">{t('settings.textModel.noPreset')}</div>
                      ) : (
                        textPresets.map(p => (
                          <div key={p.name} className="preset-item">
                            <span onClick={() => handleSelectPreset("text", p)}>{p.name}</span>
                            <button className="preset-delete" onClick={() => handleDeletePreset("text", p.name)}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button className="preset-save-btn" onClick={() => handleSaveAsPreset("text")} title={t('settings.textModel.savePresetTitle')}>
                  <Plus size={16} />
                  <span>{t('settings.textModel.savePreset')}</span>
                </button>
              </div>

              {/* Endpoint */}
              <div className="setting-group">
                <label>{t('settings.textModel.endpoint')}</label>
                <input
                  type="text"
                  placeholder={t('settings.textModel.endpointPlaceholder')}
                  value={textEndpoint}
                  onChange={(e) => setTextEndpoint(e.target.value)}
                />
                <span className="field-hint">{t('settings.textModel.endpointHint')}</span>
              </div>

              {/* API Key */}
              <div className="setting-group">
                <label>
                  {t('settings.textModel.apiKey')}
                  {textApiKey && <span className="key-status">✓</span>}
                </label>
                <input
                  type="password"
                  placeholder={t('settings.textModel.apiKeyPlaceholder')}
                  value={textApiKey}
                  onChange={(e) => setTextApiKey(e.target.value)}
                />
              </div>

              {/* Model */}
              <div className="setting-group">
                <label>{t('settings.textModel.model')}</label>
                <input
                  type="text"
                  placeholder={t('settings.textModel.modelPlaceholder')}
                  value={textModel}
                  onChange={(e) => setTextModel(e.target.value)}
                />
              </div>

              <div className="test-connection-row">
                <button
                  className="btn secondary test-btn"
                  onClick={() => handleTestConnection("text")}
                  disabled={!textEndpoint || !textModel}
                >
                  {t('settings.textModel.testConnection')}
                </button>
                {activeTab === "text" && message && <span className={`test-result ${messageType === "success" ? "test-result-success" : messageType === "error" ? "test-result-error" : "test-result-info"}`}>{message}</span>}
              </div>
            </div>
          )}

          {/* 后处理设置 */}
          {activeTab === "postprocess" && (
            <div className="model-config">
              <div className="config-section-header">
                <h3>{t('settings.bgRemoval.title')}</h3>
                <p className="config-desc">{t('settings.bgRemoval.desc')}</p>
              </div>

              {/* 启用开关 */}
              <div className="setting-group">
                <label>{t('settings.bgRemoval.enable')}</label>
                <div className="toggle-row">
                  <span className="toggle-label">{bgRemovalEnabled ? t('settings.bgRemoval.enabled') : t('settings.bgRemoval.disabled')}</span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={bgRemovalEnabled}
                      onChange={(e) => setBgRemovalEnabled(e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p className="setting-hint">
                  {t('settings.bgRemoval.enableHint')}
                </p>
              </div>

              {bgRemovalEnabled && (
                <>
                  {/* 预设选择 */}
                  <div className="setting-group">
                    <label>{t('settings.bgRemoval.service')}</label>
                    <select
                      value={bgRemovalModelId}
                      onChange={(e) => {
                        const preset = BG_REMOVAL_PRESETS.find(p => p.model === e.target.value);
                        if (preset) {
                          setBgRemovalApiType("Gradio");
                          setBgRemovalModelId(preset.model);
                          setBgRemovalTemplate(preset.template);
                        }
                      }}
                      className="settings-select"
                    >
                      {BG_REMOVAL_PRESETS.map(p => (
                        <option key={p.model} value={p.model}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <span className="field-hint">
                      {t('settings.bgRemoval.serviceHint')}
                    </span>
                  </div>

                  {/* 测试连接 */}
                  <div className="test-connection-row">
                    <button
                      className="btn secondary test-btn"
                      onClick={async () => {
                        setBgTestingConnection(true);
                        setInfoMessage(t('settings.bgRemoval.testingMessage'));
                        try {
                          await invoke<string>("test_bg_removal_connection", {
                            apiType: "Gradio",
                            modelId: bgRemovalModelId,
                            payloadTemplate: bgRemovalTemplate,
                            apiToken: bgRemovalApiToken.trim() || null,
                          });
                          setSuccessMessage(t('settings.bgRemoval.connectionSuccessSimple'));
                        } catch (error) {
                          setErrorMessage(t('settings.testFailed').replace('{error}', String(error)));
                        } finally {
                          setBgTestingConnection(false);
                        }
                      }}
                      disabled={bgTestingConnection || !bgRemovalModelId}
                    >
                      {bgTestingConnection ? t('settings.bgRemoval.testing') : t('settings.bgRemoval.testConnection')}
                    </button>
                    {activeTab === "postprocess" && message && <span className={`test-result ${messageType === "success" ? "test-result-success" : messageType === "error" ? "test-result-error" : "test-result-info"}`}>{message}</span>}
                  </div>

                  <div className="config-hint config-hint-spaced">
                    {t('settings.bgRemoval.coldStartHint')}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 外观设置 */}
          {activeTab === "appearance" && (
            <div className="model-config">
              <div className="config-section-header">
                <h3>{t('settings.appearance.title')}</h3>
                <p className="config-desc">{t('settings.appearance.desc')}</p>
              </div>

              <div className="setting-group">
                <label>{t('settings.appearance.language')}</label>
                <div className="language-options">
                  <button
                    className={`language-btn ${locale === 'zh-CN' ? 'active' : ''}`}
                    onClick={() => setLocale('zh-CN')}
                    type="button"
                  >
                    {t('settings.appearance.chinese')}
                  </button>
                  <button
                    className={`language-btn ${locale === 'en' ? 'active' : ''}`}
                    onClick={() => setLocale('en')}
                    type="button"
                  >
                    {t('settings.appearance.english')}
                  </button>
                </div>
              </div>

              <div className="setting-group">
                <label>{t('settings.appearance.theme')}</label>
                <div className="theme-options">
                  <button
                    className={`theme-btn ${mode === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    <span className="theme-icon"><Sun size={16} strokeWidth={2} /></span>
                    <span className="theme-label">{t('settings.appearance.light')}</span>
                  </button>
                  <button
                    className={`theme-btn ${mode === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    <span className="theme-icon"><Moon size={16} strokeWidth={2} /></span>
                    <span className="theme-label">{t('settings.appearance.dark')}</span>
                  </button>
                  <button
                    className={`theme-btn ${mode === 'system' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('system')}
                  >
                    <span className="theme-icon"><Monitor size={16} strokeWidth={2} /></span>
                    <span className="theme-label">{t('settings.appearance.system')}</span>
                  </button>
                </div>
              </div>

              <div className="settings-actions settings-actions-compact">
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? t('settings.saving') : t('settings.saveButton')}
                </button>
                {activeTab === "appearance" && message && <span className={`test-result test-result-inline ${messageType === "success" ? "test-result-success" : messageType === "error" ? "test-result-error" : "test-result-info"}`}>{message}</span>}
              </div>
            </div>
          )}

          {/* 关于界面 */}
          {activeTab === "about" && (
            <div className="model-config">
              <div className="config-section-header">
                <h3>{t('settings.about.title')}</h3>
                <p className="config-desc">{t('settings.about.desc')}</p>
              </div>

              <div className="about-content">
                <div className="about-hero-section">
                  <div className="about-logo-wrapper">
                    <img src="/logo.png" alt="FolderPainter" className="app-main-logo" />
                  </div>
                  <div className="about-branding">
                    <h2 className="app-display-name">FolderPainter</h2>
                    <span className="app-display-version">{appVersion}</span>
                  </div>
                  <p className="app-tagline">{t('settings.about.description')}</p>
                </div>

                <div className="about-info-grid">
                  <div className="about-info-card author-card">
                    <div className="card-icon-box">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                    </div>
                    <div className="card-details">
                      <span className="card-label">{t('settings.about.author')}</span>
                      <strong className="card-value">qup1010</strong>
                    </div>
                  </div>

                  <div className="about-info-card project-card">
                    <div className="card-icon-box">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                      </svg>
                    </div>
                    <div className="card-details">
                      <span className="card-label">{t('settings.about.github')}</span>
                      <button
                        className="card-action-link"
                        onClick={async (e) => {
                          e.preventDefault();
                          await openUrl("https://github.com/qup1010/FolderPainter");
                        }}
                      >
                        {t('settings.about.openProject')}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="about-tech-section">
                  <h4 className="tech-section-title">{t('settings.about.techStack')}</h4>
                  <div className="tech-pills">
                    <span className="tech-pill tauri">Tauri v2</span>
                    <span className="tech-pill react">React</span>
                    <span className="tech-pill ts">TypeScript</span>
                    <span className="tech-pill rust">Rust</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 保存按钮 */}
          {(activeTab === "image" || activeTab === "text" || activeTab === "postprocess") && (
            <div className="settings-actions">
              <button className="btn primary" onClick={handleSave} disabled={saving}>
                <Save size={16} />
                {saving ? t('settings.saving') : t('settings.saveConfig')}
              </button>
            </div>
          )}
        </div>

        {/* 自定义名称输入弹窗 Overlay */}
        {showNameInput && (
          <div className="custom-prompt-overlay" onClick={() => setShowNameInput(false)}>
            <div className="custom-prompt-modal" onClick={(e) => e.stopPropagation()}>
              <h3>{t('settings.preset.saveTitle')}</h3>
              <div className="prompt-input-wrapper">
                <label>{t('settings.preset.nameLabel')}</label>
                <input
                  autoFocus
                  type="text"
                  value={presetNameInput}
                  onChange={(e) => setPresetNameInput(e.target.value)}
                  placeholder={t('settings.preset.namePlaceholder')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmSavePreset();
                    if (e.key === 'Escape') setShowNameInput(false);
                  }}
                />
              </div>
              <div className="prompt-actions">
                <button className="btn secondary" onClick={() => setShowNameInput(false)}>
                  {t('settings.preset.cancel')}
                </button>
                <button
                  className="btn primary"
                  onClick={confirmSavePreset}
                  disabled={!presetNameInput.trim()}
                >
                  {t('settings.preset.confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
