import { useEffect, useRef, useState, type ReactNode } from 'react';
import './menus.css';

export type ActionMenuItem = {
  label: string;
  description?: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
};

export function ActionMenu({
  label,
  heading,
  description,
  trigger,
  triggerClassName,
  className,
  placement = 'bottom',
  items,
}: {
  label: string;
  heading: string;
  description?: string;
  trigger: ReactNode;
  triggerClassName: string;
  className?: string;
  placement?: 'top' | 'bottom';
  items: ActionMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`action-menu ${placement === 'top' ? 'action-menu-top' : ''} ${className ?? ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        {trigger}
      </button>
      {open && (
        <section className="action-menu-panel" aria-label={heading}>
          <div className="action-menu-heading">
            <strong>{heading}</strong>
            {description && <p>{description}</p>}
          </div>
          <div role="menu">
            {items.map(item => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`action-menu-item ${item.destructive ? 'action-menu-item-destructive' : ''}`}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.icon && <span className="action-menu-item-icon" aria-hidden="true">{item.icon}</span>}
                <span className="action-menu-item-copy">
                  <strong>{item.label}</strong>
                  {item.description && <small>{item.description}</small>}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
