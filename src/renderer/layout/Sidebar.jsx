import React from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RoutePath } from '../router/RouteManager';

export default function Sidebar() {
    const { t } = useTranslation();

    return (
        <div className="sidebar">
        <h2>Sidebar</h2>
        <ul>
            <li>
                <NavLink to={RoutePath.Transcription}>
                    {t('sidebar.transcription')}
                </NavLink>
            </li>

            <li>
                <NavLink to={RoutePath.Dashboard}>
                    {t('sidebar.dashBoard')}
                </NavLink>
            </li>

            <li>
                <NavLink to={RoutePath.AIChat}>
                    {t('sidebar.aiChat')}
                </NavLink>
            </li>

            <li>
                <NavLink to={RoutePath.Workspace}>
                    {t('sidebar.workspace')}
                </NavLink>
            </li>
            
            <li>
                <NavLink to={RoutePath.ModelManagement}>
                    {t('sidebar.modelManagement')}
                </NavLink>
            </li>

            <li>
                <NavLink to={RoutePath.Settings}>
                    {t('sidebar.settings')}
                </NavLink>
            </li>
        </ul>
        </div>
    );
}