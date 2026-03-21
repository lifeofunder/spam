import type { HTMLAttributes, ReactNode } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement> & { children: ReactNode };

export function Card({ className = '', children, ...rest }: CardProps) {
  return (
    <div className={`surface-card ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}

type CardHeaderProps = { title: string; description?: string; actions?: ReactNode };

export function CardHeader({ title, description, actions }: CardHeaderProps) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {description ? <p className="card-desc muted">{description}</p> : null}
      </div>
      {actions ? <div className="card-header-actions">{actions}</div> : null}
    </div>
  );
}
