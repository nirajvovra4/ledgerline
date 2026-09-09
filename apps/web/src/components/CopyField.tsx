import { useState } from 'react';
import { copyToClipboard } from '../lib/download';
import { Button } from './Button';

export function CopyField({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <input
        className="input input--sm"
        readOnly
        value={value}
        aria-label={label ?? 'Copy value'}
        onFocus={(e) => e.target.select()}
      />
      <Button
        size="sm"
        onClick={async () => {
          const ok = await copyToClipboard(value);
          setCopied(ok);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </div>
  );
}
