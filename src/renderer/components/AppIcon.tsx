import { ReactElement } from 'react';

export type AppIconName =
  | 'studio'
  | 'agent'
  | 'workspace'
  | 'templates'
  | 'models'
  | 'settings'
  | 'appearance'
  | 'language'
  | 'guide';

type AppIconProps = {
  name: AppIconName;
  size: number;
};

const paths: Record<AppIconName, ReactElement> = {
  studio: <path d="M4 13v-2M8 17V7M12 20V4M16 17V7M20 13v-2" />,
  agent: (
    <>
      <rect x="5" y="7" width="14" height="11" rx="3" />
      <path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M9 4h6" />
    </>
  ),
  workspace: <path d="M3.5 7.5h6l2-2h9v13h-17z" />,
  templates: (
    <>
      <path d="M6 3.5h9l3 3v14H6z" />
      <path d="M15 3.5v4h4M9 12h6M9 16h6" />
    </>
  ),
  models: (
    <>
      <path d="m12 3 8 4.5-8 4.5-8-4.5z" />
      <path d="m4 7.5v9L12 21l8-4.5v-9M12 12v9" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
    </>
  ),
  appearance: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  language: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 12h17M12 3c2.2 2.5 3.3 5.5 3.3 9s-1.1 6.5-3.3 9c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3z" />
    </>
  ),
  guide: (
    <>
      <path d="M5 4.5h11a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
      <path d="M8 4.5v15M11 9h5M11 13h5" />
    </>
  ),
};

export default function AppIcon({ name, size }: AppIconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      >
        {paths[name]}
      </g>
    </svg>
  );
}
