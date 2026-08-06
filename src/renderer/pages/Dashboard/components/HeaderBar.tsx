import React from 'react';

interface HeaderBarProps {
    title?: string;
    onCreateNote?: () => void;
    onNavigateSettings?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
    title = "儀表板",
    onCreateNote = () => console.log("Create Note clicked"),
    onNavigateSettings = () => console.log("Settings clicked")
}) => {
    return (
        <header className="dashboard-header">
            <div className="header-main-row">
                <div className="header-title-container">
                    <h1 className="header-title">
                        {title}
                    </h1>
                </div>

                <div className="header-actions">
                    <button className="btn-secondary" onClick={onNavigateSettings}>
                        <span>⚙️ 設置</span>
                    </button>
                    <button className="btn-primary create-note-btn" onClick={onCreateNote}>
                        <span>+ 新建筆記</span>
                    </button>
                </div>
            </div>
        </header>
    );
};
