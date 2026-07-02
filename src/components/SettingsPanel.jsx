import React from 'react';
import { X, Type, Layout, AlignLeft } from 'lucide-react';

export default function SettingsPanel({ settings, onUpdateSettings, onClose }) {
  const fontFamilies = [
    { name: 'Lora (Serif)', value: "'Lora', Georgia, serif" },
    { name: 'Merriweather (Serif)', value: "'Merriweather', Georgia, serif" },
    { name: 'Georgia (Serif)', value: 'Georgia, serif' },
    { name: 'Inter (Sans-Serif)', value: "'Inter', sans-serif" },
    { name: 'System UI', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
    { name: 'Dyslexic-Friendly', value: "'OpenDyslexic', 'Dyslexie', sans-serif" }
  ];

  const themes = [
    { id: 'light', name: 'Light', bg: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
    { id: 'dark', name: 'Dark', bg: '#111827', text: '#f3f4f6', border: '#374151' },
    { id: 'sepia', name: 'Sepia', bg: '#faf5e6', text: '#433422', border: '#d4c4ac' },
    { id: 'charcoal', name: 'Charcoal', bg: '#27272a', text: '#f4f4f5', border: '#3f3f46' },
    { id: 'emerald', name: 'Emerald', bg: '#0b231e', text: '#e6f4ea', border: '#1e4632' }
  ];

  const updateSetting = (key, value) => {
    onUpdateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="settings-panel glass animate-fade">
      <div className="panel-header">
        <h2>Appearance Settings</h2>
        <button className="btn-icon" onClick={onClose} title="Close settings">
          <X size={20} />
        </button>
      </div>

      <div className="panel-body">
        {}
        <div className="setting-group">
          <label className="group-label">Theme</label>
          <div className="theme-selector-grid">
            {themes.map((theme) => (
              <button
                key={theme.id}
                className={`theme-btn ${settings.theme === theme.id ? 'active' : ''}`}
                style={{ 
                  backgroundColor: theme.bg, 
                  color: theme.text,
                  borderColor: theme.border
                }}
                onClick={() => updateSetting('theme', theme.id)}
                title={theme.name}
              >
                <span>{theme.name}</span>
                {settings.theme === theme.id && <div className="active-dot" style={{ backgroundColor: theme.text }}></div>}
              </button>
            ))}
          </div>
        </div>

        {}
        <div className="setting-group">
          <label className="group-label">
            <Type size={16} />
            Font Family
          </label>
          <select
            value={settings.fontFamily}
            onChange={(e) => updateSetting('fontFamily', e.target.value)}
            className="setting-select"
          >
            {fontFamilies.map((font) => (
              <option key={font.name} value={font.value}>
                {font.name}
              </option>
            ))}
          </select>
        </div>

        {}
        <div className="setting-group">
          <div className="group-label-with-value">
            <label className="group-label">Font Size</label>
            <span className="value-display">{settings.fontSize}px</span>
          </div>
          <div className="slider-control">
            <span className="slider-label-min">A</span>
            <input
              type="range"
              min="12"
              max="32"
              step="1"
              value={settings.fontSize}
              onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
              className="setting-slider"
            />
            <span className="slider-label-max">A</span>
          </div>
        </div>

        {}
        <div className="setting-group">
          <div className="group-label-with-value">
            <label className="group-label">
              <AlignLeft size={16} />
              Line Height
            </label>
            <span className="value-display">{settings.lineHeight}</span>
          </div>
          <input
            type="range"
            min="1.2"
            max="2.2"
            step="0.1"
            value={settings.lineHeight}
            onChange={(e) => updateSetting('lineHeight', parseFloat(e.target.value))}
            className="setting-slider"
          />
        </div>

        {}
        <div className="setting-group">
          <div className="group-label-with-value">
            <label className="group-label">Margin Width</label>
            <span className="value-display">{settings.margin}px</span>
          </div>
          <input
            type="range"
            min="10"
            max="120"
            step="5"
            value={settings.margin}
            onChange={(e) => updateSetting('margin', parseInt(e.target.value))}
            className="setting-slider"
          />
        </div>

        {}
        <div className="setting-group">
          <label className="group-label">
            <Layout size={16} />
            Layout Mode
          </label>
          <div className="layout-selector">
            <button
              className={`layout-btn ${settings.layout === 'auto' ? 'active' : ''}`}
              onClick={() => updateSetting('layout', 'auto')}
            >
              Automatic
            </button>
            <button
              className={`layout-btn ${settings.layout === 'single' ? 'active' : ''}`}
              onClick={() => updateSetting('layout', 'single')}
            >
              Single Page
            </button>
            <button
              className={`layout-btn ${settings.layout === 'double' ? 'active' : ''}`}
              onClick={() => updateSetting('layout', 'double')}
            >
              Two Pages
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
