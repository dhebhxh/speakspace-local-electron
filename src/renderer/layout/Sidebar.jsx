import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <div className="sidebar">
      <h2>Sidebar</h2>
      {/* 现有问题说明：App.css 的导航样式以 `.sidebar nav` 为选择器，但这里缺少 nav 包裹，因此相关布局和激活态样式不会生效。 */}
      <ul>
        <li>
          <NavLink to="/Transcription">{t('sidebar.transcription')}</NavLink>
        </li>

        <li>
          <NavLink to="/AIChat">{t('sidebar.aiChat')}</NavLink>
        </li>

        <li>
          {/* 首页直接进入工作空间。 / Open Workspace directly from the home route. */}
          <NavLink to="/" end>
            {t('sidebar.workspace')}
          </NavLink>
        </li>

        <li>
          <NavLink to="/ModelManagement">
            {t('sidebar.modelManagement')}
          </NavLink>
        </li>

        <li>
          <NavLink to="/Settings">{t('sidebar.settings')}</NavLink>
        </li>
      </ul>
    </div>
  );
}
