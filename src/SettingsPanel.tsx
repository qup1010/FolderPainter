import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useTheme, ThemeMode } from "./hooks/useTheme";
import { useI18n, setLocale, getLocale } from "./hooks/useI18n";
import { ChevronDown, Save, Trash2, Plus } from "lucide-react";
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

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"image" | "text" | "postprocess" | "appearance" | "about">("image");

  // 主题
  const { mode, setMode } = useTheme();

  // 国际化
  const { t } = useI18n();

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
  // 注意：api_name 仅用于后端确定调用哪个端点，实际请求体是 Gradio 标准格式 {"data": [...]}
  const BG_REMOVAL_PRESETS = [
    {
      name: "BRIA RMBG 2.0",
      type: "Gradio",
      model: "briaai/BRIA-RMBG-2.0",
      // /api/image 端点，参数: image
      template: '{"data": ["{{IMAGE}}"], "api_name": "/image"}'
    },
    {
      name: "BRIA RMBG 1.4",
      type: "Gradio",
      model: "briaai/BRIA-RMBG-1.4",
      // /api/predict 端点，参数: 单个图片
      template: '{"data": ["{{IMAGE}}"], "api_name": "/predict"}'
    },
    {
      name: "not-lain/background-removal",
      type: "Gradio",
      model: "not-lain/background-removal",
      // /api/png 端点，参数: f (文件)
      template: '{"data": ["{{IMAGE}}"], "api_name": "/png"}'
    },
    {
      name: "KenjieDec/RemBG",
      type: "Gradio",
      model: "KenjieDec/RemBG",
      // /api/inference 端点，参数: file, model, x, y
      template: '{"data": ["{{IMAGE}}", "isnet-general-use", 0, 0], "api_name": "/inference"}'
    },
  ];

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadPresets();
    }
  }, [isOpen]);

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
      setMessage(t('settings.loadConfigFailed').replace('{error}', String(error)));
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

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const newConfig: AppConfig = {
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
      };

      await invoke("save_config", { config: newConfig });
      setMessage(t('settings.configSaved'));
      setTimeout(() => setMessage(""), 2000);
    } catch (error) {
      setMessage(t('settings.saveFailed').replace('{error}', String(error)));
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
      await invoke("save_model_preset", { presetType: type, preset });
      setMessage(t('settings.presetSaved').replace('{name}', name));
      await loadPresets();
      if (type === "image") setSelectedImagePreset(name);
      else setSelectedTextPreset(name);

      // 关闭弹窗
      setShowNameInput(false);
      setPendingPresetType(null);
    } catch (error) {
      setMessage(t('settings.presetSaveFailed').replace('{error}', String(error)));
    }
  };

  const handleDeletePreset = async (type: "image" | "text", name: string) => {
    if (!confirm(t('settings.deleteConfirm').replace('{name}', name))) return;

    try {
      await invoke("delete_model_preset", { presetType: type, name });
      setMessage(t('settings.presetDeleted'));
      await loadPresets();
      if (type === "image" && selectedImagePreset === name) setSelectedImagePreset("");
      if (type === "text" && selectedTextPreset === name) setSelectedTextPreset("");
    } catch (error) {
      setMessage(t('settings.presetDeleteFailed').replace('{error}', String(error)));
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
      setMessage(t('settings.fillEndpointFirst'));
      return;
    }

    try {
      setMessage(t('settings.testingConnection'));
      const result = await invoke<string>("test_api_connection", {
        apiKey: key || "",
        endpoint,
        model
      });
      setMessage(t('settings.connectionSuccess').replace('{result}', result));
    } catch (error) {
      setMessage(t('settings.connectionFailed').replace('{error}', String(error)));
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
                {activeTab === "image" && message && <span className="test-result">{message}</span>}
              </div>

              {/* 并行生成设置 */}
              <div className="config-section-header" style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
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
                {activeTab === "text" && message && <span className="test-result">{message}</span>}
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
                        setMessage(t('settings.bgRemoval.testingMessage'));
                        try {
                          const result = await invoke<string>("test_bg_removal_connection", {
                            apiType: "Gradio",
                            modelId: bgRemovalModelId,
                            payloadTemplate: bgRemovalTemplate,
                            apiToken: bgRemovalApiToken.trim() || null,
                          });
                          setMessage(result);
                        } catch (error) {
                          setMessage(t('settings.testFailed').replace('{error}', String(error)));
                        } finally {
                          setBgTestingConnection(false);
                        }
                      }}
                      disabled={bgTestingConnection || !bgRemovalModelId}
                    >
                      {bgTestingConnection ? t('settings.bgRemoval.testing') : t('settings.bgRemoval.testConnection')}
                    </button>
                    {activeTab === "postprocess" && message && <span className="test-result">{message}</span>}
                  </div>

                  <div className="config-hint" style={{ marginTop: '1rem' }}>
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
                <label>{t('settings.appearance.theme')}</label>
                <div className="theme-options">
                  <button
                    className={`theme-btn ${mode === 'light' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('light')}
                  >
                    <span className="theme-icon">☀️</span>
                    <span className="theme-label">{t('settings.appearance.light')}</span>
                  </button>
                  <button
                    className={`theme-btn ${mode === 'dark' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('dark')}
                  >
                    <span className="theme-icon">🌙</span>
                    <span className="theme-label">{t('settings.appearance.dark')}</span>
                  </button>
                  <button
                    className={`theme-btn ${mode === 'system' ? 'active' : ''}`}
                    onClick={() => handleThemeChange('system')}
                  >
                    <span className="theme-icon">💻</span>
                    <span className="theme-label">{t('settings.appearance.system')}</span>
                  </button>
                </div>
              </div>

              {/* 保存按钮 */}
              <div className="settings-actions" style={{ marginTop: '1rem' }}>
                <button className="btn primary" onClick={handleSave} disabled={saving}>
                  <Save size={16} />
                  {saving ? t('settings.saving') : t('settings.saveButton')}
                </button>
                {activeTab === "appearance" && message && <span className="test-result" style={{ marginLeft: '1rem' }}>{message}</span>}
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
                <div className="about-logo">
                  <img src="/logo.png" alt="FolderPainter" className="app-logo" />
                  <h2 className="app-name">FolderPainter</h2>
                  <p className="app-version">v0.1.0</p>
                </div>

                <div className="about-description">
                  <p>{t('settings.about.description')}</p>
                </div>

                <div className="about-links">
                  <a
                    href="https://github.com/qup1010/FolderPainter"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="about-link"
                    onClick={async (e) => {
                      e.preventDefault();
                      await openUrl("https://github.com/qup1010/FolderPainter");
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                    </svg>
                    <span>{t('settings.about.github')}</span>
                  </a>
                </div>

                <div className="about-author">
                  <p>{t('settings.about.author')}: <strong>qup1010</strong></p>
                </div>

                <div className="about-tech">
                  <p className="tech-label">{t('settings.about.techStack')}</p>
                  <div className="tech-tags">
                    <span className="tech-tag">Tauri v2</span>
                    <span className="tech-tag">React</span>
                    <span className="tech-tag">TypeScript</span>
                    <span className="tech-tag">Rust</span>
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
