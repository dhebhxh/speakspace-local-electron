import { CSSProperties, PointerEvent, ReactNode, useRef } from 'react';
import './SpotlightSurface.css';

type SpotlightSurfaceProps = {
  children: ReactNode;
  className: string;
  spotlightColor: string;
};

type SpotlightStyle = CSSProperties & {
  '--spotlight-color'?: string;
};

/** Adapted from React Bits SpotlightCard for one restrained status surface. */
export default function SpotlightSurface({
  children,
  className,
  spotlightColor,
}: SpotlightSurfaceProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' || !surfaceRef.current) return;
    const rect = surfaceRef.current.getBoundingClientRect();
    surfaceRef.current.style.setProperty(
      '--spotlight-x',
      `${event.clientX - rect.left}px`,
    );
    surfaceRef.current.style.setProperty(
      '--spotlight-y',
      `${event.clientY - rect.top}px`,
    );
  };

  return (
    <div
      className={`spotlight-surface ${className}`.trim()}
      onPointerMove={handlePointerMove}
      ref={surfaceRef}
      style={{ '--spotlight-color': spotlightColor } as SpotlightStyle}
    >
      {children}
    </div>
  );
}
