import { cn } from '@/lib/utils';
import { PLATFORM_CONFIG } from '@/lib/constants';

interface PlatformIconProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showName?: boolean;
}

const sizeMap = {
  sm: 'h-8 w-8 text-base',
  md: 'h-10 w-10 text-lg',
  lg: 'h-12 w-12 text-xl',
  xl: 'h-16 w-16 text-2xl',
};

export function PlatformIcon({ platform, size = 'md', className, showName }: PlatformIconProps) {
  const config = PLATFORM_CONFIG[platform] ?? { name: platform, color: '#888888', emoji: '🎵' };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn(
          'flex items-center justify-center rounded-xl flex-shrink-0',
          sizeMap[size],
        )}
        style={{ backgroundColor: `${config.color}22`, border: `1px solid ${config.color}44` }}
        title={config.name}
      >
        <span>{config.emoji}</span>
      </div>
      {showName && (
        <span className="text-sm font-medium text-text-primary">{config.name}</span>
      )}
    </div>
  );
}
