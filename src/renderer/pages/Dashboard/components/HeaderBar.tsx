import React from 'react';
import { useTranslation } from 'react-i18next';

interface HeaderBarProps {
    title?: string;
    onCreateNote?: () => void;
    onNavigateSettings?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
    title,
    onCreateNote = () => console.log("Create Note clicked"),
    onNavigateSettings = () => console.log("Settings clicked")
}) => {
    const { t } = useTranslation();

    return (
        <header className="dashboard-header">
            <div className="header-main-row">
                <div className="header-title-container">
                    <h1 className="header-title">
                        {title ?? t('dashboard.title')}
                    </h1>
                </div>

                <div className="header-actions">
                    <button className="btn-primary create-note-btn" onClick={onCreateNote}>
                        <span>+ {t('dashboard.action.newNote')}</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
