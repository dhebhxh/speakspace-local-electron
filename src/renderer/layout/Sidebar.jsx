import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RoutePath } from '../router/RouteManager';
import AppIcon from '../components/AppIcon';
import SpotlightSurface from '../components/SpotlightSurface';

const primaryItems = [
  { to: '/', end: true, labelKey: 'sidebar.transcription', icon: 'studio' },
  { to: RoutePath.Dashboard, labelKey: 'sidebar.dashBoard', icon: 'dashboard' },
  { to: '/Agent', labelKey: 'sidebar.agent', icon: 'agent' },
  { to: '/Workspace', labelKey: 'sidebar.workspace', icon: 'workspace' },
];

const systemItems = [
  { to: '/Workflow', labelKey: 'sidebar.workflow', icon: 'templates' },
  {
    to: '/ModelManagement',
    labelKey: 'sidebar.modelManagement',
    icon: 'models',
  },
  { to: '/Settings', labelKey: 'sidebar.settings', icon: 'settings' },
];

function NavigationItems({ items, t }) {
  return items.map((item) => (
    <li key={item.to}>
      <NavLink
        to={item.to}
        end={item.end}
        aria-label={t(item.labelKey)}
        title={t(item.labelKey)}
      >
        <AppIcon name={item.icon} size={19} />
        <span>{t(item.labelKey)}</span>
      </NavLink>
    </li>
  ));
}

export default function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-mark" aria-hidden="true">
          SS
        </span>
        <span className="sidebar-brand-copy">
          <strong>SpeakSpace</strong>
          <small>{t('sidebar.tagline')}</small>
        </span>
      </div>
      <nav aria-label={t('sidebar.navigation')}>
        <span className="sidebar-group-label">{t('sidebar.group.work')}</span>
        <ul>
          <NavigationItems items={primaryItems} t={t} />
        </ul>
        <span className="sidebar-group-label sidebar-group-label--system">
          {t('sidebar.group.system')}
        </span>
        <ul>
          <NavigationItems items={systemItems} t={t} />
        </ul>
      </nav>
      <SpotlightSurface
        className="sidebar-local-status"
        spotlightColor="rgba(56, 210, 188, 0.18)"
      >
        <span className="sidebar-local-status__title">
          <i aria-hidden="true" />
          {t('sidebar.local')}
        </span>
        <small>{t('sidebar.local.detail')}</small>
      </SpotlightSurface>
    </aside>
  );
}
