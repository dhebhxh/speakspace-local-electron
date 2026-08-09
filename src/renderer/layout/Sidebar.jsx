import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <h2>SpeakSpace</h2>
      <nav aria-label="Primary navigation">
        <ul>
          <li>
            <NavLink to="/">{t('sidebar.transcription')}</NavLink>
          </li>

          <li>
            <NavLink to="/AIChat">{t('sidebar.aiChat')}</NavLink>
          </li>

          <li>
            <NavLink to="/Workspace">{t('sidebar.workspace')}</NavLink>
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
      </nav>
    </aside>
  );
}
