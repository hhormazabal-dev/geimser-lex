import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className='empty-state'>
      <Icon className='empty-state-icon' />
      <h3 className='empty-state-title'>{title}</h3>
      <p className='empty-state-description'>{description}</p>
      {action && (
        <div className='mt-6'>
          <Button onClick={action.onClick}>
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
