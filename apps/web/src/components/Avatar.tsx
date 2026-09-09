import { initials } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export function Avatar({
  name,
  size = 'md',
  square,
  outline,
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  square?: boolean;
  outline?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'avatar',
        size !== 'md' && `avatar--${size}`,
        square && 'avatar--square',
        outline && 'avatar--outline',
        className,
      )}
      aria-hidden="true"
      title={name}
    >
      {initials(name)}
    </span>
  );
}
